import { Euler, MathUtils, Object3D, type Camera, type Scene } from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

export type Transform = {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  scale: [number, number, number];
};

export type TransformTarget = {
  id: string;
  label: string;
  parent?: Object3D;
  frameId?: string;
  read: () => Transform;
  preview: (draft: Transform | null) => void;
};

type Options = {
  scene: Scene;
  camera: Camera;
  viewport: HTMLElement;
  targets: readonly TransformTarget[];
  invalidate: () => void;
  allowPointer?: (event: PointerEvent) => boolean;
  onDragChange?: (dragging: boolean) => void;
  getContext?: () => unknown;
};

type Mode = 'translate' | 'rotate' | 'scale';
type Space = 'world' | 'local';
type Field = 'position' | 'rotation' | 'scale';
type Axis = 0 | 1 | 2;
type Entry = { target: TransformTarget; draft: Transform | null; undo: (Transform | null)[] };

export function readTransform(object: Object3D): Transform {
  return { position: object.position.toArray(), quaternion: object.quaternion.toArray(), scale: object.scale.toArray() };
}

export function applyTransform(object: Object3D, transform: Transform) {
  object.position.fromArray(transform.position);
  object.quaternion.fromArray(transform.quaternion);
  object.scale.fromArray(transform.scale);
  object.updateMatrix();
}

function sameTransform(a: Transform, b: Transform) {
  const dot = a.quaternion.reduce((sum, component, axis) => sum + component * b.quaternion[axis], 0);
  return Math.abs(1 - Math.abs(dot)) < 1e-12 &&
    a.position.every((value, axis) => Math.abs(value - b.position[axis]) < 1e-8) &&
    a.scale.every((value, axis) => Math.abs(value - b.scale[axis]) < 1e-8);
}

export function createTransformInspector(options: Options) {
  const { viewport, camera, scene, invalidate, targets } = options;
  const view = viewport.ownerDocument.defaultView ?? window;
  const entries = new Map<string, Entry>();
  for (const target of targets) {
    if (entries.has(target.id)) throw new Error(`Duplicate transform target: ${target.id}`);
    entries.set(target.id, { target, draft: null, undo: [] });
  }
  const listeners = new Set<() => void>();
  const controls = new TransformControls(camera);
  const helper = controls.getHelper();
  const proxy = new Object3D();
  const angles = new Euler();
  let selected: Entry | undefined;
  let enabled = true;
  let gizmo = true;
  let uniform = false;
  let drag: { pointer: number; start: Transform; before: Transform | null } | undefined;
  let suppressClick = false;
  scene.add(helper);
  controls.setSize(.72);

  function notify() {
    invalidate();
    for (const listener of listeners) listener();
  }

  function restoreProxy() {
    if (selected) applyTransform(proxy, selected.draft ?? selected.target.read());
  }

  function syncGizmo() {
    if (enabled && gizmo && selected) controls.attach(proxy);
    else controls.detach();
  }

  function updateDraft(entry: Entry, draft: Transform | null) {
    entry.draft = draft;
    entry.target.preview(draft);
  }

  function pushUndo(entry: Entry, before: Transform | null) {
    if (entry.undo.length === 50) entry.undo.shift();
    entry.undo.push(before);
  }

  function finishDrag(cancel: boolean) {
    if (!drag || !selected) return;
    const { pointer, start, before } = drag;
    drag = undefined;
    controls.pointerUp(null);
    if (viewport.hasPointerCapture(pointer)) viewport.releasePointerCapture(pointer);
    if (cancel || sameTransform(start, readTransform(proxy))) {
      updateDraft(selected, before);
      restoreProxy();
    } else {
      pushUndo(selected, before);
      const next = readTransform(proxy);
      if (sameTransform(next, selected.target.read())) updateDraft(selected, null);
    }
    options.onDragChange?.(false);
    notify();
  }

  function pointer(event: PointerEvent, button = event.button) {
    const bounds = viewport.getBoundingClientRect();
    // The addon consumes NDC x/y and button here. Its type declares a DOM event.
    return {
      x: 2 * (event.clientX - bounds.left) / bounds.width - 1,
      y: 1 - 2 * (event.clientY - bounds.top) / bounds.height,
      button,
    } as PointerEvent;
  }

  function canPick(event: PointerEvent) {
    return controls.object && event.pointerType !== 'touch' && (options.allowPointer?.(event) ?? true);
  }

  function updateMatrices() {
    camera.updateWorldMatrix(true, false);
    proxy.updateWorldMatrix(true, false);
    helper.updateMatrixWorld(true);
  }

  function claim(event: PointerEvent) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function down(event: PointerEvent) {
    suppressClick = false;
    if (!selected || drag || event.button !== 0 || !canPick(event)) return;
    updateMatrices();
    const input = pointer(event);
    controls.pointerHover(input);
    controls.pointerDown(input);
    if (!controls.dragging) return;
    drag = { pointer: event.pointerId, start: readTransform(proxy), before: selected.draft };
    viewport.setPointerCapture(event.pointerId);
    options.onDragChange?.(true);
    claim(event);
    notify();
  }

  function moveDrag(event: PointerEvent) {
    if (event.pointerId !== drag?.pointer) return;
    if (!(event.buttons & 1)) {
      finishDrag(true);
      return;
    }
    claim(event);
    updateMatrices();
    controls.pointerMove(pointer(event, -1));
  }

  function hover(event: PointerEvent) {
    if (!controls.object) return;
    const axis = controls.axis;
    if (canPick(event) && !event.buttons) {
      updateMatrices();
      controls.pointerHover(pointer(event));
    } else {
      controls.axis = null;
    }
    if (axis !== controls.axis) invalidate();
  }

  function up(event: PointerEvent) {
    if (drag?.pointer !== event.pointerId || event.button !== 0) return;
    claim(event);
    suppressClick = true;
    finishDrag(false);
  }

  function cancel(event: PointerEvent) {
    if (drag?.pointer === event.pointerId) finishDrag(true);
  }

  function lostCapture(event: PointerEvent) {
    // Window listeners can still complete an active gesture after capture is transferred.
    if (!(event.buttons & 1)) cancel(event);
  }

  function leave() {
    if (drag || !controls.axis) return;
    controls.axis = null;
    invalidate();
  }

  function click(event: MouseEvent) {
    if (!suppressClick || event.detail === 0) return;
    suppressClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function updateDrag() {
    if (!drag || !selected) return;
    if (controls.mode === 'scale') {
      const start = drag.start.scale;
      if (uniform) {
        const axis = controls.axis?.includes('X') ? 'x' : controls.axis?.includes('Y') ? 'y' : 'z';
        const index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
        const ratio = Math.max(.0001, proxy.scale[axis] / start[index]);
        proxy.scale.set(...start).multiplyScalar(ratio);
      } else {
        for (const [index, axis] of (['x', 'y', 'z'] as const).entries()) {
          if (proxy.scale[axis] * start[index] <= 0) proxy.scale[axis] = start[index] * .0001;
        }
      }
    }
    const next = readTransform(proxy);
    if (![...next.position, ...next.quaternion, ...next.scale].every(Number.isFinite)) {
      restoreProxy();
      return;
    }
    updateDraft(selected, next);
    notify();
  }

  const events = new AbortController();
  const listenerOptions = { capture: true, signal: events.signal };
  viewport.addEventListener('pointerdown', down, listenerOptions);
  viewport.addEventListener('pointermove', hover, listenerOptions);
  viewport.addEventListener('lostpointercapture', lostCapture, listenerOptions);
  viewport.addEventListener('pointerleave', leave, { signal: events.signal });
  viewport.addEventListener('click', click, listenerOptions);
  view.addEventListener('pointermove', moveDrag, listenerOptions);
  view.addEventListener('pointerup', up, listenerOptions);
  view.addEventListener('pointercancel', cancel, listenerOptions);
  view.addEventListener('blur', () => finishDrag(true), { signal: events.signal });
  controls.addEventListener('objectChange', updateDrag);

  return {
    targets,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getState() {
      if (selected) angles.setFromQuaternion(proxy.quaternion, 'XYZ');
      return {
        id: selected?.target.id ?? '', mode: controls.mode, space: controls.space, gizmo, uniform,
        dragging: !!drag, canUndo: !!selected?.undo.length, canReset: !!selected?.draft,
        changed: [...entries.values()].some(entry => entry.draft),
        transform: selected ? readTransform(proxy) : null,
        rotation: selected ? [angles.x, angles.y, angles.z].map(MathUtils.radToDeg) : null,
      };
    },
    select(id: string) {
      finishDrag(true);
      selected = entries.get(id);
      proxy.removeFromParent();
      if (selected) {
        (selected.target.parent ?? scene).add(proxy);
        restoreProxy();
      }
      syncGizmo();
      notify();
    },
    setEnabled(next: boolean) {
      if (!next) finishDrag(true);
      enabled = next;
      syncGizmo();
      notify();
    },
    refresh() {
      if (!drag) restoreProxy();
      notify();
    },
    setMode(mode: Mode) { if (!drag) { controls.setMode(mode); notify(); } },
    setSpace(space: Space) { if (!drag) { controls.setSpace(space); notify(); } },
    setUniform(next: boolean) { if (!drag) { uniform = next; notify(); } },
    setGizmo(next: boolean) { if (!drag) { gizmo = next; syncGizmo(); notify(); } },
    setAxis(field: Field, axis: Axis, value: number) {
      if (!selected || drag || !Number.isFinite(value)) return false;
      const before = readTransform(proxy);
      const key = (['x', 'y', 'z'] as const)[axis];
      if (field === 'rotation') {
        angles.setFromQuaternion(proxy.quaternion, 'XYZ');
        angles[key] = MathUtils.degToRad(value);
        proxy.quaternion.setFromEuler(angles);
      } else if (field === 'scale') {
        if (Math.abs(value) < 1e-8 || (uniform && value / before.scale[axis] <= 0)) return false;
        if (uniform) proxy.scale.multiplyScalar(value / before.scale[axis]);
        else proxy.scale[key] = value;
      } else {
        proxy.position[key] = value;
      }
      const next = readTransform(proxy);
      if (![...next.position, ...next.quaternion, ...next.scale].every(Number.isFinite)) {
        applyTransform(proxy, before);
        return false;
      }
      if (sameTransform(before, next)) return true;
      pushUndo(selected, selected.draft);
      updateDraft(selected, sameTransform(next, selected.target.read()) ? null : next);
      notify();
      return true;
    },
    undo() {
      if (!selected || drag || !selected.undo.length) return;
      updateDraft(selected, selected.undo.pop() ?? null);
      restoreProxy();
      notify();
    },
    reset() {
      if (!selected?.draft || drag) return;
      pushUndo(selected, selected.draft);
      updateDraft(selected, null);
      restoreProxy();
      notify();
    },
    exportJSON() {
      return JSON.stringify({
        version: 1,
        coordinateSpace: 'parent-local',
        rotationFormat: 'quaternion-xyzw',
        objects: [...entries.values()].flatMap(({ draft, target }) =>
          draft ? [{ id: target.id, label: target.label, frameId: target.frameId, ...draft }] : []),
        context: options.getContext?.(),
      }, null, 2);
    },
    dispose() {
      finishDrag(true);
      events.abort();
      controls.removeEventListener('objectChange', updateDrag);
      controls.detach();
      helper.removeFromParent();
      helper.dispose(); // No DOM element is connected to the addon.
      proxy.removeFromParent();
      listeners.clear();
      for (const { target, draft } of entries.values()) if (draft) target.preview(null);
      invalidate();
    },
  };
}

export type TransformInspector = ReturnType<typeof createTransformInspector>;
