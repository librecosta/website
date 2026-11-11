import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { Frustum, InstancedMesh, Matrix4, Mesh, Ray, Raycaster, Vector3,
  type Box3, type Group, type Intersection, type Object3D } from 'three';
import { observationIds, type ObservationId } from './narrative';
import { createObservationGraphics } from './observation-graphics';
import { EXPANSE } from './parameters';
import type { Transform } from '@/tools/transform-inspector/editor';

type SignalCard = { id: ObservationId; node: HTMLElement };
export type ObservationAnchors = Partial<Record<ObservationId, Object3D | null>>;

export type ObservationElements = {
  buttons: Partial<Record<ObservationId, HTMLButtonElement | null>>;
  readouts: Partial<Record<ObservationId, HTMLSpanElement | null>>;
  card: SignalCard | null;
  cardReadout?: HTMLSpanElement | null;
};

export type BoardPreviews = {
  selected?: ObservationId;
  drafts: Partial<Record<ObservationId, Transform>>;
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

export function ObservationProjection({ anchors, elements, opaque, terrain, ground, previews, mobile, reduced }: {
  anchors: ObservationAnchors;
  elements: RefObject<ObservationElements>;
  opaque: RefObject<Group | null>;
  terrain: Box3;
  ground: (x: number, z: number) => number;
  previews: RefObject<BoardPreviews>;
  mobile: boolean;
  reduced: boolean;
}) {
  const lastTrace = useRef(-Infinity);
  const lastView = useRef({ terrain, width: 0, height: 0 });
  const blocked = useRef<Partial<Record<ObservationId, { anchor: Object3D; by: 'terrain' | 'structure' | '' }>>>({});
  const scratch = useMemo(() => ({
    world: new Vector3(), eye: new Vector3(), view: new Vector3(), endpoint: new Vector3(), localEnd: new Vector3(),
    frustum: new Frustum(), projection: new Matrix4(),
    localRay: new Ray(), inverse: new Matrix4(), caster: new Raycaster(), hits: [] as Intersection[],
    meshes: [] as Mesh[],
  }), []);
  const graphics = useMemo(createObservationGraphics, []);
  useEffect(() => () => graphics.dispose(), [graphics]);
  const placement = useRef({ card: null as SignalCard | null, id: undefined as ObservationId | undefined,
    draft: undefined as Transform | undefined, began: 0, blocked: '' });

  useFrame(({ camera, size }) => {
    const { world, eye, view, endpoint, localEnd, caster, localRay, inverse, hits, meshes, frustum, projection } = scratch;
    const { panel } = graphics;
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
    }
    panel.visible = false;
    const fit = placement.current;
    const selected = previews.current.selected;
    const id = selected ?? card?.id;
    if (id) {
      const draft = previews.current.drafts[id];
      const pose = EXPANSE.observationBoards[id];
      const relative = 'relative' in pose;
      const parent = relative ? anchors[id] : null;
      const opening = fit.id !== id || (!selected && fit.card !== card);
      const changed = opening || fit.draft !== draft;
      if (changed) {
        fit.card = card;
        fit.id = id;
        fit.draft = draft;
        if (opening) { fit.began = now; graphics.paint(id); }
      }
      if (changed || parent) {
        const { position, quaternion, scale } = draft ?? pose;
        panel.position.fromArray(position);
        panel.quaternion.fromArray(quaternion);
        panel.scale.fromArray(scale);
        if (parent) {
          parent.updateWorldMatrix(true, false);
          panel.applyMatrix4(parent.matrixWorld);
        }
        panel.updateMatrixWorld();
      }
      const inView = (!relative || parent) && frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,
        camera.matrixWorldInverse)).intersectsObject(panel);
      if (inView) {
        if (trace || changed || card?.node.dataset.state === 'outside') fit.blocked = occlusion(panel.position, .2);
        cardState = fit.blocked || 'visible';
        const elapsed = now - fit.began;
        panel.material.opacity = reduced || selected ? 1 : Math.min(1, elapsed / 220);
        panel.visible = true;
      }
    } else {
      fit.card = null;
      fit.id = undefined;
    }
    if (card) {
      if (card.id !== id) cardState = 'outside';
      if (card.node.dataset.state !== cardState) card.node.dataset.state = cardState;
    }
    if (cardReadout && (trace || !card)) {
      cardReadout.textContent = card ? `${card.id} · ${cardState} · ${panel.position.toArray().map(Math.round).join(' / ')}` : '关闭';
    }
  });
  return <primitive object={graphics.panel} dispose={null} />;
}
