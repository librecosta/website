import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Kind = 'gates' | 'archive';
const stone = ['#817f70', '#a8a08b', '#767e73', '#b7a990'];
const meadow = ['#879858', '#9ea966', '#a3ac69', '#758d60'];
const ivory = '#ded4b4';
const tile = '#a8553b';
const dark = '#555a56';
const lamp = '#ffe7a2';
const wood = '#937254';
// Each approach shares one centerline from the summit landing to the pier in +Z.
const approaches = {
  gates: { x: -.7, from: .19, crest: 1.98, shore: 4.05, end: 5.6, width: 1.4, deck: 1.12, steps: 9 },
  archive: { x: -2.55, from: 1.62, crest: 4.77, shore: 7.28, end: 9.2, width: 1.4, deck: 1.39, steps: 11 },
};

export function originalIsland(kind: Kind) {
  const group = new T.Group();
  const parts: T.BufferGeometry[] = [];
  let seed = { gates: 318, archive: 279 }[kind];
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function add(geometry: T.BufferGeometry, hex: string, x: number, y: number, z: number, angle = 0) {
    const materialColor = new T.Color(hex);
    const part = geometry.index ? geometry.toNonIndexed() : geometry;
    if (part !== geometry) geometry.dispose();
    part.rotateY(angle);
    part.translate(x, y, z);
    const n = part.getAttribute('position').count;
    const color = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 3) {
      const shade = 0.9 + random() * 0.14;
      for (let j = i; j < i + 3; j++) {
        color[j * 3] = materialColor.r * shade;
        color[j * 3 + 1] = materialColor.g * shade;
        color[j * 3 + 2] = materialColor.b * shade;
      }
    }
    part.deleteAttribute('uv');
    part.setAttribute('color', new T.BufferAttribute(color, 3));
    parts.push(part);
  }
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: string, angle = 0) =>
    add(new T.BoxGeometry(w, h, d), color, x, y, z, angle);
  const cone = (x: number, y: number, z: number, a: number, b: number, h: number, color: string, sides = 8) =>
    add(new T.CylinderGeometry(a, b, h, sides), color, x, y, z);

  // Hand-shaped coastlines, with an intertidal shelf, fractured bluffs and
  // inset vegetated terraces. Each silhouette has its own slope and headland.
  const outline = {
    gates: [[-14, 5], [-15, 0], [-11, -5], [-6, -6], [-1, -3], [5, -5], [11, -9], [15, -8], [15, -4], [10, 1], [5, 4], [-1, 4], [-6, 6]],
    archive: [[-12, -4], [-8, -9], [-2, -11], [4, -10], [10, -7], [12, -2], [9, 6], [6, 8], [4, 5], [1, 4], [-2, 8], [-7, 9], [-13, 4]],
  }[kind];
  const summit = { gates: 3.0, archive: 4.8 }[kind];
  const n = outline.length;
  const coast = outline.flatMap(([x,z], i) => {
    const [nx,nz] = outline[(i+1)%n];
    return [[x,z], [(x+nx)*0.5+(random()-.5)*1.3,(z+nz)*0.5+(random()-.5)*1.5]];
  });
  const tiers = [[.91,-2.6],[1.05,-.65],[1,.2],[.93,.75],[.84,1.25],[.72,summit-.44],[.63,summit]];
  const rings = tiers.map(([scale, height], ring) => coast.map(([x,z], i) => new T.Vector3(
    x * scale + (ring > 3 ? -.7 : 0),
    height + (ring > 0 && ring < 6 ? Math.sin(i*1.53+ring)*.34 + Math.cos(i*.88)*.16 : 0),
    z * scale + (ring > 3 ? -1 : 0),
  )));
  const vertices: number[] = [];
  const colors: number[] = [];
  function tri(a: T.Vector3,b: T.Vector3,c: T.Vector3, palette: string[]) {
    vertices.push(...a.toArray(),...b.toArray(),...c.toArray());
    const color = new T.Color(palette[Math.floor(random()*palette.length)]).multiplyScalar(.91+random()*.13);
    for(let i=0;i<3;i++)colors.push(...color.toArray());
  }
  for(let ring=1;ring<rings.length;ring++) for(let i=0;i<coast.length;i++){
    const j=(i+1)%coast.length;
    const a=rings[ring][i], b=rings[ring][j], c=rings[ring-1][i], d=rings[ring-1][j];
    const palette=ring===3 ? ['#cabb92','#b9a887','#d1bd91'] : ring===6 ? meadow : stone;
    tri(a,b,c,palette); tri(b,d,c,palette);
  }
  const top = new T.Vector3(-.7,summit,-1);
  for(let i=0;i<coast.length;i++) tri(rings[6][(i+1)%coast.length],rings[6][i],top,meadow);
  const land = new T.BufferGeometry();
  land.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  land.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  land.computeVertexNormals();
  parts.push(land);

  const approach = approaches[kind];
  const groundMaterial = new T.MeshBasicMaterial();
  const ground = new T.Mesh(land, groundMaterial);
  const ray = new T.Raycaster(new T.Vector3(), new T.Vector3(0, -1, 0));
  function groundHeight(x: number, z: number) {
    ray.ray.origin.set(x, summit + 1, z);
    return ray.intersectObject(ground)[0]?.point.y ?? -.5;
  }
  function stonePlatform(x: number, width: number, from: number, to: number, top: number, color: string) {
    const base = Math.min(top - .14, ...[-width / 2, 0, width / 2].flatMap(dx =>
      [from, (from + to) / 2, to].map(z => groundHeight(x + dx, z) - .12)));
    box(x, (top + base) / 2, (from + to) / 2, width, top - base, to - from, color);
  }
  function buildApproach() {
    const { x, from, crest, shore, end, width, deck, steps } = approach;
    const top = summit + (kind === 'gates' ? .18 : .08);
    const tread = (shore - crest) / steps;
    stonePlatform(x, width, from, crest, top, '#c4b89a');
    for (let i = 0; i < steps; i++) {
      const edge = crest + i * tread;
      const riserTop = T.MathUtils.lerp(top, deck, (i + 1) / (steps + 1));
      stonePlatform(x, width, edge, edge + tread, riserTop, '#bdac88');
    }
    const planks = [wood, '#c09c68', '#ac885b', '#c8a775'];
    const count = Math.ceil((end - shore) / .25);
    const pitch = (end - shore) / count;
    for (let i = 0; i < count; i++) {
      box(x, deck - .08, shore + (i + .5) * pitch, 2.18, .16, pitch - .012, planks[i % 4]);
    }
    for (const side of [-.88, .88]) {
      box(x + side, deck - .23, (shore + end) / 2, .17, .17, end - shore, wood);
      for (const z of [shore + .2, end - .2]) {
        const bottom = Math.min(deck - .33, groundHeight(x + side, z) - .14);
        const postTop = deck + .21;
        cone(x + side, (bottom + postTop) / 2, z, .09, .13, postTop - bottom, wood, 6);
        cone(x + side, postTop, z, .14, .14, .12, lamp, 6);
      }
    }
  }
  function tree(x:number,y:number,z:number,pine=false) {
    const h=.6+random()*.85;
    cone(x,y+h*.42,z,.12,.26,h,wood,5);
    if(pine) {
      cone(x,y+h,z,.06,h*.51,h*1.45,'#536d58',7);
      cone(x,y+h*1.5,z,.015,h*.4,h,'#688866',7);
    } else {
      add(new T.IcosahedronGeometry(h*.55,0),'#829b5f',x-.22,y+h,z+.15);
      add(new T.IcosahedronGeometry(h*.58,0),'#a8ab60',x+.21,y+h*1.18,z-.14);
    }
  }
  function rock(x: number, y: number, z: number, size: number, tint: string) {
    const clearance = size * 1.25 + .1;
    const pathHalfWidth = z + clearance < approach.shore ? approach.width / 2 : 1.09;
    if (z + clearance > approach.from && z - clearance < approach.end &&
      Math.abs(x - approach.x) < pathHalfWidth + clearance) return;
    const geometry = new T.IcosahedronGeometry(size, 0);
    geometry.scale(1.25, .62 + random() * .48, .69 + random() * .36);
    geometry.rotateZ((random() - .5) * .8);
    add(geometry, tint, x, y, z, random() * Math.PI);
  }
  function gable(x:number,y:number,z:number,w:number,d:number,h:number,color:string) {
    box(x,y+h*.5,z,w,h,d,ivory);
    const roof=new T.CylinderGeometry(.63*w,.63*w,d+.28,3,1,false,0);
    roof.rotateX(Math.PI/2);
    roof.scale(.83, .49, 1);
    add(roof,color,x,y+h+.24,z);
    for(let i=-1;i<=1;i++) box(x+i*w*.29,y+h*.56,z+d*.502,.2,h*.26,.035,'#658980');
    box(x,y+h*.25,z+d*.508,.24,h*.5,.04,dark);
  }
  if(kind==='gates') {
    const x = approach.x, z = -1, h = 2.34, w = 2.9, y = summit;
    stonePlatform(x, w + .7, 2 * z - approach.from, approach.from, y + .18, '#bfad90');
    for (const side of [-1, 1]) {
      const px = x + side * w * .48;
      box(px, y + h * .53, z, .46, h, .44, '#bcb19a', .17);
      box(px, y + h * .55, z + .25, .16, h * .67, .09, '#a078ad');
      box(px, y + .27, z, .81, .2, .73, '#777b79');
    }
    add(new T.TorusGeometry(w * .505, .15, 5, 12, Math.PI), '#beb4a2', x, y + h - .06, z);
    add(new T.TorusGeometry(w * .485, .045, 5, 12, Math.PI), '#b18abb', x, y + h - .06, z + .17);
    for (let j = 0; j < 7; j++) box(x + (j - 3) * .32, y + .19, z + .81, .12, .033, .22, '#d6bf8d');
    for (const [tx, tz] of [[-7,2.2],[-5,-2],[3,-5],[4,.1],[7,-3],[4.6,-4],[-6,-1],[-4,1.6]]) {
      tree(tx, groundHeight(tx, tz), tz, true);
    }
  } else {
    const x = -.45, z = -2.65, roofZ = z - .35;
    stonePlatform(x, 5.25, z - 2.2, z + 2.2, summit + 1.17, '#b8a98c');
    box(x, summit + 1.88, roofZ, 4.7, 1.5, 3.8, ivory);
    box(x, summit + 2.69, roofZ, 5.2, .24, 4.23, '#ada68a');
    for (let dx = -2; dx <= 2; dx++) {
      cone(x + dx, summit + 1.72, z + 1.72, .13, .20, 1.45, '#a2947b', 8);
      box(x + dx, summit + 1.88, z + 1.63, .55, 1.18, .06, '#698b80');
    }
    add(new T.CylinderGeometry(0, 3.2, 1.35, 4, 1, false, Math.PI / 4), '#789d91', x, summit + 3.47, roofZ);
    cone(x, summit + 4.06, roofZ, .74, .9, 1.9, ivory);
    for (let i=0;i<8;i++) {
      const a=i*Math.PI/4;
      box(x + Math.sin(a) * .78, summit + 4.09, roofZ + Math.cos(a) * .78, .17, .75, .13, '#6e968c', a);
    }
    cone(x, summit + 5.04, roofZ, .9, .9, .12, '#a99c7b');
    cone(x, summit + 5.25, roofZ, .54, .58, .37, lamp);
    cone(x, summit + 5.62, roofZ, 0, .79, .59, '#728f87');
    const entry = z + 2.2;
    const landing = .72;
    const tread = (landing - entry) / 5;
    for (let i = 0; i < 5; i++) {
      const edge = entry + i * tread;
      stonePlatform(x, 2.2, edge, edge + tread, summit + T.MathUtils.lerp(1.17, .08, (i + 1) / 6), '#c4b89a');
    }
    const plazaLeft = approach.x - approach.width / 2;
    const plazaRight = x + 1.1;
    stonePlatform((plazaLeft + plazaRight) / 2, plazaRight - plazaLeft, landing, approach.from, summit + .08, '#c4b89a');
    gable(-5,summit,-1.4,2,2,1.3,tile);
    for (const [tx, tz] of [[4,-5],[4,0],[-4.5,2],[-2,-6.1],[2,-6],[4.8,-2],[-5,2.8],[-4.3,-3.3]]) {
      tree(tx, groundHeight(tx, tz), tz, true);
    }
  }
  for (let i = 0; i < coast.length; i++) {
    const outer = rings[3][i];
    if (i % 2 === 0) {
      rock(outer.x, outer.y - .29, outer.z, .31 + random() * .79, stone[i % stone.length]);
      rock(outer.x - .46, .17, outer.z + .3, .23 + random() * .23, stone[(i + 1) % stone.length]);
    }
    const bluff = rings[4][i].clone().lerp(rings[5][i], .46);
    if (i % 3 !== 1) {
      rock(bluff.x, bluff.y - .2, bluff.z, .35 + random() * .66, stone[(i + 2) % stone.length]);
      const shrub = rings[5][i].clone().lerp(rings[6][i], .33);
      rock(shrub.x, shrub.y + .13, shrub.z, .26 + random() * .35, meadow[i % meadow.length]);
    }
  }
  buildApproach();
  groundMaterial.dispose();

  const geometry=mergeGeometries(parts);
  parts.forEach(part=>part.dispose());
  group.add(new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:1})));
  return group;
}

export function glassLandmark() {
  const group = new T.Group();
  const glass = new T.MeshPhysicalMaterial({
    name: 'LibreCosta glass',
    color: '#74c7c6', roughness: .21, metalness: .12, clearcoat: 1,
    emissive: '#164e53', emissiveIntensity: .24,
  });
  const seam = new T.MeshStandardMaterial({ color: '#bfdfd5', roughness: .28, metalness: .28 });
  const plaque = new T.Mesh(new T.BoxGeometry(2.06, .35, .095),
    new T.MeshStandardMaterial({ color: '#b8c2aa', roughness: .92 }));
  plaque.position.set(0, -.79, 1.22);
  group.add(plaque);
  for (const [x, z, height, angle] of [[-.37,-.02,1.42,-.15],[.19,-.12,2.14,.2],[.48,.1,1.21,.28]]) {
    const panel = new T.Mesh(new T.BoxGeometry(.31,height,.59),glass);
    panel.position.set(x,height*.48,z);
    panel.rotation.set(.12,angle,-.16);
    group.add(panel);
    const cap = new T.Mesh(new T.BoxGeometry(.32,.045,.61),seam);
    cap.position.set(0,height*.5,0);
    panel.add(cap);
  }
  return group;
}
