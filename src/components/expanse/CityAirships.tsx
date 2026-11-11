import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { Vector3, type Group, type Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import { EXPANSE } from './parameters';
import { buildAirshipGeometry, buildFlightRoute } from './skyline';

export function CityAirships({ material, elapsed, reduced, onAnchor }: {
  material: MeshStandardMaterial; elapsed: RefObject<number>; reduced: boolean;
  onAnchor: (object: Object3D | null) => void;
}) {
  const roots = useRef<(Group | null)[]>([]);
  const hulls = useRef<(Mesh | null)[]>([]);
  const { airships, tangent } = useMemo(() => ({
    airships: EXPANSE.futureCity.airships.map(spec => ({
      ...buildFlightRoute(spec), geometry: buildAirshipGeometry(spec.id, spec.size),
    })),
    tangent: new Vector3(),
  }), []);
  useEffect(() => () => airships.forEach(({ geometry }) => geometry.dispose()), [airships]);
  useFrame(() => {
    const time = reduced ? 0 : elapsed.current;
    airships.forEach(({ curve, phase, speed, length }, index) => {
      const progress = (phase + time * speed / length) % 1;
      curve.getPointAt(progress, roots.current[index]!.position);
      curve.getTangentAt(progress, tangent);
      hulls.current[index]!.rotation.set(-Math.asin(tangent.y), Math.atan2(tangent.x, tangent.z), 0, 'YXZ');
    });
  }, -0.25);

  return airships.map(({ id, size, geometry }, index) =>
    <group key={id} ref={node => { roots.current[index] = node; }} dispose={null}>
      <mesh ref={node => { hulls.current[index] = node; }} geometry={geometry} material={material} />
      {id === 'passenger' && <object3D ref={onAnchor} position={[0, -size[1] * .64, 0]} />}
    </group>);
}
