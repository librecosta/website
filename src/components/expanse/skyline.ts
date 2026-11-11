import { BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, MathUtils, SphereGeometry, Vector3, type Object3D } from 'three';
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
  const { radius, guideOffset } = city.ring;
  const track: BufferGeometry[] = [];
  let ringAnchor: Vec3 | undefined;
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
      const bottom = dock ? -195 : -88;
      if (start === 42 && dock) {
        // Lower face of the transfer node visible from the valley.
        ringAnchor = [Math.cos(azimuth) * r, bottom - .4, Math.sin(azimuth) * r];
      }
      track.push(pier([0, bottom, 0], [guideOffset + 185, dock ? 246 : 125, dock ? 250 : 93],
        .87, dock ? alloy.silver : alloy.web, .24).rotateY(-azimuth)
        .translate(Math.cos(azimuth) * r, 0, Math.sin(azimuth) * r));
    }
  }
  return { civic: merge(parts), ring: merge(track), ringAnchor, satellites: buildSatellites(city.satellites, compact), batches };
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
    // A tapered lift hull above a distinct promenade deck and swept aft stabilizers.
    hull(skin, [[-.50,.08,-.10,.14],[-.38,.30,-.27,.30],[-.16,.46,-.33,.48],
      [.22,.44,-.32,.46],[.40,.27,-.25,.30],[.51,.06,-.07,.12]]);
    hull(trim, [[-.37,.15,-.30,-.18],[-.18,.33,-.53,-.18],[.25,.31,-.48,-.16],[.44,.10,-.28,-.10]]);
    hull(alloy.shell, [[-.32,.18,.29,.31],[-.14,.30,.38,.54],[.21,.24,.38,.53],[.39,.09,.30,.35]]);
    hull(alloy.rail, [[-.52,.43,-.12,.07],[-.43,.53,-.14,.08],[-.26,.26,-.12,.12]]);
    for (const side of [-1, 1]) {
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
