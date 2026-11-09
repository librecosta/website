import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { BufferGeometry, InstancedMesh, Material, Matrix4, Object3D } from 'three';
import { buildDressingRemains, buildDressingRocks } from './dressing-meshes';
import type { renderedGround } from './sand-transport';

function RockBatch({ geometry, matrices, material }: {
  geometry: BufferGeometry; matrices: Matrix4[]; material: Material;
}) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const batch = mesh.current!;
    matrices.forEach((matrix, i) => batch.setMatrixAt(i, matrix));
    batch.instanceMatrix.needsUpdate = true;
    batch.computeBoundingBox();
    batch.computeBoundingSphere();
    return () => batch.dispose();
  }, [matrices, geometry, material]);
  return <instancedMesh ref={mesh} args={[geometry, material, matrices.length]} castShadow receiveShadow dispose={null} />;
}

export function EnvironmentalDressing({ ground, mobile, material, onAnchor }: {
  ground: ReturnType<typeof renderedGround>; mobile: boolean; material: Material;
  onAnchor: (object: Object3D | null) => void;
}) {
  const { gl, invalidate } = useThree();
  const rocks = useMemo(() => buildDressingRocks(ground, mobile), [ground, mobile]);
  const remains = useMemo(() => buildDressingRemains(ground, mobile), [ground, mobile]);
  useLayoutEffect(() => {
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [rocks, remains, material, gl, invalidate]);
  useEffect(() => () => {
    rocks.forEach(batch => batch.geometry.dispose());
    remains.geometry.dispose();
  }, [rocks, remains]);
  return <>
    {rocks.map((batch, i) => <RockBatch key={i} {...batch} material={material} />)}
    <mesh geometry={remains.geometry} material={material} castShadow receiveShadow>
      {remains.anchor && <object3D ref={onAnchor} position={remains.anchor} />}
    </mesh>
  </>;
}
