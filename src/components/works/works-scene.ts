/*
 * Adapts Wenz Louie Rejas's cameraFraming, islandModel and interactionManager
 * (MIT, 0319381). See public/works/wenz-license.txt.
 */
import * as T from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Project } from './projects';
import { glassLandmark, originalIsland } from './island-craft';

const OFFSET = new T.Vector3(200, 120, 200);
const RIGHT = new T.Vector3(1, 0, -1).normalize();
const FORWARD = new T.Vector3(1, 0, 1).normalize();
const RISE = OFFSET.y / OFFSET.length();
const VERTICAL = 200 * Math.SQRT2 / OFFSET.length();
const CRAFT = { collector: 'fields', gates: 'gates', archive: 'archive' } as const;
const cameraAxes = ['x', 'y', 'scale'] as const;

type Island = {
  project: Project;
  model: T.Object3D;
  bounds: T.Box3;
  marker: T.Vector3;
  center: T.Vector3;
  tints: { material: T.MeshStandardMaterial; base: T.Color }[];
  displayTint: number;
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
  // Preserve the models' original height and their lower terrain geometry.
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
  return { project, model: carrier, bounds, center, marker, tints, displayTint: 1 };
}

export function mountAtlas(canvas: HTMLCanvasElement, projects: readonly Project[], input: Input) {
  const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 900);
  const hemisphere = new T.HemisphereLight('#f0f2dd', '#7b9185', 2.1);
  const sun = new T.DirectionalLight('#fff1cb', 2.05);
  sun.position.set(-70, 120, 48);
  scene.add(hemisphere, sun);

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
  let loadFailed = false;
  let hasFocus = document.hasFocus();
  let frame = 0;
  let lastDraw = 0;
  let frames = 0;
  let pixelRatio = 1;
  let dirty = true;
  let pointerChanged = false;
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
  let drag: { id: number; x: number; y: number; originX: number; originY: number } | null = null;
  let pointerMoved = false;
  const touches = new Map<number, { x: number; y: number }>();
  let pinch: { distance: number; scale: number; x: number; y: number; centerX: number; centerY: number } | null = null;

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
      projectedBounds();
      if (!frames) current = { x: overviewX, y: overviewY, scale: overviewScale };
      dirty = true;
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
    const islandHeight = (selected.bounds.max.y - selected.bounds.min.y) * VERTICAL + wide * RISE;
    const scale = Math.min(freeWidth * 0.63 / wide, Math.max(72, freeHeight - 82) * 0.82 / islandHeight, 18);
    return {
      x: x + (viewport.x - freeWidth) / (2 * scale),
      y: y - (viewport.y - freeHeight + (panel?.side === 'bottom' ? -45 : 0)) / (2 * scale),
      scale,
    };
  }

  function setCamera() {
    const { x, y, scale } = current;
    cameraTarget.copy(RIGHT).multiplyScalar(x).addScaledVector(FORWARD, -y / RISE);
    camera.position.copy(cameraTarget).add(OFFSET);
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
      const hit = hits[0];
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
    button.dataset.outside = String(x < 15 || x > viewport.x - 15 || y < 68 || y > viewport.y - 46);
  }

  function request() {
    if (!frame && !dead && !lost && !document.hidden && viewport.x) frame = requestAnimationFrame(render);
  }

  function render(now: number) {
    frame = 0;
    const stepping = !motion.matches && hasFocus && presented;
    const period = viewport.x < 760 ? 1000 / 24 : 1000 / 30;
    const elapsed = lastDraw ? now - lastDraw : 0;
    if (stepping && elapsed > 0 && elapsed < period - 2) {
      request();
      return;
    }
    const delta = elapsed ? Math.min(elapsed / 1000, 0.2) : 1 / 30;
    const desired = target();
    const ease = stepping ? 1 - Math.exp(-12 * delta) : 1;
    let cameraChanged = false;
    let moving = false;
    for (const key of cameraAxes) {
      const gap = desired[key] - current[key];
      if (!gap) continue;
      cameraChanged = true;
      const snap = key === 'scale' ? 0.015 : 0.08;
      current[key] = Math.abs(gap) < snap ? desired[key] : current[key] + gap * ease;
      moving ||= current[key] !== desired[key];
    }
    if (cameraChanged || dirty) setCamera();

    if (mouse && !drag && !panel && (pointerChanged || cameraChanged)) setHover(pick(mouse.x, mouse.y));
    pointerChanged = false;
    const active = selected?.project ?? focused ?? hover;
    let highlightChanged = false;
    for (const island of islands.values()) {
      const aim = selected ? (island === selected ? 1.1 : .57) : (island.project === active ? 1.16 : 1);
      if (cameraChanged || dirty) placeButton(island);
      if (aim === island.displayTint) continue;
      // Upstream's easeHover with a snap at rest.
      const blend = island.displayTint + (aim - island.displayTint) * (stepping ? Math.min(1, 15 * delta) : 1);
      island.displayTint = Math.abs(aim - blend) < 0.012 ? aim : blend;
      moving ||= island.displayTint !== aim;
      highlightChanged = true;
      for (const { material, base } of island.tints) {
        material.color.copy(base).multiplyScalar(island.displayTint);
      }
    }
    if (!dirty && !cameraChanged && !highlightChanged) return;
    dirty = false;
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
        frames, islands: islands.size, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
        pixelRatio, target: current, frameIntervalsMs: intervals,
      });
    }
    lastDraw = moving ? now : 0;
    if (moving) request();
  }

  function markerAt(element: Element | null) {
    const button = element?.closest<HTMLButtonElement>('button[data-project]:enabled');
    return button ? islands.get(button.dataset.project ?? '')?.project : undefined;
  }

  function start(event: PointerEvent) {
    if (panel || event.button !== 0) return;
    const marker = markerAt(event.target instanceof Element ? event.target : null);
    if (event.target !== canvas && !marker) return;
    pointerMoved = false;
    if (event.pointerType === 'touch') {
      if (touches.size >= 2) return;
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touches.size === 2) {
        const [a, b] = touches.values();
        pinch = { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), scale: current.scale / overviewScale,
          x: current.x, y: current.y, centerX: (a.x + b.x - viewport.x) / 2, centerY: (viewport.y - a.y - b.y) / 2 };
        drag = null;
        pointerMoved = true;
        canvas.setPointerCapture(event.pointerId);
        return;
      }
    }
    if (drag || !event.isPrimary) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY,
      originX: exploration.x, originY: exploration.y };
    canvas.setPointerCapture(event.pointerId);
  }

  function nudge(key: string) {
    if (panel || !loaded) return false;
    if (key === '+' || key === '=' || key === '-') {
      adjustZoom(key === '-' ? 0.87 : 1.15);
      return true;
    }
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[key];
    if (!direction) return false;
    exploration.x = T.MathUtils.clamp(exploration.x + direction[0] * 8, -40, 40);
    exploration.y = T.MathUtils.clamp(exploration.y + direction[1] * 8, -38, 38);
    request();
    return true;
  }

  function move(event: PointerEvent) {
    if (panel) return;
    if (touches.has(event.pointerId)) {
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinch && touches.size === 2) {
        const [a, b] = touches.values();
        exploration.scale = T.MathUtils.clamp(pinch.scale * Math.hypot(a.x - b.x, a.y - b.y) / pinch.distance, .86, 2.5);
        const scale = exploration.scale * overviewScale;
        const x = pinch.x + pinch.centerX / (pinch.scale * overviewScale) - (a.x + b.x - viewport.x) / (2 * scale);
        const y = pinch.y + pinch.centerY / (pinch.scale * overviewScale) - (viewport.y - a.y - b.y) / (2 * scale);
        exploration.x = T.MathUtils.clamp(x - overviewX, -40, 40);
        exploration.y = T.MathUtils.clamp(y - overviewY, -38, 38);
        request();
        return;
      }
    }
    if (!drag) {
      if (event.pointerType === 'mouse' && event.target === canvas) {
        mouse = { x: event.clientX, y: event.clientY };
        pointerChanged = true;
        request();
      }
      return;
    }
    if (event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!pointerMoved && Math.hypot(dx, dy) < 8) return;
    pointerMoved = true;
    mouse = null;
    setHover(null);
    canvas.style.cursor = 'grabbing';
    exploration.x = T.MathUtils.clamp(drag.originX - dx / current.scale, -40, 40);
    exploration.y = T.MathUtils.clamp(drag.originY + dy / current.scale, -38, 38);
    request();
  }

  function cancel() {
    const ids = [...touches.keys()];
    if (drag && !ids.includes(drag.id)) ids.push(drag.id);
    drag = null;
    pinch = null;
    touches.clear();
    for (const id of ids) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    canvas.style.cursor = hover ? 'pointer' : 'grab';
  }

  function finish(event: PointerEvent) {
    if (pinch && touches.has(event.pointerId)) {
      touches.delete(event.pointerId);
      if (!touches.size) cancel();
      return;
    }
    if (!drag || drag.id !== event.pointerId) return;
    cancel();
  }

  function click(event: MouseEvent) {
    if (!event.detail || pointerMoved || panel || !(event.target instanceof Element)) return;
    const marker = markerAt(event.target);
    if (!marker && event.target !== canvas) return;
    const { clientX: x, clientY: y } = event;
    const project = marker ?? markerAt(document.elementFromPoint(x, y)) ?? pick(x, y);
    if (!project) return;
    event.preventDefault();
    input.select(project);
  }

  function leave() {
    mouse = null;
    if (!hover) return;
    setHover(null);
    request();
  }

  function zoom(event: WheelEvent) {
    if (panel || !loaded) return;
    event.preventDefault();
    adjustZoom(Math.exp(-event.deltaY * 0.0011));
  }

  function adjustZoom(factor: number) {
    if (panel || !presented) return;
    exploration.scale = T.MathUtils.clamp(exploration.scale * factor, .86, 2.5);
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

  function unmount() {
    if (dead) return;
    dead = true;
    abort.abort();
    pause();
    observer.disconnect();
    dispose(scene);
    renderer.dispose();
    renderer.forceContextLoss();
    // Outstanding Draco reads release their workers when their promises settle.
  }

  const listen = { signal: abort.signal };
  const stage = canvas.parentElement;
  stage?.addEventListener('pointerdown', start, listen);
  stage?.addEventListener('pointermove', move, listen);
  stage?.addEventListener('pointerup', finish, listen);
  stage?.addEventListener('pointercancel', cancel, listen);
  stage?.addEventListener('click', click, { ...listen, capture: true });
  canvas.addEventListener('lostpointercapture', event => {
    if (event.pointerId === drag?.id || touches.has(event.pointerId)) cancel();
  }, listen);
  canvas.addEventListener('pointerleave', leave, listen);
  canvas.addEventListener('wheel', zoom, { ...listen, passive: false });
  window.addEventListener('resize', resize, listen);
  window.addEventListener('blur', () => { hasFocus = false; pause(); mouse = null; setHover(null); }, listen);
  window.addEventListener('focus', () => { hasFocus = true; request(); }, listen);
  window.addEventListener('pagehide', event => { if (!event.persisted) unmount(); }, listen);
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
    dirty = true;
    if (!loadFailed) input.loaded(presented ? loaded : Math.min(loaded, projects.length - 1));
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
    projectedBounds();
    dirty = true;
    loaded++;
    if (loaded < projects.length && !lost) input.loaded(loaded);
    request();
  }
  Promise.allSettled(projects.map(load)).then(results => {
    decoder.dispose();
    loadFailed = results.some(result => result.status === 'rejected');
    if (!dead && loadFailed) input.failed();
  });

  return {
    update(project: Project | null, preview: Project | null, sheet: typeof panel) {
      selected = project ? islands.get(project.slug) ?? null : null;
      focused = preview;
      panel = sheet;
      if (panel) { cancel(); leave(); }
      request();
    },
    overview() {
      exploration = { x: 0, y: 0, scale: 1 };
      request();
    },
    nudge,
    adjustZoom,
    dispose: unmount,
  };
}

export type AtlasScene = ReturnType<typeof mountAtlas>;
