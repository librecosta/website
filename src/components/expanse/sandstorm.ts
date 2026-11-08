import { Color, DataTexture, LinearFilter, RGBAFormat, Vector3 } from 'three';
import { EXPANSE } from './parameters';
import { createSandTransport } from './sand-transport';
import { sanctuaryInfluence, type SanctuaryField } from './sanctuary-field';
import { valueNoise } from './world';

type Ground = (x: number, z: number) => number;
const { suspended, refuge } = EXPANSE.sandstorm;
const wind = EXPANSE.aeolian.wind;
const windLength = Math.hypot(...wind);
const wx = wind[0] / windLength, wz = wind[1] / windLength;

export function sanctuaryTransport(field: SanctuaryField, height: Ground) {
  return {
    ...refuge,
    influence: (x: number, z: number) => sanctuaryInfluence(field, x, height(x, z), z),
    crosswind: (x: number, z: number) => Math.tanh(4 * (
      -(x - field.center.x) * wz / field.radius.x + (z - field.center.z) * wx / field.radius.z)),
  };
}

function suspendedSupply(x: number, z: number) {
  // Wind-aligned, stationary source terrain. Transport, rather than noise animation,
  // moves the suspended dust through this pattern and carries it across the domain.
  const along = x * wx + z * wz, across = -x * wz + z * wx;
  const strata = 0.74 * valueNoise(along / 2050, across / 720, EXPANSE.seed + 187)
    + 0.26 * valueNoise(along / 1140, across / 390, EXPANSE.seed + 331);
  return 0.17 + 0.74 * (0.5 + 0.5 * strata) ** 1.45;
}

export function createSandstorm(ground: Ground, surface: Ground, field: SanctuaryField | null, mobile: boolean) {
  const quality = mobile ? 'mobile' : 'desktop';
  const [nx, nz] = suspended.resolution[quality];
  const [x0, x1, z0, z1] = suspended.bounds;
  const width = x1 - x0, depth = z1 - z0;
  const layerHeight: Ground = (x, z) => ground(x, z) + suspended.airHeight;
  const obstacles: Ground = (x, z) => Math.max(layerHeight(x, z), surface(x, z));
  const simulation = createSandTransport({ ...EXPANSE.windMotion, ...suspended, resolution: suspended.resolution[quality] },
    wind, layerHeight, obstacles, { sediment: suspendedSupply, background: suspended.background,
      sanctuary: field ? sanctuaryTransport(field, layerHeight) : undefined });
  const data = new Uint8Array(nx * nz * 4);
  const fieldTexture = new DataTexture(data, nx, nz, RGBAFormat);
  fieldTexture.minFilter = fieldTexture.magFilter = LinearFilter;
  let groundMin = Infinity, groundMax = -Infinity;
  const heights = new Float32Array(nx * nz);
  for (let i = 0; i < heights.length; i++) {
    const x = x0 + (i % nx + 0.5) * width / nx, z = z0 + (Math.floor(i / nx) + 0.5) * depth / nz;
    heights[i] = ground(x, z);
    groundMin = Math.min(groundMin, heights[i]);
    groundMax = Math.max(groundMax, heights[i]);
    data[i * 4 + 3] = Math.round(suspendedSupply(x, z) * 255);
  }
  const groundRange = groundMax - groundMin || 1;
  for (let i = 0; i < heights.length; i++) {
    // Encode height linearly across two channels so hardware bilinear filtering remains valid.
    const code = Math.round((heights[i] - groundMin) / groundRange * 65535);
    data[i * 4 + 1] = code >>> 8;
    data[i * 4 + 2] = code & 255;
  }
  const sun = new Vector3(...EXPANSE.atmosphere.daylight.sunPosition)
    .sub(new Vector3(...EXPANSE.atmosphere.sunTarget)).normalize();
  const uniforms = {
    stormField: { value: fieldTexture }, stormBoundsMin: { value: new Vector3(x0, groundMin - 30, z0) },
    stormBoundsMax: { value: new Vector3(x1, groundMax + suspended.topHeight, z1) },
    stormHeightRange: { value: groundRange }, stormSun: { value: sun },
    stormColor: { value: new Color(suspended.tint) }, stormDebug: { value: false },
  };
  function upload() {
    for (let i = 0; i < heights.length; i++) {
      data[i * 4] = Math.round(255 * Math.sqrt(Math.min(1, simulation.concentration[i] / suspended.referenceDensity)));
    }
    fieldTexture.needsUpdate = true;
  }
  upload();
  return { simulation, uniforms, upload };
}

export type Sandstorm = ReturnType<typeof createSandstorm>;
export type SandstormUniforms = Sandstorm['uniforms'];

export function sandstormAir(mobile: boolean) {
  const samples = suspended.samples[mobile ? 'mobile' : 'desktop'];
  return /* glsl */ `
    uniform sampler2D stormField;
    uniform vec3 stormBoundsMin, stormBoundsMax, stormColor, stormSun;
    uniform float stormHeightRange;
    uniform bool stormDebug;

    float sandstormOpticalDepth(vec3 ray, float surfaceDistance) {
      vec3 inv = mix(vec3(-1.0), vec3(1.0), step(vec3(0.0), ray)) / max(abs(ray), vec3(0.00001));
      vec3 a = (stormBoundsMin - cameraPosition) * inv, b = (stormBoundsMax - cameraPosition) * inv;
      vec3 entry = min(a, b), exit = max(a, b);
      float start = max(0.0, max(entry.x, max(entry.y, entry.z)));
      float end = min(exit.x, min(exit.y, exit.z));
      if (start >= min(end, surfaceDistance)) return 0.0;

      vec2 span = stormBoundsMax.xz - stormBoundsMin.xz;
      float optical = 0.0, last = start;
      for (int i = 0; i < ${samples}; i++) {
        float t = float(i + 1) / ${samples.toFixed(1)};
        float next = min(surfaceDistance, mix(start, end, t * (0.60 + 0.40 * t)));
        float ds = next - last;
        vec3 point = cameraPosition + ray * (last + 0.5 * ds);
        vec2 uv = (point.xz - stormBoundsMin.xz) / span;
        vec4 column = texture2D(stormField, uv);
        float ground = stormBoundsMin.y + 30.0 + stormHeightRange * dot(column.gb, vec2(256.0, 1.0) / 257.0);
        float y = point.y - ground;
        vec2 edge = min(uv, 1.0 - uv) * span;
        float taper = smoothstep(0.0, ${suspended.edgeFade.toFixed(1)}, min(edge.x, edge.y));
        // The dust skirt rides above the separate saltation layer. Above it,
        // loaded columns support a thicker, higher lobe with a soft falloff.
        float load = column.r * column.r;
        float low = exp2(-max(0.0, y) / mix(170.0, 340.0, column.a));
        float loft = (y - mix(120.0, 630.0, load) * mix(0.76, 1.3, column.a)) / mix(92.0, 255.0, load);
        float vertical = smoothstep(-55.0, 85.0, y) * (0.54 * low + 0.91 * exp2(-loft * loft))
          * (1.0 - smoothstep(${(suspended.topHeight * 0.60).toFixed(1)}, ${suspended.topHeight.toFixed(1)}, y));
        optical += load * column.r * vertical * taper * ds;
        if (next >= surfaceDistance) break;
        last = next;
      }
      return optical * ${suspended.extinction.toFixed(6)};
    }

    vec3 scatterSandstorm(vec3 base, vec3 cameraToSurface) {
      float distanceToSurface = length(cameraToSurface);
      vec3 ray = cameraToSurface / max(distanceToSurface, 0.001);
      float sunward = 0.5 + 0.5 * dot(ray, stormSun);
      vec3 tint = stormColor * mix(0.82, 1.17, sunward * sunward);
      float opacity = 1.0 - exp(-sandstormOpticalDepth(ray, distanceToSurface) * (stormDebug ? 2.6 : 1.0));
      return mix(base, stormDebug ? vec3(0.027, 0.58, 0.52) : tint, opacity);
    }
  `;
}
