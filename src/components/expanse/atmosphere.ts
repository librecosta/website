import { Color, DataTexture, DataUtils, HalfFloatType, LinearFilter, LinearSRGBColorSpace, MathUtils, RepeatWrapping, RGBAFormat, Vector3, Vector4, type Material } from 'three';
import { EXPANSE, type SkyView } from './parameters';
import { forSkyDirection, SKY_HEIGHT, SKY_WIDTH } from './sky-field';
import { sandstormAir, type SandstormUniforms } from './sandstorm';

const skySize = [96, 64] as const;
const luminance = ([r, g, b]: number[]) => r * 0.2126 + g * 0.7152 + b * 0.0722;

// Daylight terms from Three.js r187 Sky.js (MIT, © 2010–2026 three.js authors).
// Share the graded daylight model between the sky and fog.
// https://github.com/mrdoob/three.js/blob/r187/examples/jsm/objects/Sky.js
export function createAtmosphere() {
  const start = performance.now();
  const { sky, daylight, sunTarget, fogNear, fogFar, distantFadeDepth, distantFog } = EXPANSE.atmosphere;
  const sunDirection = new Vector3(...daylight.sunPosition).sub(new Vector3(...sunTarget)).normalize();
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
      return (inscatter + 0.1 * extinction) * 0.04 * sky.exposure;
    });
    const compressed = radiance.map(value => value / (1 + value));
    const gray = luminance(compressed);
    const exposed = compressed.map(value => MathUtils.lerp(gray, value, sky.saturation));
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
  // Stack visible sky and cloud-free air light in one texture. Each pass still uses one lookup.
  const data = new Uint16Array(2 * base.length).fill(DataUtils.toHalfFloat(1));
  const texture = new DataTexture(data, SKY_WIDTH, 2 * SKY_HEIGHT, RGBAFormat, HalfFloatType);
  texture.wrapS = RepeatWrapping;
  texture.colorSpace = LinearSRGBColorSpace;
  texture.minFilter = texture.magFilter = LinearFilter;
  const [r, gHorizon, b] = evaluate(0, -sunDirection.z);
  return {
    base, data, generationMs: performance.now() - start,
    horizon: new Color(r, gHorizon, b),
    fogRange: [fogNear, fogFar] as const,
    distantFade: new Vector4(...distantFadeDepth, ...distantFog),
    uniforms: {
      airSky: { value: texture },
    },
  };
}

export type Atmosphere = ReturnType<typeof createAtmosphere>;

export function bakeSkyRadiance(atmosphere: Atmosphere, field: Uint8Array, view: SkyView) {
  const start = performance.now();
  const { fieldValue, fieldWarmth, fieldMist, maxOpticalDepth, cloudLightLow, cloudLightHigh,
    hazeTint, hazeHeight, hazeOpacity, horizonGlow, zenithGrade } = EXPANSE.atmosphere.skyFinish;
  const { data, base, uniforms } = atmosphere;
  const main = view === 'color' || view === 'main';
  const secondary = view === 'color' || view === 'secondary';
  const opacityByDensity = Float32Array.from({ length: 256 }, (_, density) => -Math.expm1(-maxOpticalDepth * density / 255));
  for (let row = 0; row < SKY_HEIGHT; row++) {
    const elevation = (row / (SKY_HEIGHT - 1)) ** 2;
    const cloudHue = MathUtils.smoothstep(elevation, 0.12, 0.54);
    const cloudLight = cloudLightLow.map((low, channel) => MathUtils.lerp(low, cloudLightHigh[channel], cloudHue));
    const halo = 1 - MathUtils.smoothstep(elevation, ...horizonGlow.haloRange);
    const core = 1 - MathUtils.smoothstep(elevation, 0, horizonGlow.coreHeight);
    const glow = horizonGlow.haloLift.map((lift, channel) => lift * halo + horizonGlow.coreLift[channel] * core);
    const hazeColor = hazeTint.map((tint, channel) => MathUtils.lerp(tint, horizonGlow.lowHazeTint[channel], halo));
    const horizonHaze = hazeOpacity * (1 - MathUtils.smoothstep(elevation, 0, hazeHeight));
    const zenith = MathUtils.smoothstep(elevation, ...zenithGrade.elevationRange);
    const zenithScale = zenithGrade.colorScale.map(scale => MathUtils.lerp(1, scale, zenith));
    const offset = row * SKY_WIDTH * 4;
    for (let i = offset; i < offset + SKY_WIDTH * 4; i += 4) {
      const brightness = (2 * field[i] / 255 - 1) * fieldValue;
      const thermal = 2 * field[i + 3] / 255 - 1;
      const haze = horizonHaze + (1 - horizonHaze) * fieldMist * field[i + 3] / 255;
      const density = Math.min(255, (main ? field[i + 1] : 0) + (secondary ? field[i + 2] : 0));
      const opacity = opacityByDensity[density];
      for (let channel = 0; channel < 3; channel++) {
        const clear = base[i + channel] + brightness + thermal * fieldWarmth[channel];
        const lift = glow[channel];
        // Roll the added light off near white to preserve color around bright scattering.
        const sky = clear + (lift > 0 ? lift * (1 - MathUtils.smoothstep(clear, 0.865, 1)) : lift);
        const clouded = MathUtils.lerp(sky, cloudLight[channel], opacity);
        // Grade the composited sky so the high veils and their background deepen together.
        data[i + channel] = DataUtils.toHalfFloat(MathUtils.lerp(clouded, hazeColor[channel], haze) * zenithScale[channel]);
        data[base.length + i + channel] = DataUtils.toHalfFloat(MathUtils.lerp(sky, hazeColor[channel], haze));
      }
    }
  }
  uniforms.airSky.value.needsUpdate = true;
  return performance.now() - start;
}

export const sampleSky = /* glsl */ `
  uniform sampler2D airSky;

  vec2 skyDirectionUv(vec3 direction) {
    float u = 0.5 + atan(direction.x, -direction.z + 1e-7) / 6.28318530718;
    float row = sqrt(clamp(direction.y, 0.0, 1.0)) * float(${SKY_HEIGHT - 1}) + 0.5;
    // Keep linear filtering inside the selected half, including the horizon and zenith rows.
    return vec2(u, row / float(${2 * SKY_HEIGHT}));
  }

  vec3 skyRadiance(vec3 direction) {
    return texture2D(airSky, skyDirectionUv(direction)).rgb;
  }

  vec3 airRadiance(vec3 direction) {
    return texture2D(airSky, skyDirectionUv(direction) + vec2(0.0, 0.5)).rgb;
  }
`;

const cityHaze = EXPANSE.futureCity.haze;
const glslVec3 = (vector: readonly number[]) => `vec3(${vector.map(value => value.toFixed(1)).join(', ')})`;
export const skylineCloud = /* glsl */ `
  // Approximate the optical depth through a broad, world-space Gaussian bank.
  float cloudIntegral(float t) {
    return 0.5 + 0.5 * t * inversesqrt(0.7 + t * t);
  }

  vec3 scatterSkylineCloud(vec3 color, vec3 ray, float depth) {
    vec3 radius = ${glslVec3(cityHaze.crownRadius)};
    vec3 origin = (cameraPosition - ${glslVec3(cityHaze.crownCenter)}) / radius;
    vec3 direction = ray / radius;
    float rate = length(direction);
    vec3 axis = direction / rate;
    float center = dot(origin, axis);
    vec3 lateral = origin - axis * center;
    lateral.y += 0.17 * sin(lateral.x * 5.6 + 0.7) + 0.09 * sin(lateral.x * 13.8);
    float column = exp(-dot(lateral, lateral)) * (cloudIntegral(center + depth * rate) - cloudIntegral(center));
    float haze = 1.0 - exp(-${cityHaze.crownDensity.toFixed(2)} * column);
    vec3 mist = mix(airRadiance(ray), vec3(0.77, 0.82, 0.89), 0.22);
    return mix(color, mist, haze);
  }
`;

export function applyAerialPerspective(material: Material, atmosphere: Atmosphere, distant = false,
  storm?: SandstormUniforms, mobile = false, skyline = false) {
  const compile = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey();
  const { hazeHeight, distantHaze } = EXPANSE.atmosphere.skyFinish;
  material.dithering = true;
  material.customProgramCacheKey = () => `${key}:aerial-perspective:${distant}:storm:${!!storm}:${mobile}:${skyline}`;
  material.onBeforeCompile = (shader, renderer) => {
    compile(shader, renderer);
    Object.assign(shader.uniforms, atmosphere.uniforms, storm);
    if (distant) shader.uniforms.airDistantFade = { value: atmosphere.distantFade };
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
        ${skyline ? skylineCloud : ''}
        ${storm ? sandstormAir(mobile) : ''}
        ${distant ? 'uniform vec4 airDistantFade;' : ''}
      `)
      .replace('#include <colorspace_fragment>', `
        #ifdef USE_FOG
          float airDepth = length(vAirRay);
          float fogAmount = ${distant
            ? 'mix(airDistantFade.z, airDistantFade.w, smoothstep(airDistantFade.x, airDistantFade.y, airDepth))'
            : 'smoothstep(fogNear, fogFar, airDepth)'};
          if (fogAmount > 0.0) {
            vec3 ray = vAirRay / airDepth;
            ${distant ? `
              float haze = 1.0 - smoothstep(0.0, float(${hazeHeight}), ray.y);
              float lowHaze = haze * float(${distantHaze});
            ` : skyline ? 'float lowHaze = 0.0;' : ''}
            ${skyline ? `
              float foothill = 1.0 - smoothstep(0.0, ${cityHaze.foothillHeight.toFixed(1)}, cameraPosition.y + vAirRay.y);
              // The dense city bank grades into the horizon haze as the surface rises.
              lowHaze = mix(lowHaze, ${cityHaze.foothillDensity.toFixed(2)}, foothill);
            ` : ''}
            ${distant || skyline ? 'fogAmount = mix(fogAmount, 1.0, lowHaze);' : ''}
            vec3 scatter = airRadiance(ray);
            ${skyline ? `
              scatter = mix(scatter, vec3(0.48, 0.54, 0.63), 0.16 * (1.0 - foothill));
            ` : ''}
            gl_FragColor.rgb = mix(gl_FragColor.rgb, scatter, fogAmount);
            ${skyline ? 'gl_FragColor.rgb = scatterSkylineCloud(gl_FragColor.rgb, ray, airDepth);' : ''}
          }
        #endif
        ${storm ? 'gl_FragColor.rgb = scatterSandstorm(gl_FragColor.rgb, vAirRay);' : ''}
        #include <colorspace_fragment>
      `)
      .replace('#include <fog_fragment>', '');
  };
}
