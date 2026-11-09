import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { DynamicDrawUsage, Object3D, Vector3, type InstancedMesh, type MeshStandardMaterial } from 'three';
import { buildTrafficRoutes, buildVehicleGeometry, type VehicleKind } from './skyline';
import { EXPANSE } from './parameters';

const traffic = EXPANSE.futureCity.traffic;

export function CityTraffic({ material, elapsed, reduced }: {
  material: MeshStandardMaterial; elapsed: RefObject<number>; reduced: boolean;
}) {
  const meshes = useRef<(InstancedMesh | null)[]>([]);
  const lastTime = useRef(NaN);
  const { batches, transform, tangent } = useMemo(() => {
    const lanes = buildTrafficRoutes(traffic);
    const batches = (Object.keys(traffic.vehicles) as VehicleKind[]).map(kind => ({
      kind,
      geometry: buildVehicleGeometry(kind, traffic.vehicles[kind]),
      members: lanes.flatMap(lane => lane.fleet.flatMap((member, i) => member === kind
        ? [{ lane, offset: lane.phase + i / lane.fleet.length }] : [])),
    }));
    return { batches, transform: new Object3D(), tangent: new Vector3() };
  }, []);

  useLayoutEffect(() => {
    const instances = meshes.current.slice();
    for (const mesh of instances) mesh!.instanceMatrix.setUsage(DynamicDrawUsage);
    lastTime.current = NaN;
    return () => {
      batches.forEach(batch => batch.geometry.dispose());
      instances.forEach(mesh => mesh!.dispose());
    };
  }, [batches]);

  useFrame(() => {
    const time = reduced ? 0 : elapsed.current;
    if (time === lastTime.current) return;
    lastTime.current = time;
    batches.forEach(({ members }, index) => {
      const mesh = meshes.current[index]!;
      members.forEach(({ lane, offset }, i) => {
        const position = (offset + time * lane.speed / lane.length) % 1;
        lane.curve.getPointAt(position, transform.position);
        lane.curve.getTangentAt(position, tangent);
        transform.rotation.set(-Math.asin(tangent.y), Math.atan2(tangent.x, tangent.z), 0, 'YXZ');
        transform.updateMatrix();
        mesh.setMatrixAt(i, transform.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    });
  });

  // Vehicles move throughout the city, so do not cull using an initial parking position.
  return batches.map(({ kind, geometry, members }, i) =>
    <instancedMesh key={kind} ref={mesh => { meshes.current[i] = mesh; }}
      args={[geometry, undefined, members.length]} material={material} frustumCulled={false} />);
}
