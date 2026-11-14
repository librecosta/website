/*
 * Isometria camera and drag-to-rotate behavior adapted under MIT
 * (Copyright 2026 bswxyz). See public/works/isometria-license.txt.
 */
import * as THREE from 'three';
import type { Project } from './projects';
import { addDaylight, disposeIsland, halfGrid, makeCamera, makeIsland, makeRenderer } from './isometria-world';

const HOME = 0.6;
const TURN = 0.14;
const DRAG_THRESHOLD = 7;

export function mountAtlas(
  canvas: HTMLCanvasElement,
  map: HTMLElement,
  projects: readonly Project[],
  buttons: ReadonlyMap<string, HTMLButtonElement>,
  setAvailable: (available: boolean) => void,
) {
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = makeCamera();
  const sun = addDaylight(scene);
  const { world, markers } = makeIsland(projects);
  scene.add(world);

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const debug = new URLSearchParams(location.search).has('worksDebug');
  const rotateAxis = new THREE.Vector3(0, 1, 0);
  const projected = new THREE.Vector3();
  let width = 0;
  let height = 0;
  let frame = 0;
  let frames = 0;
  let lastTime = 0;
  const intervals: number[] = [];
  let target = HOME;
  let angle = HOME;
  let highlighted: string | null = null;
  let available = true;
  let invalid = true;
  let locked = false;
  let suppressClick = false;
  let pointer: { id: number; x: number; y: number; angle: number; dragging: boolean } | null = null;

  // Fit the original camera at the ends of the permitted rotation, with room
  // for the 44 px buttons. The 13-tile board and the raised landmarks both fit.
  const bounds = new THREE.Box3().setFromObject(world);
  let horizontal = 0;
  let top = -Infinity;
  let bottom = Infinity;
  for (const rotation of [HOME - TURN, HOME, HOME + TURN]) {
    const edge = halfGrid + 0.5;
    for (const x of [-edge, edge]) for (const z of [-edge, edge]) {
      for (const y of [0, 0.6]) {
        projected.set(x, y, z).applyAxisAngle(rotateAxis, rotation).project(camera);
        horizontal = Math.max(horizontal, Math.abs(projected.x));
        top = Math.max(top, projected.y);
        bottom = Math.min(bottom, projected.y);
      }
    }
    for (const marker of markers) {
      const { x, y, z } = marker.group.position;
      projected.set(x, y + 1.05, z).applyAxisAngle(rotateAxis, rotation).project(camera);
      top = Math.max(top, projected.y);
    }
  }
  // Keep the high ground and trees inside the same fit.
  projected.set(0, bounds.max.y, 0).project(camera);
  top = Math.max(top, projected.y);
  const centerY = (top + bottom) / 2;

  function schedule() {
    if (!frame && available && !document.hidden && width && height) frame = requestAnimationFrame(draw);
  }

  function draw(now: number) {
    frame = 0;
    if (!available || document.hidden) return;
    const elapsed = lastTime ? now - lastTime : 0;
    const easing = motion.matches ? 1 : 1 - Math.pow(0.82, Math.max(16, Math.min(elapsed, 42)) / 16);
    angle += (target - angle) * easing;
    if (Math.abs(target - angle) < 0.0008) angle = target;
    world.rotation.y = angle;
    let moving = angle !== target;

    for (const { slug, group, height, color } of markers) {
      const active = slug === highlighted;
      const lift = active && !motion.matches ? 0.14 : 0;
      const difference = height + lift - group.position.y;
      group.position.y += Math.abs(difference) < 0.002 ? difference : difference * easing;
      moving ||= Math.abs(difference) >= 0.002 && !motion.matches;
      color.emissive.setHex(active ? 0x303525 : 0x000000);
    }

    world.updateMatrixWorld();
    for (const { slug, group } of markers) {
      const button = buttons.get(slug);
      if (!button) continue;
      projected.set(0, 0.78, 0);
      group.localToWorld(projected).project(camera);
      const x = (projected.x * 0.5 + 0.5) * width;
      button.style.setProperty('--x', `${x}px`);
      button.style.setProperty('--y', `${(0.5 - projected.y * 0.5) * height}px`);
      button.style.setProperty('--tooltip-offset', `${THREE.MathUtils.clamp(x, 84, width - 84) - x}px`);
    }
    renderer.render(scene, camera);

    if (debug) {
      if (elapsed > 0) {
        intervals.push(elapsed);
        if (intervals.length > 120) intervals.shift();
      }
      const { calls, triangles } = renderer.info.render;
      const { geometries, textures } = renderer.info.memory;
      const shadowTarget = sun.shadow.map;
      canvas.dataset.sceneStats = JSON.stringify({
        calls, triangles, geometries, textures, frames: ++frames, angle,
        pixelRatio: renderer.getPixelRatio(),
        shadowSize: shadowTarget?.width ?? 0,
        frameIntervalsMs: intervals,
      });
    }
    if (moving) {
      lastTime = now;
      schedule();
    } else {
      lastTime = 0;
    }
  }

  function resize() {
    const box = map.getBoundingClientRect();
    const nextWidth = Math.floor(box.width);
    const nextHeight = Math.floor(box.height);
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    if (!nextWidth || !nextHeight) return;
    if (!invalid && nextWidth === width && nextHeight === height && ratio === renderer.getPixelRatio()) return;
    invalid = false;
    width = nextWidth;
    height = nextHeight;
    const scale = Math.min((width - 8) / (2 * horizontal), (height - 28) / (top - bottom), 86);
    const vertical = height / (2 * scale);
    Object.assign(camera, {
      left: -width / (2 * scale), right: width / (2 * scale),
      top: centerY + vertical, bottom: centerY - vertical,
    });
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    schedule();
  }

  function start(event: PointerEvent) {
    if (pointer || locked || !available || !event.isPrimary || event.button !== 0) return;
    suppressClick = false;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, angle: target, dragging: false };
  }

  function move(event: PointerEvent) {
    if (!pointer || event.pointerId !== pointer.id) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (!pointer.dragging && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
    suppressClick = true;
    if (!pointer.dragging) {
      if (Math.abs(dy) > Math.abs(dx)) {
        pointer = null;
        return;
      }
      pointer.dragging = true;
      map.setPointerCapture(event.pointerId);
      map.dataset.dragging = 'true';
    }
    target = THREE.MathUtils.clamp(pointer.angle + dx * 0.003, HOME - TURN, HOME + TURN);
    schedule();
  }

  function finish(event?: PointerEvent) {
    if (!pointer || (event && event.pointerId !== pointer.id)) return;
    const id = pointer.id;
    pointer = null;
    delete map.dataset.dragging;
    if (map.hasPointerCapture(id)) map.releasePointerCapture(id);
  }

  function lostCapture(event: PointerEvent) {
    // A touch begins with implicit capture on its button. Transferring it to
    // the map fires a bubbling loss on that button before the drag continues.
    if (event.target === map) finish(event);
  }

  function guardClick(event: MouseEvent) {
    if (!suppressClick || event.detail === 0) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClick = false;
  }

  function pause() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    finish();
  }

  function visibility() {
    if (document.hidden) {
      pause();
    } else {
      resize();
      schedule();
    }
  }

  function contextLost(event: Event) {
    event.preventDefault();
    available = false;
    pause();
    setAvailable(false);
  }

  function contextRestored() {
    available = true;
    invalid = true;
    resize();
    setAvailable(true);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(map);
  map.addEventListener('pointerdown', start);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', finish);
  window.addEventListener('pointercancel', finish);
  map.addEventListener('lostpointercapture', lostCapture);
  map.addEventListener('click', guardClick, true);
  window.addEventListener('blur', pause);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', visibility);
  motion.addEventListener('change', schedule);
  canvas.addEventListener('webglcontextlost', contextLost);
  canvas.addEventListener('webglcontextrestored', contextRestored);
  resize();

  return {
    update(active: string | null, panelOpen: boolean) {
      highlighted = active;
      if (panelOpen) {
        finish();
        target = angle;
      }
      locked = panelOpen;
      schedule();
    },
    dispose() {
      available = false;
      pause();
      observer.disconnect();
      map.removeEventListener('pointerdown', start);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      map.removeEventListener('lostpointercapture', lostCapture);
      map.removeEventListener('click', guardClick, true);
      window.removeEventListener('blur', pause);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
      motion.removeEventListener('change', schedule);
      canvas.removeEventListener('webglcontextlost', contextLost);
      canvas.removeEventListener('webglcontextrestored', contextRestored);
      disposeIsland(world);
      sun.shadow.dispose();
      renderer.dispose();
    },
  };
}

export type AtlasScene = ReturnType<typeof mountAtlas>;
