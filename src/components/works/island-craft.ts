import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Kind = 'fields' | 'gates' | 'archive';
const stone = ['#817f70', '#a8a08b', '#767e73', '#b7a990'];
const meadow = ['#879858', '#9ea966', '#a3ac69', '#758d60'];
const ivory = '#ded4b4';
const tile = '#a8553b';
const dark = '#555a56';
const lamp = '#ffe7a2';
const wood = '#937254';

export function originalIsland(kind: Kind) {
  const group = new T.Group();
  const parts: T.BufferGeometry[] = [];
  let seed = { fields: 149, gates: 318, archive: 279 }[kind];
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
    fields: [[-12, -2], [-11, -7], [-7, -10], [0, -10], [7, -8], [12, -4], [12, 1], [8, 5], [4, 7], [-3, 8], [-9, 6], [-13, 2]],
    gates: [[-14, 5], [-15, 0], [-11, -5], [-6, -6], [-1, -3], [5, -5], [11, -9], [15, -8], [15, -4], [10, 1], [5, 4], [-1, 4], [-6, 6]],
    archive: [[-12, -4], [-8, -9], [-2, -11], [4, -10], [10, -7], [12, -2], [9, 6], [6, 8], [4, 5], [1, 4], [-2, 8], [-7, 9], [-13, 4]],
  }[kind];
  const summit = { fields: 3.6, gates: 3.0, archive: 4.8 }[kind];
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

  const materials = [wood, '#c09c68', '#ac885b', '#c8a775'];
  function dock(x:number,z:number,length:number) {
    for(let i=0;i<length*4;i++) box(x, .58, z+i*.25, 2.18,.18,.24,materials[i%4]);
    for(const side of [-.95,.95]) for(let j=0;j<length;j+=1.6) {
      cone(x+side,.31,z+j,.09,.13,1.36,wood,6);
      if(j===0 || j>length-1.7) cone(x+side,.98,z+j,.15,.15,.22,lamp,6);
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
  if(kind==='fields') {
    for(let k=0;k<9;k++){
      const z=-4+k*.56;
      const length=10-Math.abs(4-k)*.44;
      box(-.9,summit+.04,z,length,.1,.45,k%3===0?'#ad8a55':'#9e884f');
      for(let i=0;i<Math.floor(length*3);i++){
        const x=-.9-length*.44+i*.29;
        const h=.15+random()*.36;
        cone(x,summit+h*.5,z+.08,.04,.1,h,i%5===0?'#c3ac61':'#748749',5);
      }
    }
    gable(-3.15,summit,2.25,2.7,1.65,1.2,tile);
    gable(2.5,summit,1.65,1.7,1.55,1,'#779991');
    cone(4.65,summit+.9,-.3,.58,.74,1.8,dark);
    cone(4.65,summit+1.93,-.3,0,.63,.55,'#b99c6b');
    for(let i=0;i<10;i++)box(-4.7+i*.8,summit+.04,3.4,.65,.08,.46,'#c0ad7d');
    for (const [x,z] of [[-7,0],[5,-3],[-5,-5],[4,2],[-6,3],[-4,3.8],[1,-4.8],[5,-1.2]]) {
      tree(x,summit,z);
    }
    for (let step=0;step<13;step++) {
      box(-.3, .55+step*.227, 6.18-step*.195, 1.25,.27,.29, '#bdac82');
    }
    dock(.4,6.2,3.1);
  } else if(kind==='gates') {
    const gates = [];
    for(let k=0;k<5;k++){
      const x=-8.2+k*3.65, z=1.1-Math.sin(k*.75)*3.5;
      gates.push([x, z]);
      const h=1.9+k*.22, w=2.9;
      const y=summit;
      box(x,y+.09,z,w+.7,.18,w*.82,'#bfad90');
      for(const side of [-1,1]){
        const px=x+side*w*.48;
        box(px,y+h*.53,z,.46,h,.44,'#bcb19a',.17);
        box(px,y+h*.55,z+.25,.16,h*.67,.09,k%2?'#d68f65':'#a078ad');
        box(px,y+.17,z,.81,.34,.73,'#777b79');
      }
      add(new T.TorusGeometry(w*.505,.15,5,12,Math.PI), '#beb4a2',x,y+h-.06,z);
      add(new T.TorusGeometry(w*.485,.045,5,12,Math.PI),k%2?'#edaa74':'#b18abb',x,y+h-.06,z+.17);
      for(let j=0;j<7;j++)box(x+(j-3)*.32,y+.17,z+.81,.12,.11,.22,'#d6bf8d');
    }
    for (let i = 1; i < gates.length; i++) {
      const [ax, az] = gates[i - 1];
      const [bx, bz] = gates[i];
      const angle = -Math.atan2(bz - az, bx - ax);
      for (const t of [.28, .5, .72]) {
        const x = T.MathUtils.lerp(ax, bx, t);
        const z = T.MathUtils.lerp(az, bz, t);
        box(x, summit + .12, z, .68, .18, 1.46, '#c2ab89', angle);
        box(x, summit + .22, z + .65, .59, .035, .08, '#a389af', angle);
      }
    }
    for (let i = 0; i < 9; i++) box(-7.5 + i * .06, .62 + i * .22, 4.9 - i * .23, 1.16, .28, .29, '#a99a80');
    for(const p of [[-7,2.2],[-5,-2],[3,-5],[5,0],[7,-3],[4.6,-4],[-6,-1],[-4,1.6]])tree(p[0],summit,p[1],true);
    dock(-7.5,4.5,3.5);
  } else {
    for(let i=0;i<5;i++)box(.5,summit+.12+i*.11,3.4-i*.29,3.8-i*.2,.22+i*.11,.49,'#c4b89a');
    box(.5,summit+.58,-.35,5.25,1.17,4.4,'#b8a98c');
    box(.5,summit+1.88,-.7,4.7,1.5,3.8,ivory);
    box(.5,summit+2.69,-.7,5.2,.24,4.23,'#ada68a');
    for(const x of [-1.5,-.5,.5,1.5,2.5]) {
      cone(x,summit+1.72,1.37,.13,.20,1.45,'#a2947b',8);
      box(x,summit+1.88,1.28,.55,1.18,.06,'#698b80');
    }
    add(new T.CylinderGeometry(0,3.2,1.35,4,1,false,Math.PI/4),'#789d91',.5,summit+3.47,-.7);
    cone(.5,summit+4.06,-.7,.74,.9,1.9,ivory);
    for (let i=0;i<8;i++) {
      const a=i*Math.PI/4;
      box(.5+Math.sin(a)*.78,summit+4.09,-.7+Math.cos(a)*.78,.17,.75,.13,'#6e968c',a);
    }
    cone(.5,summit+5.04,-.7,.9,.9,.12,'#a99c7b');
    cone(.5,summit+5.25,-.7,.54,.58,.37,lamp);
    cone(.5,summit+5.62,-.7,0,.79,.59,'#728f87');
    gable(-5,summit,-1.4,2,2,1.3,tile);
    for(const p of [[4,-5],[4,0],[-4,2],[-2,-4],[2,-4],[4.8,-2],[-5,2.8],[-3,-3]])tree(p[0],summit,p[1],true);
    for(let i=0;i<12;i++)box(2.2+i*.19,summit-.31*i,2.15+i*.285,1.1,.32,.35,'#b2a68c',-.37);
    dock(5.4,5.6,4.3);
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
