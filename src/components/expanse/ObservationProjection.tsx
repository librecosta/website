import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type RefObject } from 'react';
import { Box3, InstancedMesh, Matrix4, Mesh, Ray, Raycaster, Vector3, type Group, type Intersection, type Object3D } from 'three';
import { observationIds, type ObservationId } from './narrative';
import { EXPANSE } from './parameters';

export type ObservationElements = {
  buttons: Partial<Record<ObservationId, HTMLButtonElement | null>>;
  readouts: Partial<Record<ObservationId, HTMLSpanElement | null>>;
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

export function ObservationProjection({ anchors, elements, opaque, terrain, ground, mobile }: {
  anchors: Partial<Record<ObservationId, Object3D | null>>;
  elements: RefObject<ObservationElements>;
  opaque: RefObject<Group | null>;
  terrain: Box3;
  ground: (x: number, z: number) => number;
  mobile: boolean;
}) {
  const lastTrace = useRef(-Infinity);
  const lastView = useRef({ terrain, width: 0, height: 0 });
  const blocked = useRef<Partial<Record<ObservationId, { anchor: Object3D; by: 'terrain' | 'structure' | '' }>>>({});
  const scratch = useMemo(() => ({
    world: new Vector3(), eye: new Vector3(), view: new Vector3(), endpoint: new Vector3(), localEnd: new Vector3(),
    localRay: new Ray(), inverse: new Matrix4(), caster: new Raycaster(), hits: [] as Intersection[],
    meshes: [] as Mesh[],
  }), []);

  useFrame(({ camera, size }) => {
    const { world, eye, view, endpoint, localEnd, caster, localRay, inverse, hits, meshes } = scratch;
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
              caster.ray.origin.copy(eye);
              caster.ray.direction.subVectors(world, eye);
              const distance = caster.ray.direction.length();
              caster.ray.direction.divideScalar(distance);
              caster.near = 0;
              caster.far = distance - 1;
              // The rendered heightfield supplies the actual sand elevation.
              // Restrict samples to its bounding volume, even for the distant ring.
              let occlusion: 'terrain' | 'structure' | '' = terrainOccludes(
                caster.ray, caster.far, terrain, ground, mobile ? 11 : 6, view)
                ? 'terrain' : '';
              if (!occlusion) {
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
                  if (hits.length) { occlusion = 'structure'; break; }
                }
              }
              blocked.current[id] = { anchor, by: occlusion };
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
  });
  return null;
}
