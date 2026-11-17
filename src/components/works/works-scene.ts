/*
 * Adapts Wenz Louie Rejas's cameraFraming and islandModel (MIT, 0319381).
 * See public/works/wenz-license.txt.
 */
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { atelierEnvironment } from './atelier-light';
import type { Project } from './projects';

const offset = new T.Vector3(200, 120, 200);

function dispose(object: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>();
  const materials = new Set<T.Material>();
  const textures = new Set<T.Texture>();
  const images = new Set<ImageBitmap>();
  object.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    geometries.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof T.Texture) textures.add(value);
    }
  });
  for (const texture of textures) {
    texture.dispose();
    if (typeof ImageBitmap !== 'undefined' && texture.image instanceof ImageBitmap) images.add(texture.image);
  }
  for (const image of images) image.close();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

function prepareIsland(project: Project, model: T.Object3D) {
  const carrier = new T.Group();
  carrier.add(model);
  carrier.rotation.y = T.MathUtils.degToRad(project.island.bearing);
  const size = new T.Box3().setFromObject(carrier, true).getSize(new T.Vector3());
  carrier.scale.setScalar(project.island.width / Math.max(size.x, size.z));
  carrier.updateMatrixWorld(true);
  // The original Blender assets carry calibrated PBR and baked shading.
  if (project.island.model !== 'signal') return carrier;
  const seen = new Set<T.Material>();
  model.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!(material instanceof T.MeshStandardMaterial) || seen.has(material)) continue;
      seen.add(material);
      if (!material.name.startsWith('LibreCosta')) material.roughness = 1;
      material.metalness *= 0.55;
      material.emissiveIntensity *= 0.34;
      if (material.aoMap) {
        // Retain the upstream baked overhead visibility in the G channel.
        material.onBeforeCompile = shader => {
          shader.fragmentShader = shader.fragmentShader.replace('#include <aomap_fragment>', `
            #include <aomap_fragment>
            #ifdef USE_AOMAP
              float overhead = 1.0 - 0.42 * (1.0 - texture2D(aoMap, vAoMapUv).g);
              reflectedLight.directDiffuse *= overhead;
              reflectedLight.directSpecular *= overhead;
            #endif
          `);
        };
      }
    }
  });
  return carrier;
}

function fitIsland(model: T.Object3D, camera: T.OrthographicCamera) {
  const inverse = camera.quaternion.clone().invert();
  const point = new T.Vector3();
  const bounds = new T.Box3();
  model.traverse(node => {
    if (!(node instanceof T.Mesh) || !node.visible) return;
    const positions = node.geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index++) {
      point.fromBufferAttribute(positions, index).applyMatrix4(node.matrixWorld).applyQuaternion(inverse);
      bounds.expandByPoint(point);
    }
  });
  return {
    target: bounds.getCenter(new T.Vector3()).applyQuaternion(camera.quaternion),
    size: bounds.getSize(new T.Vector3()),
  };
}

async function loadIsland(project: Project, signal: AbortSignal) {
  const slug = project.island.model;

  const response = await fetch(`/works/islands/${slug}.glb`, { signal });
  if (!response.ok) throw new Error(`Island model: ${response.status}`);
  const bytes = await response.arrayBuffer();
  signal.throwIfAborted();
  const decoder = new DRACOLoader().setDecoderPath('/works/draco/').setWorkerLimit(1);
  try {
    const loader = new GLTFLoader().setDRACOLoader(decoder);
    return (await loader.parseAsync(bytes, '')).scene;
  } finally {
    decoder.dispose();
  }
}

export function mountIsland(canvas: HTMLCanvasElement, project: Project, callbacks: {
  ready: () => void;
  failed: () => void;
}) {
  const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'default' });
  renderer.setClearColor(0, 0);
  const scene = new T.Scene();
  const beatline = project.island.model === 'sofaraway';
  const waveLoom = project.island.model === 'wavefield';
  const discoveryHarbor = project.island.model === 'gofurry';
  const neutralDaylight = project.island.model === 'gopher-atlas' || project.island.model === 'tool4furry' || waveLoom || discoveryHarbor;
  const optical = project.island.model === 'liquid-glass' || beatline;
  // Match the approved harbor view so the court and the lower quay both read.
  const viewOffset = discoveryHarbor ? new T.Vector3(200, 168, 200) : offset;
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 900);
  camera.position.copy(viewOffset);
  camera.lookAt(0, 0, 0);
  const hemisphere = optical || neutralDaylight
    ? new T.HemisphereLight('#f0f4f8', '#85988c', 2.25)
    : new T.HemisphereLight('#f0f2dd', '#7b9185', 2.1);
  const sun = new T.DirectionalLight(waveLoom ? '#edf3ff' : optical || neutralDaylight ? '#fff3df' : '#fff1cb', optical ? 2.35 : 2.05);
  sun.position.set(-70, 120, 48);
  scene.add(hemisphere, sun);
  if (project.island.model === 'harvest' || optical || neutralDaylight) {
    // Neutral reflected daylight brings up the copper and timber on the camera side.
    const fill = new T.DirectionalLight('#e6edfa', optical ? .85 : .64);
    fill.position.set(86, 72, 118);
    scene.add(fill);
  }
  if (optical) renderer.transmissionResolutionScale = .75;

  const abort = new AbortController();
  const listen = { signal: abort.signal };
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const controls = new OrbitControls(camera, canvas);
  controls.enabled = false;
  controls.enablePan = false;
  controls.enableDamping = !motion.matches;
  controls.dampingFactor = .17;
  controls.minPolarAngle = Math.PI * .14;
  controls.maxPolarAngle = Math.PI * .49;
  controls.minZoom = .65;
  controls.maxZoom = 1.65;
  controls.touches.TWO = T.TOUCH.DOLLY_PAN;
  const homePosition = new T.Vector3();
  const spherical = new T.Spherical();
  let home: ReturnType<typeof fitIsland> | null = null;
  let reset: { from: T.Spherical; to: T.Spherical; zoom: number; start: number } | null = null;
  let dead = false;
  let frame = 0;
  let presented = false;
  let dirty = true;
  let width = 0;
  let height = 0;
  let pixelRatio = 0;

  function request() {
    if (!frame && !dead && home && width && height && !document.hidden) frame = requestAnimationFrame(render);
  }

  function resize() {
    if (dead) return;
    const rect = canvas.getBoundingClientRect();
    const nextWidth = Math.round(rect.width);
    const nextHeight = Math.round(rect.height);
    const ratio = Math.min(devicePixelRatio || 1, nextWidth < 560 ? 1.25 : 1.5);
    if (width === nextWidth && height === nextHeight && ratio === pixelRatio && !dirty) return;
    width = nextWidth;
    height = nextHeight;
    pixelRatio = ratio;
    if (!width || !height || !home) return;
    const aspect = width / height;
    const half = Math.max(home.size.x / aspect, home.size.y) * .56;
    camera.top = half;
    camera.bottom = -half;
    camera.right = half * aspect;
    camera.left = -camera.right;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    dirty = true;
    request();
  }

  function render(now: number) {
    frame = 0;
    if (document.hidden || dead) return;
    if (reset) {
      const progress = motion.matches ? 1 : T.MathUtils.clamp((now - reset.start) / 420, 0, 1);
      const ease = 1 - (1 - progress) ** 3;
      spherical.set(reset.to.radius, T.MathUtils.lerp(reset.from.phi, reset.to.phi, ease),
        T.MathUtils.lerp(reset.from.theta, reset.to.theta, ease));
      camera.position.setFromSpherical(spherical).add(controls.target);
      camera.zoom = T.MathUtils.lerp(reset.zoom, 1, ease);
      camera.updateProjectionMatrix();
      dirty = true;
      if (progress === 1) reset = null;
    }
    const changed = controls.update();
    if (dirty || changed) {
      renderer.render(scene, camera);
      dirty = false;
    }
    if (!presented) {
      presented = true;
      controls.enabled = true;
      callbacks.ready();
    }
    if (reset || changed && controls.enableDamping) request();
  }

  function interruptReset() { reset = null; }

  function change() {
    dirty = true;
    request();
  }

  function zoom(factor: number) {
    if (!presented || dead) return;
    interruptReset();
    camera.zoom = T.MathUtils.clamp(camera.zoom * factor, controls.minZoom, controls.maxZoom);
    camera.updateProjectionMatrix();
    change();
  }

  function resetView() {
    if (!presented || dead) return;
    // Clear any residual orbit damping before starting the return to the authored view.
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = !motion.matches;
    const from = new T.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    const to = new T.Spherical().setFromVector3(homePosition);
    to.theta = from.theta + T.MathUtils.euclideanModulo(to.theta - from.theta + Math.PI, Math.PI * 2) - Math.PI;
    reset = { from, to, zoom: camera.zoom, start: performance.now() };
    request();
  }

  function keyboard(event: KeyboardEvent) {
    if (!presented || dead) return;
    if (event.key === '+' || event.key === '=') zoom(1.15);
    else if (event.key === '-') zoom(1 / 1.15);
    else if (event.key === 'Home') resetView();
    else {
      const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const step = directions[event.key as keyof typeof directions];
      if (!step) return;
      interruptReset();
      spherical.setFromVector3(camera.position.clone().sub(controls.target));
      spherical.theta += step[0] * .12;
      spherical.phi = T.MathUtils.clamp(spherical.phi + step[1] * .12, controls.minPolarAngle, controls.maxPolarAngle);
      camera.position.setFromSpherical(spherical).add(controls.target);
      change();
    }
    event.preventDefault();
  }

  function onVisibility() {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else request();
  }

  function disposeScene(contextLost = false) {
    if (dead) return;
    dead = true;
    abort.abort();
    cancelAnimationFrame(frame);
    observer.disconnect();
    controls.dispose();
    dispose(scene);
    scene.environment?.dispose();
    scene.clear();
    renderer.dispose();
    if (!contextLost) renderer.forceContextLoss();
  }

  function fail(contextLost = false) {
    if (dead) return;
    disposeScene(contextLost);
    callbacks.failed();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  controls.addEventListener('start', interruptReset);
  controls.addEventListener('change', change);
  canvas.addEventListener('keydown', keyboard, listen);
  canvas.addEventListener('webglcontextlost', () => fail(true), listen);
  document.addEventListener('visibilitychange', onVisibility, listen);
  window.addEventListener('pagehide', event => { if (!event.persisted) disposeScene(); }, listen);
  motion.addEventListener('change', () => {
    controls.enableDamping = !motion.matches;
    request();
  }, listen);

  async function show() {
    const model = await loadIsland(project, abort.signal);
    if (dead) {
      dispose(model);
      return;
    }
    const carrier = prepareIsland(project, model);
    scene.add(carrier);
    if (optical) {
      scene.environment = atelierEnvironment();
      scene.environmentIntensity = beatline ? .38 : .62;
    }
    home = fitIsland(carrier, camera);
    controls.target.copy(home.target);
    homePosition.copy(viewOffset);
    camera.position.copy(home.target).add(homePosition);
    controls.update();
    resize();
  }
  void show().catch(() => fail());
  return { zoom, resetView, dispose: disposeScene };
}

export type IslandScene = ReturnType<typeof mountIsland>;
