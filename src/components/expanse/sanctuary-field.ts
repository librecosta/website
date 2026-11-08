import { Color, MathUtils, Quaternion, Vector2, Vector3 } from 'three';
import { EXPANSE } from './parameters';
import type { Monument } from './world';

const settings = EXPANSE.sanctuary;
type Ground = (x: number, z: number) => number;
export type SanctuaryPointer = { x: number; y: number; active: boolean };

export function createSanctuaryField(hero: Monument, ground: Ground) {
  const [x, , z] = hero.position;
  const center = new Vector3(x, ground(x, z) + hero.scale[1] * settings.elevation, z);
  const radius = new Vector3(...hero.scale).multiply(new Vector3(...settings.radiusScale));
  const [near, far] = settings.proximity;
  return { center, radius, proximity: [near * hero.scale[0], far * hero.scale[0]] as const };
}

export type SanctuaryField = ReturnType<typeof createSanctuaryField>;

// World-space sanctuary weight, independent of the viewer and of world time.
// The GPU uses the same definition for the air and both particle populations.
export function sanctuaryInfluence({ center, radius }: SanctuaryField, x: number, y: number, z: number) {
  return Math.max(0, 1 - (((x - center.x) / radius.x) ** 2
    + ((y - center.y) / radius.y) ** 2 + ((z - center.z) / radius.z) ** 2)) ** 2;
}

export function sanctuaryUniforms({ center, radius, proximity }: SanctuaryField) {
  return {
    sanctuaryCenter: { value: center }, sanctuaryRadius: { value: radius },
    sanctuaryProximity: { value: new Vector2(...proximity) }, sanctuaryDistantGain: { value: settings.distantGain },
    sanctuaryTint: { value: new Color(settings.air.color) }, sanctuaryOpticalDepth: { value: settings.air.opticalDepth },
  };
}
export type SanctuaryUniforms = ReturnType<typeof sanctuaryUniforms>;

export const sanctuaryShader = /* glsl */ `
  uniform vec3 sanctuaryCenter, sanctuaryRadius;
  uniform vec2 sanctuaryProximity;
  uniform float sanctuaryDistantGain;
  float sanctuaryInfluence(vec3 point) {
    vec3 p = (point - sanctuaryCenter) / sanctuaryRadius;
    float w = max(0.0, 1.0 - dot(p, p));
    return w * w;
  }
  float sanctuaryNearness() {
    return mix(sanctuaryDistantGain, 1.0, 1.0 - smoothstep(sanctuaryProximity.x, sanctuaryProximity.y,
      distance(cameraPosition.xz, sanctuaryCenter.xz)));
  }
`;

export const sanctuaryAir = /* glsl */ `
  ${sanctuaryShader}
  uniform vec3 sanctuaryTint;
  uniform float sanctuaryOpticalDepth;
  float sanctuaryPrimitive(float t, float span2) {
    float t2 = t * t;
    return t * (span2 * span2 + t2 * (0.2 * t2 - (2.0 / 3.0) * span2));
  }
  vec3 scatterSanctuary(vec3 base, vec3 cameraToSurface) {
    // Work in ellipsoid coordinates. Stop integrating at the opaque receiver,
    // so a stone face only receives light from air in front of it.
    vec3 eye = (cameraPosition - sanctuaryCenter) / sanctuaryRadius;
    vec3 segment = cameraToSurface / sanctuaryRadius;
    float end = max(length(segment), 1e-6);
    vec3 ray = segment / end;
    float axis = -dot(eye, ray);
    vec3 closest = eye + axis * ray;
    float span2 = 1.0 - dot(closest, closest);
    if (span2 <= 0.0) return base;
    float span = sqrt(span2);
    float lo = max(-span, -axis), hi = min(span, end - axis);
    if (lo >= hi) return base;
    float density = sanctuaryPrimitive(hi, span2) - sanctuaryPrimitive(lo, span2);
    float amount = 1.0 - exp(-sanctuaryOpticalDepth * density * sanctuaryNearness());
    return mix(base, sanctuaryTint, amount);
  }
`;

export function seedMotes(field: SanctuaryField, hero: Monument, ground: Ground, quality: 'mobile' | 'desktop') {
  const count = settings.ground.count[quality] + settings.ascending.count[quality];
  const positions = new Float32Array(count * 3), motion = new Float32Array(count * 4), traits = new Float32Array(count * 2);
  const local = new Vector3(), inverse = new Quaternion(...hero.quaternion).invert();
  let i = 0;
  for (const [layer, profile] of [settings.ground, settings.ascending].entries()) {
    let seed = EXPANSE.seed + 117 + layer * 219;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const range = ([min, max]: readonly [number, number]) => MathUtils.lerp(min, max, random());
    for (let j = 0; j < profile.count[quality]; j++, i++) {
      let x: number, y: number, z: number;
      do {
        const angle = random() * Math.PI * 2, r = Math.sqrt(random());
        x = field.center.x + Math.cos(angle) * r * field.radius.x;
        z = field.center.z + Math.sin(angle) * r * field.radius.z;
        y = ground(x, z) + 1.4;
        local.set(x - hero.position[0], y - hero.position[1], z - hero.position[2]).applyQuaternion(inverse);
        // Keep emitters clear of the footprint and allow a little room for drift.
      } while ((Math.abs(local.x) < hero.scale[0] / 2 + 65 && Math.abs(local.z) < hero.scale[2] / 2 + 65)
        || random() > sanctuaryInfluence(field, x, y, z));
      positions.set([x, y, z], i * 3);
      motion.set([random(), range(profile.life), range(profile.rise), range(profile.size)], i * 4);
      traits.set([random(), layer], i * 2);
    }
  }
  return { positions, motion, traits };
}
