/*
 * Adapts Wenz Louie Rejas's cameraFraming, islandModel and interactionManager
 * (MIT, 0319381). See public/works/wenz-license.txt.
 */
import * as T from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Project } from './projects';
import { glassLandmark, originalIsland } from './island-craft';
import { buildWaterlineField } from './shore-field';
import { oceanMaterial, oceanSurfaceMaterial, shoreMesh } from './water';

const OFFSET = new T.Vector3(200, 120, 200);
const RIGHT = new T.Vector3(1, 0, -1).normalize();
const FORWARD = new T.Vector3(1, 0, 1).normalize();
const RISE = OFFSET.y / OFFSET.length();
const VERTICAL = 200 * Math.SQRT2 / OFFSET.length();
const CRAFT = { collector: 'fields', gates: 'gates', archive: 'archive' } as const;
const SHORE_MARGIN = 3.7;

type Island = {
  project: Project;
  model: T.Object3D;
  bounds: T.Box3;
  marker: T.Vector3;
  center: T.Vector3;
  tints: { material: T.MeshStandardMaterial; base: T.Color }[];
  shore: T.Mesh<T.PlaneGeometry, T.ShaderMaterial> | null;
  hoverBlend: number;
};

type Input = {
  points: ReadonlyMap<string, HTMLButtonElement>;
  hover: (project: Project | null) => void;
  select: (project: Project) => void;
  loaded: (count: number) => void;
  failed: () => void;
};

function dispose(object: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>();
  const materials = new Set<T.Material>();
  const textures = new Set<T.Texture>();
  object.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    geometries.add(node.geometry);
    const meshMaterials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of meshMaterials) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof T.Texture) textures.add(value);
      if (material instanceof T.ShaderMaterial) {
        for (const { value } of Object.values(material.uniforms) as T.IUniform[]) {
          if (value instanceof T.Texture) textures.add(value);
        }
      }
    }
  });
  for (const texture of textures) {
    texture.dispose();
    if (typeof ImageBitmap !== 'undefined' && texture.image instanceof ImageBitmap) texture.image.close();
  }
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

function prepareIsland(project: Project, model: T.Object3D): Island {
  const carrier = new T.Group();
  carrier.add(model);
  carrier.rotation.y = T.MathUtils.degToRad(project.island.bearing);
  const initial = new T.Box3().setFromObject(carrier, true);
  const size = initial.getSize(new T.Vector3());
  const scale = project.island.width / Math.max(size.x, size.z);
  const pivot = initial.getCenter(new T.Vector3());
  const [across, depth] = project.island.chart;
  carrier.scale.setScalar(scale);
  carrier.position.copy(RIGHT).multiplyScalar(across).addScaledVector(FORWARD, -depth);
  carrier.position.x -= pivot.x * scale;
  carrier.position.z -= pivot.z * scale;
  // The original models and authored islands share a water plane at Y=0.
  carrier.position.y = project.island.model === 'signal' ? 0.3 : 0;
  carrier.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(carrier, true);
  const center = bounds.getCenter(new T.Vector3());
  const marker = center.clone();
  marker.y = bounds.max.y + 1.7;

  const tints: Island['tints'] = [];
  const seen = new Set<T.Material>();
  model.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    for (const material of (Array.isArray(node.material) ? node.material : [node.material])) {
      if (!(material instanceof T.MeshStandardMaterial) || seen.has(material)) continue;
      seen.add(material);
      if (!material.name.startsWith('LibreCosta')) material.roughness = 1;
      material.metalness *= 0.55;
      material.emissiveIntensity *= 0.34;
      if (project.island.model === 'prism' && /Glow_Creative/.test(material.name)) {
        material.color.set('#7abbad');
        material.emissive.set('#368c83');
      }
      if (material.aoMap) {
        // Wenz's packed bake persists in the glTF AO channel. Use the G
        // overhead visibility channel for the direct daylight contribution.
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
      tints.push({ material, base: material.color.clone() });
    }
  });
  const field = buildWaterlineField(carrier, 0.04, SHORE_MARGIN, 144);
  return { project, model: carrier, bounds, center, marker, tints, hoverBlend: 0,
    shore: field ? shoreMesh(field, SHORE_MARGIN) : null };
}

export function mountAtlas(canvas: HTMLCanvasElement, projects: readonly Project[], input: Input) {
  const renderer = new T.WebGLRenderer({ canvas, alpha: false, antialias: true, powerPreference: 'high-performance' });
  const scene = new T.Scene();
  scene.background = new T.Color('#28778b');
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 4200);
  const hemisphere = new T.HemisphereLight('#f0f2dd', '#7b9185', 2.1);
  const sun = new T.DirectionalLight('#fff1cb', 2.05);
  sun.position.set(-70, 120, 48);
  scene.add(hemisphere, sun);
  const sea = new T.Mesh(new T.PlaneGeometry(4400, 4400, 96, 96), oceanMaterial());
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.055;
  sea.layers.set(1);
  // Render the soft ocean pattern at a lower resolution than the island models.
  const waterTarget = new T.WebGLRenderTarget(1, 1, { depthBuffer: false });
  const surface = new T.Mesh(new T.PlaneGeometry(4400, 4400), oceanSurfaceMaterial(waterTarget.texture));
  surface.rotation.copy(sea.rotation);
  surface.position.copy(sea.position);
  scene.add(sea, surface);

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const debug = new URLSearchParams(location.search).has('worksDebug');
  const abort = new AbortController();
  const decoder = new DRACOLoader().setDecoderPath('/works/draco/').setWorkerLimit(2);
  const loader = new GLTFLoader().setDRACOLoader(decoder);
  const islands = new Map<string, Island>();
  const picker = new T.Raycaster();
  const hits: T.Intersection[] = [];
  const pointer = new T.Vector2();
  const projected = new T.Vector3();
  const cameraTarget = new T.Vector3();
  const viewport = new T.Vector2();
  let loaded = 0;
  let presented = false;
  let dead = false;
  let lost = false;
  let hasFocus = document.hasFocus();
  let frame = 0;
  let lastDraw = 0;
  let time = 0;
  let frames = 0;
  let pixelRatio = 1;
  const intervals: number[] = [];
  let overviewScale = 1;
  let overviewX = 0;
  let overviewY = 0;
  let current = { x: 0, y: 0, scale: 1 };
  let exploration = { x: 0, y: 0, scale: 1 };
  let selected: Island | null = null;
  let panel: { side: 'bottom' | 'right'; size: number } | null = null;
  let hover: Project | null = null;
  let focused: Project | null = null;
  let mouse: { x: number; y: number } | null = null;
  let drag: { id: number; x: number; y: number; originX: number; originY: number; project: Project | null; moved: boolean } | null = null;

  function projectedBounds() {
    let left = -73, right = 73, top = 60, bottom = -49;
    for (const { bounds } of islands.values()) {
      for (const x of [bounds.min.x, bounds.max.x]) for (const z of [bounds.min.z, bounds.max.z]) {
        const across = x * RIGHT.x + z * RIGHT.z;
        const depth = (x * FORWARD.x + z * FORWARD.z) * -RISE;
        left = Math.min(left, across);
        right = Math.max(right, across);
        top = Math.max(top, depth + (bounds.max.y + 3) * VERTICAL);
        bottom = Math.min(bottom, depth);
      }
    }
    overviewX = (left + right) / 2;
    overviewY = (top + bottom) / 2;
    overviewScale = Math.min((viewport.x - 24) / (right - left), (viewport.y - 158) / (top - bottom));
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    const nextRatio = Math.min(devicePixelRatio || 1, bounds.width < 760 ? 1.25 : 1.5);
    if (viewport.x !== bounds.width || viewport.y !== bounds.height || pixelRatio !== nextRatio) {
      viewport.set(bounds.width, bounds.height);
      pixelRatio = nextRatio;
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(viewport.x, viewport.y, false);
      const buffer = renderer.getDrawingBufferSize(new T.Vector2());
      const waterScale = Math.min(.5, 640 / Math.max(buffer.x, buffer.y));
      waterTarget.setSize(Math.ceil(buffer.x * waterScale), Math.ceil(buffer.y * waterScale));
      surface.material.uniforms.uBufferSize.value.copy(buffer);
      projectedBounds();
      if (!frames) current = { x: overviewX, y: overviewY, scale: overviewScale };
    }
    request();
  }

  function target() {
    if (!selected) return {
      x: overviewX + exploration.x, y: overviewY + exploration.y,
      scale: overviewScale * exploration.scale,
    };
    const x = selected.center.dot(RIGHT);
    const y = selected.center.y * VERTICAL - selected.center.dot(FORWARD) * RISE;
    const wide = selected.project.island.width;
    // Reported panel size defines the visible area, like IslandPanel upstream.
    const freeWidth = viewport.x - (panel?.side === 'right' ? panel.size : 0);
    const freeHeight = viewport.y - (panel?.side === 'bottom' ? panel.size : 0);
    const islandHeight = selected.bounds.max.y * VERTICAL + wide * RISE;
    const scale = Math.min(freeWidth * 0.58 / wide, Math.max(78, freeHeight - 86) * 0.79 / islandHeight, 17);
    return {
      x: x + (viewport.x - freeWidth) / (2 * scale),
      y: y - (viewport.y - freeHeight + (panel?.side === 'bottom' ? -45 : 0)) / (2 * scale),
      scale,
    };
  }

  function setCamera() {
    const { x, y, scale } = current;
    cameraTarget.copy(RIGHT).multiplyScalar(x).addScaledVector(FORWARD, -y / RISE);
    // Keep the full water plane in front of the camera on tall portrait viewports.
    camera.position.copy(cameraTarget).addScaledVector(OFFSET, 6);
    camera.lookAt(cameraTarget);
    camera.left = -viewport.x / (2 * scale);
    camera.right = -camera.left;
    camera.top = viewport.y / (2 * scale);
    camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  function setHover(project: Project | null) {
    if (project === hover) return;
    hover = project;
    input.hover(project);
    canvas.style.cursor = project ? 'pointer' : 'grab';
  }

  function pick(x: number, y: number): Project | null {
    const bounds = canvas.getBoundingClientRect();
    pointer.set((x - bounds.left) / bounds.width * 2 - 1, 1 - (y - bounds.top) / bounds.height * 2);
    picker.setFromCamera(pointer, camera);
    let nearest: Project | null = null;
    let gap = Infinity;
    for (const island of islands.values()) {
      if (!picker.ray.intersectsBox(island.bounds)) continue;
      hits.length = 0;
      picker.intersectObject(island.model, true, hits);
      const hit = hits.find(item => item.point.y >= -0.15);
      if (hit && hit.distance < gap) {
        gap = hit.distance;
        nearest = island.project;
      }
    }
    return nearest;
  }

  function placeButton(island: Island) {
    const button = input.points.get(island.project.slug);
    if (!button) return;
    projected.copy(island.marker).project(camera);
    const x = (projected.x + 1) * viewport.x / 2;
    const y = (1 - projected.y) * viewport.y / 2;
    button.style.setProperty('--x', x + 'px');
    button.style.setProperty('--y', y + 'px');
    button.style.setProperty('--tip-x', T.MathUtils.clamp(x, 136, viewport.x - 136) - x + 'px');
    button.dataset.below = String(y < 134);
    button.dataset.outside = String(x < 15 || x > viewport.x - 15 || y < 68 || y > viewport.y - 46);
  }

  function request() {
    if (!frame && !dead && !lost && !document.hidden && viewport.x) frame = requestAnimationFrame(render);
  }

  function render(now: number) {
    frame = 0;
    const stepping = !motion.matches && hasFocus;
    const animateWater = stepping && !panel && loaded === projects.length;
    const period = viewport.x < 760 ? 1000 / 24 : 1000 / 30;
    const elapsed = lastDraw ? now - lastDraw : 0;
    if (stepping && elapsed > 0 && elapsed < period - 2) {
      request();
      return;
    }
    const delta = elapsed ? Math.min(elapsed / 1000, 0.2) : 1 / 30;
    const desired = target();
    const ease = stepping ? 1 - Math.exp(-6 * delta) : 1;
    let moving = false;
    for (const key of ['x', 'y', 'scale'] as const) {
      const gap = desired[key] - current[key];
      if (Math.abs(gap) < 0.008) current[key] = desired[key];
      else {
        current[key] += gap * ease;
        moving = ease < 1;
      }
    }
    setCamera();

    if (mouse && !drag && !panel && moving) setHover(pick(mouse.x, mouse.y));
    const active = selected?.project ?? focused ?? hover;
    if (animateWater) time += delta * 0.75;
    sea.material.uniforms.uTime.value = time;
    for (const island of islands.values()) {
      const aim = Number(island.project === active);
      // Upstream's easeHover with a snap at rest.
      const blend = island.hoverBlend + (aim - island.hoverBlend) * (stepping ? Math.min(1, 7 * delta) : 1);
      island.hoverBlend = Math.abs(aim - blend) < 0.012 ? aim : blend;
      moving ||= island.hoverBlend !== aim;
      for (const { material, base } of island.tints) {
        material.color.copy(base).multiplyScalar(1 + island.hoverBlend * 0.22);
      }
      if (island.shore) {
        island.shore.material.uniforms.uHighlight.value = island.hoverBlend;
        island.shore.material.uniforms.uTime.value = time;
      }
      placeButton(island);
    }
    camera.layers.set(1);
    renderer.setRenderTarget(waterTarget);
    renderer.render(scene, camera);
    const waterCalls = renderer.info.render.calls;
    const waterTriangles = renderer.info.render.triangles;
    renderer.setRenderTarget(null);
    camera.layers.set(0);
    renderer.render(scene, camera);
    if (!presented && loaded === projects.length) {
      presented = true;
      input.loaded(loaded);
    }
    frames++;
    if (debug) {
      if (elapsed > 0 && elapsed < 500) {
        intervals.push(elapsed);
        if (intervals.length > 90) intervals.shift();
      }
      canvas.dataset.sceneStats = JSON.stringify({
        frames, islands: islands.size, shorelines: [...islands.values()].filter(i => i.shore).length,
        calls: renderer.info.render.calls + waterCalls, triangles: renderer.info.render.triangles + waterTriangles,
        geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
        pixelRatio, waterSize: [waterTarget.width, waterTarget.height], target: current, frameIntervalsMs: intervals,
      });
    }
    lastDraw = moving || animateWater ? now : 0;
    if (moving || animateWater) request();
  }

  function start(event: PointerEvent) {
    if (panel || drag || !event.isPrimary || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY,
      originX: exploration.x, originY: exploration.y, project: pick(event.clientX, event.clientY), moved: false };
    canvas.setPointerCapture(event.pointerId);
  }

  function nudge(key: string) {
    if (panel || !loaded) return false;
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[key];
    if (!direction) return false;
    exploration.x = T.MathUtils.clamp(exploration.x + direction[0] * 8, -40, 40);
    exploration.y = T.MathUtils.clamp(exploration.y + direction[1] * 8, -38, 38);
    request();
    return true;
  }

  function move(event: PointerEvent) {
    if (panel) return;
    if (!drag) {
      if (event.pointerType === 'mouse') {
        mouse = { x: event.clientX, y: event.clientY };
        setHover(pick(mouse.x, mouse.y));
      }
      request();
      return;
    }
    if (event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 8) return;
    drag.moved = true;
    mouse = null;
    setHover(null);
    canvas.style.cursor = 'grabbing';
    exploration.x = T.MathUtils.clamp(drag.originX - dx / current.scale, -40, 40);
    exploration.y = T.MathUtils.clamp(drag.originY + dy / current.scale, -38, 38);
    request();
  }

  function cancel() {
    const id = drag?.id;
    drag = null;
    if (id !== undefined && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    canvas.style.cursor = hover ? 'pointer' : 'grab';
  }

  function finish(event: PointerEvent) {
    if (!drag || drag.id !== event.pointerId) return;
    const project = !drag.moved && drag.project && pick(event.clientX, event.clientY) === drag.project ? drag.project : null;
    cancel();
    if (project) input.select(project);
  }

  function leave() {
    mouse = null;
    setHover(null);
    request();
  }

  function zoom(event: WheelEvent) {
    if (panel || !loaded) return;
    event.preventDefault();
    exploration.scale = T.MathUtils.clamp(exploration.scale * Math.exp(-event.deltaY * 0.0011), 0.86, 2.5);
    request();
  }

  function pause() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastDraw = 0;
    cancel();
  }

  function visible() {
    if (document.hidden) pause();
    else request();
  }

  const listen = { signal: abort.signal };
  canvas.addEventListener('pointerdown', start, listen);
  canvas.addEventListener('pointermove', move, listen);
  canvas.addEventListener('pointerup', finish, listen);
  canvas.addEventListener('pointercancel', cancel, listen);
  canvas.addEventListener('lostpointercapture', cancel, listen);
  canvas.addEventListener('pointerleave', leave, listen);
  canvas.addEventListener('wheel', zoom, { ...listen, passive: false });
  window.addEventListener('resize', resize, listen);
  window.addEventListener('blur', () => { hasFocus = false; pause(); leave(); }, listen);
  window.addEventListener('focus', () => { hasFocus = true; request(); }, listen);
  document.addEventListener('visibilitychange', visible, listen);
  motion.addEventListener('change', request, listen);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    lost = true;
    pause();
    input.failed();
  }, listen);
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    if (presented) input.loaded(loaded);
    request();
  }, listen);

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  async function load(project: Project) {
    const slug = project.island.model;
    let model: T.Object3D;
    if (slug) {
      const response = await fetch('/works/islands/' + slug + '.glb', { signal: abort.signal });
      if (!response.ok) throw Error('Island model: ' + response.status);
      const data = await response.arrayBuffer();
      if (dead) return;
      model = (await loader.parseAsync(data, '')).scene;
      if (slug === 'prism') {
        const terrace = model.getObjectByName('Island_Creative');
        const glass = glassLandmark();
        glass.position.y = 2.81;
        (terrace ?? model).add(glass);
      }
    } else {
      const key = project.landmark as keyof typeof CRAFT;
      model = originalIsland(CRAFT[key]);
    }
    if (dead) {
      dispose(model);
      return;
    }
    const island = prepareIsland(project, model);
    islands.set(project.slug, island);
    scene.add(island.model);
    if (island.shore) scene.add(island.shore);
    projectedBounds();
    loaded++;
    if (loaded < projects.length && !lost) input.loaded(loaded);
    request();
  }
  Promise.allSettled(projects.map(load)).then(results => {
    decoder.dispose();
    if (!dead && results.some(result => result.status === 'rejected')) input.failed();
  });

  return {
    update(project: Project | null, preview: Project | null, sheet: typeof panel) {
      selected = project ? islands.get(project.slug) ?? null : null;
      focused = preview;
      panel = sheet;
      if (panel) leave();
      request();
    },
    overview() {
      exploration = { x: 0, y: 0, scale: 1 };
      request();
    },
    nudge,
    dispose() {
      dead = true;
      abort.abort();
      pause();
      observer.disconnect();
      dispose(scene);
      waterTarget.dispose();
      renderer.dispose();
      // Outstanding Draco reads release their workers when their promises settle.
    },
  };
}

export type AtlasScene = ReturnType<typeof mountAtlas>;
