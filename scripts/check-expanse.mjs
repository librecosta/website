import assert from 'node:assert/strict';
import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, OrthographicCamera, PerspectiveCamera, Quaternion, Raycaster, Vector3 } from 'three';
import { EXPANSE } from '../src/components/expanse/parameters.ts';
import { buildAeolianTerrain, duneRelief, buildMonuments, buildSlottedMonolithData, buildTerrainData, buildWedgeData, crestAt, fingerprint, fitVerticalFov, heightAt, localVertices, sampleJourney, sandBedSupply, valleyAt, worldVertices, structureDistance, windSurfaceAbove } from '../src/components/expanse/world.ts';
import { createSandTransport, renderedGround, stormExposure } from '../src/components/expanse/sand-transport.ts';
import { addRuinDeposits } from '../src/components/expanse/dressing-terrain.ts';
import { mapJourneyProgress } from '../src/components/expanse/journey-timing.ts';
import { buildSkyline } from '../src/components/expanse/skyline.ts';

// Behavioural invariants for repeated art iteration; no browser or extra runner.
const rendered = {};
const monuments = buildMonuments(EXPANSE);
const timing = EXPANSE.journey.timing;
const mapped = s => mapJourneyProgress(s, timing);
const chapterPose = s => sampleJourney(mapped(s), EXPANSE);
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
  const base = buildTerrainData(EXPANSE, segments);
  const dunes = buildAeolianTerrain(EXPANSE, segments);
  assert.deepEqual(dunes, buildAeolianTerrain(EXPANSE, segments), 'Dunes are deterministic');
  assert.deepEqual(dunes.indices, base.indices, 'Dune relief does not change terrain topology');
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
  const ground = renderedGround(dunes.positions.slice(), segments, EXPANSE.terrain);
  addRuinDeposits(dunes.positions, monuments, ground, EXPANSE);
  rendered[quality] = dunes.positions;
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

// A flat bed isolates the longitudinal shelter from ordinary terrain wind shadows.
const feedConfig = { ...transportImpulseConfig, bounds: [-600, 600, -4400, -660], resolution: [48, 32], baseShear: 0.12 };
const feedOptions = { sediment: () => 1, background: EXPANSE.sandstorm.background };
const openWind = createSandTransport(feedConfig, [1, 0], flat, flat, feedOptions);
const { approach, driftMinimum, veilMinimum, settling } = EXPANSE.sandstorm.shelter;
const exposureAt = z => stormExposure(z, approach, driftMinimum);
const lee = createSandTransport(feedConfig, [1, 0], flat, flat, {
  ...feedOptions,
  shelter: { exposure: exposureAt, settling },
});
const shelteredCell = 4 * 48 + 24, openCell = 31 * 48 + 24;
let minimumOpenDensity = Infinity;
for (let i = 0; i < 640; i++) {
  openWind.advance(); lee.advance();
  minimumOpenDensity = Math.min(minimumOpenDensity, openWind.concentration[openCell]);
}
assert(minimumOpenDensity > 0 && openWind.balance.fed > 0 && openWind.balance.entered > 0);
assert(lee.concentration[shelteredCell] > 0 && lee.concentration[shelteredCell] < openWind.concentration[shelteredCell],
  'Shelter reduces ground transport without extinguishing it');
assert(lee.concentration[openCell] > .99 * openWind.concentration[openCell], 'The exposed inlet remains active');
const exposureSamples = [0, .25, .5, .75, 1].map(s => stormExposure(chapterPose(s).position[2], approach, veilMinimum));
assert(exposureSamples[0] > .97 && exposureSamples.every((value, i) => i === 0 || value <= exposureSamples[i - 1]));
assert.equal(exposureSamples.at(-1), veilMinimum);
for (const layer of [openWind, lee]) {
  const budget = layer.measureBudget();
  assert(Math.abs(budget.residual) < 1e-6 && Math.abs(budget.totalResidual) < 1e-6);
}

const sandGround = renderedGround(rendered.desktop, EXPANSE.terrain.resolution.desktop, EXPANSE.terrain);
const windSurface = windSurfaceAbove(sandGround, monuments);
const liveWind = createSandTransport(windConfig, EXPANSE.aeolian.wind, sandGround, windSurface, {
  sediment: sandBedSupply(EXPANSE, sandGround), window: windConfig.window, background: EXPANSE.sandstorm.background,
  shelter: { exposure: exposureAt, settling },
});
const [leftWind, rightWind, backWind, frontWind] = windConfig.bounds;
const [windColumns, windRows] = windConfig.resolution;
const windDx = (rightWind - leftWind) / windColumns, windDz = (frontWind - backWind) / windRows;
for (const progress of [0, .25, .5, .75, 1, .5, 0]) {
  const [x, , z] = chapterPose(progress).position;
  liveWind.follow(z);
  const nearRow = Math.floor((z - 50 - backWind) / windDz), farRow = Math.floor((z - 430 - backWind) / windDz);
  assert(farRow >= liveWind.firstRow && nearRow < liveWind.firstRow + windConfig.window.rows, 'The visible valley stays inside the transport window');
  for (let i = 0; i < 8; i++) {
    liveWind.advance();
    let density = 0, samples = 0;
    for (let row = farRow; row <= nearRow; row++) {
      const column = Math.floor((x - leftWind) / windDx);
      for (let offset = -5; offset <= 5; offset++) {
        density += liveWind.concentration[row * windColumns + column + offset];
        samples++;
      }
    }
    assert(density / samples > 1, 'Ground dust persists in the visible corridor on the full round trip');
  }
}
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
  const [cx, , cz] = chapterPose(progress).position;
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
  followAndCheck(chapterPose(progress).position[2]);
  sand.advance();
  if (i % 16 === 0) sampleBudget();
}
assert(preservedCells > 0 && moves > 80);
assert(maximumBudgetError < 1e-6, 'Airborne and total budgets conserve mass to numerical precision');
assert(sand.balance.lifted > 0 && sand.balance.deposited > 0 && sand.balance.escaped > 0 && sand.balance.entered > 0);
assert(sand.shelter.some(value => value > 0.25) && sand.solid.some(Boolean), 'The rendered dunes and exposed structures affect wind');
assert(viewSamples[4].density > 0 && viewSamples.slice(0, 3).every(sample => sample.density > viewSamples[4].density));
const sandTransport = { step: windConfig.step, threshold: sand.threshold, cfl: sand.cfl, maximumBudgetError,
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
const field = monuments.filter(m => m.family === 'Mid Monoliths');
assert.deepEqual(field.map(m => m.id), [EXPANSE.futureCity.ruin.id], 'Only the left entrance ruin remains');
const grove = monuments.filter(m => m.family === 'Distant Stelae');
assert.equal(monuments.length, field.length + grove.length, 'The retired main monument is absent');
assert(grove.some(m => m.position[0]<0) && grove.some(m => m.position[0]>0), 'Horizon stelae flank the destination');
const terrainEnd = EXPANSE.terrain.centerZ - EXPANSE.terrain.depth / 2;
assert(grove.every(m => m.kind === 'slotted' && m.position[2] < terrainEnd &&
  m.position[1] - m.scale[1] / 2 < 0), 'Horizon silhouettes extend below the sand line');
const shadowReceiverFloor=-100;
assert(rendered.desktop.every((v, i) => i%3!==1 || v>=shadowReceiverFloor) &&
       rendered.mobile.every((v, i) => i%3!==1 || v>=shadowReceiverFloor), 'Shadow receiver floor is below the terrain');
const {sunPosition, shadowBounds} = EXPANSE.atmosphere.daylight;
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
      assert(Math.abs(p.x)<1 && Math.abs(p.y)<1 && Math.abs(p.z)<1,`${monument.id} and its ground shadow fit the static frustum`);
    }
  }
}
assert(chapterPose(.01).position[2] < chapterPose(0).position[2]-10, 'First scroll produces travel, no dead segment');
assert.equal(EXPANSE.journey.screens - 1, 2.5);
assert.deepEqual([mapped(0), mapped(1), EXPANSE.journey.reducedProgress], [.356, 1, .356]);
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
let previousPosition = chapterPose(0).position;
for (let i = 1; i <= 20; i++) {
  const position = chapterPose(i / 20).position;
  worldSteps.push(Math.hypot(...position.map((value, axis) => value - previousPosition[axis])));
  previousPosition = position;
}
assert(worldSteps.at(-1) < worldSteps.at(-2) * .7, 'World speed eases down into Arrival');
let minimumLeftSaddleRelief=Infinity;
const [left,shoulder]=EXPANSE.terrain.crestRibbons;
for(let z=chapterPose(0).position[2];z>=-5100;z-=25) {
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
  assert(Math.min(...signed) < -30 && Math.max(...signed) > 10, m.id + ': real partial terrain occlusion');
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
const { futureCity } = EXPANSE;
const cameraFar = futureCity.cameraFar;
for (let i=0;i<=1000;i++) {
  const p=i/1000, pose=chapterPose(p);
  const {position,target,roll}=pose;
  assert(target[2] < position[2] - 100, 'Look direction stays forward, no flips');
  assert(Math.abs(roll) < Math.PI/60, 'Limited roll');
  const camera=new PerspectiveCamera(); camera.position.set(...position); camera.up.set(0,1,0);
  camera.lookAt(...target); camera.rotateZ(roll);
  if(previousQuaternion) maxQuaternionStep=Math.max(maxQuaternionStep,previousQuaternion.angleTo(camera.quaternion));
  previousQuaternion=camera.quaternion.clone();
  if(previousPose) assert(position[2] <= previousPose.position[2] + 1e-6, 'No unintended path reversal');
  previousPose=pose;
  assert.deepEqual(pose,chapterPose(p), 'Pure reversible pose function');
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
  const reference=new PerspectiveCamera(pose.fov,EXPANSE.journey.framingAspect,3,cameraFar);
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
const arrival=sampleJourney(1,EXPANSE), arrivalCamera=new PerspectiveCamera(arrival.fov,EXPANSE.journey.framingAspect,3,cameraFar);
arrivalCamera.position.set(...arrival.position); arrivalCamera.lookAt(...arrival.target); arrivalCamera.updateMatrixWorld();
const cityCenter = new Vector3(...futureCity.center);
const cityAxis = new Vector3(0,1,0);
const cityWorld = point => {
  point.y=Math.max(point.y,0); // Below the distant grade, behind the valley horizon.
  return point.multiplyScalar(futureCity.scale).add(cityCenter);
};
const skyline = buildSkyline(futureCity, EXPANSE.seed, false);
const positions = skyline.civic.getAttribute('position');
const destination = Array.from({ length: positions.count }, (_, i) => cityWorld(new Vector3().fromBufferAttribute(positions, i)));
let buildings = 0;
for (const batch of skyline.batches) {
  buildings += batch.buildings.length;
  for (const { position, size, yaw } of batch.buildings) for (const vertex of localVertices('box', EXPANSE)) {
    vertex.y += .5;
    destination.push(cityWorld(vertex.multiply(new Vector3(...size)).applyAxisAngle(cityAxis, yaw).add(new Vector3(...position))));
  }
  batch.geometry.dispose();
}
skyline.civic.dispose();
assert(buildings >= 300 && buildings <= 500, 'The districts supply hundreds of reusable skyline silhouettes');
assert((futureCity.ring.radius - futureCity.ring.guideOffset) * 2 > futureCity.coreWidth * 5.8, 'Open space separates the axis from the rails');
assert(destination.every(point => point.z < terrainEnd), 'Every district stands beyond the valley mesh');
const arrivalBounds=destination.map(v=>v.project(arrivalCamera));
assert(arrivalBounds.every(p => Math.abs(p.x)<.93 && Math.abs(p.y)<.93 && p.z>-1 && p.z<1),'Whole destination fits with breathing room at arrival');
assert(arrival.target[1]>arrival.position[1]+500,'Arrival looks upward from the low valley');
const arrivalFraming={horizontalRange:[Math.min(...arrivalBounds.map(p=>p.x)),Math.max(...arrivalBounds.map(p=>p.x))],
 verticalRange:[Math.min(...arrivalBounds.map(p=>p.y)),Math.max(...arrivalBounds.map(p=>p.y))],
 centerDistance:new Vector3(...arrival.position).distanceTo(cityCenter)};
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
const distantGroove=EXPANSE.distantSteleGroove;
const slotted=buildSlottedMonolithData(distantGroove,EXPANSE.distantSteleTaper), distantSteleVolume=solidVolume(slotted);
const [tx,tz]=EXPANSE.distantSteleTaper;
const sectionIntegral=t => t-((1-tx)+(1-tz))*t*t/2+(1-tx)*(1-tz)*t*t*t/3;
const slotVolume=({width,depth,top,bottom})=>width*depth*(sectionIntegral(top+.5)-sectionIntegral(bottom+.5));
const expectedVolume=sectionIntegral(1)-slotVolume(distantGroove);
assert(Math.abs(distantSteleVolume-expectedVolume)<1e-6,'Taper and recess remove real volume');
const probeGeometry=new BufferGeometry();
probeGeometry.setAttribute('position',new BufferAttribute(slotted.positions,3)); probeGeometry.setIndex(new BufferAttribute(slotted.indices,1));
const probeMaterial=new MeshBasicMaterial({side:DoubleSide}), probe=new Mesh(probeGeometry,probeMaterial), probeRay=new Raycaster();
probe.updateMatrixWorld(true);
const frontHit=(x,y) => {
 probeRay.set(new Vector3(x,y,2),new Vector3(0,0,-1));
 return probeRay.intersectObject(probe,false)[0]?.point.z;
};
assert(Math.abs(frontHit(distantGroove.center,0)-(.5-distantGroove.depth)*(1-(1-tz)*.5))<1e-6,'Groove ray reaches an actual recessed back wall');
assert(Math.abs(frontHit(distantGroove.center,.45)-.5*(1-(1-tz)*.95))<1e-6,'The tapered crown remains continuous above the groove');
probeGeometry.dispose(); probeMaterial.dispose();
console.log(JSON.stringify({ pass: true, seed: EXPANSE.seed, aeolian, sandTransport,
  instances: monuments.length, cityBuildings: buildings, minimumLeftSaddleRelief, comparedLandmarks, burial, pathValidation,
  wedgeVolume, distantSteleVolume, arrivalFraming }, null, 2));
