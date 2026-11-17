import { BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, MathUtils, ShapeUtils, SphereGeometry, Vector2, Vector3, type Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Vec3, WorldParameters } from './parameters.ts';

type City = WorldParameters['futureCity'];
type District = City['outerDistricts'][number] | City['middleDistricts'][number];
type Building = { position: Vec3; size: Vec3; yaw: number; shade: number };
type ShaftLevel = [x: number, y: number, z: number, width: number, depth: number];
const alloy = {
  silver: '#8a9eaf', shell: '#a3afbb', inset: '#111c27', footing: '#3d4751',
  rail: '#5b6f85', web: '#273849', sand: '#aa9980',
};

// Color-only pieces retain the G1 response in the shared shader.
export const legacyCityFinish = { roughness: .55, metalness: .26 } as const;
const citySurfaces = {
  satinAlloy:      { color: '#c4c9cb', roughness: .42, metalness: .34 },
  structuralIron: { color: '#465059', roughness: .78, metalness: .16 },
  precisionMetal: { color: '#8b9da9', roughness: .36, metalness: .46 },
  deckComposite:  { color: '#7e7b70', roughness: .77, metalness: .08 },
  sandAged:       { color: '#a69b86', roughness: .91, metalness: .03 },
} as const;

type CitySurface = string | { color: string; roughness: number; metalness: number };

function cityFinish(surface: CitySurface) {
  return typeof surface === 'string' ? legacyCityFinish : surface;
}

function cityColor(surface: CitySurface) {
  return typeof surface === 'string' ? surface : surface.color;
}

function cityFinishAttribute(vertexCount: number,
  { roughness, metalness }: { roughness: number; metalness: number } = legacyCityFinish) {
  const values = new Float32Array(vertexCount * 2);
  for (let i = 0; i < values.length; i += 2) {
    values[i] = roughness;
    values[i + 1] = metalness;
  }
  return new Float32BufferAttribute(values, 2);
}

function solid(vertices: Vec3[], faces: number[][], surface: CitySurface, marks = new Map<number, Vec3[]>()) {
  const positions: number[] = [];
  const lights: number[] = [];
  for (const [index, face] of faces.entries()) {
    const mark = marks.get(index);
    for (let i = 1; i + 1 < face.length; i++) {
      positions.push(...vertices[face[0]], ...vertices[face[i]], ...vertices[face[i + 1]]);
      if (mark) lights.push(...mark[0], ...mark[i], ...mark[i + 1]);
      else lights.push(0, 0, 0, 0, 0, 0, 0, 0, 0);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('cityMark', new Float32BufferAttribute(lights, 3));
  geometry.setAttribute('cityFinish', cityFinishAttribute(positions.length / 3, cityFinish(surface)));
  geometry.computeVertexNormals();
  const tint = new Color(cityColor(surface)), cladding = new Color(alloy.web);
  const colors = new Float32Array(positions.length);
  for (let i = 0; i < colors.length; i += 3) (lights[i + 2] === 1 ? cladding : tint).toArray(colors, i);
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

function finishedSolid(vertices: Vec3[], faces: number[][], finishes: CitySurface[], marks?: Map<number, Vec3[]>) {
  const geometry = solid(vertices, faces, alloy.rail, marks);
  const colors = geometry.getAttribute('color');
  const properties = geometry.getAttribute('cityFinish');
  const tint = new Color();
  let vertex = 0;
  for (const [i, face] of faces.entries()) {
    const finish = finishes[i];
    const { roughness, metalness } = cityFinish(finish);
    tint.set(marks?.get(i)?.[0][2] === 1 ? alloy.web : cityColor(finish));
    const count = (face.length - 2) * 3;
    for (let j = 0; j < count; j++, vertex++) {
      colors.setXYZ(vertex, tint.r, tint.g, tint.b);
      properties.setXY(vertex, roughness, metalness);
    }
  }
  return geometry;
}

function pier(at: Vec3, size: Vec3, taper: number, surface: CitySurface, cut = .13, lit?: (level: number, side: number) => number) {
  const [w, h, d] = size;
  return shaft([
    [at[0], at[1], at[2], w, d],
    [at[0], at[1] + h, at[2], w * taper, d * taper],
  ], surface, cut, lit);
}

type ShaftFinish = CitySurface | ((level: number, side: number) => CitySurface);
type FrontRebate = { center: number; width: number; depth: number };

function shaft(levels: ShaftLevel[], surface: ShaftFinish, cut: number,
  lit?: (level: number, side: number) => number, rebate?: FrontRebate) {
  const section = [[-.5 + cut, .5], [-.5, .5 - cut], [-.5, -.5 + cut], [-.5 + cut, -.5],
    [.5 - cut, -.5], [.5, -.5 + cut], [.5, .5 - cut], [.5 - cut, .5]];
  if (rebate) {
    const { center, width, depth } = rebate;
    const right = center + width / 2, left = center - width / 2;
    section.push([right, .5], [right, .5 - depth], [left, .5 - depth], [left, .5]);
  }
  const vertices: Vec3[] = levels.flatMap(([x, y, z, w, d]) =>
    section.map(([u, v]): Vec3 => [x + u * w, y, z + v * d]));
  const count = section.length;
  // The rebate opens into the section, so its end caps cannot use a triangle fan.
  const caps = rebate ? ShapeUtils.triangulateShape(section.map(([x, z]) => new Vector2(x, z)), [])
    : [section.map((_, i) => i)];
  const faces = [...caps];
  const finishes: CitySurface[] = [];
  const finish = typeof surface === 'function' ? surface : null;
  if (finish) caps.forEach(() => finishes.push(finish(0, -1)));
  const marks = new Map<number, Vec3[]>();
  for (let level = 0; level < levels.length - 1; level++) for (let i = 0; i < count; i++) {
    const start = level * count;
    const a = start + i, b = start + (i + 1) % count;
    const light = lit?.(level, i);
    if (light) marks.set(faces.length, [[0, 0, light], [0, 1, light], [1, 1, light], [1, 0, light]]);
    faces.push([a, a + count, b + count, b]);
    if (finish) finishes.push(finish(level, i));
  }
  for (const cap of caps) {
    faces.push(cap.map(i => vertices.length - count + i).reverse());
    if (finish) finishes.push(finish(levels.length - 2, -1));
  }
  return typeof surface === 'function' ? finishedSolid(vertices, faces, finishes, marks)
    : solid(vertices, faces, surface, marks);
}

function merge(parts: BufferGeometry[]) {
  const result = mergeGeometries(parts)!;
  parts.forEach(part => part.dispose());
  return result;
}

const { satinAlloy, structuralIron, precisionMetal, deckComposite, sandAged } = citySurfaces;

// Archetypes are authored in the existing lot units: the base sets the
// footprint and the highest occupied tier stays at y = 1.
function districtFooting(bottom: number, top: number, depth: number, taper: number) {
  return shaft([
    [0, bottom, 0, 1, depth],
    [0, MathUtils.lerp(bottom, top, .58), 0, 1, depth],
    [0, top, 0, taper, depth * taper],
  ], band => band === 0 ? sandAged : structuralIron, .11);
}

const cityArchetypes = {
  'service-podium': () => [
    shaft([
      [0, -.10, 0, 1, .94], [0, .33, 0, .96, .9024],
    ], (_, edge) => edge === 0 || edge === 6 || edge === 7 ? sandAged : structuralIron, .11),
    // A recessed service band under the wide upper body and its working roof.
    shaft([
      [-.07, .28, .04, .71, .65], [-.07, .37, .04, .71, .65],
      [-.07, .43, .04, .82, .76], [-.07, .63, .04, .79, .72],
    ], (band, edge) => band === 0 ? structuralIron : edge === -1 ? deckComposite : satinAlloy, .10),
    shaft([
      [.24, .55, -.14, .29, .43], [.24, .66, -.14, .26, .37],
      [.24, 1, -.14, .22, .32],
    ], band => band === 0 ? structuralIron : satinAlloy, .13),
    pier([-.35, .26, .12], [.25, .21, .42], .80, structuralIron, .16),
  ],
  'gatehouse-block': () => [
    districtFooting(-.10, .13, 1, .99),
    // Inward faces expose the jambs; the open bay starts just above the footing.
    shaft([
      [-.34, .10, 0, .31, .86], [-.34, .22, 0, .30, .81],
      [-.34, 1, 0, .2821, .75],
    ], (band, edge) => band === 0 || edge === 5 ? structuralIron : satinAlloy, .09),
    shaft([
      [.32, .10, .05, .35, .77], [.32, .22, .05, .33, .75],
      [.32, .86, .05, .31, .68],
    ], (band, edge) => band === 0 || edge === 1 ? structuralIron : satinAlloy, .09),
    shaft([
      [0, .69, .12, .72, .53], [0, .74, .12, .84, .71],
      [0, .83, .12, .79, .65],
    ], (band, edge) => band === 0 ? structuralIron : edge === -1 ? deckComposite : satinAlloy, .14),
  ],
  'bridge-pair': () => [
    districtFooting(-.10, .14, .98, .98),
    shaft([
      [-.30, .10, -.12, .34, .72], [-.30, .29, -.12, .32, .67],
      [-.30, .85, -.12, .30, .58], [-.30, 1, -.12, .2584, .5472],
    ], band => band === 0 ? structuralIron : satinAlloy, .09),
    shaft([
      [.29, .11, .11, .37, .68], [.29, .26, .11, .35, .65],
      [.29, .73, .11, .35, .64], [.29, .84, .11, .3145, .578],
    ], band => band === 0 ? structuralIron : satinAlloy, .09),
    // One crossing, with a deep underbeam and two haunches seated into the towers.
    shaft([
      [0, .594, .02, .61, .18], [0, .645, .02, .64, .30], [0, .69, .02, .64, .32],
    ], band => band === 0 ? structuralIron : deckComposite, .12),
    shaft([[-.25, .51, .02, .14, .21], [-.226, .647, .02, .23, .28]], structuralIron, .16),
    shaft([[.25, .51, .02, .14, .21], [.224, .647, .02, .23, .28]], structuralIron, .16),
  ],
  'stepped-core-tower': () => [
    districtFooting(-.12, .18, 1, .94),
    shaft([
      [0, .16, 0, .86, .89], [0, .425, 0, .85, .88], [-.02, .49, -.015, .77, .81],
    ], band => band === 0 ? satinAlloy : deckComposite, .08),
    // A single full-height rebate makes the middle tier read as a vertical extrusion.
    shaft([
      [-.08, .47, -.04, .61, .72], [-.08, .73, -.04, .61, .72],
      [-.10, .80, -.05, .55, .64],
    ], (_, edge) => edge >= 8 && edge <= 10 ? structuralIron : satinAlloy,
      .09, undefined, { center: .17, width: .16, depth: .13 }),
    shaft([
      [-.15, .78, -.10, .42, .51], [-.15, .835, -.10, .39, .48],
      [-.15, 1, -.10, .3318, .4029],
    ], band => band === 0 ? structuralIron : precisionMetal, .13,
    (level, side) => level === 1 && side === 7 ? 4 : 0),
  ],
  'winged-tower': () => [
    districtFooting(-.10, .17, 1, .96),
    shaft([
      [-.18, .14, -.07, .58, .74], [-.18, .26, -.07, .55, .71],
      [-.18, .89, -.07, .50, .64], [-.18, 1, -.07, .464, .592],
    ], band => band === 0 ? structuralIron : satinAlloy, .09),
    // The wing grows from the footing on a separate bearing line, then seats into the tower.
    shaft([
      [.255, .15, .105, .43, .71], [.235, .27, .11, .49, .75],
      [.198, .61, .08, .45, .62],
    ], structuralIron, .13),
    shaft([
      [.08, .48, .18, .27, .37], [.043, .63, .20, .22, .31],
    ], precisionMetal, .16),
  ],
  'forecourt-transfer': () => [
    districtFooting(-.06, .33, 1, .95),
    // The front of the terrace is a clear tread; its rear shoulder takes the annexes.
    shaft([
      [-.07, .29, -.09, .86, .77], [-.07, .41, -.10, .85, .74],
      [-.07, .56, -.13, .76, .66], [-.07, .62, -.13, .76, .66],
    ], band => [structuralIron, satinAlloy, deckComposite][band], .13),
    shaft([
      [-.28, .59, -.24, .36, .43], [-.28, .70, -.24, .34, .40],
      [-.28, 1, -.24, .3024, .3612],
    ], band => band === 0 ? structuralIron : satinAlloy, .11),
    shaft([
      [.28, .58, -.27, .27, .37], [.28, .66, -.27, .27, .37],
      [.28, .87, -.27, .2457, .3367],
    ], band => band === 0 ? structuralIron : satinAlloy, .11),
  ],
} satisfies Record<string, () => BufferGeometry[]>;

type ArchetypeId = keyof typeof cityArchetypes;
type Cluster = readonly [ArchetypeId, number, number, number, number, number];

// Each slot names a complete complex. The open strip through each shelf
// separates its frontage from the taller back row.
const districtClusters: Record<District[6], readonly Cluster[]> = {
  outer: [
    ['service-podium', -.31, .24, .28, .28, 315], ['service-podium', .01, .25, .30, .29, 185],
    ['service-podium', .32, .21, .25, .32, 265], ['service-podium', -.28, -.10, .34, .22, 390],
    ['service-podium', .22, -.12, .35, .23, 360], ['service-podium', -.22, -.34, .34, .20, 485],
    ['service-podium', .15, -.35, .23, .22, 285], ['service-podium', .37, -.32, .16, .18, 215],
  ],
  middle: [
    ['service-podium', -.31, .27, .25, .24, 365], ['gatehouse-block', .01, .26, .35, .27, 610],
    ['service-podium', .34, .24, .20, .24, 280], ['winged-tower', -.29, -.04, .30, .26, 970],
    ['gatehouse-block', .24, -.03, .36, .26, 870], ['gatehouse-block', -.32, -.34, .28, .24, 1020],
    ['bridge-pair', .03, -.34, .33, .24, 1290], ['winged-tower', .34, -.31, .23, .25, 1060],
  ],
  inner: [
    ['gatehouse-block', -.32, .26, .24, .22, 710], ['winged-tower', .02, .27, .27, .24, 990],
    ['service-podium', .34, .25, .20, .22, 480], ['stepped-core-tower', -.29, -.01, .24, .22, 1520],
    ['winged-tower', .24, -.04, .30, .23, 1420], ['stepped-core-tower', -.34, -.31, .22, .25, 1770],
    ['bridge-pair', .00, -.33, .34, .25, 1610], ['stepped-core-tower', .34, -.31, .23, .25, 1940],
  ],
};

function modularDistricts(districts: readonly District[], seed: number) {
  const buildings = new Map<ArchetypeId, Building[]>();
  const place = (id: ArchetypeId, building: Building) => {
    const instances = buildings.get(id);
    if (instances) instances.push(building);
    else buildings.set(id, [building]);
  };
  let state = seed >>> 0;
  const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (const [x, z, width, depth, datum, degrees, zone] of districts) {
    const yaw = MathUtils.degToRad(degrees);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const flip = random() < .5 ? -1 : 1;
    for (const [type, u, v, w, d, height] of districtClusters[zone]) {
      const a = width * (u * flip + (random() - .5) * .035);
      const b = depth * (v + (random() - .5) * .035);
      // Reserve bridges for the rear terraces, away from the main approach.
      const id = type === 'bridge-pair' && z > -1200 ? 'winged-tower' : type;
      // The service lanes pass over the front shelves' back rows.
      const streetHeight = zone === 'middle' && z > 0 && id === 'winged-tower' ? height * .74 : height;
      place(id, {
        position: [x + c * a + s * b, datum + (v < -.2 ? 105 : v < 0 ? 45 : 15), z - s * a + c * b],
        size: [width * w, streetHeight * (.84 + random() * .30), depth * d],
        yaw: yaw + (random() < .25 ? Math.PI : 0),
        shade: .85 + random() * .17,
      });
    }
  }
  for (const side of [-1, 1]) {
    place('forecourt-transfer', { position: [side * 1670, 0, 1040], size: [1240, 860, 1100], yaw: side * .10, shade: .96 });
    place('gatehouse-block', { position: [side * 1750, 0, 1830], size: [840, 515, 460], yaw: 0, shade: .94 });
    place('forecourt-transfer', { position: [side * 2220, 0, 160], size: [750, 505, 910], yaw: side * .10, shade: .89 });
  }
  return [...buildings].map(([id, instances]) => ({ id, geometry: merge(cityArchetypes[id]()), buildings: instances }));
}

const ringSegments = [[2, 38], [42, 82], [86, 121], [125, 174],
  [178, 220], [224, 267], [271, 309], [313, 358]] as const;

type Quad = [number, number, number, number];
type PanelRecess = {
  across: readonly [number, number];
  along: readonly [number, number];
  depth: number;
  bevel: number;
  surface: CitySurface;
  lining: CitySurface;
  floor: CitySurface;
};

// Replace one flat face with a framed recess. The original perimeter is shared
// with its neighbours, so the joint does not alter the swept profile.
function recessPanel(vertices: Vec3[], face: Quad, recess: PanelRecess) {
  const [a, b, c, d] = face.map(i => new Vector3(...vertices[i]));
  const across = b.clone().sub(a);
  const along = d.clone().sub(a);
  const inward = across.clone().cross(along).normalize().negate();
  const { across: [u0, u1], along: [v0, v1], depth, bevel, surface, lining, floor } = recess;
  const bu = Math.min(bevel / across.length(), (u1 - u0) * .25);
  const bv = Math.min(bevel / along.length(), (v1 - v0) * .25);
  const addQuad = (u0: number, u1: number, v0: number, v1: number, depth: number) =>
    [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => {
      const near = a.clone().lerp(b, u);
      const far = d.clone().lerp(c, u);
      vertices.push(near.lerp(far, v).addScaledVector(inward, depth).toArray());
      return vertices.length - 1;
    });
  const lip = addQuad(u0, u1, v0, v1, 0);
  const bed = addQuad(u0 + bu, u1 - bu, v0 + bv, v1 - bv, depth);
  const faces: number[][] = [], finishes: CitySurface[] = [];
  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4;
    faces.push([face[i], face[next], lip[next], lip[i]], [lip[i], lip[next], bed[next], bed[i]]);
    finishes.push(surface, lining);
  }
  faces.push(bed);
  finishes.push(floor);
  return { faces, finishes };
}

function ringShellJoint(vertices: Vec3[], face: Quad, width: number, depth: number, surface: CitySurface,
  floor: CitySurface) {
  const span = new Vector3(...vertices[face[0]]).distanceTo(new Vector3(...vertices[face[3]]));
  const half = width / (2 * span);
  return recessPanel(vertices, face, {
    across: [.14, .86], along: [.5 - half, .5 + half], depth, bevel: 8,
    surface, lining: precisionMetal, floor,
  });
}

type ArcFinish = {
  sides: readonly [CitySurface, CitySurface, CitySurface, CitySurface];
  end: CitySurface;
  bevel: number;
  joint?: { width: number; floor: CitySurface };
};

function trackArc(radius: number, y: number, width: number, depth: number,
  start: number, end: number, segments: number, finish: ArcFinish, lit = false) {
  const vertices: Vec3[] = [];
  const faces: number[][] = [];
  const finishes: CitySurface[] = [];
  const marks = new Map<number, Vec3[]>();
  const endBevel = finish.bevel;
  const bevelAngle = MathUtils.radToDeg(endBevel / radius);
  const angles = Array.from({ length: segments + 1 }, (_, i) =>
    MathUtils.lerp(start + bevelAngle, end - bevelAngle, i / segments));
  if (endBevel) { angles.unshift(start); angles.push(end); }
  const last = angles.length - 1;
  for (const [i, degrees] of angles.entries()) {
    const angle = MathUtils.degToRad(degrees);
    const c = Math.cos(angle), s = Math.sin(angle);
    const trim = i === 0 || i === last ? endBevel * .17 : 0;
    const halfWidth = width / 2 - trim, halfDepth = depth / 2 - trim;
    for (const [offset, height] of [[-halfWidth, -halfDepth], [halfWidth, -halfDepth],
      [halfWidth, halfDepth], [-halfWidth, halfDepth]]) {
      vertices.push([(radius + offset) * c, y + height, (radius + offset) * s]);
    }
  }
  for (let i = 0; i < last; i++) for (let side = 0; side < 4; side++) {
    const a = i * 4 + side, b = i * 4 + (side + 1) % 4;
    const face: Quad = [a, b, b + 4, a + 4];
    const marked = lit && (side === 0 || side === 3);
    if (side === 1 && i === Math.floor(last / 2) && finish.joint) {
      const joint = ringShellJoint(vertices, face, finish.joint.width, 11, finish.sides[side], finish.joint.floor);
      faces.push(...joint.faces);
      finishes.push(...joint.finishes);
      continue;
    }
    if (marked) {
      const low = (angles[i] - start) / (end - start), high = (angles[i + 1] - start) / (end - start);
      marks.set(faces.length, [[0, low, 2], [1, low, 2], [1, high, 2], [0, high, 2]]);
    }
    faces.push(face);
    finishes.push(!marked && (i === 0 || i === last - 1) ? finish.end : finish.sides[side]);
  }
  faces.push([3, 2, 1, 0], [last * 4, last * 4 + 1, last * 4 + 2, last * 4 + 3]);
  finishes.push(finish.end, finish.end);
  return finishedSolid(vertices, faces, finishes, marks);
}

// Radial offset and height in the main beam's cross-section. The city-facing web
// sits behind the two flanges, with a continuous hollow cell behind the web.
const beamSection = {
  outline: [[-138, -147], [165, -147], [165, 147], [-145, 147], [-165, 129],
    [-165, 66], [-47, 66], [-47, -66], [-165, -66], [-165, -125]],
  cell: [[-12, -94], [111, -94], [111, 94], [-12, 94]],
};
const terminalSection = {
  outline: [[-151, -147], [165, -147], [165, 147], [-151, 147], [-165, 137],
    [-165, 48], [-123, 48], [-123, -48], [-165, -48], [-165, -136]],
  cell: [[8, -62], [89, -62], [89, 62], [8, 62]],
};
const terminalShoulder = {
  outline: terminalSection.outline.map(([x, y]) => [x * .94, y * .95]),
  cell: [[4, -72], [98, -72], [98, 72], [4, 72]],
};
const terminalCap = ShapeUtils.triangulateShape(
  terminalSection.outline.map(([x, y]) => new Vector2(x, y)),
  [terminalSection.cell.map(([x, y]) => new Vector2(x, y))],
);

function mainRingBeam(radius: number, start: number, end: number, segments: number) {
  // Short integral terminal collars taper into the normal cross-section. The
  // annular caps close the steel around the cell without closing the cell itself.
  const neck = MathUtils.radToDeg(45 / radius);
  const terminalSpan = MathUtils.radToDeg(118 / radius);
  const stations = [start, start + neck, ...Array.from({ length: segments + 1 }, (_, i) =>
    MathUtils.lerp(start + terminalSpan, end - terminalSpan, i / segments)), end - neck, end];
  const { outline, cell } = beamSection;
  const stride = outline.length + cell.length;
  const last = stations.length - 1;
  const vertices = stations.flatMap((degrees, i) => {
    const angle = MathUtils.degToRad(degrees);
    const c = Math.cos(angle), s = Math.sin(angle);
    const section = i === 0 || i === last ? terminalSection
      : i === 1 || i === last - 1 ? terminalShoulder : beamSection;
    return [...section.outline, ...section.cell].map(([x, y]): Vec3 => [(radius + x) * c, y, (radius + x) * s]);
  });
  const faces: number[][] = [];
  const finishes: CitySurface[] = [];
  const sideFinish = [structuralIron, satinAlloy, satinAlloy, satinAlloy, satinAlloy,
    precisionMetal, structuralIron, precisionMetal, satinAlloy, satinAlloy];
  for (let i = 0; i < last; i++) {
    const first = i * stride;
    const terminal = i === 0 || i === last - 1;
    const panelJoint = i === 2 + Math.floor(segments / 3) || i === 2 + Math.floor(segments * 2 / 3);
    for (let side = 0; side < outline.length; side++) {
      const a = first + side, b = first + (side + 1) % outline.length;
      const face: Quad = [a, b, b + stride, a + stride];
      if (side === 1 && panelJoint) {
        const joint = ringShellJoint(vertices, face, 34, 16, satinAlloy, precisionMetal);
        faces.push(...joint.faces);
        finishes.push(...joint.finishes);
        continue;
      }
      faces.push(face);
      // The machined return bridges the collar to the shell and lines the bore mouth.
      finishes.push(terminal && (side === 1 || side === 6) ? precisionMetal : sideFinish[side]);
    }
    for (let side = 0; side < cell.length; side++) {
      const a = first + outline.length + side;
      const b = first + outline.length + (side + 1) % cell.length;
      faces.push([b, a, a + stride, b + stride]);
      finishes.push(terminal ? precisionMetal : structuralIron);
    }
  }
  for (const face of terminalCap) {
    faces.push([...face].reverse(), face.map(i => i + last * stride));
    finishes.push(precisionMetal, precisionMetal);
  }
  return finishedSolid(vertices, faces, finishes);
}

function ringBrace(section: number[][], tangent: number, width: number) {
  const vertices = [-width / 2, width / 2].flatMap(side =>
    section.map(([x, y]): Vec3 => [x, y, tangent + side]));
  return solid(vertices, [[3, 2, 1, 0], [4, 5, 6, 7],
    [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]], structuralIron);
}

function ringSupport(guideOffset: number, tangent: number, width: number) {
  const guideEnd = -guideOffset - 55;
  return [
    ringBrace([[guideEnd, -323], [58, -162], [58, -109], [guideEnd, -218]], tangent, width),
    pier([16, -166, tangent], [136, 36, width + 52], .92, precisionMetal, .19),
    shaft([
      [-guideOffset, -328, tangent, 174, width + 12],
      [-guideOffset, -304, tangent, 180, width + 18],
      [-guideOffset, -232, tangent, 172.96, (width + 18) * .94],
    ], band => band === 0 ? precisionMetal : structuralIron, .16),
  ];
}

const anchorInset = 111;
const transferBottom = -195;
function transferNode(guideOffset: number) {
  return [
    // Keep the sightline to the existing observation keel between the braces.
    ...ringSupport(guideOffset, -205, 70), ...ringSupport(guideOffset, 205, 70),
    pier([-guideOffset - 27, -274, 0], [228, 46, 466], 1, deckComposite, .15),
    pier([-anchorInset, transferBottom, 0], [97, 57, 118], 1.38, structuralIron, .24),
  ];
}

const innerArcRadius = 4235;
const innerArcSpans = [[50, 74], [129, 153], [186, 210], [281, 303]] as const;
const carrierRail: ArcFinish = {
  sides: [precisionMetal, structuralIron, structuralIron, precisionMetal],
  end: precisionMetal, bevel: 56, joint: { width: 36, floor: structuralIron },
};
const shortGuide: ArcFinish = {
  sides: [structuralIron, precisionMetal, precisionMetal, precisionMetal],
  end: precisionMetal, bevel: 38,
};

function inboardSkyport({ inset, length, width, deckHeight }: City['ring']['skyports'][number]) {
  const tip = -inset - length / 2;
  // Each station carries the deck edge and underside in one section. The
  // upper shoulder descends from M1 through M2 to the level berth.
  const stations = [
    [54, -116, -261, .34],
    [-156, -190, -470, .48],
    [-227, -282, -572, .60],
    [-388, deckHeight, deckHeight - 119, .91],
    [-583, deckHeight, deckHeight - 181, 1],
    [tip + 173, deckHeight, deckHeight - 158, .94],
    [tip, deckHeight, deckHeight - 84, .68],
  ];
  const vertices = stations.flatMap(([x, top, bottom, span]) => {
    const half = width * span / 2;
    const shoulder = top - Math.min(66, (top - bottom) * .62);
    return [[top, -half], [top, half], [top - 22, half], [shoulder, half * .87],
      [bottom, half * .56], [bottom, -half * .56], [shoulder, -half * .87], [top - 22, -half]]
      .map(([y, z]): Vec3 => [x, y, z]);
  });
  const faces = [Array.from({ length: 8 }, (_, i) => i)];
  const finishes: CitySurface[] = [structuralIron];
  const rootFinish = [satinAlloy, precisionMetal, structuralIron, structuralIron,
    structuralIron, structuralIron, structuralIron, precisionMetal];
  const deckFinish = [deckComposite, satinAlloy, satinAlloy, structuralIron,
    structuralIron, structuralIron, satinAlloy, precisionMetal];
  const panels = [
    { station: 2, side: 4, recess: { // Inspection plate at the lower root.
      across: [.20, .80], along: [.16, .84], depth: 14, bevel: 12,
      surface: structuralIron, lining: precisionMetal, floor: structuralIron,
    } },
    { station: 3, side: 0, recess: { // Hatch lies landward of the berth.
      across: [.34, .57], along: [.23, .64], depth: 9, bevel: 7,
      surface: deckComposite, lining: structuralIron, floor: deckComposite,
    } },
    { station: 4, side: 0, recess: { // The setback runs beyond the passenger skids.
      across: [.85, .97], along: [.10, .91], depth: 20, bevel: 10,
      surface: deckComposite, lining: precisionMetal, floor: sandAged,
    } },
    { station: 4, side: 4, recess: { // A single large recessed belly plate.
      across: [.17, .83], along: [.11, .89], depth: 24, bevel: 22,
      surface: structuralIron, lining: precisionMetal, floor: structuralIron,
    } },
  ] as const;
  for (let i = 0; i < stations.length - 1; i++) {
    for (let side = 0; side < 8; side++) {
      const a = i * 8 + side, b = i * 8 + (side + 1) % 8;
      const face: Quad = [b, a, a + 8, b + 8];
      const panel = panels.find(panel => panel.station === i && panel.side === side);
      if (panel) {
        const cut = recessPanel(vertices, face, panel.recess);
        faces.push(...cut.faces);
        finishes.push(...cut.finishes);
      } else {
        faces.push(face);
        finishes.push((i < 3 ? rootFinish : deckFinish)[side]);
      }
    }
  }
  const end = (stations.length - 1) * 8;
  // The nose exposes the machined edge, shell return and iron belly in section.
  for (const panel of [[7, 2, 1, 0], [6, 3, 2, 7], [5, 4, 3, 6]]) {
    faces.push(panel.map(i => end + i));
  }
  finishes.push(precisionMetal, satinAlloy, structuralIron);
  return finishedSolid(vertices, faces, finishes);
}

function buildPrimaryRing({ radius, guideOffset, skyports }: City['ring'], segments: number) {
  const track: BufferGeometry[] = [];
  const anchorDegrees = 62;
  const transferNodes = [anchorDegrees, 245.5];
  const place = (degrees: number, parts: BufferGeometry[]) => {
    const angle = MathUtils.degToRad(degrees);
    track.push(...parts.map(part => part.rotateY(-angle)
      .translate(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)));
  };
  for (const [start, end] of ringSegments) {
    track.push(mainRingBeam(radius, start, end, segments),
      trackArc(radius - guideOffset, -222, 176, 164, start + 2, end - 2, segments, carrierRail, true));
    for (const fraction of [.21, .79]) {
      const degrees = MathUtils.lerp(start, end, fraction);
      // The skyport root already bridges the two rails at its station.
      if (skyports.every(port => Math.abs(degrees - port.degrees) > 5)) {
        place(degrees, ringSupport(guideOffset, 0, 106));
      }
    }
    for (const degrees of transferNodes) {
      if (degrees > start && degrees < end) place(degrees, transferNode(guideOffset));
    }
  }
  for (const [start, end] of innerArcSpans) {
    track.push(trackArc(innerArcRadius, -190, 90, 102, start, end, Math.ceil(segments * .6), shortGuide));
    const innerSeat = innerArcRadius - radius - 35;
    for (const fraction of [.19, .81]) {
      place(MathUtils.lerp(start, end, fraction), [
        ringBrace([[innerSeat, -247], [-guideOffset, -275], [-guideOffset, -208], [innerSeat, -170]], 0, 79),
        pier([innerSeat + 35, -255, 0], [90, 41, 108], .9, precisionMetal, .18),
      ]);
    }
  }
  for (const port of skyports) place(port.degrees, [inboardSkyport(port)]);
  // The original observation point sits just below the valley-facing node's keel.
  const angle = MathUtils.degToRad(anchorDegrees);
  const r = radius - anchorInset;
  const ringAnchor: Vec3 = [Math.cos(angle) * r, transferBottom - .4, Math.sin(angle) * r];
  return { ring: merge(track), ringAnchor };
}

function buildSecondaryRing({ radius, sectionScale: scale }: City['secondaryRing'], segments: number) {
  // Grow the shell up and outward from the return to preserve the approach
  // clearance under the inner edge.
  const shellDepth = 244 * scale;
  const returnDepth = 96 * scale;
  return merge(ringSegments.flatMap(([start, end], index) => {
    const angle = MathUtils.degToRad(MathUtils.lerp(start, end, index % 2 ? .72 : .28));
    const bearingRadius = radius - 56 * scale;
    const bearing = shaft([
      [0, -34, 0, 128 * scale, 152 * scale],
      [0, -34 + 38 * scale, 0, 125 * scale, 146 * scale],
      [0, -34 + 115 * scale, 0, 128 * scale * .84, 152 * scale * .84],
    ], band => band === 0 ? precisionMetal : structuralIron, .20)
      .rotateY(-angle).translate(Math.cos(angle) * bearingRadius, 0, Math.sin(angle) * bearingRadius);
    return [
      trackArc(radius + 40 * scale, shellDepth / 2 - 28.2, 256 * scale, shellDepth,
        start, end, segments, {
          sides: [structuralIron, satinAlloy, satinAlloy, precisionMetal], end: precisionMetal, bevel: 75,
          joint: index % 2 === 0 ? { width: 28, floor: precisionMetal } : undefined,
        }),
      trackArc(radius - 65 * scale, returnDepth / 2 - 36, 106 * scale, returnDepth,
        start + 2, end - 2, segments, {
          sides: [precisionMetal, structuralIron, structuralIron, precisionMetal], end: structuralIron, bevel: 49,
        }, true),
      bearing,
    ];
  }));
}

function buildSatellites({ count, orbitRadius, sphereRadius }: City['satellites'], compact: boolean) {
  const sphere = new SphereGeometry(sphereRadius, compact ? 20 : 28, compact ? 12 : 18);
  const uv = sphere.getAttribute('uv');
  const color = new Color('#536677');
  const colors = new Float32Array(uv.count * 3), marks = new Float32Array(uv.count * 3);
  for (let i = 0; i < uv.count; i++) {
    color.toArray(colors, i * 3);
    marks.set([uv.getY(i), 0, 5], i * 3);
  }
  sphere.setAttribute('color', new Float32BufferAttribute(colors, 3));
  sphere.setAttribute('cityMark', new Float32BufferAttribute(marks, 3));
  sphere.setAttribute('cityFinish', cityFinishAttribute(uv.count));
  const members = Array.from({ length: count }, (_, i) => {
    const angle = 2 * Math.PI * i / count;
    return sphere.clone().translate(orbitRadius * Math.cos(angle), 0, orbitRadius * Math.sin(angle));
  });
  sphere.dispose();
  return merge(members);
}

function buildSpireWing(side: -1 | 1, coreWidth: number) {
  const { satinAlloy, structuralIron, precisionMetal, sandAged } = citySurfaces;
  const z = side < 0 ? 10 : -245;
  const top = side < 0 ? 8750 : 8370;
  const profile: ShaftLevel[] = [
    [side * (coreWidth / 2 - 320), 970, z, 640, 1160],
    [side * 390, 4050, z - 16, 582, 1050],
    [side * 390, 4500, z - 58, 532, 925],
    [side * 390, 6570, z - 91, 447, 808],
    [side * 370, 6800, z - 130, 368, 654],
    [side * 340, top - 395, z - 169, 228, 317],
    [side * 330, top, z - 188, 148, 190],
  ];
  const sectionAt = (y: number): ShaftLevel => {
    const next = profile.findIndex(level => level[1] >= y);
    if (next === 0) return profile[0];
    const [x0, y0, z0, w0, d0] = profile[next - 1];
    const [x1, y1, z1, w1, d1] = profile[next];
    const t = (y - y0) / (y1 - y0);
    return [MathUtils.lerp(x0, x1, t), y, MathUtils.lerp(z0, z1, t),
      MathUtils.lerp(w0, w1, t), MathUtils.lerp(d0, d1, t)];
  };

  // Keep the rear line and taper. Recess the leading face behind the shell courses.
  const wing = [[970, 0], [1500, 210], [4050, 230], [4500, 240], [6570, 165],
    [6800, 0], [top - 395, 0], [top, 0]].map(([y, recess]): ShaftLevel => {
    const [x, , z, w, d] = sectionAt(y);
    return [x, y, z - recess / 2, w, d - recess];
  });
  const parts = [
    shaft(wing, structuralIron, .23),
    // The flared shoe is let into the podium. Only its lowest exposed skirt takes sand.
    shaft([
      [side * 487, 760, z - 80, 722, 1270],
      [side * 487, 850, z - 80, 735, 1300],
      [side * 466, 1170, z - 48, 665, 1110],
      [side * 448, 1260, z - 63, 598, 967],
      [side * 414, 1730, z - 100, 490, 750],
    ], band => band === 0 ? sandAged : structuralIron, .19),
  ];
  const offset = side > 0 ? 100 : 0;
  const courses = [
    { from: 1620, to: 2690 - offset, width: .77, shift: .035, thickness: 104 },
    { from: 2870 - offset, to: 4310 - offset, width: .66, shift: .085, thickness: 114 },
    { from: 4515, to: 6240 - offset, width: .72, shift: .025, thickness: 88 },
  ];
  for (const [index, { from, to, width, shift, thickness }] of courses.entries()) {
    const entry = 135, exit = 106;
    const stations = [from, from + entry, ...profile.map(level => level[1]).filter(y => y > from + entry && y < to - exit), to - exit, to];
    const casing = stations.map((y, i): ShaftLevel => {
      const [x, , z, w, d] = sectionAt(y);
      const rim = i === 0 || i === stations.length - 1;
      return [x + side * w * shift, y, z + d / 2 - 15 - thickness / 2 - (rim ? 31 : 0),
        w * width * (rim ? .84 : 1), thickness - (rim ? 30 : 0)];
    });
    // Iron seats enter the wing behind the casing; a machined shoe is exposed
    // at the lower end of each course. The remaining gap stays open.
    const [x, , z, w, d] = sectionAt(from + entry);
    const face = z + d / 2;
    const seatX = x + side * w * shift;
    parts.push(
      shaft(casing, (_, edge) => edge === 9 || edge === 0 || edge === 6 ? structuralIron : satinAlloy,
        .10, undefined, index === 2 ? undefined : { center: side * .18, width: .14, depth: .44 }),
      shaft([
        [seatX, from - 70, face - 202, w * .37, 108],
        [seatX, from + 35, face - 154, w * .55, 205],
        [seatX, from + entry + 50, face - 161, w * .45, 190],
      ], structuralIron, .17),
      pier([seatX, from + 12, face - 62], [w * .43, 82, 72], .87, precisionMetal, .12),
    );
  }
  return parts;
}

function buildAxialSpire(coreWidth: number) {
  const { satinAlloy, structuralIron, precisionMetal, deckComposite, sandAged } = citySurfaces;
  const parts = [
    shaft([
      [0, -180, 80, 3650, 3270], [0, 118, 80, 3470, 3110],
      [0, 225, 80, 3321.5, 2975.7],
    ], band => band === 0 ? structuralIron : sandAged, .23),
    shaft([
      [0, 205, 10, 2920, 2720], [0, 265, 10, 2890, 2680],
      [0, 532, 10, 2720, 2500], [0, 625, 10, 2569.6, 2393.6],
    ], band => [structuralIron, satinAlloy, deckComposite][band], .19),
    shaft([
      [0, 595, -100, 2100, 2040], [0, 852, -100, 2010, 1910],
      [0, 970, -100, 1806, 1754.4],
    ], band => band === 0 ? satinAlloy : deckComposite, .19),
    shaft([
      [0, 950, -190, 1390, 1390], [0, 1045, -194, 1340, 1330],
      [0, 1440, -208, 1210, 1190], [0, 1525, -190, 1112, 1112],
    ], band => band === 0 ? deckComposite : structuralIron, .21),
    // The wings form the side walls of the bay. This spine closes it from behind.
    shaft([
      [0, 1120, -385, 880, 730],
      [0, 1640, -595, 760, 600],
      [0, 3100, -650, 740, 530],
      [0, 5000, -635, 675, 530],
      [0, 6500, -595, 535, 480],
      [0, 6870, -540, 455, 450],
      [0, 7360, -460, 270.3, 300.9],
    ], structuralIron, .22),
    ...buildSpireWing(-1, coreWidth),
    ...buildSpireWing(1, coreWidth),
  ];
  for (const side of [-1, 1]) {
    parts.push(shaft([
      [side * 158, 1440, -280, 170, 270],
      [side * 123, 2870, -341, 120, 170],
      [side * 104, 4970, -326, 102, 170],
      [side * 100, 6470, -341, 76, 146],
    ], precisionMetal, .18, (level, face) => level === 1 && face === (side < 0 ? 6 : 0) ? 1 : 0));
  }
  for (const [y, span, front] of [[2680, 950, 176], [4740, 850, 123]]) {
    // Two diaphragms tie both wings to the spine. The tall bays between them stay open.
    const back = -520;
    const depth = front - back;
    const z = (front + back) / 2;
    parts.push(shaft([
      [0, y, z - 14, span * .91, depth - 28],
      [0, y + 49, z, span, depth],
      [0, y + 121, z, span, depth],
    ], band => band === 0 ? structuralIron : deckComposite, .12),
    shaft([
      [0, y - 142, z - 67, span * .62, depth - 122],
      [0, y - 40, z - 52, span * .91, depth - 74],
      [0, y + 5, z - 52, span * .96, depth - 66],
    ], structuralIron, .15));
  }
  return parts;
}

export function buildSkyline(city: City, seed: number, compact: boolean) {
  const parts: BufferGeometry[] = [];
  const districts = [...city.outerDistricts, ...city.middleDistricts];
  const batches = modularDistricts(districts, seed);

  // Linked bedrock shelves. Sand belongs on exposed treads and at the toe.
  for (const [x, z, w, d, y, degrees] of districts) {
    const yaw = MathUtils.degToRad(degrees);
    const shelf = [
      pier([0, -130, 0], [w * 1.14, y + 130, d * 1.12], .88, alloy.footing),
      pier([0, y - 26, 0], [w * 1.09, 44, d * 1.04], .98, alloy.silver),
      pier([-w * .09, y + 13, d * .41], [w * .70, 28, d * .13], .91, alloy.sand),
      pier([0, y - 20, -d * .24], [w * .96, 112, d * .53], .96, alloy.shell),
      pier([0, y + 74, -d * .37], [w * .91, 108, d * .34], .95, alloy.silver),
    ];
    parts.push(...shelf.map(piece => piece.rotateY(yaw).translate(x, 0, z)));
  }

  parts.push(...buildAxialSpire(city.coreWidth));
  for (const sign of [-1, 1]) {
    parts.push(
      pier([sign * 1050, 800, -830], [535, 2870, 650], .61, alloy.silver, .23),
      pier([sign * 1445, 510, -1060], [460, 1880, 720], .65, alloy.shell, .21),
      pier([sign * 1700, 355, -1740], [410, 1990, 520], .50, alloy.silver),
      // Civic skyways span the valley-side gaps between the denser tower precincts.
      pier([sign * 2780, 475, -1340], [1970, 160, 350], .98, alloy.inset).rotateY(sign * .085),
      pier([sign * 3120, 120, -1450], [310, 410, 420], .86, alloy.shell),
      pier([sign * 4000, 120, -1600], [385, 520, 530], .89, alloy.silver),
      pier([sign * 4660, 240, -1680], [1370, 170, 590], .98, alloy.shell).rotateY(sign * .078),
    );
  }

  const segments = compact ? 7 : 12;
  return {
    civic: merge(parts), ...buildPrimaryRing(city.ring, segments), secondaryRing: buildSecondaryRing(city.secondaryRing, segments),
    satellites: buildSatellites(city.satellites, compact), batches,
  };
}

export function poseSkylineRing(pivot: Object3D, track: Object3D, ring: City['ring'], seconds: number) {
  const phase = 2 * Math.PI * seconds;
  const [pitch, yaw, roll] = ring.tilt;
  // The support plane tilts around the tower center. The rail turns within that plane.
  pivot.position.y = ring.height + ring.bob.amplitude * Math.sin(phase / ring.bob.period);
  pivot.rotation.set(
    MathUtils.degToRad(pitch + ring.pitch.degrees * Math.sin(phase / ring.pitch.period)),
    MathUtils.degToRad(yaw),
    MathUtils.degToRad(roll + ring.roll.degrees * Math.sin(phase / ring.roll.period)),
    'ZYX',
  );
  track.rotation.y = phase / ring.revolutionSeconds % (2 * Math.PI);
}

export function poseSecondaryRing(track: Object3D, ring: City['secondaryRing'], seconds: number) {
  const turn = 2 * Math.PI * seconds / ring.revolutionSeconds % (2 * Math.PI);
  track.rotation.y = MathUtils.degToRad(ring.phaseDegrees) + ring.direction * turn;
}

export function poseSkylineOrbit(orbit: Object3D, satellites: City['satellites'], seconds: number) {
  // A fixed inclined plane and a shared angular speed keep all three bodies equally spaced.
  const angle = MathUtils.degToRad(satellites.phaseDegrees) - 2 * Math.PI * seconds / satellites.revolutionSeconds;
  orbit.position.y = satellites.height;
  orbit.rotation.set(MathUtils.degToRad(satellites.pitchDegrees), angle % (2 * Math.PI), 0, 'XYZ');
}

type Traffic = WorldParameters['futureCity']['traffic'];
export type VehicleKind = keyof Traffic['vehicles'];

export function buildFlightRoute<T extends { waypoints: readonly Vec3[] }>(route: T) {
  const curve = new CatmullRomCurve3(route.waypoints.map(point => new Vector3(...point)), true);
  curve.arcLengthDivisions = 512;
  return { ...route, curve, length: curve.getLength() };
}

export function buildTrafficRoutes(traffic: Traffic) {
  return traffic.routes.map(buildFlightRoute);
}

type Slice = readonly [z: number, halfWidth: number, bottom: number, top: number];
const skin = '#8595a1', trim = '#263540', glass = '#415564', cargo = '#756e60';

function flightHull(size: Vec3) {
  const parts: BufferGeometry[] = [];
  const hull = (color: string, slices: readonly Slice[], offsetX = 0, light = 0) => {
    const vertices: Vec3[] = slices.flatMap(([z, half, bottom, top]) => {
      const cut = half * .27, rise = (top - bottom) * .22;
      const corners = [[-half+cut,bottom],[half-cut,bottom],[half,bottom+rise],[half,top-rise],
        [half-cut,top],[-half+cut,top],[-half,top-rise],[-half,bottom+rise]];
      return corners.map(([x,y]): Vec3 => [(x + offsetX) * size[0], y * size[1], z * size[2]]);
    });
    const cap = [0, 1, 2, 3, 4, 5, 6, 7];
    const faces = [cap.slice().reverse()];
    for (let slice = 0; slice < slices.length - 1; slice++) {
      for (let side = 0; side < 8; side++) {
        const a = slice * 8 + side, b = slice * 8 + (side + 1) % 8;
        faces.push([a, b, b + 8, a + 8]);
      }
    }
    faces.push(cap.map(i => i + vertices.length - 8));
    const mesh = solid(vertices, faces, color);
    if (light) {
      const marks = mesh.getAttribute('cityMark');
      for (let i = 0; i < marks.count; i++) marks.setZ(i, light);
    }
    parts.push(mesh);
  };

  const pod = (x: number, y: number, z: number, width: number, height: number, length: number,
    color: string, light = 0) => {
    hull(color, [
      [z - length / 2, width * .41, y - height / 2, y + height / 2],
      [z + length / 2, width / 2, y - height / 2, y + height / 2],
    ], x, light);
  };

  return { parts, hull, pod };
}

export function buildAirshipGeometry(kind: City['airships'][number]['id'], size: Vec3) {
  const { parts, hull, pod } = flightHull(size);
  if (kind === 'passenger') {
    const [width, height, length] = size;
    // A tapered lift hull above a distinct promenade deck and swept aft stabilizers.
    hull(skin, [[-.50,.08,-.10,.14],[-.38,.30,-.27,.30],[-.16,.46,-.33,.48],
      [.22,.44,-.32,.46],[.40,.27,-.25,.30],[.51,.06,-.07,.12]]);
    hull(trim, [[-.37,.15,-.30,-.18],[-.18,.33,-.53,-.18],[.25,.31,-.48,-.16],[.44,.10,-.28,-.10]]);
    hull(alloy.shell, [[-.32,.18,.29,.31],[-.14,.30,.38,.54],[.21,.24,.38,.53],[.39,.09,.30,.35]]);
    hull(alloy.rail, [[-.52,.43,-.12,.07],[-.43,.53,-.14,.08],[-.26,.26,-.12,.12]]);
    for (const side of [-1, 1]) {
      const skidX = side * width * .24;
      parts.push(pier([skidX, -height * .84, 0], [width * .15, height * .10, length * .53], .92, alloy.footing, .15));
      for (const z of [-.17, .17]) {
        parts.push(pier([skidX, -height * .76, z * length], [width * .11, height * .39, length * .075],
          .87, alloy.rail, .16));
      }
      pod(side * .41, -.10, -.30, .22, .26, .27, trim);
      pod(side * .43, -.10, -.441, .12, .13, .036, glass, 6);
      for (const z of [-.10, .02, .14, .26]) pod(side * .285, -.35, z, .086, .10, .070, glass, 6);
    }
  } else {
    // Twin lift housings bracket a loaded spine, with a separate forward bridge.
    hull(trim, [[-.46,.15,-.23,.14],[-.33,.38,-.37,.30],[.25,.38,-.35,.28],[.46,.22,-.23,.11]]);
    hull(cargo, [[-.36,.20,-.29,.28],[-.28,.27,-.48,.45],[.19,.27,-.48,.45],[.29,.16,-.27,.27]]);
    hull(glass, [[.22,.15,-.12,.30],[.36,.21,-.21,.36],[.52,.10,-.16,.12]]);
    for (const side of [-1, 1]) {
      hull(skin, [[-.50,.078,-.16,.17],[-.34,.14,-.32,.42],[.24,.14,-.31,.37],[.44,.082,-.17,.20]], side * .38);
      pod(side * .38, -.01, -.491, .12, .18, .042, cargo, 7);
      pod(side * .38, .02, .436, .10, .12, .042, glass, 6);
      for (const z of [-.25, .17]) pod(side * .38, .29, z, .31, .19, .08, alloy.rail);
    }
  }
  return merge(parts);
}

export function buildVehicleGeometry(kind: VehicleKind, size: Vec3) {
  const { parts, hull, pod } = flightHull(size);
  switch (kind) {
    case 'courier':
      // A swept dispatch sled with a low canopy.
      hull(skin, [[-.49,.29,-.40,.08],[-.26,.5,-.36,.18],[.20,.20,-.27,.19],[.54,.07,-.18,.02]]);
      hull(glass, [[-.22,.16,.16,.43],[.08,.13,.17,.48],[.27,.08,.13,.20]]);
      pod(0, -.09, .528, .17, .13, .055, skin, 6);
      break;
    case 'cab':
      // Short two-seat body with a full-width canopy.
      hull(skin, [[-.51,.36,-.42,.11],[-.32,.48,-.46,.18],[.25,.48,-.40,.22],[.50,.32,-.25,.12]]);
      hull(glass, [[-.29,.31,.12,.33],[-.11,.35,.15,.50],[.18,.29,.15,.47],[.31,.22,.14,.22]]);
      pod(0, .04, .501, .54, .14, .04, skin, 6);
      break;
    case 'shuttle':
      // A longer glazed transit cabin on a tapered carriage.
      hull(skin, [[-.50,.34,-.30,.22],[-.32,.46,-.43,.42],[.33,.46,-.43,.42],[.52,.31,-.25,.20]]);
      pod(0, .23, 0, .93, .20, .62, glass);
      pod(0, .24, -.02, .95, .08, .44, glass, 6);
      pod(0, -.06, .515, .53, .13, .045, skin, 6);
      break;
    case 'utility':
      // A work deck with paired field tools and an amber marker.
      hull(trim, [[-.52,.31,-.41,.14],[-.28,.46,-.43,.15],[.34,.45,-.40,.15],[.49,.32,-.31,.07]]);
      pod(0, .26, .18, .52, .40, .34, skin);
      pod(0, .48, .18, .24, .11, .13, cargo, 7);
      for (const side of [-1, 1]) pod(side * .33, .11, -.19, .24, .42, .43, skin);
      break;
    case 'freighter':
      // A tandem pallet carrier with two separate load enclosures.
      hull(trim, [[-.52,.41,-.39,-.04],[-.36,.5,-.44,.03],[.32,.49,-.44,.04],[.53,.32,-.32,.01]]);
      for (const z of [-.28, .01]) pod(0, .22, z, .79, .50, .26, cargo);
      hull(skin, [[.16,.33,.02,.34],[.35,.32,.01,.32],[.51,.25,-.05,.12]]);
      pod(0, -.09, .526, .52, .13, .06, skin, 6);
      break;
    case 'heavy':
      // Twin long spars carry one broad container, with a recessed forward cab.
      for (const side of [-1, 1]) {
        hull(skin, [[-.51,.11,-.35,.12],[-.36,.14,-.45,.18],[.34,.14,-.42,.16],[.53,.09,-.32,.09]], side * .35);
        pod(side * .35, -.05, .527, .15, .16, .045, skin, 6);
        pod(side * .35, -.04, -.51, .14, .16, .035, cargo, 7);
      }
      pod(0, .17, -.09, .63, .61, .65, cargo);
      hull(glass, [[.25,.23,.00,.24],[.40,.19,-.04,.20],[.49,.14,-.08,.08]]);
      break;
  }
  return merge(parts);
}
