import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { Box3, Euler, Frustum, InstancedMesh, MathUtils, Matrix4, Mesh, Quaternion, Ray, Raycaster, Vector3,
  type Group, type Intersection, type Object3D } from 'three';
import { observationIds, type ObservationId } from './narrative';
import { createObservationGraphics, signalPanel } from './observation-graphics';
import { EXPANSE } from './parameters';

type SignalCard = { id: ObservationId; node: HTMLElement };

export type ObservationElements = {
  buttons: Partial<Record<ObservationId, HTMLButtonElement | null>>;
  readouts: Partial<Record<ObservationId, HTMLSpanElement | null>>;
  card: SignalCard | null;
  cardReadout?: HTMLSpanElement | null;
};

const axes = ['x', 'y', 'z'] as const;
const panelAspect = signalPanel.height / signalPanel.width;

function boardPose(id: ObservationId, ground: (x: number, z: number) => number) {
  const spec = EXPANSE.observationBoards[id];
  const height = spec.width * panelAspect;
  const rotation = new Quaternion().setFromEuler(new Euler(MathUtils.degToRad(spec.pitch - 90),
    MathUtils.degToRad(spec.yaw), 0, 'YXZ'));
  const size = new Vector3(spec.width, height, 1);
  if ('center' in spec) return { position: new Vector3(...spec.center), rotation, size };

  const [x, z] = spec.foot;
  const foot = new Vector3(x, ground(x, z), z);
  const right = new Vector3(1, 0, 0).applyQuaternion(rotation);
  const up = new Vector3(0, 1, 0).applyQuaternion(rotation);
  const edge = right.clone().multiplyScalar(spec.width / 2);
  const crossSlope = (ground(x + edge.x, z + edge.z) - ground(x - edge.x, z - edge.z)) / spec.width;
  right.y = crossSlope * spec.followSlope + Math.tan(MathUtils.degToRad(spec.roll));
  right.normalize();
  up.addScaledVector(right, -up.dot(right)).normalize();
  rotation.setFromRotationMatrix(new Matrix4().makeBasis(right, up, new Vector3().crossVectors(right, up)));

  // Keep the plate low on the slope, allowing the sand to meet the rim on the uphill side.
  const sample = new Vector3();
  let lift = 0;
  for (const across of [-.5, -.25, 0, .25, .5]) {
    for (const along of [0, .5, 1]) {
      sample.copy(foot).addScaledVector(right, across * spec.width).addScaledVector(up, along * height);
      lift = Math.max(lift, ground(sample.x, sample.z) - sample.y);
    }
  }
  const position = foot.addScaledVector(up, height / 2);
  position.y += Math.min(lift, spec.liftLimit) + spec.clearance;
  return { position, rotation, size };
}

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
    frustum: new Frustum(), projection: new Matrix4(),
    localRay: new Ray(), inverse: new Matrix4(), caster: new Raycaster(), hits: [] as Intersection[],
    meshes: [] as Mesh[],
  }), []);
  const graphics = useMemo(createObservationGraphics, []);
  useEffect(() => () => graphics.dispose(), [graphics]);
  const poses = useMemo(() => ({ bones: boardPose('bones', ground), ruin: boardPose('ruin', ground),
    ring: boardPose('ring', ground) }), [ground]);
  const placement = useRef({ card: null as SignalCard | null, poses, began: 0, blocked: '' });

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
    if (!card) placement.current.card = null;
    if (card) {
      const fit = placement.current;
      const opening = fit.card !== card;
      const changed = opening || fit.poses !== poses;
      if (changed) {
        fit.card = card;
        fit.poses = poses;
        if (opening) { fit.began = now; graphics.paint(card.id); }
        const { position, rotation, size: scale } = poses[card.id];
        panel.position.copy(position);
        panel.quaternion.copy(rotation);
        panel.scale.copy(scale);
        panel.updateMatrixWorld();
      }
      const inView = frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,
        camera.matrixWorldInverse)).intersectsObject(panel);
      if (inView) {
        if (trace || changed || card.node.dataset.state === 'outside') fit.blocked = occlusion(panel.position, .2);
        cardState = fit.blocked || 'visible';
        const elapsed = now - fit.began;
        panel.material.opacity = reduced ? 1 : Math.min(1, elapsed / 220);
        panel.visible = true;
      }
      if (card.node.dataset.state !== cardState) card.node.dataset.state = cardState;
    }
    if (cardReadout && (trace || !card)) {
      cardReadout.textContent = card ? `${card.id} · ${cardState} · ${panel.position.toArray().map(Math.round).join(' / ')}` : '关闭';
    }
  });
  return <primitive object={graphics.panel} dispose={null} />;
}
