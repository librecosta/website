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

function solid(vertices: Vec3[], faces: number[][], color: string, marks = new Map<number, Vec3[]>()) {
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
  geometry.computeVertexNormals();
  const tint = new Color(color), cladding = new Color(alloy.web);
  const colors = new Float32Array(positions.length);
  for (let i = 0; i < colors.length; i += 3) (lights[i + 2] === 1 ? cladding : tint).toArray(colors, i);
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

function finishedSolid(vertices: Vec3[], faces: number[][], finishes: string[]) {
  const geometry = solid(vertices, faces, alloy.rail);
  const colors = geometry.getAttribute('color');
  const tint = new Color();
  let vertex = 0;
  for (const [i, face] of faces.entries()) {
    tint.set(finishes[i]);
    const count = (face.length - 2) * 3;
    for (let j = 0; j < count; j++) colors.setXYZ(vertex++, tint.r, tint.g, tint.b);
  }
  return geometry;
}

// All district modules use the same chamfered section and stepped construction.
// The origin sits on the floor so footprint and height can be scaled independently.
function pier(at: Vec3, size: Vec3, taper: number, color: string, cut = .13, lit?: (level: number, side: number) => number) {
  const [w, h, d] = size;
  return shaft([
    [at[0], at[1], at[2], w, d],
    [at[0], at[1] + h, at[2], w * taper, d * taper],
  ], color, cut, lit);
}

function shaft(levels: ShaftLevel[], color: string, cut: number,
  lit?: (level: number, side: number) => number) {
  const section = [[-.5 + cut, .5], [-.5, .5 - cut], [-.5, -.5 + cut], [-.5 + cut, -.5],
    [.5 - cut, -.5], [.5, -.5 + cut], [.5, .5 - cut], [.5 - cut, .5]];
  const vertices: Vec3[] = levels.flatMap(([x, y, z, w, d]) =>
    section.map(([u, v]): Vec3 => [x + u * w, y, z + v * d]));
  const faces = [section.map((_, i) => i)];
  const marks = new Map<number, Vec3[]>();
  for (let level = 0; level < levels.length - 1; level++) for (let i = 0; i < 8; i++) {
    const start = level * 8;
    const a = start + i, b = start + (i + 1) % 8;
    const light = lit?.(level, i);
    if (light) marks.set(faces.length, [[0, 0, light], [0, 1, light], [1, 1, light], [1, 0, light]]);
    faces.push([a, a + 8, b + 8, b]);
  }
  faces.push(section.map((_, i) => vertices.length - 1 - i));
  return solid(vertices, faces, color, marks);
}

function merge(parts: BufferGeometry[]) {
  const result = mergeGeometries(parts)!;
  parts.forEach(part => part.dispose());
  return result;
}

function archetype(inner: boolean, tall: boolean, compact: boolean) {
  const shoulder = tall ? .66 : .54;
  const parts = [
    pier([0, -.06, 0], [1, .19, 1], .94, alloy.footing),
    pier([0, .13, 0], [tall ? .77 : .91, shoulder - .13, .87], tall ? .85 : .93, alloy.shell),
    pier([0, shoulder, tall ? -.04 : 0], [tall ? .61 : .71, 1 - shoulder, tall ? .58 : .70],
      tall ? .63 : .88, alloy.silver, tall ? .19 : .11, (_, side) => inner && tall && side === 7 ? 4 : 0),
  ];
  if (inner && !tall) {
    // A broad gatehouse volume breaks the repetition of the tall pylons.
    parts.push(pier([0, .47, .04], [1.05, .13, .91], .91, alloy.inset, .13,
      (_, side) => side === 7 || side === 5 ? 3 : 0));
    if (!compact) parts.push(pier([0, .60, .04], [.95, .065, .82], .91, alloy.silver));
  } else if (inner && !compact) {
    parts.push(pier([0, .27, .26], [.29, .47, .42], .64, alloy.inset));
  }
  return merge(parts);
}

function populate(districts: readonly District[], inner: boolean, seed: number) {
  let state = seed >>> 0;
  const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  const lots: [Building[], Building[]] = [[], []];
  const [columns, rows] = inner ? [5, 4] : [7, 5];
  for (const [x, z, width, depth, datum, degrees] of districts) {
    const yaw = MathUtils.degToRad(degrees);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const inward = 1 - MathUtils.smoothstep(Math.abs(x), 1700, 8800);
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const u = ((column + .46 + .22 * (row % 2) + .25 * (random() - .5)) / columns - .5) * width;
        const v = ((row + .5 + .28 * (random() - .5)) / rows - .5) * depth;
        const tall = (column + 2 * row) % 5 < (inner ? 3 : 2);
        const fill = (inner ? .71 : .50) + .16 * random() + .10 * inward;
        const height = (inner ? 510 + 390 * inward : 290 + 170 * inward)
          * (.65 + .62 * random()) * (tall ? 1.55 : .78) * (1.09 - .18 * row / rows);
        lots[Number(tall)].push({
          position: [x + c * u + s * v, datum - 19 + 42 * row, z - s * u + c * v],
          size: [width * fill / columns * (tall ? .93 : 1.14), height, depth * fill / rows],
          yaw, shade: .83 + .19 * random(),
        });
      }
    }
  }
  return lots;
}

const ringSegments = [[2, 38], [42, 82], [86, 121], [125, 174],
  [178, 220], [224, 267], [271, 309], [313, 358]] as const;

function trackArc(radius: number, y: number, width: number, depth: number,
  start: number, end: number, segments: number, color: string, lit = false, endBevel = 0) {
  const vertices: Vec3[] = [];
  const faces: number[][] = [];
  const marks = new Map<number, Vec3[]>();
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
    if (lit && (side === 0 || side === 3)) {
      const low = (angles[i] - start) / (end - start), high = (angles[i + 1] - start) / (end - start);
      marks.set(faces.length, [[0, low, 2], [1, low, 2], [1, high, 2], [0, high, 2]]);
    }
    faces.push([a, b, b + 4, a + 4]);
  }
  faces.push([3, 2, 1, 0], [last * 4, last * 4 + 1, last * 4 + 2, last * 4 + 3]);
  return solid(vertices, faces, color, marks);
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
  const finishes: string[] = [];
  const sideFinish = [alloy.rail, alloy.silver, alloy.silver, alloy.shell, alloy.shell,
    alloy.rail, alloy.web, alloy.rail, alloy.shell, alloy.silver];
  for (let i = 0; i < last; i++) {
    const first = i * stride;
    const terminal = i === 0 || i === last - 1;
    for (let side = 0; side < outline.length; side++) {
      const a = first + side, b = first + (side + 1) % outline.length;
      faces.push([a, b, b + stride, a + stride]);
      finishes.push(terminal && side === 6 ? alloy.rail : sideFinish[side]);
    }
    for (let side = 0; side < cell.length; side++) {
      const a = first + outline.length + side;
      const b = first + outline.length + (side + 1) % cell.length;
      faces.push([b, a, a + stride, b + stride]);
      finishes.push(alloy.inset);
    }
  }
  for (const face of terminalCap) {
    faces.push([...face].reverse(), face.map(i => i + last * stride));
    finishes.push(alloy.shell, alloy.shell);
  }
  return finishedSolid(vertices, faces, finishes);
}

function ringBrace(section: number[][], tangent: number, width: number) {
  const vertices = [-width / 2, width / 2].flatMap(side =>
    section.map(([x, y]): Vec3 => [x, y, tangent + side]));
  return solid(vertices, [[3, 2, 1, 0], [4, 5, 6, 7],
    [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]], alloy.rail);
}

function ringSupport(guideOffset: number, tangent: number, width: number) {
  const guideEnd = -guideOffset - 55;
  return [
    ringBrace([[guideEnd, -323], [58, -162], [58, -109], [guideEnd, -218]], tangent, width),
    pier([16, -166, tangent], [136, 36, width + 52], .92, alloy.silver, .19),
    pier([-guideOffset, -328, tangent], [184, 96, width + 18], .94, alloy.web, .16),
  ];
}

const anchorInset = 111;
const transferBottom = -195;
function transferNode(guideOffset: number) {
  return [
    // Keep the sightline to the existing observation keel between the braces.
    ...ringSupport(guideOffset, -205, 70), ...ringSupport(guideOffset, 205, 70),
    pier([-guideOffset - 27, -274, 0], [228, 46, 466], 1, alloy.silver, .15),
    pier([-anchorInset, transferBottom, 0], [97, 57, 118], 1.38, alloy.web, .24),
  ];
}

const innerArcRadius = 4235;
const innerArcSpans = [[50, 74], [129, 153], [186, 210], [281, 303]] as const;

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
  const finishes = [alloy.rail];
  const deckFinish = [alloy.shell, alloy.silver, alloy.rail, alloy.web,
    alloy.web, alloy.web, alloy.rail, alloy.silver];
  for (let i = 0; i < stations.length - 1; i++) {
    for (let side = 0; side < 8; side++) {
      const a = i * 8 + side, b = i * 8 + (side + 1) % 8;
      faces.push([b, a, a + 8, b + 8]);
      finishes.push(i < 3 && side === 0 ? alloy.silver : deckFinish[side]);
    }
  }
  faces.push(Array.from({ length: 8 }, (_, i) => vertices.length - 1 - i));
  finishes.push(alloy.rail);
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
      trackArc(radius - guideOffset, -222, 176, 164, start + 2, end - 2, segments, alloy.web, true));
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
    track.push(trackArc(innerArcRadius, -190, 90, 102, start, end, Math.ceil(segments * .6), alloy.shell));
    const innerSeat = innerArcRadius - radius - 35;
    for (const fraction of [.19, .81]) {
      place(MathUtils.lerp(start, end, fraction), [
        ringBrace([[innerSeat, -247], [-guideOffset, -275], [-guideOffset, -208], [innerSeat, -170]], 0, 79),
        pier([innerSeat + 35, -255, 0], [90, 41, 108], .9, alloy.rail, .18),
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
    const bearing = pier([0, -34, 0], [128 * scale, 115 * scale, 152 * scale], .84, alloy.rail, .20)
      .rotateY(-angle).translate(Math.cos(angle) * bearingRadius, 0, Math.sin(angle) * bearingRadius);
    return [
      trackArc(radius + 40 * scale, shellDepth / 2 - 28.2, 256 * scale, shellDepth,
        start, end, segments, alloy.silver, false, 75),
      trackArc(radius - 65 * scale, returnDepth / 2 - 36, 106 * scale, returnDepth,
        start + 2, end - 2, segments, alloy.web, true, 49),
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
  const members = Array.from({ length: count }, (_, i) => {
    const angle = 2 * Math.PI * i / count;
    return sphere.clone().translate(orbitRadius * Math.cos(angle), 0, orbitRadius * Math.sin(angle));
  });
  sphere.dispose();
  return merge(members);
}

function buildSpireWing(side: -1 | 1, coreWidth: number) {
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
    shaft(wing, alloy.rail, .23),
    // The flared shoe carries the wing into the stepped podium.
    shaft([
      [side * 487, 790, z - 80, 735, 1300],
      [side * 466, 1170, z - 48, 665, 1110],
      [side * 414, 1730, z - 100, 490, 750],
    ], alloy.footing, .19),
  ];
  const offset = side > 0 ? 100 : 0;
  const courses = [
    { from: 1620, to: 2690 - offset, width: .77, shift: .035, thickness: 104, color: alloy.shell },
    { from: 2870 - offset, to: 4310 - offset, width: .66, shift: .085, thickness: 114, color: alloy.shell },
    { from: 4515, to: 6240 - offset, width: .72, shift: .025, thickness: 88, color: alloy.silver },
  ];
  for (const { from, to, width, shift, thickness, color } of courses) {
    const stations = [from, from + 90, ...profile.map(level => level[1]).filter(y => y > from + 90 && y < to - 70), to - 70, to];
    const casing = stations.map((y, i): ShaftLevel => {
      const [x, , z, w, d] = sectionAt(y);
      const rim = i === 0 || i === stations.length - 1;
      return [x + side * w * shift, y, z + d / 2 - 15 - thickness / 2,
        w * width * (rim ? .84 : 1), thickness - (rim ? 30 : 0)];
    });
    const [x, y, z, w, d] = sectionAt((from + to) / 2);
    // A short bracket seats each shell against the wing and leaves the ends open.
    parts.push(shaft(casing, color, .15),
      pier([x + side * w * shift, y - 68, z + d / 2 - 177], [w * .34, 136, 188], 1, alloy.web, .16));
  }
  return parts;
}

function buildAxialSpire(coreWidth: number) {
  const parts = [
    pier([0, -180, 80], [3650, 405, 3270], .91, alloy.footing, .23),
    pier([0, 205, 10], [2920, 420, 2720], .88, alloy.shell, .19),
    pier([0, 595, -100], [2100, 375, 2040], .86, alloy.silver, .21),
    pier([0, 950, -190], [1390, 575, 1390], .80, alloy.inset, .24),
    // The wings form the side walls of the bay. This spine closes it from behind.
    shaft([
      [0, 1120, -385, 880, 730],
      [0, 1640, -595, 760, 600],
      [0, 3100, -650, 740, 530],
      [0, 5000, -635, 675, 530],
      [0, 6500, -595, 535, 480],
      [0, 6870, -540, 455, 450],
      [0, 7360, -460, 270.3, 300.9],
    ], alloy.inset, .22),
    ...buildSpireWing(-1, coreWidth),
    ...buildSpireWing(1, coreWidth),
  ];
  for (const side of [-1, 1]) {
    parts.push(shaft([
      [side * 158, 1440, -280, 170, 270],
      [side * 123, 2870, -341, 120, 170],
      [side * 104, 4970, -326, 102, 170],
      [side * 100, 6470, -341, 76, 146],
    ], alloy.rail, .18, (level, face) => level === 1 && face === (side < 0 ? 6 : 0) ? 1 : 0));
  }
  for (const [y, span, front] of [[2680, 950, 176], [4740, 850, 123]]) {
    // Two diaphragms tie both wings to the spine. The tall bays between them stay open.
    const back = -520;
    const depth = front - back;
    const z = (front + back) / 2;
    parts.push(pier([0, y, z], [span, 121, depth], 1, alloy.silver, .12),
      pier([0, y - 142, z - 52], [span * .75, 144, depth - 92], 1.28, alloy.footing, .15));
  }
  return parts;
}

export function buildSkyline(city: City, seed: number, compact: boolean) {
  const parts: BufferGeometry[] = [];
  const outer = populate(city.outerDistricts, false, seed);
  const middle = populate(city.middleDistricts, true, seed + 37);
  const batches = [outer, middle].flatMap((pair, tier) => pair.map((buildings, variant) =>
    ({ geometry: archetype(tier === 1, variant === 1, compact), buildings })));

  // Linked bedrock shelves. Sand belongs on exposed treads and at the toe.
  for (const [x, z, w, d, y, degrees] of [...city.outerDistricts, ...city.middleDistricts]) {
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
      pier([sign * 820, 335, 930], [480, 1370, 470], .67, alloy.silver),
      pier([sign * 1650, 280, 80], [690, 340, 325], .96, alloy.inset),
      pier([sign * 1750, 580, 90], [1110, 93, 270], 1, alloy.shell),
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
