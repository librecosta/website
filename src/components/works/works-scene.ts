import type { Project } from './projects';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeWorld, surface, type Point } from './works-world';
import { markImages } from './ProjectMark';

export const atlasRegions = {
  rivet: [-269,-58],
  vane: [-277,-215],
  refraction: [308,-115],
  farbeat: [429,256],
  folio: [-354,308],
} as const satisfies Record<Project['region'], Point>;

const tints: Record<string,string> = {
  gofurry: '#a2ebef', 'librecosta-uptime': '#c4d6fa', 'liquid-glass': '#9cf2db',
  wavefield: '#a5d9ff', sofaraway: '#e0b9ff', gopheratlas: '#f7d49e',
};

const desktopView = new T.Vector3(.11,.94,1).normalize();
const portraitView = new T.Vector3(-.788,1.15,.616).normalize();
const desktopCenter = new T.Vector3(5,0,-3);
const portraitCenter = new T.Vector3(21,0,-19);
const sphereGeometry = () => new T.SphereGeometry(1,48,28);

function glassMaterial(tint: T.Color) {
  return new T.ShaderMaterial({
    uniforms: { tint: { value: tint }, focus: { value: 0 } },
    transparent:true,
    depthWrite:false,
    vertexShader:`varying vec3 n;
      void main() {
        n=normalize(normalMatrix*normal);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }`,
    fragmentShader:`uniform vec3 tint;
      uniform float focus;
      varying vec3 n;
      void main() {
        vec3 normal=normalize(n);
        float center=clamp(normal.z,0.,1.);
        float rim=pow(1.-center,2.35);
        float edge=pow(1.-center,6.);
        float glint=pow(max(dot(normal,normalize(vec3(-.56,.63,.49))),0.),25.);
        float bounce=pow(max(dot(normal,normalize(vec3(.42,-.72,.54))),0.),8.);
        float shade=pow(max(dot(normal,normalize(vec3(.09,-.76,.62))),0.),2.);
        float opacity= .11 + .47*rim + .31*edge + .54*glint + .18*bounce + .17*shade + focus*.09;
        vec3 c=tint*(.29 + .59*rim + .16*bounce + .20*focus);
        c=mix(c,vec3(.86,.99,1.),max(glint*.92,edge*.68));
        gl_FragColor=vec4(c,min(opacity,.92));
        #include <colorspace_fragment>
      }`,
  });
}

function marker(project: Project, geometry: T.SphereGeometry, iconGeometry: T.PlaneGeometry) {
  const [x,z] = project.position;
  const ground = surface(x,z);
  const tint = new T.Color(tints[project.slug] ?? '#a7edfa');
  const group = new T.Group();
  group.position.set(x,ground,z);
  const glass = new T.Mesh(geometry, glassMaterial(tint));
  glass.renderOrder=3;
  const icon = new T.Mesh(iconGeometry, new T.ShaderMaterial({
    transparent:true, depthWrite:false,
    uniforms:{image:{value:null},tint:{value:tint},official:{value:project.landmark==='terrace'?1:0}},
    vertexShader:'varying vec2 p; void main() { p=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader:`uniform sampler2D image; uniform vec3 tint; uniform float official; varying vec2 p;
      void main() {
        vec4 mark=texture2D(image,p);
        vec3 c=mix(mark.rgb,vec3(1.),official);
        gl_FragColor=vec4(mix(c,tint,.14),mark.a);
        #include <colorspace_fragment>
      }`,
  }));
  icon.visible=false;
  icon.renderOrder=2;
  const light = new T.Mesh(
    new T.CylinderGeometry(.9,4.5,1,16,1,true),
    new T.MeshBasicMaterial({color:tint,opacity:.49,transparent:true,side:T.DoubleSide,depthWrite:false}),
  );
  const base = new T.Group();
  for (const [radius,width,opacity] of [[23,.6,.72],[31,.48,.38],[37,.22,.19]]) {
    const ring = new T.Mesh(new T.RingGeometry(radius-width,radius,64),
      new T.MeshBasicMaterial({color:tint,opacity,transparent:true,side:T.DoubleSide,depthWrite:false}));
    ring.rotation.x=-Math.PI/2;
    base.add(ring);
  }
  base.position.y=1.7;
  const footprint = new T.Mesh(new T.CircleGeometry(32,48),new T.ShaderMaterial({
    uniforms:{tint:{value:tint}}, depthWrite:false, transparent:true,
    vertexShader:'varying vec2 p; void main() { p=uv-.5; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader:`uniform vec3 tint; varying vec2 p;
      void main(){ gl_FragColor=vec4(tint,.28*pow(max(0.,1.-length(p)*2.),1.65));
        #include <colorspace_fragment>
      }`,
  }));
  footprint.rotation.x=-Math.PI/2;
  footprint.position.y=1.2;
  group.add(glass,icon,light,base,footprint);
  return {group,glass,icon,light,base,footprint};
}

export function mountAtlas(container: HTMLDivElement, interaction: HTMLElement, projects: readonly Project[], zoomChanged: (value:number)=>void) {
  const renderer = new T.WebGLRenderer({ antialias:true, alpha:false, powerPreference:'low-power' });
  renderer.setClearColor('#050e18');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.65));
  renderer.domElement.setAttribute('aria-hidden','true');
  renderer.domElement.dataset.atlasCanvas = '';
  const scene = new T.Scene();
  scene.add(new T.HemisphereLight('#b1eaff','#406585',1.38));
  const daylight = new T.DirectionalLight('#b9e6ff',2.05);
  daylight.position.set(-320,580,-380);
  scene.add(daylight);
  scene.add(makeWorld());
  const geo = sphereGeometry();
  const iconGeometry = new T.PlaneGeometry(1,1);
  const textures = new T.TextureLoader();
  let disposed = false;
  const markers = projects.map(p=>{
    const model=marker(p,geo,iconGeometry);
    model.icon.material.uniforms.image.value = textures.load(markImages[p.landmark],texture=>{
      if (disposed) return;
      texture.colorSpace=T.SRGBColorSpace;
      model.icon.visible=true;
      invalidate();
    });
    scene.add(model.group);
    return {project:p, ...model};
  });
  const camera = new T.OrthographicCamera(-1,1,1,-1,1,3800);
  const viewDirection = desktopView.clone();
  const home = desktopCenter.clone();
  function keepMarkerClick(event: PointerEvent) {
    if (event.target instanceof Element && event.target.closest('button')) event.stopPropagation();
  }
  interaction.addEventListener('pointerdown',keepMarkerClick,true);
  const controls = new OrbitControls(camera,interaction);
  controls.enableRotate=false;
  controls.enableDamping=false;
  controls.screenSpacePanning=false;
  controls.zoomToCursor=true;
  controls.minZoom=1;
  controls.maxZoom=3.4;
  controls.maxTargetRadius=670;
  controls.panSpeed=.88;
  controls.mouseButtons.LEFT=T.MOUSE.PAN;
  controls.touches.ONE=T.TOUCH.PAN;
  controls.touches.TWO=T.TOUCH.DOLLY_PAN;
  controls.target.copy(home);
  const bySlug = new Map<string, HTMLElement>();
  const regionLabels = new Map<string, HTMLElement>();
  const labelPositions = Object.entries(atlasRegions).map(([region,[x,z]]) =>
    ({region, point:new T.Vector3(x,surface(x,z)+2,z)}));
  const projected = new T.Vector3();
  let request = 0;
  let width = 0, height = 0;
  let focused: string | null = null;
  let selected: string | null = null;
  let currentZoom = NaN;
  let portrait = false;

  function place(el: HTMLElement | undefined, point: T.Vector3, margin: number) {
    if (!el) return;
    point.project(camera);
    const x=(point.x*.5+.5)*width, y=(.5-point.y*.5)*height;
    const visible=x>margin && x<width-margin && y>margin && y<height-margin;
    el.style.setProperty('--screen-x',x.toFixed(1)+'px');
    el.style.setProperty('--screen-y',y.toFixed(1)+'px');
    el.toggleAttribute('data-offscreen', !visible);
  }

  function draw() {
    request=0;
    if (!width || !height) return;
    camera.updateMatrixWorld();
    const pixelsPerUnit=height*camera.zoom/(camera.top-camera.bottom);
    for (const {project,group,glass,icon,light,base,footprint} of markers) {
      const active=project.slug===focused || project.slug===selected;
      const radius=T.MathUtils.clamp(32*pixelsPerUnit,width<600?16:23,width<600?34:51)/pixelsPerUnit;
      const lift=Math.max(53,radius*(width<600?1.43:1.65));
      glass.scale.setScalar(radius*(active?1.08:1));
      glass.position.y=lift;
      icon.position.y=lift;
      icon.quaternion.copy(camera.quaternion);
      const image = icon.material.uniforms.image.value.image;
      const aspect = image ? image.width / image.height : 1;
      icon.scale.set(radius*1.02,radius*1.02/aspect,1);
      glass.material.uniforms.focus.value=active?1:0;
      light.position.y=(lift-radius*.8)*.5;
      light.scale.y=lift-radius*.8;
      const baseScale=T.MathUtils.clamp(radius/28,1,1.3);
      base.scale.setScalar(baseScale);
      footprint.scale.setScalar(baseScale);
      const element=bySlug.get(project.slug);
      element?.style.setProperty('--orb-diameter',(2*radius*pixelsPerUnit).toFixed(1)+'px');
      projected.copy(group.position);
      projected.y+=lift;
      place(element,projected,24);
      if (element) {
        const x = (projected.x*.5+.5)*width;
        const y = (.5-projected.y*.5)*height;
        const cardMargin = Math.min(114,width*.27)+12;
        element.style.setProperty('--tip-offset', T.MathUtils.clamp(x,cardMargin,width-cardMargin)-x+'px');
        element.toggleAttribute('data-flip', y>height-160);
      }
    }
    for (const {region,point} of labelPositions) {
      place(regionLabels.get(region),projected.copy(point),33);
    }
    renderer.render(scene,camera);
    if (camera.zoom!==currentZoom) {
      currentZoom=camera.zoom;
      zoomChanged(currentZoom);
    }
  }

  function invalidate() {
    if (!request) request=requestAnimationFrame(draw);
  }

  function resize() {
    width=container.clientWidth;
    height=container.clientHeight;
    if (!width || !height) return;
    const ratio=width/height;
    const usePortrait = ratio < .86;
    if (usePortrait !== portrait) {
      portrait=usePortrait;
      viewDirection.copy(portrait ? portraitView : desktopView);
      const center = portrait ? portraitCenter : desktopCenter;
      controls.target.add(center.clone().sub(home));
      home.copy(center);
      controls.cursor.copy(center);
      camera.position.copy(controls.target).addScaledVector(viewDirection,1400);
      controls.update();
    }
    const span=Math.max(708,(portrait ? 1085 : 1315)/ratio);
    camera.left=-span*ratio/2;
    camera.right=span*ratio/2;
    camera.top=span/2;
    camera.bottom=-span/2;
    camera.updateProjectionMatrix();
    renderer.setSize(width,height);
    invalidate();
  }

  function reset() {
    controls.target.copy(home);
    camera.position.copy(home).addScaledVector(viewDirection,1400);
    camera.zoom=1;
    camera.updateProjectionMatrix();
    controls.update();
    invalidate();
  }

  function zoom(factor: number) {
    camera.zoom=T.MathUtils.clamp(camera.zoom*factor,controls.minZoom,controls.maxZoom);
    camera.updateProjectionMatrix();
    invalidate();
  }

  container.append(renderer.domElement);
  controls.addEventListener('change',invalidate);
  const resizeObserver=new ResizeObserver(resize);
  resizeObserver.observe(container);
  reset();
  resize();
  return {
    zoom,
    reset,
    reveal(project: Project, fromIndex: boolean) {
      const [x,z]=project.position;
      if (width>=641 && !fromIndex) return;
      const nextZoom = fromIndex ? Math.max(camera.zoom,1.55) : camera.zoom;
      const shift = width<641 ? (camera.top-camera.bottom) / nextZoom * (height < 640 ? .24 : .16) : 0;
      const planarLength = Math.hypot(viewDirection.x,viewDirection.z);
      const target = new T.Vector3(x,0,z).addScaledVector(
        new T.Vector3(viewDirection.x,0,viewDirection.z),
        shift / (viewDirection.y * planarLength),
      );
      const difference = target.sub(controls.target);
      controls.target.add(difference);
      camera.position.add(difference);
      camera.zoom=nextZoom;
      camera.updateProjectionMatrix();
      controls.update();
      invalidate();
    },
    marker(slug: string, el: HTMLElement | null) {
      if (el) {
        bySlug.set(slug,el);
        invalidate();
      } else bySlug.delete(slug);
    },
    label(region: string, el: HTMLElement | null) {
      if (el) {
        regionLabels.set(region,el);
        invalidate();
      } else regionLabels.delete(region);
    },
    highlight(hover: string|null, current: string|null) {
      focused=hover;
      selected=current;
      invalidate();
    },
    dispose() {
      disposed=true;
      if (request) cancelAnimationFrame(request);
      resizeObserver.disconnect();
      interaction.removeEventListener('pointerdown',keepMarkerClick,true);
      controls.removeEventListener('change',invalidate);
      controls.dispose();
      const resources=new Set<T.BufferGeometry|T.Material>();
      scene.traverse(object=>{
        if (object instanceof T.Mesh || object instanceof T.LineSegments) {
          resources.add(object.geometry);
          resources.add(object.material);
          if (object instanceof T.InstancedMesh) object.dispose();
        }
      });
      for (const asset of resources) asset.dispose();
      for (const {icon} of markers) icon.material.uniforms.image.value.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

export type AtlasScene = ReturnType<typeof mountAtlas>;
