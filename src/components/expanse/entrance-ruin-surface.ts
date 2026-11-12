import { BufferAttribute, Color, MathUtils, Matrix3, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type BufferGeometry } from 'three';
import { EXPANSE } from './parameters';
import type { Monument } from './world';

const shell = new Color('#b3aa9a');
const wornEdge = new Color('#c4bcae');
const hardware = new Color('#899394');
const recess = new Color('#797366');
const dust = new Color('#a59882');
const mastSeats = [[-.105, .137], [.22, -.093], [-.17, -.11], [.009, .103]];

function metalMask(x: number, y: number, z: number) {
  const mast = MathUtils.smoothstep(y, .323, .342);
  if (y <= .293 || mast === 1) return mast;
  let seatDistance = Infinity;
  for (const [a, b] of mastSeats) seatDistance = Math.min(seatDistance, Math.hypot(x - a, z - b));
  const seats = (1 - MathUtils.smoothstep(seatDistance, .016, .041)) * MathUtils.smoothstep(y, .293, .326);
  return Math.max(mast, seats * .84);
}

function surfaceBends(source: BufferGeometry, points: Vector3[]) {
  const position = source.getAttribute('position');
  const vertex = new Vector3(), edge = new Vector3();
  const lookup = new Map<string, number>();
  // The export splits hard normals. Weld positions for the measurement alone.
  const welded = points.map((_, i) => {
    const key = vertex.fromBufferAttribute(position, i).toArray().join(',');
    const match = lookup.get(key);
    if (match !== undefined) return match;
    const id = lookup.size;
    lookup.set(key, id);
    return id;
  });
  const directions = Array.from({ length: lookup.size }, () => new Vector3());
  const neighbors = new Uint16Array(lookup.size);
  const addEdge = (a: number, b: number) => {
    const from = welded[a], to = welded[b];
    if (from === to) return;
    edge.subVectors(points[b], points[a]).normalize();
    directions[from].add(edge);
    directions[to].sub(edge);
    neighbors[from]++;
    neighbors[to]++;
  };
  const index = source.getIndex();
  for (let i = 0; i < (index?.count ?? points.length); i += 3) {
    const a = index?.getX(i) ?? i, b = index?.getX(i + 1) ?? i + 1, c = index?.getX(i + 2) ?? i + 2;
    addEdge(a, b);
    addEdge(b, c);
    addEdge(c, a);
  }
  directions.forEach((direction, i) => direction.multiplyScalar(1 / Math.max(1, neighbors[i])));
  return welded.map(i => directions[i]);
}

export function finishEntranceRuin(source: BufferGeometry, ruin: Monument, ground: (x: number, z: number) => number) {
  const transform = new Matrix4().compose(new Vector3(...ruin.position),
    new Quaternion().fromArray(ruin.quaternion), new Vector3(...ruin.scale));
  const normalMatrix = new Matrix3().getNormalMatrix(transform);
  const position = source.getAttribute('position'), normals = source.getAttribute('normal');
  const points = Array.from({ length: position.count }, (_, i) =>
    new Vector3().fromBufferAttribute(position, i).applyMatrix4(transform));
  const bends = surfaceBends(source, points);
  const [wx, wz] = EXPANSE.aeolian.wind;
  const wind = new Vector3(wx, 0, wz).normalize();
  const colors = new Uint8Array(position.count * 3), finish = new Uint8Array(position.count * 2);
  const tint = new Color(), normal = new Vector3(), local = new Vector3();
  points.forEach((point, i) => {
    local.fromBufferAttribute(position, i);
    normal.fromBufferAttribute(normals, i).applyNormalMatrix(normalMatrix);
    const bend = normal.dot(bends[i]), facing = normal.dot(wind);
    const inside = MathUtils.smoothstep(bend, .038, .23) * .79;
    const exposed = 1 - MathUtils.smoothstep(facing, -.72, -.10);
    const wear = .49 * MathUtils.smoothstep(-bend, .035, .24) * exposed;
    const silt = 1 - MathUtils.smoothstep(point.y - ground(point.x, point.z), 12, 112);
    const lee = MathUtils.smoothstep(facing, .04, .55);
    const settled = silt * (.34 + .35 * lee + .23 * Math.max(0, normal.y));
    const metal = metalMask(local.x, local.y, local.z) * (1 - inside * .75);
    tint.copy(shell).lerp(wornEdge, wear).lerp(recess, inside).lerp(hardware, metal).lerp(dust, settled);
    colors[i * 3] = Math.round(tint.r * 255);
    colors[i * 3 + 1] = Math.round(tint.g * 255);
    colors[i * 3 + 2] = Math.round(tint.b * 255);
    const roughness = MathUtils.lerp(MathUtils.lerp(.88 - .14 * wear + .10 * inside, .63, metal), .98, settled);
    const metalness = MathUtils.lerp(MathUtils.lerp(.045, .38, metal), .01, settled);
    finish[i * 2] = Math.round(roughness * 255);
    finish[i * 2 + 1] = Math.round(metalness * 255);
  });
  const geometry = source.clone();
  geometry.setAttribute('color', new BufferAttribute(colors, 3, true));
  geometry.setAttribute('ruinSurface', new BufferAttribute(finish, 2, true));
  return geometry;
}

export function createEntranceRuinMaterial() {
  const material = new MeshStandardMaterial({ vertexColors: true });
  material.customProgramCacheKey = () => 'entrance-ruin-surface';
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 ruinSurface;\nvarying vec2 vRuinSurface;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRuinSurface = ruinSurface;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRuinSurface;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vRuinSurface.x;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vRuinSurface.y;');
  };
  return material;
}
