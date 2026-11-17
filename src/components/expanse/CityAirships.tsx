import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { MathUtils, Vector3, type Group, type MeshStandardMaterial, type Object3D } from 'three';
import { EXPANSE } from './parameters';
import { buildAirshipGeometry, buildFlightRoute } from './skyline';

const city = EXPANSE.futureCity;
const [passenger, cargo] = city.airships;

export function DockedAirship({ material, onAnchor }: {
  material: MeshStandardMaterial;
  onAnchor: (object: Object3D | null) => void;
}) {
  const port = city.ring.skyports[0];
  const { geometry, bottom } = useMemo(() => {
    const geometry = buildAirshipGeometry(passenger.id, passenger.size);
    geometry.computeBoundingBox();
    return { geometry, bottom: geometry.boundingBox!.min.y };
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return <group rotation-y={-MathUtils.degToRad(port.degrees)} dispose={null}>
    <group position={[city.ring.radius - port.inset - port.berthAdvance, port.deckHeight - bottom, port.berthOffset]}
      rotation-y={-Math.PI / 2}>
      <mesh geometry={geometry} material={material} />
      <object3D ref={onAnchor} position={[-passenger.size[0] * .62, passenger.size[1] * .05, 0]} />
    </group>
  </group>;
}

export function CirclingAirship({ material, elapsed }: {
  material: MeshStandardMaterial; elapsed: RefObject<number>;
}) {
  const hull = useRef<Group>(null);
  const { curve, length, geometry, tangent } = useMemo(() => ({
    ...buildFlightRoute(cargo), geometry: buildAirshipGeometry(cargo.id, cargo.size),
    tangent: new Vector3(),
  }), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    const progress = (cargo.phase + elapsed.current * cargo.speed / length) % 1;
    curve.getPointAt(progress, hull.current!.position);
    curve.getTangentAt(progress, tangent);
    hull.current!.rotation.set(-Math.asin(tangent.y), Math.atan2(tangent.x, tangent.z), 0, 'YXZ');
  }, -0.25);

  return <group ref={hull} dispose={null}>
    <mesh geometry={geometry} material={material} />
  </group>;
}
