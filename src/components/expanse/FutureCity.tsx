import { useLoader, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import { CylinderGeometry, MathUtils, MeshStandardMaterial, Vector4, type BufferGeometry, type Mesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { applyAerialPerspective, type Atmosphere } from './atmosphere';
import { EXPANSE } from './parameters';
import type { SandstormUniforms } from './sandstorm';
import type { Monument } from './world';

const city = EXPANSE.futureCity;
const cityAsset = '/expanse/future-city.glb';

function buildSkyline() {
  const radius = Math.SQRT1_2;
  const sections = city.skyline.map(({ center: [x, y, z], size: [width, height, depth], taper }) =>
    new CylinderGeometry(radius * taper, radius, 1, 4, 1, false, Math.PI / 4)
      .scale(width, height, depth).translate(x, y, z));
  const geometry = mergeGeometries(sections)!;
  sections.forEach(section => section.dispose());
  return geometry;
}

export function FutureCity({ ruin, atmosphere, storm, mobile }: {
  ruin: Monument; atmosphere: Atmosphere; storm?: SandstormUniforms; mobile: boolean;
}) {
  const { nodes } = useLoader(GLTFLoader, cityAsset);
  const { gl, invalidate } = useThree();
  const skyline = useMemo(buildSkyline, []);
  const materials = useMemo(() => {
    const ruin = new MeshStandardMaterial({ color: '#aa9a84', roughness: .91 });
    const hub = new MeshStandardMaterial({ color: '#877f77', roughness: 1 });
    applyAerialPerspective(ruin, atmosphere, false, undefined, storm, mobile);
    applyAerialPerspective(hub, { ...atmosphere, distantFade: new Vector4(...city.fog) }, true, undefined, storm, mobile);
    return { ruin, hub };
  }, [atmosphere, mobile, storm]);
  useLayoutEffect(() => {
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [gl, invalidate]);
  useEffect(() => () => skyline.dispose(), [skyline]);
  useEffect(() => () => { materials.ruin.dispose(); materials.hub.dispose(); }, [materials]);

  const geometry = (name: string) => (nodes[name] as Mesh<BufferGeometry>).geometry;
  const [pitch, yaw, roll] = city.ring.tilt.map(MathUtils.degToRad);
  return <group dispose={null}>
    <mesh geometry={geometry('Tower')} material={materials.ruin} position={ruin.position}
      quaternion={ruin.quaternion} scale={ruin.scale} castShadow receiveShadow />
    <group position={[...city.center]} scale={city.scale}>
      <mesh geometry={skyline} material={materials.hub} rotation-y={city.skylineYaw} />
      <mesh geometry={geometry('Ring')} material={materials.hub} position-y={city.ring.height}
        rotation={[pitch, yaw, roll, 'YXZ']} scale={[...city.ring.scale]} />
    </group>
  </group>;
}
