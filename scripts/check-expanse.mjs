import assert from 'node:assert/strict';
import { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { EXPANSE } from '../src/components/expanse/parameters.ts';
import { buildMonuments, buildTerrainData, buildWedgeData, crestAt, fingerprint, fitVerticalFov, heightAt, sampleJourney, valleyAt, worldVertices, structureDistance } from '../src/components/expanse/world.ts';

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
const monuments = buildMonuments(EXPANSE);
assert.deepEqual(monuments, buildMonuments(EXPANSE));
assert(monuments.length <= 12, 'Restraint: no procedural block forest');
for (const z of [1900,1100,200,-800,-2000,-3200]) {
  const spine=valleyAt(z,EXPANSE), floor=heightAt(spine.x,z,EXPANSE);
  assert(heightAt(spine.x-500,z,EXPANSE)-floor > 30, 'Left bank wraps the channel');
  assert(heightAt(spine.x+500,z,EXPANSE)-floor > 30, 'Right bank wraps the channel');
}
const field=monuments.filter(m => m.family === 'Mid Monoliths');
const hero=monuments.filter(m => m.family === 'Hero Structure');
assert(field.length > 0 && hero.length > 0, 'Field and destination remain represented');
assert(Math.min(...field.map(m => m.position[2])) > Math.max(...hero.map(m => m.position[2])), 'Destination stays beyond the field');
assert(sampleJourney(.01,EXPANSE).position[2] < sampleJourney(0,EXPANSE).position[2]-10, 'First scroll produces travel, no dead segment');
let minimumLeftSaddleRelief=Infinity;
const [left,shoulder]=EXPANSE.terrain.crestRibbons;
for(let z=1000;z>=-4050;z-=25) {
  const spine=valleyAt(z,EXPANSE), a=crestAt(z,left), b=crestAt(z,shoulder);
  for(const quality of ['desktop','mobile']) for(let j=0;j<=12;j++) {
    const x=spine.x+a.offset+(b.offset-a.offset)*j/12;
    minimumLeftSaddleRelief=Math.min(minimumLeftSaddleRelief,meshHeight(x,z,quality)-meshHeight(spine.x,z,quality));
  }
}
assert(minimumLeftSaddleRelief > 80, 'Left crests join as raised sand, with no trough returning to the valley floor');
const burial = monuments.map(m => {
  assert(m.position.every(Number.isFinite)); assert(m.scale.every(x => x > 0));
  const vertices = worldVertices(m);
  const signed = vertices.map(v => v.y - heightAt(v.x,v.z,EXPANSE));
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
  const vx = i => (i / nx - .5) * width, vz = j => centerZ + depth/2 - j/nz*depth;
  const a = Math.fround(heightAt(vx(ix),vz(iz),EXPANSE)), b = Math.fround(heightAt(vx(ix+1),vz(iz),EXPANSE));
  const c = Math.fround(heightAt(vx(ix),vz(iz+1),EXPANSE)), d = Math.fround(heightAt(vx(ix+1),vz(iz+1),EXPANSE));
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
  if ([0,50,250,550,800,1000].includes(i)) poses.push({progress:p,...pose});
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
  const reference=new PerspectiveCamera(pose.fov,EXPANSE.journey.framingAspect,3,11000);
  reference.position.set(...pose.position); reference.lookAt(...pose.target); reference.rotateZ(pose.roll); reference.updateMatrixWorld();
  for(const aspect of [1.5,1,390/844]) {
    const fitted=reference.clone(); fitted.aspect=aspect;
    fitted.fov=fitVerticalFov(pose.fov,aspect,EXPANSE.journey.framingAspect);
    fitted.updateProjectionMatrix(); fitted.updateMatrixWorld();
    for(const m of monuments) for(const vertex of worldVertices(m)) {
      const a=vertex.clone().project(reference);
      if(Math.abs(a.x)>.95 || Math.abs(a.y)>.95 || a.z< -1 || a.z>1) continue;
      const b=vertex.clone().project(fitted);
      assert(Math.abs(b.x-a.x)<1e-9 && Math.abs(b.x)<1 && Math.abs(b.y)<1, 'Narrow film fit preserves the complete authored composition');
      comparedLandmarks++;
    }
  }
}
assert(comparedLandmarks>0);
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
  instances: monuments.length, minimumLeftSaddleRelief, comparedLandmarks, burial, pathValidation, wedgeVolume: volume }, null, 2));
