import { Color, DataTexture, DataUtils, HalfFloatType, LinearFilter, LinearSRGBColorSpace, MathUtils, RepeatWrapping, RGBAFormat, Vector3, Vector4, type Material } from 'three';
import { EXPANSE, type LightingLook, type SkyLayers } from './parameters';
import { forSkyDirection, SKY_HEIGHT, SKY_WIDTH } from './sky-field';

const skySize = [96, 64] as const;
const luminance = ([r, g, b]: number[]) => r * 0.2126 + g * 0.7152 + b * 0.0722;

// Daylight terms from Three.js r187 Sky.js (MIT, © 2010–2026 three.js authors).
// Evaluate the model when the lighting look changes and share its graded color
// between the sky and fog.
// https://github.com/mrdoob/three.js/blob/r187/examples/jsm/objects/Sky.js
export function createAtmosphere(look: LightingLook) {
  const start = performance.now();
  const { sky: originalSky, looks, sunTarget, fogNear, fogFar, distantFadeDepth, distantFog } = EXPANSE.atmosphere;
  const { air, sunPosition } = looks[look];
  const sky = air?.sky ?? originalSky;
  const sunDirection = new Vector3(...sunPosition).sub(new Vector3(...sunTarget)).normalize();
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
    const radiance = rayleigh.map((r, channel) => {
      const m = mie[channel];
      const extinction = Math.exp(-(8400 * r + 1250 * m) * airMass);
      const light = sunEnergy * (r * rayleighPhase + m * miePhase) / (r + m);
      const inscatter = (light * (1 - extinction)) ** 1.5
        * MathUtils.lerp(1, Math.sqrt(light * extinction), lowSun);
      return (inscatter + 0.1 * extinction) * 0.04 * originalSky.exposure;
    });
    let exposed: number[];
    if (air) {
      // Grade linear radiance first, then use a common shoulder to preserve hue.
      const gray = luminance(radiance);
      const muted = radiance.map(value => MathUtils.lerp(gray, value, sky.saturation));
      const shoulder = 1 / (0.54 + Math.max(...muted));
      exposed = muted.map(value => value * shoulder);
    } else {
      // Preserve the J3 control, including its per-channel compression.
      const compressed = radiance.map(value => value / (1 + value));
      const gray = luminance(compressed);
      exposed = compressed.map(value => MathUtils.lerp(gray, value, sky.saturation));
    }
    const rise = MathUtils.smoothstep(height, 0, sky.horizonTintHeight);
    return exposed.map((value, channel) => (
      MathUtils.lerp(sky.blackLevel, sky.whiteLevel, value)
      * MathUtils.lerp(sky.horizonTint[channel], 1, rise)
    ));
  };

  const [width, height] = skySize;
  const analytic = new Float32Array(width * height * 3);
  for (let row = 0; row < height; row++) {
    const elevation = (row / (height - 1)) ** 2;
    for (let col = 0; col < width; col++) {
      analytic.set(evaluate(elevation, 2 * col / (width - 1) - 1), (row * width + col) * 3);
    }
  }

  // Reproject the small analytic LUT onto the same angular grid as the cloud field.
  const base = new Float32Array(SKY_WIDTH * SKY_HEIGHT * 4);
  forSkyDirection((offset, x, y, z) => {
    const cosine = x * sunDirection.x + y * sunDirection.y + z * sunDirection.z;
    const u = (0.5 + 0.5 * MathUtils.clamp(cosine, -1, 1)) * (width - 1);
    const col = Math.min(Math.floor(u), width - 2);
    const v = Math.sqrt(y) * (height - 1);
    const lower = Math.min(Math.floor(v), height - 2);
    const low = 3 * (lower * width + col), high = low + width * 3;
    for (let channel = 0; channel < 3; channel++) {
      base[offset + channel] = MathUtils.lerp(
        MathUtils.lerp(analytic[low + channel], analytic[low + 3 + channel], u - col),
        MathUtils.lerp(analytic[high + channel], analytic[high + 3 + channel], u - col),
        v - lower,
      );
    }
  });
  const data = new Uint16Array(base.length).fill(DataUtils.toHalfFloat(1));
  const texture = new DataTexture(data, SKY_WIDTH, SKY_HEIGHT, RGBAFormat, HalfFloatType);
  texture.wrapS = RepeatWrapping;
  texture.colorSpace = LinearSRGBColorSpace;
  texture.minFilter = texture.magFilter = LinearFilter;
  const [r, gHorizon, b] = evaluate(0, -sunDirection.z);
  return {
    base, data, generationMs: performance.now() - start,
    horizon: new Color(r, gHorizon, b),
    fogRange: air?.fogRange ?? [fogNear, fogFar] as const,
    nearMist: air?.nearMist,
    distantFade: new Vector4(...distantFadeDepth, ...(air?.distantFog ?? distantFog)),
    uniforms: {
      airSky: { value: texture },
      airHorizonHaze: { value: true },
    },
  };
}

export type Atmosphere = ReturnType<typeof createAtmosphere>;

export function bakeSkyRadiance(atmosphere: Atmosphere, field: Uint8Array, layers: Omit<SkyLayers, 'micro'>) {
  const start = performance.now();
  const { broadTint, fieldFade, maxOpticalDepth, cloudLightLow, cloudLightHigh,
    hazeTint, hazeHeight, hazeOpacity } = EXPANSE.atmosphere.skyFinish;
  const { data, base, uniforms } = atmosphere;
  // The fourth mask channel holds envelope × filament, so only 256 optical depths are possible.
  const opacityByDensity = layers.veil
    ? Float32Array.from({ length: 256 }, (_, density) => -Math.expm1(-maxOpticalDepth * density / 255))
    : null;
  for (let row = 0; row < SKY_HEIGHT; row++) {
    const elevation = (row / (SKY_HEIGHT - 1)) ** 2;
    const broadFade = layers.broad ? MathUtils.smoothstep(elevation, ...fieldFade) : 0;
    const cloudHue = MathUtils.smoothstep(elevation, 0.12, 0.54);
    const cloudLight = cloudLightLow.map((low, channel) => MathUtils.lerp(low, cloudLightHigh[channel], cloudHue));
    const haze = layers.haze ? hazeOpacity * (1 - MathUtils.smoothstep(elevation, 0, hazeHeight)) : 0;
    const offset = row * SKY_WIDTH * 4;
    for (let i = offset; i < offset + SKY_WIDTH * 4; i += 4) {
      const broad = (2 * field[i] / 255 - 1) * broadFade;
      const opacity = opacityByDensity ? opacityByDensity[field[i + 3]] : 0;
      for (let channel = 0; channel < 3; channel++) {
        const sky = base[i + channel] + broad * broadTint[channel];
        const clouded = MathUtils.lerp(sky, cloudLight[channel], opacity);
        data[i + channel] = DataUtils.toHalfFloat(MathUtils.lerp(clouded, hazeTint[channel], haze));
      }
    }
  }
  uniforms.airHorizonHaze.value = layers.haze;
  uniforms.airSky.value.needsUpdate = true;
  return performance.now() - start;
}

export const sampleSky = /* glsl */ `
  uniform sampler2D airSky;

  vec2 skyDirectionUv(vec3 direction) {
    float u = 0.5 + atan(direction.x, -direction.z + 1e-7) / 6.28318530718;
    float row = sqrt(clamp(direction.y, 0.0, 1.0)) * float(${SKY_HEIGHT - 1}) + 0.5;
    return vec2(u, row / float(${SKY_HEIGHT}));
  }

  vec3 skyRadiance(vec3 direction) {
    return texture2D(airSky, skyDirectionUv(direction)).rgb;
  }
`;

export function applyAerialPerspective(material: Material, atmosphere: Atmosphere, distant = false) {
  const compile = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey();
  const nearMist = distant ? null : atmosphere.nearMist;
  const { hazeHeight, distantHaze } = EXPANSE.atmosphere.skyFinish;
  material.dithering = true;
  material.customProgramCacheKey = () => `${key}:aerial-perspective:${distant}:${Boolean(nearMist)}`;
  material.onBeforeCompile = (shader, renderer) => {
    compile(shader, renderer);
    Object.assign(shader.uniforms, atmosphere.uniforms);
    if (distant) shader.uniforms.airDistantFade = { value: atmosphere.distantFade };
    if (nearMist) shader.uniforms.airNearMist = { value: new Vector3(...nearMist) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <fog_pars_vertex>', '#include <fog_pars_vertex>\nvarying vec3 vAirRay;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvAirRay = transpose(mat3(viewMatrix)) * mvPosition.xyz;');
    // The lookup already contains the sky exposure. Mix after surface tone mapping
    // and before converting both colors to the display's transfer function.
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <fog_pars_fragment>', `
        #include <fog_pars_fragment>
        varying vec3 vAirRay;
        ${sampleSky}
        ${distant ? 'uniform vec4 airDistantFade; uniform bool airHorizonHaze;' : ''}
        ${nearMist ? 'uniform vec3 airNearMist;' : ''}
      `)
      .replace('#include <colorspace_fragment>', `
        #ifdef USE_FOG
          float airDepth = length(vAirRay);
          float fogAmount = ${distant
            ? 'mix(airDistantFade.z, airDistantFade.w, smoothstep(airDistantFade.x, airDistantFade.y, airDepth))'
            : 'smoothstep(fogNear, fogFar, airDepth)'};
          ${nearMist ? `
            float mist = airNearMist.z * smoothstep(airNearMist.x, airNearMist.y, airDepth);
            fogAmount = mix(fogAmount, 1.0, mist);
          ` : ''}
          if (fogAmount > 0.0) {
            vec3 ray = vAirRay / airDepth;
            ${distant ? `
              if (airHorizonHaze) {
                float haze = 1.0 - smoothstep(0.0, float(${hazeHeight}), ray.y);
                fogAmount = mix(fogAmount, 1.0, haze * float(${distantHaze}));
              }
            ` : ''}
            gl_FragColor.rgb = mix(gl_FragColor.rgb, skyRadiance(ray), fogAmount);
          }
        #endif
        #include <colorspace_fragment>
      `)
      .replace('#include <fog_fragment>', '');
  };
}
