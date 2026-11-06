import assert from 'node:assert/strict';
import { EXPANSE } from '../src/components/expanse/parameters.ts';
import { buildMonuments, buildTerrainData, buildWedgeData, fingerprint, heightAt } from '../src/components/expanse/world.ts';

// Behavioural invariants for repeated art iteration; no browser or extra runner.
const results = {};
for (const quality of ['desktop', 'mobile']) {
  const segments = EXPANSE.terrain.resolution[quality];
  const a = buildTerrainData(EXPANSE, segments), b = buildTerrainData(EXPANSE, segments);
  assert.deepEqual(a, b, 'Same seed and parameters must produce identical mesh buffers');
  assert.equal(a.positions.length, (segments[0] + 1) * (segments[1] + 1) * 3);
  assert.equal(a.indices.length, segments[0] * segments[1] * 6);
  let peakSlope = 0, min = Infinity, max = -Infinity;
  for (let iz = 0; iz <= segments[1]; iz++) for (let ix = 0; ix <= segments[0]; ix++) {
    const i = (iz * (segments[0] + 1) + ix) * 3, y = a.positions[i + 1];
    assert(Number.isFinite(y)); min = Math.min(min, y); max = Math.max(max, y);
    if (ix < segments[0]) peakSlope = Math.max(peakSlope, Math.abs(a.positions[i + 4] - y) / (EXPANSE.terrain.width / segments[0]));
    if (iz < segments[1]) peakSlope = Math.max(peakSlope, Math.abs(a.positions[i + (segments[0] + 1) * 3 + 1] - y) / (EXPANSE.terrain.depth / segments[1]));
  }
  assert(peakSlope < 1, 'No spike-like slopes in this broad terrain blockout');
  assert(min > -30 && max < 350, 'Massing stays within the intended scale');
  results[quality] = { vertices: a.positions.length / 3, triangles: a.indices.length / 3,
    fingerprint: fingerprint(a.positions), heightRange: [min, max], maximumGridSlope: peakSlope };
}
const changedSeed = structuredClone(EXPANSE); changedSeed.seed++;
assert.notEqual(fingerprint(buildTerrainData(changedSeed, EXPANSE.terrain.resolution.mobile).positions), results.mobile.fingerprint);
for (let z = -3600; z <= 1000; z += 100) {
  const x = Math.sin((z + 400) / EXPANSE.terrain.corridor.bendLength) * EXPANSE.terrain.corridor.bend;
  for (const offset of [-80, 0, 80]) {
    const h = heightAt(x + offset, z, EXPANSE);
    assert(h > -6 && h < 7, 'Protected crossing corridor must remain low');
    assert(Math.abs(heightAt(x + offset + 10, z, EXPANSE) - h) < 1.2, 'No steep ledge in the crossing corridor');
  }
}
const monuments = buildMonuments(EXPANSE);
assert.deepEqual(monuments, buildMonuments(EXPANSE));
for (const m of monuments) {
  assert(m.position.every(Number.isFinite)); assert(m.scale.every(x => Number.isFinite(x) && x > 0));
}
const gate = monuments.filter(m => m.group === 'threshold');
assert.equal(gate.length, 3);
function insideBox(m, point) {
  const dx = point[0] - m.position[0], dz = point[2] - m.position[2];
  const x = dx * Math.cos(m.rotation) - dz * Math.sin(m.rotation);
  const z = dx * Math.sin(m.rotation) + dz * Math.cos(m.rotation);
  return Math.abs(x) < m.scale[0] / 2 && Math.abs(point[1] - m.position[1]) < m.scale[1] / 2 && Math.abs(z) < m.scale[2] / 2;
}
for (const y of [80, 160, 260]) {
  assert(!monuments.some(m => insideBox(m, [0, y, -740])), 'The main gate negative space must stay open');
}
assert(gate.some(m => insideBox(m, [0, 390, -740])), 'Gate has a real load-bearing lintel');
const wedge = buildWedgeData(), edges = new Map();
let volume = 0;
for (let i = 0; i < wedge.indices.length; i += 3) {
  const ids = [...wedge.indices.slice(i, i + 3)];
  const [a,b,c] = ids.map(v => [...wedge.positions.slice(v * 3, v * 3 + 3)]);
  volume += (a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0])) / 6;
  for (let j = 0; j < 3; j++) {
    const x = ids[j], y = ids[(j + 1) % 3], key = [Math.min(x,y),Math.max(x,y)].join(':');
    const list = edges.get(key) ?? []; list.push(x < y ? 1 : -1); edges.set(key,list);
  }
}
assert(volume > 0, 'Wedge winding must face outward');
assert([...edges.values()].every(e => e.length === 2 && e[0] + e[1] === 0), 'Wedge must be a closed orientable solid');
console.log(JSON.stringify({ pass: true, seed: EXPANSE.seed, terrain: results,
  instances: monuments.length, mainGateVoid: 'open', wedgeVolume: volume }, null, 2));
