import * as T from 'three';

export type Point = readonly [number, number];

const shores: Point[][] = [
  [[-570,-225],[-518,-302],[-457,-327],[-398,-351],[-297,-347],[-213,-326],[-140,-346],[-52,-321],
   [43,-342],[121,-333],[172,-305],[231,-312],[299,-283],[318,-251],[308,-218],[357,-180],[346,-144],
   [405,-112],[397,-87],[450,-58],[469,-31],[444,-10],[398,1],[372,29],[319,31],[291,44],[274,73],
   [227,83],[203,110],[146,111],[97,145],[55,146],[28,173],[-18,181],[-58,166],[-94,177],[-144,157],
   [-179,171],[-221,144],[-270,139],[-289,112],[-346,118],[-369,100],[-408,99],[-436,73],[-487,66],
   [-511,32],[-555,8],[-568,-40],[-551,-87],[-581,-139]],
  [[-472,215],[-443,178],[-412,166],[-370,177],[-341,164],[-314,179],[-280,192],[-260,221],[-267,248],
   [-286,271],[-329,279],[-350,298],[-395,304],[-420,291],[-455,282],[-474,254]],
  [[219,185],[235,156],[272,145],[295,152],[321,126],[358,133],[393,144],[422,165],[467,169],[501,194],
   [490,226],[462,243],[439,245],[409,280],[379,288],[356,275],[329,269],[308,241],[277,232],[248,215]],
  [[-39,324],[-16,305],[20,299],[53,309],[68,335],[49,351],[14,362],[-16,354],[-40,344]],
  [[448,-278],[472,-309],[513,-313],[535,-300],[581,-293],[601,-265],[584,-242],[550,-234],[530,-210],
   [491,-221],[463,-239]],
];

const coastlines = shores.map(points => {
  const curve = new T.CatmullRomCurve3(points.map(([x,z]) => new T.Vector3(x,0,z)), true, 'centripetal');
  return Array.from({length: points.length * 9}, (_, index) => {
    const p = curve.getPoint(index / (points.length * 9));
    const angle = index * .78;
    return [p.x + Math.sin(angle * .73) * 2 + Math.sin(angle * 1.61) * .8,
      p.z + Math.cos(angle * .81) * 2.3 + Math.cos(angle * 1.73) * .9] as Point;
  });
});

const bounds = coastlines.map(coast => {
  const x = coast.map(p => p[0]), z = coast.map(p => p[1]);
  return [Math.min(...x), Math.max(...x), Math.min(...z), Math.max(...z)] as const;
});

function coastDistance(x: number, z: number, coast: Point[]) {
  let inside = false, squared = Infinity;
  for (let i = 0, j = coast.length - 1; i < coast.length; j = i++) {
    const [ax,az] = coast[j], [bx,bz] = coast[i];
    if ((az > z) !== (bz > z) && x < (bx-ax) * (z-az) / (bz-az) + ax) inside = !inside;
    const dx = bx-ax, dz = bz-az;
    const t = T.MathUtils.clamp(((x-ax)*dx + (z-az)*dz)/(dx*dx + dz*dz),0,1);
    squared = Math.min(squared,(x-ax-t*dx)**2 + (z-az-t*dz)**2);
  }
  return (inside ? 1 : -1) * Math.sqrt(squared);
}

function hill(x: number, z: number, cx: number, cz: number, rx: number, rz: number, h: number) {
  return h * Math.exp(-(((x-cx)/rx)**2 + ((z-cz)/rz)**2));
}

function elevation(x: number, z: number, distance: number) {
  const ridge = hill(x,z,-314,-249,135,54,41) + hill(x,z,-194,-190,128,55,30)
    + hill(x,z,151,-220,108,68,20) + hill(x,z,-404,225,41,64,11);
  const folds = 3 * Math.sin(x*.025 + z*.049) + 2 * Math.cos(z*.041 - x*.014);
  return 13 + T.MathUtils.smoothstep(distance, 0, 56) * (3 + ridge + folds);
}

export function surface(x: number, z: number) {
  for (const [index, [left,right,top,bottom]] of bounds.entries()) {
    if (x < left || x > right || z < top || z > bottom) continue;
    const distance = coastDistance(x,z,coastlines[index]);
    if (distance >= 0) return elevation(x,z,distance);
  }
  return 0;
}

function lineObject(vertices: number[], color: string, opacity: number) {
  const geometry = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  return new T.LineSegments(geometry, new T.LineBasicMaterial({ color, opacity, transparent: true, depthWrite: false }));
}

function landMeshes(group: T.Group) {
  const cap: number[] = [], colors: number[] = [], wall: number[] = [], shore: number[] = [];
  const coastHalo: number[] = [], haloStrength: number[] = [];
  const contours: number[] = [];
  const waterLevels = [12, 26, 46].map(distance => ({ height: -distance, vertices: [] as number[] }));
  const low = new T.Color('#0e3043'), high = new T.Color('#1b4c62');
  const color = new T.Color();
  type Vertex = [number, number, number];
  function contourTriangle(triangle: Vertex[], level: number, y: number, vertices: number[]) {
    for (let i = 0; i < 3; i++) {
      const a = triangle[i], b = triangle[(i+1)%3];
      if ((a[1] > level) === (b[1] > level)) continue;
      const t = (level-a[1])/(b[1]-a[1]);
      vertices.push(T.MathUtils.lerp(a[0],b[0],t), y, T.MathUtils.lerp(a[2],b[2],t));
    }
  }
  for (const [island, coast] of coastlines.entries()) {
    const [left,right,top,bottom] = bounds[island];
    const step = 5;
    const margin = 50;
    const width = Math.ceil((right-left+2*margin)/step)+1;
    const height = Math.ceil((bottom-top+2*margin)/step)+1;
    const xs = left-margin, zs = top-margin;
    const grid: Vertex[] = [];
    for (let j=0; j<height; j++) for (let i=0; i<width; i++) {
      const x = xs+i*step, z = zs+j*step;
      grid.push([x,coastDistance(x,z,coast),z]);
    }
    function triangle(a: Vertex, b: Vertex, c: Vertex) {
      const source = [a,b,c], polygon: Vertex[] = [], edge: Vertex[] = [];
      const min = Math.min(a[1],b[1],c[1]), max = Math.max(a[1],b[1],c[1]);
      if (min < 0) for (const level of waterLevels) {
        if (min <= level.height && max > level.height) contourTriangle(source,level.height,.2,level.vertices);
      }
      if (max < 0) return;
      for (let i=0; i<3; i++) {
        const u = source[i], v = source[(i+1)%3];
        if (u[1] >= 0) polygon.push([u[0],elevation(u[0],u[2],u[1]),u[2]]);
        if ((u[1] >= 0) !== (v[1] >= 0)) {
          const t = u[1]/(u[1]-v[1]);
          const cut: Vertex = [T.MathUtils.lerp(u[0],v[0],t),13,T.MathUtils.lerp(u[2],v[2],t)];
          polygon.push(cut);
          edge.push(cut);
        }
      }
      for (let i=1; i<polygon.length-1; i++) {
        const points = [polygon[0],polygon[i],polygon[i+1]];
        for (const level of [20,25,31,38,45,53,61]) contourTriangle(points,level,level+.16,contours);
        for (const p of points) {
          cap.push(...p);
          color.copy(low).lerp(high,T.MathUtils.smoothstep(p[1],13,62));
          colors.push(color.r,color.g,color.b);
        }
      }
      if (edge.length !== 2) return;
      const [u,v] = edge;
      const base = -2;
      wall.push(...u, u[0],base,u[2], ...v, ...v, u[0],base,u[2], v[0],base,v[2]);
      shore.push(u[0],u[1]+.2,u[2],v[0],v[1]+.2,v[2]);
      const length = Math.hypot(v[0]-u[0],v[2]-u[2]) || 1;
      const inside = source.find(p => p[1]>=0) ?? u;
      const normalX = (u[2]-v[2])/length, normalZ = (v[0]-u[0])/length;
      const direction = (inside[0]-u[0])*normalX+(inside[2]-u[2])*normalZ > 0 ? -1 : 1;
      const dx = normalX * 11 * direction, dz = normalZ * 11 * direction;
      const topY=13.22;
      coastHalo.push(u[0],topY,u[2],v[0],topY,v[2],u[0]+dx,topY,u[2]+dz,
        v[0],topY,v[2],v[0]+dx,topY,v[2]+dz,u[0]+dx,topY,u[2]+dz);
      haloStrength.push(1,1,0,1,0,0);
    }
    for (let j=0; j<height-1; j++) for (let i=0; i<width-1; i++) {
      const k=j*width+i;
      triangle(grid[k],grid[k+width],grid[k+1]);
      triangle(grid[k+1],grid[k+width],grid[k+width+1]);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(cap,3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  group.add(new T.Mesh(geometry, new T.MeshLambertMaterial({vertexColors:true})));
  const wallGeometry = new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(wall,3));
  group.add(new T.Mesh(wallGeometry, new T.ShaderMaterial({
    side:T.DoubleSide,
    vertexShader:'varying float h; void main() { h=position.y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:`varying float h;
      void main() {
        vec3 c=mix(vec3(.008,.035,.063), vec3(.020,.17,.26), smoothstep(2.0,13.5,h));
        c+=vec3(.014,.053,.09)*(smoothstep(5.5,6.2,h)-smoothstep(6.9,7.8,h));
        gl_FragColor=vec4(c,1.0);
        #include <colorspace_fragment>
      }`,
  })));
  group.add(lineObject(shore,'#72ddff',.81));
  waterLevels.forEach(({vertices},index) => group.add(lineObject(vertices,'#438baa',[.37,.22,.11][index])));
  const halo = new T.BufferGeometry();
  halo.setAttribute('position', new T.Float32BufferAttribute(coastHalo,3));
  halo.setAttribute('strength', new T.Float32BufferAttribute(haloStrength,1));
  group.add(new T.Mesh(halo,new T.ShaderMaterial({
    transparent:true, depthWrite:false, side:T.DoubleSide,
    vertexShader:'attribute float strength; varying float s; void main(){s=strength; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying float s;
      void main() {
        gl_FragColor=vec4(.046,.36,.57,.21*pow(s,2.3));
        #include <colorspace_fragment>
      }`,
  })));
  group.add(lineObject(contours,'#63b4d5',.24));
}

function onLand(x: number,z: number, inset=3) {
  const i=bounds.findIndex(([l,r,t,b], index) => x>l && x<r && z>t && z<b && coastDistance(x,z,coastlines[index]) > inset);
  return i >= 0;
}

function route(points: Point[], offset: number, spacing: number, clip = false) {
  const curve = new T.CatmullRomCurve3(points.map(([x,z])=>new T.Vector3(x,0,z)));
  const vertices: number[] = [];
  const count = Math.ceil(curve.getLength()/spacing);
  let previous = curve.getPoint(0);
  for (let i=1; i<=count; i++) {
    const current = curve.getPoint(i/count);
    if ((!clip || (onLand(previous.x,previous.z) && onLand(current.x,current.z))) && (clip || i%4<3)) {
      for (const p of [previous,current]) vertices.push(p.x,(clip ? surface(p.x,p.z) : 0) + offset,p.z);
    }
    previous=current;
  }
  return vertices;
}

const arteries: Point[][] = [
  [[-480,-33],[-394,14],[-295,23],[-202,5],[-127,45],[-45,70],[46,76],[111,54],[209,28],[285,-12],[370,-40],[425,-43]],
  [[-393,15],[-359,-54],[-298,-93],[-216,-131],[-121,-138],[-41,-168],[14,-235],[80,-273]],
  [[-124,46],[-111,-13],[-64,-54],[30,-82],[87,-136],[164,-149],[244,-153],[328,-128]],
  [[-273,26],[-251,57],[-193,80],[-126,103],[-62,124],[19,117],[69,99]],
  [[112,54],[157,70],[206,62],[265,33]],
  [[-441,233],[-393,217],[-349,233],[-303,232]],
  [[253,190],[309,192],[361,213],[425,216],[459,196]],
];

function city(group: T.Group) {
  const major = arteries.flatMap(path => route(path, 1.2, 4, true));
  const rivers = [
    [[7,-294],[-23,-248],[-13,-203],[-38,-171],[-53,-134],[-31,-100],[-20,-68],[8,-32],[-10,8],[9,59],[45,94],[43,157]],
    [[146,-236],[106,-204],[77,-204],[58,-182],[21,-169],[-38,-171]],
  ] satisfies Point[][];
  const streams = rivers.flatMap(path => route(path, .9, 4, true));
  const ferries = [
    [[-315,105],[-345,126],[-371,156],[-365,183]],
    [[64,133],[124,174],[198,193],[250,185]],
    [[281,35],[316,74],[356,96],[391,144]],
  ] satisfies Point[][];
  group.add(lineObject(ferries.flatMap(path=>route(path,.45,5)),'#4aaecf',.48));
  group.add(lineObject(streams,'#61c1ed',.43));
  group.add(lineObject(major,'#65d4fa',.69));

  const streets: number[] = [], collectors: number[] = [];
  const blocks: {x:number;y:number;z:number;w:number;h:number;d:number;angle:number}[] = [];
  let seed = 519731;
  function random() {
    seed = (Math.imul(seed,1664525)+1013904223)>>>0;
    return seed/4294967296;
  }
  for (const [cx,cz,columns,rows,angle] of [
    [-349,40,9,5,-.14],[-220,57,8,5,.24],[-80,78,8,5,.34],[73,87,9,6,-.26],
    [219,-3,9,6,-.29],[356,-58,7,5,.27],[-367,233,8,5,-.15],[364,212,9,5,.18],
  ]) {
    const gap = 12;
    const co=Math.cos(angle), si=Math.sin(angle);
    const point=(i:number,j:number):Point=>[cx+i*co-j*si,cz+i*si+j*co];
    const nearest=arteries.flat().reduce((best,p)=>
      Math.hypot(p[0]-cx,p[1]-cz)<Math.hypot(best[0]-cx,best[1]-cz)?p:best);
    const local = point(0,-(rows-1)*gap/2);
    if (Math.hypot(nearest[0]-local[0],nearest[1]-local[1])>9) {
      collectors.push(...route([nearest,local,[cx,cz]],1.15,4,true));
    }
    for (let j=0; j<rows; j++) for (let i=0; i<columns; i++) {
      const u=(i-(columns-1)/2)*gap, v=(j-(rows-1)/2)*gap;
      const [x,z]=point(u,v);
      if (!onLand(x,z,7) || random() < .12) continue;
      for (const [dx,dz,allowed] of [[gap,0,i+1<columns],[0,gap,j+1<rows]] as const) {
        const [bx,bz]=point(u+dx,v+dz);
        if (allowed && onLand(bx,bz,4)) streets.push(x,surface(x,z)+.9,z,bx,surface(bx,bz)+.9,bz);
      }
      const [px,pz]=point(u+4,v+4);
      if (i+1<columns && j+1<rows && onLand(px,pz,6) && random() > .16) {
        blocks.push({x:px,z:pz,y:surface(px,pz),w:2+random()*4,d:2+random()*5,h:1.3+random()**2*9,angle});
      }
    }
  }
  group.add(lineObject(collectors,'#50b6d8',.47));
  group.add(lineObject(streets,'#3c99bf',.57));
  const mesh = new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshLambertMaterial({color:'#4889a2'}),blocks.length);
  const transform = new T.Object3D();
  const color = new T.Color();
  blocks.forEach(({x,y,z,w,h,d,angle},i)=>{
    transform.position.set(x,y+h/2,z);
    transform.scale.set(w,h,d);
    transform.rotation.y=-angle;
    transform.updateMatrix();
    mesh.setMatrixAt(i,transform.matrix);
    mesh.setColorAt(i,color.setRGB(.4+random()*.31,.55+random()*.31,.66+random()*.29));
  });
  group.add(mesh);
}

export function makeWorld() {
  const group = new T.Group();
  const ocean = new T.Mesh(new T.PlaneGeometry(8500,8500),new T.ShaderMaterial({
    vertexShader:`varying vec2 map; void main() {
      vec4 p=modelMatrix*vec4(position,1.0); map=p.xz; gl_Position=projectionMatrix*viewMatrix*p;
    }`,
    fragmentShader:`varying vec2 map;
      void main() {
        vec2 a=abs(fract(map/100.0+.5)-.5)*100.0;
        vec2 aa=max(fwidth(map),vec2(.01));
        float grid=1.0-min(smoothstep(.18,.18+aa.x,a.x),smoothstep(.18,.18+aa.y,a.y));
        float bay=exp(-length((map-vec2(20.,155.))/vec2(680.,470.))*1.75);
        vec3 sea=mix(vec3(.0015,.0048,.011),vec3(.003,.023,.045),bay);
        sea+=vec3(.003,.014,.023)*grid*bay;
        gl_FragColor=vec4(sea,1.);
        #include <colorspace_fragment>
      }`,
  }));
  ocean.rotation.x=-Math.PI/2;
  ocean.position.y=-2.2;
  group.add(ocean);
  landMeshes(group);
  city(group);
  return group;
}
