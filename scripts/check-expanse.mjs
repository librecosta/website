import assert from 'node:assert/strict';
import { BoxGeometry, BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, OrthographicCamera, PerspectiveCamera, Quaternion, Raycaster, Vector3 } from 'three';
import { EXPANSE } from '../src/components/expanse/parameters.ts';
import { buildAeolianTerrain, duneRelief, buildMonuments, buildSlottedMonolithData, buildTerrainData, buildWedgeData, crestAt, fingerprint, fitVerticalFov, heightAt, sampleJourney, sandBedSupply, valleyAt, valueNoise, worldVertices, structureDistance, windSurfaceAbove } from '../src/components/expanse/world.ts';
import { analyzeSurface, buildDrifts, buildSurfaceTerrain } from '../src/components/expanse/surface.ts';
import { createSandTransport, renderedGround } from '../src/components/expanse/sand-transport.ts';
import { mapJourneyProgress } from '../src/components/expanse/journey-timing.ts';

// Behavioural invariants for repeated art iteration; no browser or extra runner.
const results = {};
const rendered = {};
const analysis = analyzeSurface(EXPANSE, { heightAt, valleyAt });
const monuments = buildMonuments(EXPANSE);
const projection = { worldVertices, valleyAt };
const drifts = buildDrifts(EXPANSE, analysis.relief, monuments, projection);
assert.deepEqual(drifts.map(drift => drift.id).sort(), [...EXPANSE.surface.drift.targets].sort());
const fixture = { ...EXPANSE, terrain: { ...EXPANSE.terrain, width: 600, depth: 600, centerZ: 0 } };
const sampleFixture = height => analyzeSurface(fixture, { heightAt: height, valleyAt: () => ({x: 0, width: 200}) }).sample(0, 0);
const planar = sampleFixture(x => x * Math.tan(Math.PI / 12));
assert(Math.abs(planar.slopeDegrees - 15) < 1e-5 && planar.concavity === 0 && planar.exposure === 0,
  'A tilted plane has the correct centered slope and no signed curvature');
const bowl = sampleFixture((x,z) => 0.001 * (x*x+z*z));
const dome = sampleFixture((x,z) => -0.001 * (x*x+z*z));
assert(bowl.concavity > .8 && bowl.exposure === 0 && dome.exposure > .8 && dome.concavity === 0,
  'An even bowl and dome produce opposite curvature masks');
const box = { ...monuments[0], position: [0, 0, 0], scale: [200, 100, 120], quaternion: [0, 0, 0, 1] };
const windFixture = { ...fixture, surface: { ...fixture.surface, drift: { ...fixture.surface.drift, wind: [1, 0], targets: [box.id] } } };
const [lee] = buildDrifts(windFixture, analysis.relief, [box], projection);
assert(lee.sample(130, 0) > lee.sample(220, 0) && lee.sample(220, 0) > 0, 'Deposition grows past the rear edge and decays downstream');
assert(lee.sample(130, 0) > lee.sample(130, 45) && lee.sample(130, 75) === 0, 'The wake feathers across the wind');
assert(lee.sample(100, 0) === 0 && lee.sample(0, 0) === 0 && lee.sample(-130, 0) === 0, 'No accumulation inside or upwind of the footprint');
const rotatedBox = { ...box, quaternion: [0, Math.SQRT1_2, 0, Math.SQRT1_2] };
const [rotatedLee] = buildDrifts(windFixture, analysis.relief, [rotatedBox], projection);
assert(rotatedLee.sample(90, 0) > 0 && lee.sample(90, 0) === 0 && rotatedLee.peak > lee.peak,
  'A real world rotation moves the rear edge and changes the projected width');
for (const quality of ['desktop', 'mobile']) {
  const segments = EXPANSE.terrain.resolution[quality];
  const base = buildTerrainData(EXPANSE, segments);
  const thin = buildSurfaceTerrain(EXPANSE, base, analysis, valueNoise);
  const a = buildSurfaceTerrain(EXPANSE, base, analysis, valueNoise, drifts);
  const duplicate = analyzeSurface(EXPANSE, { heightAt, valleyAt });
  const b = buildSurfaceTerrain(EXPANSE, buildTerrainData(EXPANSE, segments), duplicate, valueNoise,
    buildDrifts(EXPANSE, duplicate.relief, monuments, projection));
  assert.deepEqual(a, b, 'Same seed and parameters must produce identical mesh buffers');

  assert.equal(a.positions.length, (segments[0] + 1) * (segments[1] + 1) * 3);
  assert.equal(a.indices.length, segments[0] * segments[1] * 6);
  let peakSlope = 0, min = Infinity, max = -Infinity, maxAdded = 0, maxThin = 0, maxDrift = 0;
  for (let iz = 0; iz <= segments[1]; iz++) for (let ix = 0; ix <= segments[0]; ix++) {
    const i = (iz * (segments[0] + 1) + ix) * 3, y = a.positions[i + 1];
    assert(Number.isFinite(y)); min = Math.min(min, y); max = Math.max(max, y);
    const added = y - base.positions[i + 1];
    const thinLift = thin.positions[i + 1] - base.positions[i + 1], driftLift = y - thin.positions[i + 1];
    assert(thinLift >= 0 && thinLift <= a.sandDepth + 1e-4, 'The thin layer only adds bounded height');
    assert(driftLift >= 0 && Math.abs(driftLift - a.masks.drift[i / 3] * a.driftDepth) < 1e-4, 'The drift mask measures added height');
    assert(Math.abs(a.masks.sandCoverage[i / 3] - Math.min(1, added / a.sandDepth)) < 1e-4,
      'The rendered coverage measures the same thickness that lifts the surface');
    if (a.masks.drift[i / 3] > 0) {
      assert(base.positions[i] < valleyAt(base.positions[i + 2], EXPANSE).x, 'The two left-bank plumes do not restart on the right bank');
    }
    maxAdded = Math.max(maxAdded, added);
    maxThin = Math.max(maxThin, thinLift);
    maxDrift = Math.max(maxDrift, driftLift);
    if (ix < segments[0]) peakSlope = Math.max(peakSlope, Math.abs(a.positions[i + 4] - y) / (EXPANSE.terrain.width / segments[0]));
    if (iz < segments[1]) peakSlope = Math.max(peakSlope, Math.abs(a.positions[i + (segments[0] + 1) * 3 + 1] - y) / (EXPANSE.terrain.depth / segments[1]));
  }
  assert(peakSlope < 1, 'No spike-like slopes in this broad terrain blockout');
  for (const mask of Object.values(a.masks)) for (const value of mask) assert(value >= 0 && value <= 1);
  assert(maxDrift > 0 && maxDrift <= a.driftDepth + 1e-4, 'The two footprints create real, capped deposits');
  assert(min > -30 && max < 350, 'Massing stays within the intended scale');
  results[quality] = { vertices: a.positions.length / 3, triangles: a.indices.length / 3,
    fingerprint: fingerprint(a.positions), heightRange: [min, max], maximumGridSlope: peakSlope,
    maximumSandLift: maxAdded, maximumThinLift: maxThin, maximumDriftLift: maxDrift };
}
const changedSeed = structuredClone(EXPANSE); changedSeed.seed++;
const sameBase = buildTerrainData(EXPANSE, EXPANSE.terrain.resolution.mobile);
assert.notEqual(fingerprint(buildSurfaceTerrain(changedSeed, sameBase, analysis, valueNoise).masks.sandCoverage),
  fingerprint(buildSurfaceTerrain(EXPANSE, sameBase, analysis, valueNoise).masks.sandCoverage), 'The seed affects coverage even on a fixed heightfield');
const aeolian = {};
const relief = duneRelief(EXPANSE);
for (let z = 1100; z >= -3900; z -= 25) {
  const { x, width } = valleyAt(z, EXPANSE);
  assert.equal(relief(x - width * 0.8, z), 0, 'The dune layer leaves the near valley floor intact');
  assert.equal(relief(x + width * 0.8, z), 0, 'The dune layer leaves the far valley floor intact');
}
const isolatedRidge = { center: [1200, 0], turn: 0, length: 1000, stoss: 540, lee: 210, height: 105, bend: 160, brink: 35 };
const aeolianFixture = { ...EXPANSE, aeolian: { ...EXPANSE.aeolian, wind: [1, 0], ridges: [isolatedRidge],
  reliefNoise: { ...EXPANSE.aeolian.reliefNoise, strength: 0 } } };
const isolatedRelief = duneRelief(aeolianFixture), crest = valleyAt(0, EXPANSE).x + 1200;
assert.equal(isolatedRelief(crest, 0), 105, 'Configured height at the center of the brink');
assert(isolatedRelief(crest - 160, 0) > isolatedRelief(crest + 160, 0) * 4, 'A long stoss slope and much shorter lee slope');
assert.equal(isolatedRelief(crest - 540, 0), 0);
assert.equal(isolatedRelief(crest + 210, 0), 0);
assert(isolatedRelief(crest + 90, 375) > isolatedRelief(crest, 375), 'The flank follows the authored downwind curve');
for (const quality of ['desktop', 'mobile']) {
  const segments = EXPANSE.terrain.resolution[quality];
  const base = buildAeolianTerrain(EXPANSE, segments, true);
  const dunes = buildAeolianTerrain(EXPANSE, segments);
  assert.deepEqual(dunes, buildAeolianTerrain(EXPANSE, segments), 'Dunes are deterministic');
  assert.deepEqual(dunes.indices, base.indices, 'Dune relief does not change terrain topology');
  rendered[quality] = dunes.positions;
  let peakLift = 0, peakSlope = 0;
  const [nx, nz] = segments, { width, depth } = EXPANSE.terrain;
  for (let iz = 0; iz <= nz; iz++) for (let ix = 0; ix <= nx; ix++) {
    const i = (iz * (nx + 1) + ix) * 3, y = dunes.positions[i + 1];
    assert(Number.isFinite(y) && y >= base.positions[i + 1], 'The dunes add finite relief');
    assert(dunes.positions[i] === base.positions[i] && dunes.positions[i + 2] === base.positions[i + 2],
      'Heightfield displacement is vertical only');
    peakLift = Math.max(peakLift, y - base.positions[i + 1]);
    if (ix < nx) peakSlope = Math.max(peakSlope, Math.abs(dunes.positions[i + 4] - y) / (width / nx));
    if (iz < nz) peakSlope = Math.max(peakSlope, Math.abs(dunes.positions[i + (nx + 1) * 3 + 1] - y) / (depth / nz));
  }
  assert(peakLift > 50 && peakLift < 160 && peakSlope < 1.15, 'Dunes add resolvable crests without spikes');
  aeolian[quality] = { baseFingerprint: fingerprint(base.positions), fingerprint: fingerprint(dunes.positions), peakLift, peakSlope };
}
assert.deepEqual(monuments, buildMonuments(EXPANSE));
const windConfig = EXPANSE.windMotion;
const transportImpulseConfig = { ...windConfig, bounds: [-425, 405, 310, 975], resolution: [96, 64], gusts: [] };
const flat = () => 0;
const quiet = createSandTransport({ ...transportImpulseConfig, baseShear: 0.12 }, [1, 0], flat, flat, { sediment: () => 1 });
for (let i = 0; i < 64; i++) quiet.advance();
assert.equal(quiet.balance.lifted, 0, 'A subthreshold wind cannot lift a loose bed');
assert.throws(() => createSandTransport({ ...windConfig, step: 1 }, [1, 0], flat), /CFL/);
const impulse = createSandTransport(transportImpulseConfig, [1, 0], flat);
const [sandNx, sandNz] = transportImpulseConfig.resolution;
const seedCol = Math.floor(sandNx / 2), seedRow = Math.floor(sandNz / 2);
impulse.concentration[seedRow * sandNx + seedCol] = 100;
for (let i = 0; i < 64; i++) impulse.advance();
const sum = values => values.reduce((total, value) => total + value, 0);
const column = impulse.concentration.reduce((total, value, i) => total + value * (i % sandNx), 0) / sum(impulse.concentration);
assert(column > seedCol + 5, 'An isolated plume advects downwind');
assert(impulse.concentration.some((value, i) => Math.floor(i / sandNx) !== seedRow && value > 0), 'The plume spreads across wind');
assert(impulse.balance.deposited > 0 && sum(impulse.concentration) < 100, 'The plume settles without fresh lift');
for (let i = 0; i < 900; i++) impulse.advance();
assert(impulse.balance.escaped > 0, 'The open downwind edge exports the plume');
assert(Math.abs((sum(impulse.concentration) + sum(impulse.bed)) * impulse.cellArea + impulse.balance.escaped - 100 * impulse.cellArea) < 1e-9);

const sandGround = renderedGround(rendered.desktop, EXPANSE.terrain.resolution.desktop, EXPANSE.terrain);
const windSurface = windSurfaceAbove(sandGround, monuments);
const sand = createSandTransport(windConfig, EXPANSE.aeolian.wind, sandGround, windSurface,
  { sediment: sandBedSupply(EXPANSE, sandGround), window: windConfig.window });
const bedStart = sum(sand.bed) * sand.cellArea;
const viewSamples = [];
const [columns, rows] = windConfig.resolution, [x0, x1, z0, z1] = windConfig.bounds;
const dx = (x1 - x0) / columns, dz = (z1 - z0) / rows;
let peakDensity = 0, maximumBudgetError = 0;
let moves = 0, preservedCells = 0;
let dormantSample;
const sampleBudget = () => {
  assert(sand.concentration.every(value => Number.isFinite(value) && value >= 0));
  assert(sand.bed.every(value => Number.isFinite(value) && value >= 0));
  const airborne = sum(sand.concentration) * sand.cellArea;
  const { lifted, deposited, escaped, entered } = sand.balance;
  maximumBudgetError = Math.max(maximumBudgetError,
    Math.abs(airborne - (lifted - deposited - escaped + entered)),
    Math.abs(airborne + sum(sand.bed) * sand.cellArea + escaped - entered - bedStart));
};
function followAndCheck(cameraZ) {
  const previous = sand.firstRow, clock = sand.time;
  const before = sand.concentration.slice(previous * columns, (previous + windConfig.window.rows) * columns);
  const bed = sand.bed.slice(previous * columns, (previous + windConfig.window.rows) * columns);
  if (sand.follow(cameraZ)) {
    moves++;
    const start = Math.max(previous, sand.firstRow), end = Math.min(previous, sand.firstRow) + windConfig.window.rows;
    if (previous >= 0 && end > start) {
      const offset = (start - previous) * columns, count = (end - start) * columns;
      assert.deepEqual(sand.concentration.subarray(start * columns, end * columns), before.subarray(offset, offset + count));
      assert.deepEqual(sand.bed.subarray(start * columns, end * columns), bed.subarray(offset, offset + count));
      preservedCells += count;
    }
  }
  assert.equal(sand.time, clock, 'Moving the window cannot reset or advance the gust clock');
  assert(sand.windowStart + windConfig.dust.edgeFade < cameraZ - windConfig.dust.viewFade[1]);
  assert(sand.windowStart + sand.windowDepth - windConfig.dust.edgeFade > cameraZ + 80);
}
for (const [index, progress] of [0, .25, .5, .75, 1, .75, .5, .25, 0].entries()) {
  const [cx, , cz] = sampleJourney(progress, EXPANSE).position;
  followAndCheck(cz);
  if (index === 8) {
    const { cell, airborne, bed, time } = dormantSample;
    const rate = windConfig.settling * (1 + sand.shelter[cell]);
    const remaining = airborne * Math.exp(-rate * (sand.time - time));
    assert(Math.abs(sand.concentration[cell] - remaining) < 1e-12, 'Returning settles a dormant plume without reseeding it');
    assert(Math.abs(sand.bed[cell] - (bed + airborne - remaining)) < 1e-12);
  }
  let visibleDensity = 0, visibleSource = 0;
  const front = [];
  for (let row = sand.firstRow; row < sand.firstRow + windConfig.window.rows; row++) for (let col = 0; col < columns; col++) {
    const d = cz - (z0 + (row + 0.5) * dz);
    if (d > 150 && d < 850 && Math.abs(x0 + (col + 0.5) * dx - cx) < 375) front.push(row * columns + col);
  }
  for (let i = 1; i <= 128; i++) {
    sand.advance();
    if (i % 16 === 0) sampleBudget();
    for (const cell of front) {
      visibleDensity += sand.concentration[cell];
      visibleSource += sand.sourceRate[cell];
      peakDensity = Math.max(peakDensity, sand.concentration[cell]);
    }
  }
  if (index === 0) {
    const row = Math.floor((cz - 260 - z0) / dz);
    let cell = row * columns;
    for (let col = 0; col < columns; col++) {
      const candidate = row * columns + col;
      if (sand.concentration[candidate] > sand.concentration[cell]) cell = candidate;
    }
    assert(sand.concentration[cell] > 0);
    dormantSample = { cell, airborne: sand.concentration[cell], bed: sand.bed[cell], time: sand.time };
  }
  if (index < 5) viewSamples.push({ progress, density: visibleDensity / (128 * front.length), source: visibleSource / (128 * front.length) });
}
for (let i = 1; i <= 160; i++) {
  const progress = i <= 80 ? i / 80 : (160 - i) / 80;
  followAndCheck(sampleJourney(progress, EXPANSE).position[2]);
  sand.advance();
  if (i % 16 === 0) sampleBudget();
}
assert(preservedCells > 0 && moves > 80);
assert(maximumBudgetError < 1e-6, 'Airborne and total budgets conserve mass to numerical precision');
assert(sand.balance.lifted > 0 && sand.balance.deposited > 0 && sand.balance.escaped > 0 && sand.balance.entered > 0);
assert(sand.shelter.some(value => value > 0.25) && sand.solid.some(Boolean), 'The rendered dunes and exposed structures affect wind');
assert(Math.min(viewSamples[1].density, viewSamples[2].density) > viewSamples[0].density);
assert(viewSamples[4].density < viewSamples[0].density && viewSamples[4].density > 0);
results.sandTransport = { step: windConfig.step, threshold: sand.threshold, cfl: sand.cfl, maximumBudgetError,
  shadowedCells: sand.shelter.filter(value => value > 0.25).length, solidCells: sand.solid.filter(Boolean).length,
  peakDensity, moves, preservedCells, viewSamples, balance: sand.balance };
for (const monument of monuments) {
  assert(monument.position.every(Number.isFinite));
  assert(monument.scale.every(value => Number.isFinite(value) && value > 0));
}
for (const z of [1900,1100,200,-800,-2000,-3200]) {
  const spine=valleyAt(z,EXPANSE), floor=heightAt(spine.x,z,EXPANSE);
  assert(heightAt(spine.x-500,z,EXPANSE)-floor > 30, 'Left bank wraps the channel');
  assert(heightAt(spine.x+500,z,EXPANSE)-floor > 30, 'Right bank wraps the channel');
}
const field=monuments.filter(m => m.family === 'Mid Monoliths');
const hero=monuments.filter(m => m.family === 'Hero Structure');
assert(field.length > 0 && hero.length > 0, 'Field and destination remain represented');
assert.equal(hero.length,1,'One distant destination');
assert.equal(field.length,2,'Keep the outward pair; remove the central masking plate');
assert(!monuments.some(m => m.id==='field-veil' || m.id==='basin-right-return'),'Remove the annotated intrusive pieces');
const grove=monuments.filter(m => m.family==='Distant Stelae');
assert(monuments.length-grove.length<=5 && grove.length<=12,'Keep the valley open and horizon runs sparse');
assert(grove.some(m => m.position[0]<0) && grove.some(m => m.position[0]>0),'Horizon stelae flank the destination');
const terrainEnd=EXPANSE.terrain.centerZ-EXPANSE.terrain.depth/2;
assert(grove.every(m => m.kind===hero[0].kind && m.position[2]<terrainEnd &&
  m.position[1]-m.scale[1]/2<0),'Horizon silhouettes share the stele geometry and extend below the sand line');
for(const remnant of monuments.filter(m => m.family==='Basin Remnant')) {
 const rotation=new Quaternion().fromArray(remnant.quaternion);
 const side=remnant.position[0]-valleyAt(remnant.position[2],EXPANSE).x;
 if(side<0) {
  const depthDirection=new Vector3(0,0,1).applyQuaternion(rotation);
  assert(remnant.scale[2]>2*remnant.scale[1] && Math.abs(depthDirection.y)<.2 && depthDirection.x>0,
   'The fallen left slab lies along the sand with its end facing the valley');
 } else {
  const topDirection=new Vector3(0,1,0).applyQuaternion(rotation);
  assert(topDirection.x<0,'The right remnant leans inward toward the valley');
 }
}
assert(EXPANSE.hero.scale[1] > Math.max(...field.map(m => m.scale[1]))*2,'Hero has a distinct scale hierarchy');
const shadowReceiverFloor=-100;
assert(rendered.desktop.every((v, i) => i%3!==1 || v>=shadowReceiverFloor) &&
       rendered.mobile.every((v, i) => i%3!==1 || v>=shadowReceiverFloor), 'Shadow receiver floor is below the terrain');
for(const [look, {sunPosition, shadowBounds}] of Object.entries(EXPANSE.atmosphere.looks)) {
  const shadowCamera=new OrthographicCamera(...shadowBounds);
  const target=new Vector3(...EXPANSE.atmosphere.sunTarget);
  shadowCamera.position.set(...sunPosition); shadowCamera.lookAt(target); shadowCamera.updateMatrixWorld();
  const shade=target.sub(shadowCamera.position).normalize();
  for(const monument of monuments.filter(m => m.family!=='Distant Stelae')) {
    for(const v of worldVertices(monument,EXPANSE)) {
      // The box is convex: checking the two ends also contains the shadow ray between them.
      const floor=v.clone().addScaledVector(shade, Math.max(0,(shadowReceiverFloor-v.y)/shade.y));
      for(const point of [v, floor]) {
        const p=point.project(shadowCamera);
        assert(Math.abs(p.x)<1 && Math.abs(p.y)<1 && Math.abs(p.z)<1,`${look}: ${monument.id} and its ground shadow fit the static frustum`);
      }
    }
  }
}
assert(Math.min(...field.map(m => m.position[2])) > Math.max(...hero.map(m => m.position[2])), 'Destination stays beyond the field');
assert(sampleJourney(.01,EXPANSE).position[2] < sampleJourney(0,EXPANSE).position[2]-10, 'First scroll produces travel, no dead segment');
const timing = EXPANSE.journey.timing;
const mapped = s => mapJourneyProgress(s, timing);
assert.equal(EXPANSE.journey.screens - 1, 5.5);
assert.deepEqual([mapped(0), mapped(.35), mapped(1)], [0, .356, 1]);
assert.deepEqual(sampleJourney(mapped(.35), EXPANSE), sampleJourney(.356, EXPANSE));
const epsilon = 1e-7;
for (const [i, node] of timing.entries()) {
  if (i > 0) assert(Math.abs((mapped(node.scroll) - mapped(node.scroll - epsilon)) / epsilon - node.slope) < 1e-5);
  if (i < timing.length - 1) {
    assert(Math.abs((mapped(node.scroll + epsilon) - mapped(node.scroll)) / epsilon - node.slope) < 1e-5);
    const end = timing[i + 1];
    const secant = (end.path - node.path) / (end.scroll - node.scroll);
    // All three quadratic Bernstein coefficients of du/ds must be positive.
    assert(Math.min(node.slope, 3 * secant - node.slope - end.slope, end.slope) > 0);
  }
}
for (let i = 1; i <= 1000; i++) assert(mapped(i / 1000) > mapped((i - 1) / 1000));
const worldSteps = [];
let previousPosition = sampleJourney(0, EXPANSE).position;
for (let i = 1; i <= 20; i++) {
  const position = sampleJourney(mapped(i / 20), EXPANSE).position;
  worldSteps.push(Math.hypot(...position.map((value, axis) => value - previousPosition[axis])));
  previousPosition = position;
}
const peakWorldStep = Math.max(...worldSteps);
assert(worldSteps.indexOf(peakWorldStep) < 7 && peakWorldStep < 1.3 * worldSteps[0], 'A single mild acceleration before Passage');
const afterPassage = worldSteps.slice(7, -2);
assert(afterPassage.every((distance, i) => i === 0 || distance < afterPassage[i - 1] * 1.02), 'No second acceleration in world distance after Passage');
assert(worldSteps.at(-1) < worldSteps.at(-2) * .35, 'World speed eases down into Arrival');
let minimumLeftSaddleRelief=Infinity;
const [left,shoulder]=EXPANSE.terrain.crestRibbons;
for(let z=1000;z>=-5100;z-=25) {
  const spine=valleyAt(z,EXPANSE), a=crestAt(z,left), b=crestAt(z,shoulder);
  for(const quality of ['desktop','mobile']) for(let j=0;j<=12;j++) {
    const x=spine.x+a.offset+(b.offset-a.offset)*j/12;
    minimumLeftSaddleRelief=Math.min(minimumLeftSaddleRelief,meshHeight(x,z,quality)-meshHeight(spine.x,z,quality));
  }
}
assert(minimumLeftSaddleRelief > 80, 'Left crests join as raised sand, with no trough returning to the valley floor');
// Horizon silhouettes are screened by the intervening dunes. Footing checks
// apply to structures placed within the actual terrain grid.
const burial = monuments.filter(m => m.family!=='Distant Stelae').map(m => {
  const vertices = worldVertices(m,EXPANSE);
  const signed = vertices.map(v => v.y - meshHeight(v.x,v.z,'desktop'));
  assert(Math.min(...signed) < -30 && Math.max(...signed) > (m.family==='Basin Remnant'?2:10), m.id + ': real partial terrain occlusion');
  if(m.family==='Basin Remnant') assert(Math.max(...signed)<45,m.id+': only a low structural edge is exposed');
  let footingDepth = Infinity;
  for (const quality of ['desktop','mobile']) for (let u=0;u<=16;u++) for (let v=0;v<=16;v++) {
    const bottom = new Vector3((u/16-.5)*m.scale[0], -.5*m.scale[1], (v/16-.5)*m.scale[2])
      .applyQuaternion(new Quaternion().fromArray(m.quaternion)).add(new Vector3(...m.position));
    footingDepth=Math.min(footingDepth,meshHeight(bottom.x,bottom.z,quality)-bottom.y);
  }
  assert(footingDepth > 30, m.id + ': rotated footing stays below both rendered terrain grids');
  return { id: m.id, belowGroundVertices: signed.filter(x => x < 0).length,
    visibleVertices: signed.filter(x => x > 0).length,
    minimumSampledFootingDepth: footingDepth,
    vertexHeightRangeAboveTerrain: [Math.min(...signed),Math.max(...signed)] };
});
function meshHeight(x,z,quality) {
  const [nx,nz] = EXPANSE.terrain.resolution[quality];
  const {width,depth,centerZ} = EXPANSE.terrain;
  const fx = (x / width + .5) * nx, fz = (centerZ + depth/2 - z) / depth * nz;
  assert(fx > 0 && fx < nx && fz > 0 && fz < nz, 'Camera stays inside terrain');
  const ix = Math.floor(fx), iz = Math.floor(fz), u = fx-ix, v = fz-iz;
  const row = nx + 1, index = (iz * row + ix) * 3 + 1, positions = rendered[quality];
  const a = positions[index], b = positions[index + 3];
  const c = positions[index + row * 3], d = positions[index + (row + 1) * 3];
  return u+v <= 1 ? a + (b-a)*u + (c-a)*v : d + (c-d)*(1-u) + (b-d)*(1-v);
}
let minimumTerrainClearance = Infinity, minimumStructureClearance = Infinity;
let maxQuaternionStep = 0, previousPose, previousQuaternion;
const poses = [], radius = EXPANSE.journey.cameraRadius;
for (let i=0;i<=1000;i++) {
  const p=i/1000, pose=sampleJourney(p,EXPANSE);
  const {position,target,roll}=pose;
  assert(target[2] < position[2] - 100, 'Look direction stays forward, no flips');
  assert(Math.abs(roll) < Math.PI/60, 'Limited roll');
  const camera=new PerspectiveCamera(); camera.position.set(...position); camera.up.set(0,1,0);
  camera.lookAt(...target); camera.rotateZ(roll);
  if(previousQuaternion) maxQuaternionStep=Math.max(maxQuaternionStep,previousQuaternion.angleTo(camera.quaternion));
  previousQuaternion=camera.quaternion.clone();
  if(previousPose) assert(position[2] <= previousPose.position[2] + 1e-6, 'No unintended path reversal');
  previousPose=pose;
  assert.deepEqual(pose,sampleJourney(p,EXPANSE), 'Pure reversible pose function');
  for (const quality of ['desktop','mobile']) for (let j=0;j<=8;j++) {
    const offset=j===8 ? 0 : radius;
    const x=position[0]+Math.cos(j*Math.PI/4)*offset, z=position[2]+Math.sin(j*Math.PI/4)*offset;
    minimumTerrainClearance=Math.min(minimumTerrainClearance,position[1]-radius-meshHeight(x,z,quality));
  }
  for(const monument of monuments) minimumStructureClearance=Math.min(minimumStructureClearance,structureDistance(position,monument)-radius);
  if ([0,250,500,650,750,1000].includes(i)) poses.push({progress:p,...pose});
}
assert(minimumTerrainClearance > 8, 'Camera sphere has terrain clearance');
assert(minimumStructureClearance > 15, 'Camera sphere stays outside conservative OBBs');
assert(maxQuaternionStep < .025, 'No abrupt orientation change at track keys');
const pathValidation = { samples:1001, cameraRadius:radius, minimumTerrainClearance,
  minimumStructureClearance, maximumQuaternionStepDegrees:maxQuaternionStep*180/Math.PI, poses,
  scope:'Sampled trajectory and conservative structure OBBs; not a continuous collision proof.' };
// A landmark visible in the authored film gate must remain inside a narrow one.
let comparedLandmarks=0;
for(const pose of poses) {
  const reference=new PerspectiveCamera(pose.fov,EXPANSE.journey.framingAspect,3,EXPANSE.atmosphere.cameraFar);
  reference.position.set(...pose.position); reference.lookAt(...pose.target); reference.rotateZ(pose.roll); reference.updateMatrixWorld();
  for(const aspect of [1.5,1,390/844]) {
    const fitted=reference.clone(); fitted.aspect=aspect;
    fitted.fov=fitVerticalFov(pose.fov,aspect,EXPANSE.journey.framingAspect);
    fitted.updateProjectionMatrix(); fitted.updateMatrixWorld();
    for(const m of monuments) for(const vertex of worldVertices(m,EXPANSE)) {
      const a=vertex.clone().project(reference);
      if(Math.abs(a.x)>.95 || Math.abs(a.y)>.95 || a.z< -1 || a.z>1) continue;
      const b=vertex.clone().project(fitted);
      assert(Math.abs(b.x-a.x)<1e-9 && Math.abs(b.x)<1 && Math.abs(b.y)<1, 'Narrow film fit preserves the complete authored composition');
      comparedLandmarks++;
    }
  }
}
assert(comparedLandmarks>0);
const arrival=sampleJourney(1,EXPANSE), arrivalCamera=new PerspectiveCamera(arrival.fov,EXPANSE.journey.framingAspect,3,EXPANSE.atmosphere.cameraFar);
arrivalCamera.position.set(...arrival.position); arrivalCamera.lookAt(...arrival.target); arrivalCamera.updateMatrixWorld();
// Underground vertices do not belong to the visible silhouette. Clamp them to
// the actual sand surface before testing the whole exposed destination.
const arrivalBounds=worldVertices(hero[0],EXPANSE).map(v => {
 v.y=Math.max(v.y,meshHeight(v.x,v.z,'desktop')); return v.project(arrivalCamera);
});
assert(arrivalBounds.every(p => Math.abs(p.x)<.93 && Math.abs(p.y)<.93 && p.z>-1 && p.z<1),'Whole destination fits with breathing room at arrival');
assert(arrival.target[1]>arrival.position[1]+500,'Arrival looks upward from the low valley');
const arrivalFraming={horizontalRange:[Math.min(...arrivalBounds.map(p=>p.x)),Math.max(...arrivalBounds.map(p=>p.x))],
 verticalRange:[Math.min(...arrivalBounds.map(p=>p.y)),Math.max(...arrivalBounds.map(p=>p.y))],
 centerDistance:new Vector3(...arrival.position).distanceTo(new Vector3(...hero[0].position))};
function solidVolume(data) {
 const edges = new Map(); let volume=0;
 for (let i = 0; i < data.indices.length; i += 3) {
  const ids = [...data.indices.slice(i, i + 3)];
  const [a,b,c] = ids.map(v => [...data.positions.slice(v * 3, v * 3 + 3)]);
  volume += (a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0])) / 6;
  for (let j = 0; j < 3; j++) {
    const x = ids[j], y = ids[(j + 1) % 3], key = [Math.min(x,y),Math.max(x,y)].join(':');
    const list = edges.get(key) ?? []; list.push(x < y ? 1 : -1); edges.set(key,list);
  }
 }
 assert(volume > 0, 'Solid winding must face outward');
 assert([...edges.values()].every(e => e.length === 2 && e[0] + e[1] === 0), 'Solid must be a closed orientable mesh');
 return volume;
}
const wedgeVolume=solidVolume(buildWedgeData());
const slotted=buildSlottedMonolithData(EXPANSE.hero.groove,EXPANSE.hero.topScale), heroVolume=solidVolume(slotted);
const [tx,tz]=EXPANSE.hero.topScale, groove=EXPANSE.hero.groove;
const sectionIntegral=t => t-((1-tx)+(1-tz))*t*t/2+(1-tx)*(1-tz)*t*t*t/3;
const expectedVolume=sectionIntegral(1)-groove.width*groove.depth*(sectionIntegral(groove.top+.5)-sectionIntegral(groove.bottom+.5));
assert(Math.abs(heroVolume-expectedVolume)<1e-6,'Taper and recess remove real volume');
const probeGeometry=new BufferGeometry();
probeGeometry.setAttribute('position',new BufferAttribute(slotted.positions,3)); probeGeometry.setIndex(new BufferAttribute(slotted.indices,1));
const probeMaterial=new MeshBasicMaterial({side:DoubleSide}), probe=new Mesh(probeGeometry,probeMaterial), probeRay=new Raycaster();
probe.updateMatrixWorld(true);
const frontHit=(x,y) => {
 probeRay.set(new Vector3(x,y,2),new Vector3(0,0,-1));
 return probeRay.intersectObject(probe,false)[0]?.point.z;
};
assert(Math.abs(frontHit(groove.center,0)-(.5-groove.depth)*(1-(1-tz)*.5))<1e-6,'Groove ray reaches an actual recessed back wall');
assert(Math.abs(frontHit(groove.center,.45)-.5*(1-(1-tz)*.95))<1e-6,'The tapered crown remains continuous above the groove');
probeGeometry.dispose(); probeMaterial.dispose();
// Actual transformed triangle intersections, independent of drawing or fog.
// Sample a 3x3 patch of the hero's front; report finite ray visibility, not a
// universal claim about every pixel or every possible camera trajectory.
const material=new MeshBasicMaterial({side:DoubleSide});
const meshes=field.map(part => {
 const mesh=new Mesh(new BoxGeometry(1,1,1),material);
 mesh.position.set(...part.position); mesh.quaternion.fromArray(part.quaternion); mesh.scale.set(...part.scale);
 mesh.updateMatrixWorld(true); mesh.name=part.id; return mesh;
});
const heroPart=hero[0], q=new Quaternion().fromArray(heroPart.quaternion), raycaster=new Raycaster();
const visibility=[];
for(let i=0;i<=100;i++) {
 const p=i/100, camera=new Vector3(...sampleJourney(p,EXPANSE).position); let blocked=0;
 const blockers=new Set();
 for(const x of [-.3,0,.3]) for(const y of [-.05,.13,.32]) {
  const point=new Vector3(x*(1-(1-tx)*(y+.5))*heroPart.scale[0],y*heroPart.scale[1],
   .501*(1-(1-tz)*(y+.5))*heroPart.scale[2]).applyQuaternion(q).add(new Vector3(...heroPart.position));
  const direction=point.clone().sub(camera); raycaster.set(camera,direction.clone().normalize()); raycaster.far=direction.length()-.5;
  const hits=raycaster.intersectObjects(meshes,false);
  if(hits.length) {blocked++; blockers.add(hits[0].object.name);}
 }
 visibility.push({progress:p,blocked:blocked/9,blockers:[...blockers]});
}
const peak=visibility.reduce((a,b) => b.blocked>a.blocked?b:a);
assert(visibility.slice(50).every(v=>v.blocked===0),'The removed central plate no longer masks the destination on approach');
meshes.forEach(m => m.geometry.dispose()); material.dispose();
console.log(JSON.stringify({ pass: true, seed: EXPANSE.seed, aeolian, hardpanResearch: results,
  instances: monuments.length, minimumLeftSaddleRelief, comparedLandmarks, burial, pathValidation,
  wedgeVolume,heroVolume,arrivalFraming,occlusion:{peak,samples:visibility.filter((v,i)=>i%5===0)} }, null, 2));
