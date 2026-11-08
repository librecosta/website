import { Box3, Euler, Matrix4, Quaternion, Ray, ShapeUtils, Vector2, Vector3 } from 'three';
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
export function valueNoise(x: number, z: number, seed: number) {
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
    const u=(dx*c-dz*s)/fold.radius[0];
    const v=(dx*s+dz*c)/fold.radius[1]+fold.sweep*u*u;
    dunes+=fold.height*Math.exp(-2.2*(u*u+v*v));
  }
  terrain.noise.forEach((layer,i) => {
    detail+=layer.amplitude*valueNoise(x/layer.wavelength,z/layer.wavelength,world.seed+i*113);
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

export function duneRelief(world: WorldParameters) {
  const { wind, ridges, corridor, reliefNoise } = world.aeolian;
  const bearing = Math.atan2(wind[1], wind[0]);
  const shapes = ridges.map(ridge => {
    const [offset, z] = ridge.center;
    const angle = bearing + ridge.turn * Math.PI / 180;
    const roundedRun = (run: number) => Math.hypot(run, ridge.brink) - ridge.brink;
    return { ...ridge, x: valleyAt(z, world).x + offset, z, wx: Math.cos(angle), wz: Math.sin(angle),
      stossRun: roundedRun(ridge.stoss), leeRun: roundedRun(ridge.lee) };
  });
  return (x: number, z: number) => {
    const spine = valleyAt(z, world);
    const bank = smoothstep(...corridor, Math.abs(x - spine.x) / spine.width);
    if (bank === 0) return 0;
    let relief = 0;
    for (const shape of shapes) {
      const dx = x - shape.x, dz = z - shape.z;
      const u = (-dx * shape.wz + dz * shape.wx) / (shape.length / 2);
      if (Math.abs(u) >= 1) continue;
      const v = dx * shape.wx + dz * shape.wz - shape.bend * u * u;
      if (v <= -shape.stoss || v >= shape.lee) continue;
      const run = v < 0 ? shape.stossRun : shape.leeRun;
      const rounded = Math.hypot(v, shape.brink) - shape.brink;
      // Zero derivatives at the rounded brink, both toes and both tips.
      const profile = (1 - rounded / run) * (1 - u * u);
      relief += shape.height * profile * profile;
    }
    if (relief === 0) return 0;
    const variation = valueNoise(x / reliefNoise.wavelength, z / reliefNoise.wavelength, world.seed + 241);
    return relief * bank * (1 + variation * reliefNoise.strength);
  };
}

export function buildAeolianTerrain(world: WorldParameters, segments: readonly number[], original = false) {
  const base = buildTerrainData(world, segments);
  if (original) return base;
  const reliefAt = duneRelief(world);
  for (let i = 0; i < base.positions.length; i += 3) {
    base.positions[i + 1] += reliefAt(base.positions[i], base.positions[i + 2]);
  }
  return base;
}

export type Monument = {
  id: string;
  family: string;
  kind: 'box' | 'wedge' | 'slotted';
  position: [number, number, number];
  scale: [number, number, number];
  quaternion: [number, number, number, number];
  burial: number;
};

export function windSurfaceAbove(ground: (x: number, z: number) => number, monuments: Monument[]) {
  const unitBox = new Box3(new Vector3(-0.5, -0.5, -0.5), new Vector3(0.5, 0.5, 0.5));
  const obstacles = monuments.filter(item => item.kind === 'box').map(item => {
    const transform = new Matrix4().compose(new Vector3(...item.position),
      new Quaternion().fromArray(item.quaternion), new Vector3(...item.scale));
    return { transform, inverse: transform.clone().invert(), bounds: unitBox.clone().applyMatrix4(transform) };
  });
  const ray = new Ray();
  const hit = new Vector3();
  return (x: number, z: number) => {
    let top = ground(x, z);
    for (const { bounds, inverse, transform } of obstacles) {
      if (x < bounds.min.x || x > bounds.max.x || z < bounds.min.z || z > bounds.max.z || top >= bounds.max.y) continue;
      ray.origin.set(x, bounds.max.y + 1, z);
      ray.direction.set(0, -1, 0);
      ray.applyMatrix4(inverse);
      if (ray.intersectBox(unitBox, hit)) top = Math.max(top, hit.applyMatrix4(transform).y);
    }
    return top;
  };
}

export function sandBedSupply(world: WorldParameters, ground: (x: number, z: number) => number) {
  const { supply, bedding, corridor, slope, bowlRadius } = world.windMotion.sediment;
  const angle = Math.atan2(world.aeolian.wind[1], world.aeolian.wind[0]);
  const wx = Math.cos(angle), wz = Math.sin(angle);
  return (x: number, z: number) => {
    let segment = 0;
    while (segment < supply.length - 2 && z < supply[segment + 1][0]) segment++;
    const [za, a] = supply[segment], [zb, b] = supply[segment + 1];
    const regional = lerp(a, b, smoothstep(0, 1, (za - z) / (za - zb)));
    const spine = valleyAt(z, world);
    const valley = 1 - smoothstep(...corridor, Math.abs(x - spine.x) / spine.width);
    const r = bowlRadius;
    const east = ground(x + r, z), west = ground(x - r, z);
    const north = ground(x, z + r), south = ground(x, z - r);
    const gradient = Math.hypot(east - west, north - south) / (2 * r);
    const bowl = (east + west + north + south) * 0.25 - ground(x, z);
    const retention = (1 - smoothstep(...slope, gradient)) * lerp(0.55, 1, smoothstep(-3, 3, bowl));
    const u = (x * wx + z * wz) / bedding[0];
    const v = (-x * wz + z * wx) / bedding[1];
    const seams = 0.73 * valueNoise(u + 0.22 * Math.sin(v * 0.8), v, world.seed + 901)
      + 0.27 * valueNoise(u * 1.7 + 0.8, v * 1.8 - 1.2, world.seed + 913);
    return regional * valley * retention * lerp(0.10, 1, smoothstep(-0.23, 0.51, seams));
  };
}

export function localVertices(kind: Monument['kind'], world: WorldParameters): Vector3[] {
  if (kind !== 'box') {
    const data = kind === 'wedge' ? buildWedgeData().positions : buildSlottedMonolithData(world.hero.groove,world.hero.topScale).positions;
    return Array.from({ length: data.length / 3 }, (_, i) => new Vector3().fromArray(data, i * 3));
  }
  return [-.5,.5].flatMap(x => [-.5,.5].flatMap(y => [-.5,.5].map(z => new Vector3(x,y,z))));
}

export function buildMonuments(world: WorldParameters): Monument[] {
  const field = world.alignment.map(part => ({
    id: part.id, family: 'Mid Monoliths', kind: 'box' as const, scale: part.scale,
    center: [part.ideal.center[0] + part.disturbed.offset[0], part.ideal.center[1] + part.disturbed.offset[1]],
    orientation: [part.disturbed.orientation[0], part.ideal.yaw + part.disturbed.orientation[1], part.disturbed.orientation[2]],
    burial: part.ideal.burial + part.disturbed.settlement,
  }));
  return [...world.remnants, ...field, ...world.distantStelae, world.hero].map(part => {
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
    if ('exposure' in part) {
      // Sample the real top plane against the same terrain function. The entire
      // solid stays present below the sand; there is no visibility toggle.
      originY = Infinity;
      for (let u=0;u<=16;u++) for (let v=0;v<=16;v++) {
        const point=new Vector3((u/16-.5)*part.scale[0], .5*part.scale[1], (v/16-.5)*part.scale[2]).applyQuaternion(quaternion);
        originY=Math.min(originY,heightAt(x+point.x,z+point.z,world)-point.y+part.exposure);
      }
    }
    return { id: part.id, family: part.family, kind: part.kind,
      position: [x, originY - part.burial, z], scale: [...part.scale],
      quaternion: quaternion.toArray(), burial: part.burial };
  });
}

export function worldVertices(part: Monument, world: WorldParameters) {
  const q = new Quaternion().fromArray(part.quaternion);
  return localVertices(part.kind, world).map(p => p.multiply(new Vector3(...part.scale))
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

type Hero = WorldParameters['hero'];

const topCap = [3, 7, 6, 2], bottomCap = [0, 1, 5, 4];
const walls = [
  [0, 3, 2, 1], [0, 4, 7, 3], [1, 2, 6, 5], topCap, bottomCap,
  [12, 15, 14, 13], [8, 12, 13, 9], [11, 10, 14, 15], [9, 13, 14, 10], [8, 11, 15, 12],
];
const front = [4, 5, 6, 7], opening = [8, 9, 10, 11];

function steleCorners() {
  const outline = [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]];
  return [-.5, .5].flatMap(z => outline.map(([x, y]) => new Vector3(x, y, z)));
}

function steleVertices(groove: Hero['groove']) {
  const l = groove.center - groove.width / 2, r = groove.center + groove.width / 2;
  const b = groove.bottom, t = groove.top;
  const slot = [[l, b], [l, t], [r, t], [r, b]];
  return [
    ...steleCorners(),
    ...[.5, .5 - groove.depth].flatMap(z => slot.map(([x, y]) => new Vector3(x, y, z))),
  ];
}

const taperAt = (top: number, y: number) => 1 + (top - 1) * (y + .5);

function triangulateFace(vertices: Vector3[], outer: number[], hole: number[]) {
  const [a, b, c] = outer.map(i => vertices[i]);
  const across = b.clone().sub(a).normalize();
  const normal = across.clone().cross(c.clone().sub(a)).normalize();
  const up = normal.cross(across);
  const project = (i: number) => new Vector2(vertices[i].dot(across), vertices[i].dot(up));
  const corners = [...outer, ...hole];
  return ShapeUtils.triangulateShape(outer.map(project), [hole.map(project)]).flatMap(face => face.map(i => corners[i]));
}

function quad(indices: number[], [a, b, c, d]: number[]) {
  indices.push(a, b, c, a, c, d);
}

export function buildSlottedMonolithData(groove: Hero['groove'], topScale: Hero['topScale']) {
  const vertices = steleVertices(groove);
  const indices: number[] = [];
  walls.forEach(face => quad(indices, face));
  indices.push(...triangulateFace(vertices, front, opening));
  const positions = new Float32Array(vertices.flatMap(v => v.toArray()));
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] *= taperAt(topScale[0], positions[i + 1]);
    positions[i + 2] *= taperAt(topScale[1], positions[i + 1]);
  }
  return { positions, indices: new Uint16Array(indices) };
}

function taperStele(vertices: Vector3[], hero: Hero, scale: Vector3) {
  return vertices.map(v => {
    v.x *= taperAt(hero.topScale[0], v.y);
    v.z *= taperAt(hero.topScale[1], v.y);
    return v.multiply(scale);
  });
}

export function buildBeveledMonolithData(hero: Hero) {
  const scale = new Vector3(...hero.scale);
  const vertices = taperStele(steleVertices(hero.groove), hero, scale);
  return bevelStele(vertices, [...walls.map(face => [face]), [front, opening]], scale, scale.x * hero.bevelWidthRatio);
}

export function buildMonumentCoreData(hero: Hero) {
  const scale = new Vector3(...hero.scale);
  const vertices = taperStele(steleCorners(), hero, scale);
  const faces = [[bottomCap], [topCap]];
  const { width, depth, bottom, top } = hero.groove;
  const section = [[-1, bottom], [-1, top], [1, top], [1, bottom]];

  // Four outward-facing charts with matching physical sections. Referencing the
  // original front section keeps the slit legible on the narrower side faces.
  for (const face of [front, [5, 1, 2, 6], [1, 0, 3, 2], [0, 4, 7, 3]]) {
    const [a, b, c, d] = face.map(i => vertices[i]);
    const base = a.clone().lerp(b, .5), crown = d.clone().lerp(c, .5);
    const across = b.clone().sub(a).normalize();
    const outward = across.clone().cross(new Vector3(0, 1, 0));
    const ring = (recess: number) => section.map(([side, y]) => {
      const halfWidth = width * scale.x * taperAt(hero.topScale[0], y) / 2;
      const setback = recess * scale.z * taperAt(hero.topScale[1], y);
      const point = base.clone().lerp(crown, y + .5)
        .addScaledVector(across, side * halfWidth).addScaledVector(outward, -setback);
      return vertices.push(point) - 1;
    });
    const mouth = ring(0), back = ring(depth);
    faces.push([face, mouth], [[back[0], back[3], back[2], back[1]]]);
    mouth.forEach((id, i) => {
      const j = (i + 1) % mouth.length;
      faces.push([[mouth[j], id, back[i], back[j]]]);
    });
  }

  return bevelStele(vertices, faces, scale, scale.x * hero.bevelWidthRatio);
}

function bevelStele(original: Vector3[], faces: number[][][], scale: Vector3, width: number) {
  // Inset in world units so the object's non-uniform scale does not stretch the bevel.
  const vertices: Vector3[] = [], normals: Vector3[] = [], indices: number[] = [];
  const edges = new Map<string, [number, number]>();
  const caps = original.map(() => new Map<number, number>());

  for (const loops of faces) {
    const [a, b, c] = loops[0].map(i => original[i]);
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    // Three applies the instance normal matrix later. Encode the inverse of
    // that correction here, leaving the world-space plane normal intact.
    const localNormal = normal.clone().multiply(scale).normalize();
    const inset = loops.map(loop => {
      const corners = loop.map((id, i) => {
        const point = original[id];
        const previous = original[loop[(i + loop.length - 1) % loop.length]];
        const next = original[loop[(i + 1) % loop.length]];
        const inA = normal.clone().cross(point.clone().sub(previous).normalize());
        const inB = normal.clone().cross(next.clone().sub(point).normalize());
        const miter = inA.clone().add(inB).multiplyScalar(width / (1 + inA.dot(inB)));
        vertices.push(point.clone().add(miter));
        normals.push(localNormal);
        return vertices.length - 1;
      });

      // Opposite face loops run in opposite directions on every shared edge.
      // Joining their insets adds a real chamfer with interpolated face normals.
      loop.forEach((id, i) => {
        const j = (i + 1) % loop.length, next = loop[j];
        const from = corners[i], to = corners[j];
        const reverse = edges.get(`${next}:${id}`);
        if (reverse) {
          const [otherTo, otherFrom] = reverse;
          quad(indices, [to, from, otherFrom, otherTo]);
          caps[id].set(otherFrom, from);
          caps[next].set(to, otherTo);
        } else {
          edges.set(`${id}:${next}`, [from, to]);
        }
      });
      return corners;
    });

    if (inset.length === 1) quad(indices, inset[0]);
    else indices.push(...triangulateFace(vertices, inset[0], inset[1]));
  }

  // This stele has exactly three incident faces at each original corner.
  for (const cap of caps) {
    const [a, b] = cap.entries().next().value!;
    indices.push(a, b, cap.get(b)!);
  }
  return {
    positions: new Float32Array(vertices.flatMap(v => v.divide(scale).toArray())),
    normals: new Float32Array(normals.flatMap(v => v.toArray())),
    indices: new Uint16Array(indices),
  };
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
