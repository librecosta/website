import type { Vec3, WorldParameters } from './parameters';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function smoothstep(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function hash(x: number, z: number, seed: number) {
  let n = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ seed;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

// Smooth value noise, not an unbounded random height per vertex.
function noise(x: number, z: number, seed: number) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const u = smoothstep(0, 1, x - ix), v = smoothstep(0, 1, z - iz);
  return lerp(lerp(hash(ix, iz, seed), hash(ix + 1, iz, seed), u),
    lerp(hash(ix, iz + 1, seed), hash(ix + 1, iz + 1, seed), u), v) * 2 - 1;
}

export function heightAt(x: number, z: number, world: WorldParameters): number {
  const terrain = world.terrain;
  let massing = 0;
  for (const mass of terrain.masses) {
    const dx = x - mass.center[0], dz = z - mass.center[1];
    const c = Math.cos(mass.rotation), s = Math.sin(mass.rotation);
    const u = (dx * c - dz * s) / mass.radius[0];
    const v = (dx * s + dz * c) / mass.radius[1];
    massing += mass.height * Math.exp(-2.5 * (u * u + v * v));
  }
  let detail = 0;
  terrain.noise.forEach((layer, i) => {
    detail += layer.amplitude * noise(x / layer.wavelength, z / layer.wavelength, world.seed + i * 113);
  });
  const corridor = terrain.corridor;
  const centerX = Math.sin((z + 400) / corridor.bendLength) * corridor.bend;
  const side = smoothstep(corridor.halfWidth, corridor.halfWidth + corridor.blendWidth, Math.abs(x - centerX));
  let height = terrain.baseHeight + massing * side + detail * lerp(0.045, 1, side);
  for (const pad of terrain.pads) {
    const distance = Math.hypot((x - pad.center[0]) / pad.radius[0], (z - pad.center[1]) / pad.radius[1]);
    height = lerp(height, pad.level, 1 - smoothstep(0.7, 1.2, distance));
  }
  return height;
}

export function buildTerrainData(world: WorldParameters, segments: readonly number[]) {
  const [nx, nz] = segments;
  const { width, depth, centerZ } = world.terrain;
  const positions = new Float32Array((nx + 1) * (nz + 1) * 3);
  const indices = new Uint32Array(nx * nz * 6);
  let vertex = 0, index = 0;
  for (let iz = 0; iz <= nz; iz++) {
    const z = centerZ + depth / 2 - iz / nz * depth;
    for (let ix = 0; ix <= nx; ix++) {
      const x = (ix / nx - 0.5) * width;
      positions[vertex++] = x;
      positions[vertex++] = heightAt(x, z, world);
      positions[vertex++] = z;
      if (ix < nx && iz < nz) {
        const a = iz * (nx + 1) + ix, b = a + nx + 1;
        indices.set([a, a + 1, b, a + 1, b + 1, b], index);
        index += 6;
      }
    }
  }
  return { positions, indices };
}

export type Monument = {
  kind: 'box' | 'wedge';
  group: string;
  position: [number, number, number];
  scale: [number, number, number];
  rotation: number;
};

export function buildMonuments(world: WorldParameters): Monument[] {
  const result: Monument[] = [];
  const a = world.architecture;
  function solid(group: string, kind: Monument['kind'], x: number, z: number,
    scale: Vec3, rotation = 0, base?: number) {
    // Sample the footprint so a hill never leaves a floating lower corner.
    const c = Math.cos(rotation), s = Math.sin(rotation);
    const ground = base ?? Math.min(...[-0.5, 0, 0.5].flatMap(u => [-0.5, 0, 0.5].map(v =>
      heightAt(x + u * scale[0] * c + v * scale[2] * s,
        z - u * scale[0] * s + v * scale[2] * c, world)))) - 3;
    result.push({ kind, group, position: [x, ground + scale[1] / 2, z], scale: [...scale], rotation });
  }
  function gate(group: string, data: { readonly center: readonly number[]; readonly width: number;
    readonly height: number; readonly depth: number; readonly beam: number }) {
    const [x, z] = data.center;
    const { width: w, height: h, depth: d, beam: b } = data;
    const base = heightAt(x, z, world) - 2;
    for (const sign of [-1, 1]) solid(group, 'box', x + sign * (w - b) / 2, z, [b, h - b, d], 0, base);
    solid(group, 'box', x, z, [w, b, d], 0, base + h - b);
  }
  gate('threshold', a.threshold);
  gate('rear-gate', a.rearGate);
  for (const part of a.solids) {
    solid(part.group, part.kind, part.center[0], part.center[1], part.scale, part.rotation, part.base ?? undefined);
  }
  const w = a.western;
  for (let row = 0; row < w.rows; row++) {
    const c = Math.cos(w.rotation), s = Math.sin(w.rotation);
    const localZ = -(row - (w.rows - 1) / 2) * w.spacing[1];
    for (let col = 0; col < w.columns; col++) {
      if (row === 0 && col === Math.floor(w.columns / 2)) continue; // Deliberate break, not random deletion.
      const localX = (col - (w.columns - 1) / 2) * w.spacing[0];
      const x = w.center[0] + localX * c + localZ * s;
      const z = w.center[1] - localX * s + localZ * c;
      solid('western-colonnade', 'box', x, z,
        [w.width, w.rowHeights[row] - w.lintel, w.depth], w.rotation, 2);
    }
    solid('western-lintel', 'box', w.center[0] + localZ * s, w.center[1] + localZ * c,
      [(w.columns - 1) * w.spacing[0] + w.width, w.lintel, w.depth], w.rotation, 2 + w.rowHeights[row] - w.lintel);
  }
  const e = a.eastern;
  solid('eastern-wall', 'box', e.center[0], e.center[1], e.scale, e.rotation);
  const far = a.distant;
  for (const [band, centerX] of far.bands.entries()) {
    for (let row = 0; row < far.rows; row++) {
      for (let col = 0; col < far.columns; col++) {
        const h = far.heights[(col + row * 2 + band) % far.heights.length];
        // Seed affects only a bounded 4% scale range; the ordered grid is fixed.
        const variation = 0.98 + hash(col + band * 17, row, world.seed) * 0.04;
        solid('distant-' + band, 'box', centerX + (col - (far.columns - 1) / 2) * far.spacing[0],
          far.startZ - row * far.spacing[1], [far.width, h * variation, far.depth], 0);
      }
    }
  }
  return result;
}

export function buildWedgeData() {
  const positions = new Float32Array([
    -.5,-.5,-.5, .5,-.5,-.5, .5,-.5,.5, -.5,-.5,.5,
    -.25,.5,-.4, .25,.5,-.4, .25,.5,.4, -.25,.5,.4,
  ]);
  const indices = new Uint16Array([
    0,1,2,0,2,3,4,6,5,4,7,6,0,5,1,0,4,5,1,6,2,1,5,6,2,7,3,2,6,7,3,4,0,3,7,4,
  ]);
  return { positions, indices };
}

export function fingerprint(data: ArrayBufferView) {
  let hash = 2166136261;
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}
