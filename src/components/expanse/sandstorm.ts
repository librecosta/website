import { Color, Vector2, Vector3 } from 'three';
import { EXPANSE } from './parameters';
import { createStormNoise } from './storm-noise';

const { veil } = EXPANSE.sandstorm;

export function createSandstorm() {
  const { daylight, sunTarget } = EXPANSE.atmosphere;
  return {
    stormNoise: { value: createStormNoise(EXPANSE.seed) },
    stormTime: { value: 0 },
    stormWind: { value: new Vector2(...EXPANSE.aeolian.wind).normalize() },
    stormSun: { value: new Vector3(...daylight.sunPosition).sub(new Vector3(...sunTarget)).normalize() },
    stormDebug: { value: false },
    veilStrength: { value: 1 },
    veilColor: { value: new Color(veil.tint) },
  };
}

export type SandstormUniforms = ReturnType<typeof createSandstorm>;

export function sandstormAir(mobile: boolean) {
  const nearSamples = veil.samples[mobile ? 'mobile' : 'desktop'];
  return /* glsl */ `
    uniform highp sampler3D stormNoise;
    uniform vec3 stormSun, veilColor;
    uniform vec2 stormWind;
    uniform float stormTime, veilStrength;
    uniform bool stormDebug;

    vec3 windSpace(vec3 p) {
      return vec3(dot(p.xz, stormWind), p.y, dot(p.xz, vec2(-stormWind.y, stormWind.x)));
    }

    // Returns optical depth and the shade of the sand that actually scatters
    // toward the eye, composited front-to-back through the short near volume.
    vec2 cameraStorm(vec3 ray, float surfaceDistance) {
      if (stormDebug || veilStrength < 0.001) return vec2(0.0, 1.0);
      float end = min(surfaceDistance, ${veil.range[1].toFixed(1)});
      float last = 0.0, optical = 0.0, radiance = 0.0, transmit = 1.0;
      for (int i = 0; i < ${nearSamples}; i++) {
        float t = float(i + 1) / ${nearSamples.toFixed(1)};
        float next = end * t * (0.44 + 0.56 * t);
        float depth = (last + next) * 0.5;
        vec3 p = windSpace(cameraPosition + ray * depth);
        vec3 phase = (p - vec3(stormTime * ${veil.windSpeed.toFixed(1)}, 0.0, 0.0)) / vec3(475.0, 210.0, 292.0);
        vec2 warp = texture(stormNoise, (p - vec3(stormTime * 149.0, -stormTime * 10.5, 0.0))
          / vec3(967.0, 410.0, 531.0)).rg;
        vec2 eddy = texture(stormNoise, phase + vec3(0.14 * warp.y, 0.22 * warp.x, 0.18 * warp.y)).rg;
        float body = smoothstep(0.19, 0.83, eddy.x * 0.72 + warp.x * 0.28);
        float density = mix(0.51, 1.50, body) * (1.0 - smoothstep(${veil.range[0].toFixed(1)}, ${veil.range[1].toFixed(1)}, depth));
        float tau = (next - last) * density * ${veil.extinction.toFixed(4)} * veilStrength;
        float pass = exp(-tau);
        float shade = mix(0.72, 1.30, smoothstep(0.18, 0.82, warp.y * 0.32 + eddy.x * 0.42 + eddy.y * 0.26));
        radiance += transmit * (1.0 - pass) * shade;
        transmit *= pass;
        optical += tau;
        last = next;
      }
      return vec2(optical, radiance / max(1.0 - transmit, 0.0001));
    }

    float sandstormOpticalDepth(vec3 ray, float depth) {
      return cameraStorm(ray, depth).x;
    }

    vec3 scatterSandstorm(vec3 base, vec3 cameraToSurface) {
      if (stormDebug || veilStrength < 0.001) return base;
      float depth = length(cameraToSurface);
      vec3 ray = cameraToSurface / max(depth, 0.001);
      vec2 local = cameraStorm(ray, depth);
      float sunward = 0.5 + 0.5 * dot(ray, stormSun);
      vec3 tint = veilColor * local.y * mix(0.83, 1.14, sunward);
      return mix(tint, base, exp(-local.x));
    }
  `;
}
