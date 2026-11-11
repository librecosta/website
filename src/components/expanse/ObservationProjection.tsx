import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { Box3, BufferAttribute, BufferGeometry, DynamicDrawUsage, InstancedMesh, Line, LineBasicMaterial, Matrix4,
  Mesh, Ray, Raycaster, Vector3, type Group, type Intersection, type Object3D } from 'three';
import { observationIds, type ObservationId } from './narrative';

type SignalCard = { id: ObservationId; node: HTMLElement; close: HTMLButtonElement; width: number; height: number; focus: boolean };

export type ObservationElements = {
  buttons: Partial<Record<ObservationId, HTMLButtonElement | null>>;
  readouts: Partial<Record<ObservationId, HTMLSpanElement | null>>;
  card: SignalCard | null;
  cardReadout?: HTMLSpanElement | null;
};

const axes = ['x', 'y', 'z'] as const;

function terrainOccludes(ray: Ray, distance: number, bounds: Box3, ground: (x: number, z: number) => number,
  step: number, sample: Vector3) {
  let first = 0, last = distance;
  for (const axis of axes) {
    const origin = ray.origin[axis], direction = ray.direction[axis];
    if (Math.abs(direction) < 1e-9) {
      if (origin < bounds.min[axis] || origin > bounds.max[axis]) return false;
      continue;
    }
    const a = (bounds.min[axis] - origin) / direction, b = (bounds.max[axis] - origin) / direction;
    first = Math.max(first, Math.min(a, b));
    last = Math.min(last, Math.max(a, b));
    if (first > last) return false;
  }
  const count = Math.max(1, Math.ceil((last - first) / step));
  for (let i = 0; i <= count; i++) {
    ray.at(first + (last - first) * i / count, sample);
    if (sample.y < ground(sample.x, sample.z)) return true;
  }
  return false;
}

export function ObservationProjection({ anchors, elements, opaque, terrain, ground, mobile, reduced }: {
  anchors: Partial<Record<ObservationId, Object3D | null>>;
  elements: RefObject<ObservationElements>;
  opaque: RefObject<Group | null>;
  terrain: Box3;
  ground: (x: number, z: number) => number;
  mobile: boolean;
  reduced: boolean;
}) {
  const lastTrace = useRef(-Infinity);
  const lastView = useRef({ terrain, width: 0, height: 0 });
  const blocked = useRef<Partial<Record<ObservationId, { anchor: Object3D; by: 'terrain' | 'structure' | '' }>>>({});
  const scratch = useMemo(() => ({
    world: new Vector3(), eye: new Vector3(), view: new Vector3(), endpoint: new Vector3(), localEnd: new Vector3(),
    selected: new Vector3(), center: new Vector3(), bend: new Vector3(), port: new Vector3(), head: new Vector3(),
    localRay: new Ray(), inverse: new Matrix4(), caster: new Raycaster(), hits: [] as Intersection[],
    meshes: [] as Mesh[],
  }), []);
  const leader = useMemo(() => {
    const points = new BufferAttribute(new Float32Array(9), 3).setUsage(DynamicDrawUsage);
    const geometry = new BufferGeometry().setAttribute('position', points);
    const material = new LineBasicMaterial({ color: '#d6efdb', opacity: .82, transparent: true,
      depthWrite: false, toneMapped: false, fog: false });
    const line = new Line(geometry, material);
    line.frustumCulled = false;
    line.visible = false;
    return { line, geometry, material, points };
  }, []);
  useEffect(() => () => { leader.geometry.dispose(); leader.material.dispose(); }, [leader]);
  const placement = useRef({ card: null as SignalCard | null, width: 0, height: 0, cardWidth: 0, cardHeight: 0,
    side: 1, offset: new Vector3(), began: 0, blocked: '' });

  useFrame(({ camera, size }) => {
    const { world, eye, view, endpoint, localEnd, caster, localRay, inverse, hits, meshes,
      selected, center, bend, port, head } = scratch;
    const now = performance.now();
    // Update projected coordinates on every existing frame. Bound CPU occlusion work
    // independently of the frame rate and reject city batches before tracing instances.
    const previous = lastView.current;
    const trace = now - lastTrace.current >= 80 || previous.terrain !== terrain ||
      previous.width !== size.width || previous.height !== size.height;
    if (trace) {
      lastTrace.current = now;
      previous.terrain = terrain;
      previous.width = size.width;
      previous.height = size.height;
      meshes.length = 0;
      opaque.current?.updateWorldMatrix(true, true);
      opaque.current?.traverseVisible(object => {
        if (!(object instanceof Mesh)) return;
        if (object instanceof InstancedMesh && !object.boundingBox) return; // Moving traffic batches.
        meshes.push(object);
      });
    }
    camera.updateMatrixWorld();
    eye.setFromMatrixPosition(camera.matrixWorld);
    const { card, cardReadout } = elements.current;
    let cardState = card ? 'outside' : 'closed';
    let selectedX = 0, selectedY = 0;
    function occlusion(target: Vector3, margin: number) {
      caster.ray.origin.copy(eye);
      caster.ray.direction.subVectors(target, eye);
      const distance = caster.ray.direction.length();
      caster.ray.direction.divideScalar(distance);
      caster.far = distance - margin;
      if (terrainOccludes(caster.ray, caster.far, terrain, ground, mobile ? 11 : 6, view)) return 'terrain';
      caster.ray.at(caster.far, endpoint);
      for (const mesh of meshes) {
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        const bounds = mesh instanceof InstancedMesh ? mesh.boundingBox! : mesh.geometry.boundingBox!;
        localRay.copy(caster.ray).applyMatrix4(inverse.copy(mesh.matrixWorld).invert());
        const entry = localRay.intersectBox(bounds, view);
        if (!entry) continue;
        if (!bounds.containsPoint(localRay.origin) && entry.distanceToSquared(localRay.origin) >
          localEnd.copy(endpoint).applyMatrix4(inverse).distanceToSquared(localRay.origin)) continue;
        hits.length = 0;
        caster.intersectObject(mesh, false, hits);
        if (hits.length) return 'structure';
      }
      return '';
    }
    for (const id of observationIds) {
      const anchor = anchors[id];
      const button = elements.current.buttons[id];
      const readout = elements.current.readouts[id];
      if (!button) continue;
      let state = 'unmounted';
      if (anchor) {
        anchor.getWorldPosition(world);
        view.copy(world).applyMatrix4(camera.matrixWorldInverse);
        if (view.z >= 0) state = 'behind';
        else {
          view.applyMatrix4(camera.projectionMatrix);
          const x = (view.x + 1) * size.width / 2;
          const y = (1 - view.y) * size.height / 2;
          if (view.z < -1 || view.z > 1 || x < 22 || y < 22 || x > size.width - 22 || y > size.height - 22) {
            state = 'outside';
          } else {
            if (trace || blocked.current[id]?.anchor !== anchor) {
              blocked.current[id] = { anchor, by: occlusion(world, 1) };
            }
            state = blocked.current[id]?.by || 'visible';
            if (state === 'visible') {
              button.style.transform = `translate3d(${x}px, ${y}px, 0)`;
              button.toggleAttribute('data-label-inward', x > size.width - 140);
              if (card?.id === id) { selected.copy(world); selectedX = x; selectedY = y; }
            }
          }
        }
      }
      if (state === 'behind' || state === 'outside' || state === 'unmounted') delete blocked.current[id];
      if (button.dataset.state !== state) {
        button.dataset.state = state;
        button.tabIndex = state === 'visible' ? 0 : -1;
      }
      if (readout && trace) {
        readout.textContent = anchor ? `${state} · ${world.toArray().map(Math.round).join(' / ')}` : state;
      }
      if (card?.id === id) cardState = state;
    }
    leader.line.visible = false;
    if (!card) placement.current.card = null;
    if (card && cardState === 'visible') {
      const fit = placement.current;
      const opening = fit.card !== card;
      const changed = opening || fit.width !== size.width || fit.height !== size.height ||
        fit.cardWidth !== card.width || fit.cardHeight !== card.height;
      const halfWidth = card.width / 2, halfHeight = card.height / 2;
      const safeX = halfWidth + (mobile ? 14 : 26);
      const safeTop = Math.min(mobile ? 204 : 116, size.height * .31) + halfHeight;
      const safeBottom = Math.min(mobile ? 104 : 84, size.height * .18) + halfHeight;
      const clampX = (x: number) => Math.max(safeX, Math.min(size.width - safeX, x));
      const clampY = (y: number) => Math.max(safeTop, Math.min(size.height - safeBottom, y));
      const worldAt = (target: Vector3, x: number, y: number, z: number) =>
        target.set(x * 2 / size.width - 1, 1 - y * 2 / size.height, z).unproject(camera);
      if (changed) {
        fit.card = card;
        fit.width = size.width; fit.height = size.height;
        fit.cardWidth = card.width; fit.cardHeight = card.height;
        if (opening) fit.began = now;
        fit.side = selectedX < size.width * .5 ? 1 : -1;
        view.copy(selected).applyMatrix4(camera.matrixWorldInverse);
        view.multiplyScalar(.91).applyMatrix4(camera.projectionMatrix);
        worldAt(center, clampX(selectedX + fit.side * (halfWidth + (mobile ? 24 : 54))),
          clampY(selectedY - (mobile ? 69 : 65)), view.z);
        // Preserve the three-dimensional offset as the anchor moves. Refit it only when the viewport or card changes.
        fit.offset.subVectors(center, selected);
      }
      view.copy(selected).add(fit.offset).project(camera);
      const x = clampX((view.x + 1) * size.width / 2);
      const y = clampY((1 - view.y) * size.height / 2);
      const z = view.z;
      worldAt(center, x, y, z);
      if (trace || changed) fit.blocked = occlusion(center, .2);
      if (fit.blocked) cardState = fit.blocked;
      else {
        card.node.style.transform = `translate3d(${x - halfWidth}px, ${y - halfHeight}px, 0)`;
        card.node.toggleAttribute('data-port-right', fit.side < 0);
        const endX = x - fit.side * halfWidth;
        worldAt(port, endX, y, z);
        const elbowX = endX - fit.side * Math.min(18, Math.abs(endX - selectedX) * .35);
        worldAt(bend, elbowX, y, z);
        const progress = reduced ? 1 : Math.min(1, (now - fit.began) / 215);
        const length = selected.distanceTo(bend), last = bend.distanceTo(port);
        const shown = (length + last) * (1 - (1 - progress) ** 2);
        head.copy(bend).lerp(port, Math.max(0, (shown - length) / Math.max(last, 1e-6)));
        bend.lerp(selected, Math.max(0, 1 - shown / Math.max(length, 1e-6)));
        if (shown < length) head.copy(bend);
        leader.points.setXYZ(0, selected.x, selected.y, selected.z);
        leader.points.setXYZ(1, bend.x, bend.y, bend.z);
        leader.points.setXYZ(2, head.x, head.y, head.z);
        leader.points.needsUpdate = true;
        leader.line.visible = true;
      }
    }
    if (card && card.node.dataset.state !== cardState) {
      card.node.dataset.state = cardState;
      if (cardState === 'visible' && card.focus) {
        card.focus = false;
        card.close.focus({ preventScroll: true });
      }
    }
    if (cardReadout && (trace || !card)) cardReadout.textContent = card ? `${card.id} · ${cardState}` : '关闭';
  });
  return <primitive object={leader.line} dispose={null} />;
}
