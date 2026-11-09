import { BufferGeometry, Color, Float32BufferAttribute, MathUtils } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Vec3, WorldParameters } from './parameters.ts';

type City = WorldParameters['futureCity'];
type District = City['outerDistricts'][number] | City['middleDistricts'][number];
type Building = { position: Vec3; size: Vec3; yaw: number; shade: number };
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

// All district modules use the same chamfered section and stepped construction.
// The origin sits on the floor so footprint and height can be scaled independently.
function pier(at: Vec3, size: Vec3, taper: number, color: string, cut = .13, lit?: (level: number, side: number) => number) {
  const [w, h, d] = size;
  return shaft([
    [at[0], at[1], at[2], w, d],
    [at[0], at[1] + h, at[2], w * taper, d * taper],
  ], color, cut, lit);
}

function shaft(levels: [number, number, number, number, number][], color: string, cut: number,
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

function trackArc(radius: number, y: number, width: number, depth: number,
  start: number, end: number, segments: number, color: string, lit = false) {
  const vertices: Vec3[] = [];
  const faces: number[][] = [];
  const marks = new Map<number, Vec3[]>();
  for (let i = 0; i <= segments; i++) {
    const angle = MathUtils.degToRad(MathUtils.lerp(start, end, i / segments));
    const c = Math.cos(angle), s = Math.sin(angle);
    for (const [offset, height] of [[-width, -depth], [width, -depth], [width, depth], [-width, depth]]) {
      vertices.push([(radius + offset / 2) * c, y + height / 2, (radius + offset / 2) * s]);
    }
  }
  for (let i = 0; i < segments; i++) for (let side = 0; side < 4; side++) {
    const a = i * 4 + side, b = i * 4 + (side + 1) % 4;
    if (lit && (side === 0 || side === 3)) {
      const low = i / segments, high = (i + 1) / segments;
      marks.set(faces.length, [[0, low, 2], [1, low, 2], [1, high, 2], [0, high, 2]]);
    }
    faces.push([a, b, b + 4, a + 4]);
  }
  faces.push([3, 2, 1, 0], [segments * 4, segments * 4 + 1, segments * 4 + 2, segments * 4 + 3]);
  return solid(vertices, faces, color, marks);
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

  const civic = [
    pier([0, -180, 80], [3650, 405, 3270], .91, alloy.footing, .23),
    pier([0, 205, 10], [2920, 420, 2720], .88, alloy.shell, .19),
    pier([0, 595, -100], [2100, 375, 2040], .86, alloy.silver, .21),
    pier([0, 950, -190], [1390, 575, 1390], .80, alloy.inset, .24),
    pier([0, 1375, -360], [770, 5470, 970], .64, alloy.inset, .23),
    pier([0, 6010, -460], [530, 1350, 590], .51, alloy.silver, .28),
  ];
  parts.push(...civic);
  for (const sign of [-1, 1]) {
    // Two tapering load-bearing blades frame a real sky opening above the recessed spine.
    const z = sign < 0 ? 10 : -245;
    const top = sign < 0 ? 8750 : 8370;
    parts.push(
      shaft([
        [sign * (city.coreWidth / 2 - 320), 970, z, 640, 1160],
        [sign * 390, 4050, z - 16, 582, 1050],
        [sign * 390, 4500, z - 58, 532, 925],
        [sign * 390, 6570, z - 91, 447, 808],
        [sign * 370, 6800, z - 130, 368, 654],
        [sign * 340, top - 395, z - 169, 228, 317],
        [sign * 330, top, z - 188, 148, 190],
      ], alloy.silver, .23, (level, side) => level < 5 && (side === 7 || side === (sign < 0 ? 5 : 1)) ? 1 : 0),
      pier([sign * 620, 900, z + 60], [145, 3720, 640], .49, alloy.inset),
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

  // Two rails share one plane; seams and paired transfer nodes reveal the track construction.
  const { radius, guideOffset, height, tilt } = city.ring;
  const track: BufferGeometry[] = [];
  for (const [start, end] of [[2, 38], [42, 82], [86, 121], [125, 174],
    [178, 220], [224, 267], [271, 309], [313, 358]]) {
    const segments = compact ? 7 : 12;
    track.push(
      trackArc(radius, 0, 127, 93, start, end, segments, alloy.rail),
      trackArc(radius - guideOffset, -45, 82, 62, start + 2, end - 2, segments, alloy.web),
      trackArc(radius - 56, -54, 66, 42, start + 1, end - 1, segments, alloy.inset, true),
    );
    for (const fraction of [.09, .5, .91]) {
      const azimuth = MathUtils.degToRad(MathUtils.lerp(start, end, fraction));
      const r = radius - guideOffset / 2;
      const dock = fraction === .5;
      track.push(pier([0, dock ? -195 : -88, 0], [guideOffset + 185, dock ? 246 : 125, dock ? 250 : 93],
        .87, dock ? alloy.silver : alloy.web, .24).rotateY(-azimuth)
        .translate(Math.cos(azimuth) * r, 0, Math.sin(azimuth) * r));
    }
  }
  const [pitch, yaw, roll] = tilt.map(MathUtils.degToRad);
  parts.push(...track.map(piece => piece.rotateX(pitch).rotateY(yaw).rotateZ(roll).translate(0, height, 0)));
  return { civic: merge(parts), batches };
}
