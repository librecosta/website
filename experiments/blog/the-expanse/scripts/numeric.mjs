import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { registerHooks } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RepeatWrapping } from 'three';
import { root, workspace } from './snapshot.mjs';

// The production TypeScript imports are resolved by Next. Resolve their
// extensionless relative specifiers in the same source tree for offline runs.
registerHooks({ resolve(name, context, next) {
  if (name.startsWith('.') && !/\.[a-z]+$/i.test(name) && context.parentURL?.endsWith('.ts')) return next(`${name}.ts`, context);
  return next(name, context);
} });
const source = name => import(`../../../../src/components/expanse/${name}.ts`);
const { EXPANSE } = await source('parameters');
const { heightAt, duneRelief, buildAeolianTerrain, fingerprint, buildMonuments, sandBedSupply, windSurfaceAbove, sampleJourney } = await source('world');
const { renderedGround, createSandTransport, stormExposure } = await source('sand-transport');
const { addRuinDeposits } = await source('dressing-terrain');
const { mapJourneyProgress } = await source('journey-timing');
const { createSkyField, SKY_WIDTH, SKY_HEIGHT } = await source('sky-field');
const { createAtmosphere, bakeSkyRadiance } = await source('atmosphere');
const [batch, ...requested] = process.argv.slice(2);
assert(/^[\w-]+$/.test(batch ?? '') && batch !== 'publish', 'Usage: node scripts/numeric.mjs <batch> [F01 F05 F06 F08]');
const supported = ['F01', 'F05', 'F06', 'F08'];
const metadataOnly = requested.length === 1 && requested[0] === '--metadata';
const ids = metadataOnly ? [] : requested.length ? requested : supported;
assert(ids.every(id => supported.includes(id)), 'Numeric experiments are F01, F05, F06 and F08.');
const raw = join(workspace, 'outputs', batch, 'raw');
await mkdir(raw, { recursive: true });
const save = (name, value) => writeFile(join(raw, name + '.json'), JSON.stringify(value) + '\n');
const fixture = JSON.parse(await readFile(join(workspace, 'fixtures/capture.json'), 'utf8'));
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
assert(!git(['status', '--porcelain', '--', 'src', 'public', 'config', 'next.config.ts', 'pnpm-lock.yaml',
  'package.json', 'tsconfig.json']), 'Commit or isolate production changes before attributing evidence to a SHA.');
const commit = git(['rev-parse', 'HEAD']);
const provenance = { commit, parameters: EXPANSE, fixture };
const previous = await readFile(join(raw, 'source.json'), 'utf8').then(JSON.parse).catch(error => {
  if (error.code !== 'ENOENT') throw error;
  return null;
});
if (previous) assert.deepEqual(provenance, previous, 'Source or fixture changed. Capture into a new batch.');
await save('source', provenance);
const stats = array => array.reduce(({ min, max }, value) => ({ min: Math.min(min, value), max: Math.max(max, value) }),
  { min: Infinity, max: -Infinity });

if (ids.includes('F01')) {
  const [nx, nz] = EXPANSE.terrain.resolution.desktop;
  const mesh = buildAeolianTerrain(EXPANSE, [nx, nz]);
  const digest = fingerprint(mesh.positions);
  const repeat = buildAeolianTerrain(EXPANSE, [nx, nz]);
  assert(Buffer.from(mesh.positions.buffer).equals(Buffer.from(repeat.positions.buffer)));
  assert(Buffer.from(mesh.indices.buffer).equals(Buffer.from(repeat.indices.buffer)));
  const { width, depth, centerZ } = EXPANSE.terrain;
  const params = (ribbons, folds, noise) => ({ ...EXPANSE, terrain: { ...EXPANSE.terrain,
    crestRibbons: ribbons ? EXPANSE.terrain.crestRibbons : [], crosswindFolds: folds ? EXPANSE.terrain.crosswindFolds : [],
    noise: noise ? EXPANSE.terrain.noise : [],
  } });
  const basinOnly = params(false, false, false);
  const ribbonsOnly = params(true, false, false);
  const foldsOnly = params(false, true, false);
  const noiseOnly = params(false, false, true);
  const relief = duneRelief(EXPANSE);
  const panels = ['basin', 'ribbons', 'folds', 'noise', 'relief', 'full'].map(id => ({ id, values: [] }));
  let heightError = 0, floatMeshError = 0;
  for (let row = 0; row <= nz; row++) for (let col = 0; col <= nx; col++) {
    const x = (col / nx - 0.5) * width, z = centerZ + depth / 2 - row / nz * depth;
    const basin = heightAt(x, z, basinOnly);
    const fullBase = heightAt(x, z, EXPANSE);
    const original = mesh.positions[(row * (nx + 1) + col) * 3 + 1];
    const layers = [basin, heightAt(x, z, ribbonsOnly) - basin, heightAt(x, z, foldsOnly) - basin,
      heightAt(x, z, noiseOnly) - basin, relief(x, z)];
    heightError = Math.max(heightError, Math.abs(layers.slice(0, 4).reduce((a, b) => a + b) - fullBase));
    floatMeshError = Math.max(floatMeshError, Math.abs(layers.reduce((a, b) => a + b) - original));
    [...layers, original].forEach((value, i) => panels[i].values.push(value));
  }
  assert(heightError < 1e-9, 'Layer isolation does not sum to heightAt');
  assert(floatMeshError < 0.001, 'Layer sum diverged from the Float32 mesh');
  await save('F01-height', { seed: EXPANSE.seed, resolution: [nx + 1, nz + 1], triangles: mesh.indices.length / 3,
    bounds: [-width / 2, width / 2, centerZ - depth / 2, centerZ + depth / 2], fingerprint: digest,
    heightError, floatMeshError, panels: panels.map(panel => ({ ...panel, ...stats(panel.values) })) });
}

if (ids.includes('F05') || ids.includes('F06')) {
  const config = EXPANSE.windMotion;
  const monuments = buildMonuments(EXPANSE);
  const resolution = EXPANSE.terrain.resolution.desktop;
  const { positions } = buildAeolianTerrain(EXPANSE, resolution);
  addRuinDeposits(positions, monuments, renderedGround(positions.slice(), resolution, EXPANSE.terrain), EXPANSE);
  const ground = renderedGround(positions, resolution, EXPANSE.terrain);
  const { shelter } = EXPANSE.sandstorm;
  const simulation = createSandTransport(config, EXPANSE.aeolian.wind, ground, windSurfaceAbove(ground, monuments), {
    sediment: sandBedSupply(EXPANSE, ground), window: config.window, background: EXPANSE.sandstorm.background,
    shelter: { exposure: z => stormExposure(z, shelter.approach, shelter.driftMinimum), settling: shelter.settling },
  });
  const { position } = sampleJourney(mapJourneyProgress(fixture.positions.F05, EXPANSE.journey.timing), EXPANSE);
  simulation.follow(position[2]);
  for (let step = 0; step < fixture.fixedSeconds / config.step; step++) simulation.advance();
  const [cols, rows] = config.resolution;
  const [, , zMin, zMax] = config.bounds;
  const rowDepth = (zMax - zMin) / rows;
  const windowState = cameraZ => ({ cameraX: position[0], cameraZ, firstRow: simulation.firstRow,
    windowStart: simulation.windowStart, windowDepth: simulation.windowDepth, budget: simulation.measureBudget() });
  const before = windowState(position[2]);
  const values = simulation.concentration.slice(before.firstRow * cols, (before.firstRow + config.window.rows) * cols);
  if (ids.includes('F05')) await save('F05-offline', { ...before, time: simulation.time, values: Array.from(values), ...stats(values),
    cfl: simulation.cfl, fingerprint: fingerprint(positions), threshold: simulation.threshold });
  if (ids.includes('F06')) {
    const nextZ = position[2] - config.window.stride * rowDepth;
    assert(simulation.follow(nextZ), 'Fixture no longer moves the active window');
    const after = windowState(nextZ);
    assert.equal(before.firstRow - after.firstRow, config.window.stride);
    const overlapStart = Math.max(before.firstRow, after.firstRow);
    const overlapEnd = Math.min(before.firstRow, after.firstRow) + config.window.rows;
    const overlapA = values.subarray((overlapStart - before.firstRow) * cols, (overlapEnd - before.firstRow) * cols);
    const overlapB = simulation.concentration.subarray(overlapStart * cols, overlapEnd * cols);
    assert(Buffer.from(overlapA.buffer, overlapA.byteOffset, overlapA.byteLength)
      .equals(Buffer.from(overlapB.buffer, overlapB.byteOffset, overlapB.byteLength)), 'Overlap changed during follow()');
    assert(Math.abs(before.budget.totalResidual) < 0.01 && Math.abs(after.budget.totalResidual) < 0.01);
    await save('F06-window', { time: simulation.time, config, wind: EXPANSE.aeolian.wind, before, after,
      overlapRows: overlapEnd - overlapStart, overlapCells: overlapA.length, bitIdentical: true,
      rowDepth, stepWorldUnits: Math.abs(nextZ - position[2]), cfl: simulation.cfl, threshold: simulation.threshold });
  }
}

if (ids.includes('F08')) {
  const field = createSkyField().data;
  assert(Buffer.from(field).equals(Buffer.from(createSkyField().data)));
  const delta = (row, a, b, channel) => Math.abs(field[(row * SKY_WIDTH + a) * 4 + channel] - field[(row * SKY_WIDTH + b) * 4 + channel]);
  const wrap = Array.from({ length: 4 }, (_, channel) => {
    let edgeMax = 0, interiorMax = 0, edgeSquare = 0, interiorSquare = 0;
    for (let row = 0; row < SKY_HEIGHT; row++) {
      const seam = delta(row, 0, SKY_WIDTH - 1, channel);
      edgeMax = Math.max(edgeMax, seam);
      edgeSquare += seam * seam;
      for (let col = 1; col < SKY_WIDTH; col++) {
        const step = delta(row, col - 1, col, channel);
        interiorMax = Math.max(interiorMax, step);
        interiorSquare += step * step;
      }
    }
    const pole = Array.from({ length: SKY_WIDTH }, (_, col) => delta(SKY_HEIGHT - 1, 0, col, channel));
    assert.equal(Math.max(...pole), 0, 'Zenith depends on longitude');
    assert(edgeMax <= interiorMax, `Channel ${channel} wraps with a larger jump than any interior step`);
    return { channel, edgeMax, edgeRms: Math.sqrt(edgeSquare / SKY_HEIGHT), interiorMax,
      interiorRms: Math.sqrt(interiorSquare / (SKY_HEIGHT * (SKY_WIDTH - 1))), poleMax: 0 };
  });
  const atmosphere = createAtmosphere();
  const modeHashes = {};
  for (const mode of ['background', 'main', 'secondary', 'color']) {
    bakeSkyRadiance(atmosphere, field, mode);
    const half = atmosphere.data.length / 2;
    modeHashes[mode] = { sky: fingerprint(atmosphere.data.subarray(0, half)), air: fingerprint(atmosphere.data.subarray(half)) };
  }
  assert.equal(new Set(Object.values(modeHashes).map(entry => entry.air)).size, 1);
  assert.equal(new Set(Object.values(modeHashes).map(entry => entry.sky)).size, 4);
  const repeatU = atmosphere.uniforms.airSky.value.wrapS;
  assert.equal(repeatU, RepeatWrapping);
  atmosphere.uniforms.airSky.value.dispose();
  await save('F08-sky', { directionSize: [SKY_WIDTH, SKY_HEIGHT], fieldHash: fingerprint(field), wrap, repeatU, modeHashes });
  await writeFile(join(raw, 'F08-field.rgba'), field);
}
