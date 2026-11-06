import { Euler, Quaternion, Vector3 } from 'three';
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

export function valleyAt(z: number, world: WorldParameters) {
  const nodes = world.terrain.valleySpine;
  let i = 0;
  while (i < nodes.length - 2 && z < nodes[i + 1].z) i++;
  const a = nodes[i], b = nodes[i + 1];
  const t = smoothstep(0, 1, (a.z - z) / (a.z - b.z));
  return { x: lerp(a.x,b.x,t), floor: lerp(a.floor,b.floor,t), width: lerp(a.width,b.width,t) };
}

export function crestAt(z: number, ribbon: WorldParameters['terrain']['crestRibbons'][number]) {
  const nodes = ribbon.nodes;
  let i=0;
  while(i<nodes.length-2 && z<nodes[i+1].z) i++;
  const a=nodes[i], b=nodes[i+1], t=smoothstep(0,1,(a.z-z)/(a.z-b.z));
  return { offset:lerp(a.offset,b.offset,t), width:lerp(a.width,b.width,t), height:lerp(a.height,b.height,t) };
}

// Smooth union blends overlapping sand bodies without adding their heights.
function mergeCrests(a: number, b: number, blend: number) {
  const h=Math.max(0,1-Math.abs(a-b)/blend);
  return Math.max(a,b)+h*h*blend*.25;
}

export function heightAt(x: number, z: number, world: WorldParameters): number {
  const terrain=world.terrain, spine=valleyAt(z,world), profile=terrain.basinProfile;
  const lateral=x-spine.x, edge=Math.max(0,Math.abs(lateral)-spine.width);
  const bank=profile.bankHeight*(1-Math.exp(-Math.pow(edge/profile.bankRun,2)))
    *Math.exp(-Math.pow(edge/profile.outerFalloff,4))*(lateral<0 ? profile.leftScale : profile.rightScale);
  let dunes=0, detail=0;
  for(const ribbon of terrain.crestRibbons) {
    const crest=crestAt(z,ribbon), dx=lateral-crest.offset;
    const width=crest.width*(dx*ribbon.side<0 ? ribbon.innerWidth : ribbon.outerWidth);
    dunes=mergeCrests(dunes,ribbon.reliefScale*crest.height*Math.exp(-2.2*Math.pow(dx/width,2)),terrain.crestBlend);
  }
  for(const fold of terrain.crosswindFolds) {
    const dx=x-valleyAt(fold.center[1],world).x-fold.center[0], dz=z-fold.center[1];
    const c=Math.cos(fold.rotation), s=Math.sin(fold.rotation);
    const u=(dx*c-dz*s)/fold.radius[0], v=(dx*s+dz*c)/fold.radius[1];
    dunes+=fold.height*Math.exp(-2.2*(u*u+v*v));
  }
  terrain.noise.forEach((layer,i) => {
    detail+=layer.amplitude*noise(x/layer.wavelength,z/layer.wavelength,world.seed+i*113);
  });
  const mask=terrain.pathMask;
  const side=smoothstep(mask.halfWidth,mask.halfWidth+mask.blendWidth,Math.abs(lateral));
  return terrain.baseHeight+spine.floor+bank+dunes*lerp(mask.massRetention,1,side)
    +detail*lerp(.12,1,side);
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
  id: string;
  family: string;
  kind: 'box' | 'wedge';
  position: [number, number, number];
  scale: [number, number, number];
  quaternion: [number, number, number, number];
  burial: number;
};

export function localVertices(kind: Monument['kind']): Vector3[] {
  if (kind === 'wedge') {
    const data = buildWedgeData().positions;
    return Array.from({ length: data.length / 3 }, (_, i) => new Vector3().fromArray(data, i * 3));
  }
  return [-.5,.5].flatMap(x => [-.5,.5].flatMap(y => [-.5,.5].map(z => new Vector3(x,y,z))));
}

export function buildMonuments(world: WorldParameters): Monument[] {
  return world.structures.map(part => {
    const radians = part.orientation.map(v => v * Math.PI / 180);
    const quaternion = new Quaternion().setFromEuler(new Euler(radians[0], radians[1], radians[2], 'YXZ'));
    const z=part.center[1], x=valleyAt(z,world).x+part.center[0];
    // Rotate the actual lower face first; put EVERY sampled footing below terrain.
    // Burial then lowers the complete rigid object, rather than clipping/coloring it.
    let originY = Infinity;
    for (let u = 0; u <= 8; u++) for (let v = 0; v <= 8; v++) {
      const point = new Vector3((u / 8 - .5) * part.scale[0], -.5 * part.scale[1],
        (v / 8 - .5) * part.scale[2]).applyQuaternion(quaternion);
      originY = Math.min(originY, heightAt(x + point.x, z + point.z, world) - point.y);
    }
    return { id: part.id, family: part.family, kind: part.kind,
      position: [x, originY - part.burial, z], scale: [...part.scale],
      quaternion: quaternion.toArray(), burial: part.burial };
  });
}

export function worldVertices(part: Monument) {
  const q = new Quaternion().fromArray(part.quaternion);
  return localVertices(part.kind).map(p => p.multiply(new Vector3(...part.scale))
    .applyQuaternion(q).add(new Vector3(...part.position)));
}

// Signed point distance to an oriented box. For the wedge this box is conservative.
export function structureDistance(point: Vec3, part: Monument) {
  const p = new Vector3(...point).sub(new Vector3(...part.position))
    .applyQuaternion(new Quaternion().fromArray(part.quaternion).invert());
  const d = [Math.abs(p.x) - part.scale[0] / 2, Math.abs(p.y) - part.scale[1] / 2,
    Math.abs(p.z) - part.scale[2] / 2];
  return Math.hypot(...d.map(x => Math.max(x,0))) + Math.min(Math.max(...d),0);
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

// Shape-preserving C1 Hermite interpolation. No overshoot at sparse turning keys.
function channel(world: WorldParameters, progress: number, value: (i: number) => number) {
  const keys = world.journey.keys;
  const t = Math.max(0, Math.min(1, progress));
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].at) i++;
  const slope = (j: number) => (value(j + 1) - value(j)) / (keys[j + 1].at - keys[j].at);
  const tangent = (j: number) => {
    if (j === 0) return slope(0) * .65;
    if (j === keys.length - 1) return 0;
    const left = slope(j - 1), right = slope(j);
    if (left * right <= 0) return 0;
    const h0 = keys[j].at - keys[j - 1].at, h1 = keys[j + 1].at - keys[j].at;
    const w0 = 2 * h1 + h0, w1 = h1 + 2 * h0;
    return (w0 + w1) / (w0 / left + w1 / right);
  };
  const h = keys[i + 1].at - keys[i].at, u = (t - keys[i].at) / h;
  return (2*u*u*u - 3*u*u + 1) * value(i) + (u*u*u - 2*u*u + u) * h * tangent(i)
    + (-2*u*u*u + 3*u*u) * value(i + 1) + (u*u*u - u*u) * h * tangent(i + 1);
}

export function sampleJourney(progress: number, world: WorldParameters) {
  const keys = world.journey.keys;
  const position = [0,1,2].map(axis => channel(world, progress, i => keys[i].position[axis])) as [number,number,number];
  position[0] += valleyAt(position[2],world).x;
  position[1] += heightAt(position[0], position[2], world);
  const target = [0,1,2].map(axis => channel(world, progress, i => keys[i].target[axis])) as [number,number,number];
  target[0] += valleyAt(target[2],world).x;
  target[1] += valleyAt(target[2],world).floor;
  return { position, target: target as Vec3,
    roll: channel(world, progress, i => keys[i].roll),
    fov: channel(world, progress, i => keys[i].fov) };
}

// Contain the authored film gate: narrower windows reveal vertical space instead
// of cropping the left/right composition. Camera position and path never change.
export function fitVerticalFov(fov: number, aspect: number, framingAspect: number) {
  return 2*Math.atan(Math.tan(fov*Math.PI/360)*Math.max(1,framingAspect/aspect))*180/Math.PI;
}
