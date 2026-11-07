import { Color, DataTexture, DataUtils, HalfFloatType, LinearFilter, MathUtils, RGBAFormat, Vector2, Vector3, type Material } from 'three';
import { EXPANSE, type LightingLook } from './parameters';

const skySize = [96, 64] as const;

// Daylight terms from Three.js r187 Sky.js (MIT, © 2010–2026 three.js authors).
// Evaluate the model when the lighting look changes and share its graded color
// between the sky and fog.
// https://github.com/mrdoob/three.js/blob/r187/examples/jsm/objects/Sky.js
export function createAtmosphere(look: LightingLook) {
  const { sky, looks, sunTarget } = EXPANSE.atmosphere;
  const sunDirection = new Vector3(...looks[look].sunPosition).sub(new Vector3(...sunTarget)).normalize();
  const sunEnergy = 1000 * Math.max(0, 1 - Math.exp((Math.acos(sunDirection.y) - 1.6110731556870734) / 1.5));
  const lowSun = (1 - sunDirection.y) ** 5;
  const rayleigh = [5.804543e-6, 1.356291e-5, 3.026590e-5].map(value => value * sky.rayleigh);
  const mie = [1.839992e14, 2.779802e14, 4.079048e14].map(value =>
    value * (0.434 * 0.2e-17 * sky.turbidity * sky.mieCoefficient));
  const g = sky.mieDirectionalG;

  const evaluate = (height: number, cosTheta: number) => {
    const zenith = MathUtils.radToDeg(Math.acos(height));
    const airMass = 1 / (height + 0.15 * (93.885 - zenith) ** -1.253);
    const rayleighPhase = (3 / (16 * Math.PI)) * (1 + (0.5 + 0.5 * cosTheta) ** 2);
    const miePhase = (1 - g * g) / (4 * Math.PI * (1 - 2 * g * cosTheta + g * g) ** 1.5);
    const exposed = rayleigh.map((r, channel) => {
      const m = mie[channel];
      const extinction = Math.exp(-(8400 * r + 1250 * m) * airMass);
      const light = sunEnergy * (r * rayleighPhase + m * miePhase) / (r + m);
      const inscatter = (light * (1 - extinction)) ** 1.5
        * MathUtils.lerp(1, Math.sqrt(light * extinction), lowSun);
      const radiance = (inscatter + 0.1 * extinction) * 0.04 * sky.exposure;
      return radiance / (1 + radiance);
    });
    const luma = exposed[0] * 0.2126 + exposed[1] * 0.7152 + exposed[2] * 0.0722;
    const rise = MathUtils.smoothstep(height, 0, sky.horizonTintHeight);
    return exposed.map((value, channel) => (
      MathUtils.lerp(sky.blackLevel, sky.whiteLevel, MathUtils.lerp(luma, value, sky.saturation))
      * MathUtils.lerp(sky.horizonTint[channel], 1, rise)
    ));
  };

  const [width, height] = skySize;
  const data = new Uint16Array(width * height * 4);
  for (let row = 0; row < height; row++) {
    const elevation = (row / (height - 1)) ** 2;
    for (let col = 0; col < width; col++) {
      const rgb = evaluate(elevation, 2 * col / (width - 1) - 1);
      data.set([...rgb.map(DataUtils.toHalfFloat), DataUtils.toHalfFloat(1)], (row * width + col) * 4);
    }
  }
  const texture = new DataTexture(data, width, height, RGBAFormat, HalfFloatType);
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  const [r, gHorizon, b] = evaluate(0, -sunDirection.z);
  return {
    horizon: new Color(r, gHorizon, b),
    uniforms: {
      airSky: { value: texture },
      airSun: { value: sunDirection },
      airTexel: { value: new Vector2(1 / width, 1 / height) },
    },
  };
}

export type Atmosphere = ReturnType<typeof createAtmosphere>;

export const sampleSky = /* glsl */ `
  uniform sampler2D airSky;
  uniform vec3 airSun;
  uniform vec2 airTexel;

  vec3 skyRadiance(vec3 direction) {
    vec2 domain = vec2(clamp(dot(direction, airSun), -1.0, 1.0) * 0.5 + 0.5, sqrt(max(direction.y, 0.0)));
    return texture2D(airSky, domain * (1.0 - airTexel) + 0.5 * airTexel).rgb;
  }
`;

export function applyAerialPerspective(material: Material, atmosphere: Atmosphere, distant = false) {
  const compile = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey();
  const { distantFadeDepth, distantFog } = EXPANSE.atmosphere;
  material.dithering = true;
  material.customProgramCacheKey = () => `${key}:aerial-perspective:${distant}`;
  material.onBeforeCompile = (shader, renderer) => {
    compile(shader, renderer);
    Object.assign(shader.uniforms, atmosphere.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <fog_pars_vertex>', '#include <fog_pars_vertex>\nvarying vec3 vAirRay;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvAirRay = transpose(mat3(viewMatrix)) * mvPosition.xyz;');
    // The lookup already contains the sky exposure. Mix after surface tone mapping
    // and before converting both colors to the display's transfer function.
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <fog_pars_fragment>', `#include <fog_pars_fragment>\nvarying vec3 vAirRay;\n${sampleSky}`)
      .replace('#include <colorspace_fragment>', `
        #ifdef USE_FOG
          float airDepth = length(vAirRay);
          float fogAmount = ${distant
            ? `mix(float(${distantFog[0]}), float(${distantFog[1]}), smoothstep(float(${distantFadeDepth[0]}), float(${distantFadeDepth[1]}), airDepth))`
            : 'smoothstep(fogNear, fogFar, airDepth)'};
          if (fogAmount > 0.0) {
            gl_FragColor.rgb = mix(gl_FragColor.rgb, skyRadiance(vAirRay / airDepth), fogAmount);
          }
        #endif
        #include <colorspace_fragment>
      `)
      .replace('#include <fog_fragment>', '');
  };
}
