import { BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, MathUtils, Object3D, Vector3 } from 'three';
import { EXPANSE } from './parameters';
import type { renderedGround } from './sand-transport';

type Ground = ReturnType<typeof renderedGround>;
type Point = [number, number, number];
type MeshData = { positions: number[]; colors: number[]; indices: number[] };

function geometry({ positions, colors, indices }: MeshData, faceted = false) {
  const indexed = new BufferGeometry();
  indexed.setAttribute('position', new Float32BufferAttribute(positions, 3));
  indexed.setAttribute('color', new Float32BufferAttribute(colors, 3));
  indexed.setIndex(indices);
  const mesh = faceted ? indexed.toNonIndexed() : indexed;
  if (faceted) indexed.dispose();
  mesh.computeVertexNormals();
  return mesh;
}

// Different strata, including a low fractured wedge and a steep tilted plate.
const rockSections = [
  [[-.54, -.28], [.10, -.49], [.55, -.27], [.62, .14], [.23, .42], [-.46, .31], [-.61, .05]],
  [[-.55, -.08], [-.28, -.46], [.24, -.36], [.59, -.05], [.40, .37], [-.07, .41], [-.58, .22]],
] as const;

function rockShape(variant: number) {
  const sections = rockSections[variant];
  const data: MeshData = { positions: [], colors: [], indices: [] };
  const color = new Color(variant ? '#aa9c83' : '#938879');
  const radii = [0.89, 1, variant ? .83 : .76, variant ? .68 : .54];
  for (let ring = 0; ring < radii.length; ring++) {
    sections.forEach(([x, z], i) => {
      const lift = Math.sin(i * 2.6 + variant);
      const y = [-.38, .015 + lift * .09, .20 + x * .18 + lift * .05, .37 + x * .19 + lift * .04][ring];
      data.positions.push(x * radii[ring] + ring * .052, y, z * radii[ring] - ring * .03);
      const shade = [0.83, 0.96, 1, 1.07][ring] + lift * .049;
      data.colors.push(color.r * shade, color.g * shade, color.b * shade);
    });
  }
  const n = sections.length;
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    for (let ring = 0; ring < radii.length - 1; ring++) {
      const a = i + ring * n, b = next + ring * n;
      data.indices.push(a, a + n, b, b, a + n, b + n);
    }
  }
  const cap = n * (radii.length - 1);
  for (let i = 1; i < n - 1; i++) data.indices.push(0, i, i + 1, cap, cap + i + 1, cap + i);
  return geometry(data, true);
}

function sampler(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function buildDressingRocks(ground: Ground, mobile: boolean) {
  const random = sampler(EXPANSE.seed);
  const rocks = rockSections.map((_, variant) => ({ geometry: rockShape(variant), matrices: [] as Object3D['matrix'][] }));
  const transform = new Object3D();
  for (const { center, spread, count, sizes } of EXPANSE.dressing.rockGroups) {
    for (let i = 0; i < count; i++) {
      const angle = 2 * Math.PI * random();
      const reach = Math.sqrt(random());
      const x = center[0] + spread[0] * Math.cos(angle) * reach;
      const z = center[1] + spread[1] * Math.sin(angle) * reach;
      const scale = MathUtils.lerp(sizes[0], sizes[1], i === 0 ? 1 : random() ** 2);
      const yaw = random() * Math.PI;
      const height = .52 + .47 * random();
      const burial = scale * (.045 + .15 * random());
      if (mobile && scale < 5) continue;
      transform.position.set(x, ground(x, z) - burial, z);
      transform.rotation.set(Math.atan2(ground(x, z + 12) - ground(x, z - 12), 24), yaw,
        Math.atan2(ground(x + 12, z) - ground(x - 12, z), 24), 'YXZ');
      transform.scale.set(scale, scale * height, scale * (1.05 + .55 * reach));
      transform.updateMatrix();
      rocks[i % rocks.length].matrices.push(transform.matrix.clone());
    }
  }
  return rocks;
}

function tube(data: MeshData, points: Vector3[], radii: number[], base: Color, segments: number, flatten = 1) {
  const sides = 7;
  const first = data.positions.length / 3;
  const curve = new CatmullRomCurve3(points);
  const frames = curve.computeFrenetFrames(segments, false);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, point = curve.getPointAt(t);
    const index = t * (radii.length - 1);
    const lower = Math.min(radii.length - 2, Math.floor(index));
    const radius = MathUtils.lerp(radii[lower], radii[lower + 1], index - lower);
    const normal = frames.normals[i], binormal = frames.binormals[i];
    for (let side = 0; side < sides; side++) {
      const angle = side / sides * Math.PI * 2;
      const grain = Math.sin(side * 4.7) * .12 + Math.cos(i * .56 + side) * .06;
      const vertex = point.clone().addScaledVector(normal, radius * Math.cos(angle) * (1 + grain))
        .addScaledVector(binormal, radius * Math.sin(angle) * flatten);
      data.positions.push(vertex.x, vertex.y, vertex.z);
      const shade = 1 + grain + (i === segments ? .1 : 0);
      data.colors.push(base.r * shade, base.g * shade, base.b * shade);
      if (i === segments) continue;
      const a = first + i * sides + side, b = a - side + (side + 1) % sides;
      data.indices.push(a, b, a + sides, b, b + sides, a + sides);
    }
  }
  const last = first + segments * sides;
  for (let i = 1; i < sides - 1; i++) data.indices.push(first, first + i + 1, first + i, last, last + i, last + i + 1);
}

function location(center: readonly [number, number], yaw: number, length: number, ground: Ground) {
  const cos = Math.cos(yaw), sin = Math.sin(yaw);
  return ([along, height, cross]: Point) => {
    const x = center[0] + length * (along * cos + cross * sin);
    const z = center[1] + length * (cross * cos - along * sin);
    return new Vector3(x, ground(x, z) + length * height, z);
  };
}

export function buildDressingRemains(ground: Ground, mobile: boolean) {
  const data: MeshData = { positions: [], colors: [], indices: [] };
  const timber = new Color('#766452'), exposedWood = new Color('#8d7960'), bone = new Color('#ddcfb3');
  EXPANSE.dressing.deadwood.forEach(({ center, length, yaw }, i) => {
    const point = location(center, yaw, length, ground);
    const lay = (points: Point[], profile: number[], color: Color, sections: number) =>
      tube(data, points.map(point), profile.map(v => v * length), color, sections);
    const bend = i % 2 ? -1 : 1;
    lay([[-.54,-.028,-.10],[-.32,.032,-.075],[-.10,.044,-.049],[.11,.035,.018],[.29,.05,.048],[.47,.018,.10],[.59,-.016,.10]],
      [.06,.054,.048,.036,.028,.018,.008], timber, 15);
    lay([[-.10,.043,-.049],[.041,.068,-.14*bend],[.156,.071,-.19*bend],[.269,.06,-.27*bend],[.385,.028,-.29*bend]],
      [.034,.028,.020,.013,.003], timber, 9);
    lay([[.156,.071,-.19*bend],[.226,.098,-.20*bend],[.31,.11,-.205*bend]], [.016,.012,.004], exposedWood, 6);
    lay([[.11,.035,.018],[.19,.057,.126*bend],[.27,.08,.194*bend],[.34,.042,.24*bend]],
      [.025,.019,.011,.006], timber, 7);
    if (!mobile) {
      lay([[-.40,.013,-.085],[-.48,.026,-.13],[-.56,.02,-.158]], [.029,.021,.005], exposedWood, 5);
      lay([[.268,.06,-.27*bend],[.30,.093,-.33*bend],[.339,.083,-.38*bend]], [.011,.008,.003], timber, 5);
    }
  });
  EXPANSE.dressing.bones.forEach(({ center, length, yaw, ribs }, group) => {
    const point = location(center, yaw, length, ground);
    const count = mobile ? ribs - 1 : ribs;
    for (let i = 0; i < count; i++) {
      const x = [-.38, -.23, -.08, .12][i], reach = .32 + Math.sin(i * 1.2 + group) * .10;
      const side = group === 1 ? 1 : -1;
      const exposure = [.16, .12, .15, .085][(i + group) % 4];
      const points: Point[] = [
        [x,-.037,0], [x-.02,exposure*.64,side*.10], [x+.028,exposure,side*.22],
        [x+.095,exposure*.70,side*reach], [x+.18,-.034,side*(reach+.026)],
      ];
      tube(data, points.map(point), [.035,.032,.025,.018,.012].map(v => v * length), bone, mobile ? 7 : 11, .72);
    }
    const shaft: Point[] = [[-.40,.018,.17],[-.23,.046,.23],[-.04,.055,.28],[.12,.013,.35],[.18,-.032,.38]];
    tube(data, shaft.map(point), [.051,.057,.030,.028,.046].map(v => v * length), bone, 9, .83);
  });
  return geometry(data);
}
