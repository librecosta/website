import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Color, Mesh, MeshStandardMaterial, Object3D, Raycaster, Vector3, Vector4, type BufferGeometry, type Group, type InstancedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { applyAerialPerspective, type Atmosphere } from './atmosphere';
import { CirclingAirship, DockedAirship } from './CityAirships';
import { CityTraffic } from './CityTraffic';
import { EXPANSE } from './parameters';
import type { SandstormUniforms } from './sandstorm';
import { buildSkyline, legacyCityFinish, poseSecondaryRing, poseSkylineOrbit, poseSkylineRing } from './skyline';
import type { Monument } from './world';

const city = EXPANSE.futureCity;
type District = ReturnType<typeof buildSkyline>['batches'][number];

const skylineEmission = /* glsl */ `
  varying vec3 vCityMark;
  varying vec2 vCityFinish;
  vec3 skylineLight(vec3 mark) {
    if (mark.z > 5.5) {
      return mark.z < 6.5 ? vec3(0.44, 0.77, 1.0) * 2.1 : vec3(1.0, 0.50, 0.16) * 1.9;
    }
    bool window = mark.z > 2.5 && mark.z < 3.5;
    bool equator = mark.z > 4.5;
    float across = window ? mark.y : mark.x;
    float along = window ? mark.x : mark.y;
    float axis = mark.z < 1.5 ? 0.27 : 0.5;
    float width = equator ? 0.018 : (mark.z < 1.5 ? 0.041 : (mark.z > 3.5 ? 0.052 : 0.15));
    float footprint = max(fwidth(across), 0.0001);
    float distanceToLine = abs(across - axis);
    // Retain a soft, energy-limited trace even when the core is smaller than a pixel.
    float core = (1.0 - smoothstep(max(width - footprint * 0.5, 0.0), width + footprint * 0.5, distanceToLine))
      * min(1.0, width * 2.0 / footprint);
    float glow = 1.0 - smoothstep(width, width * 2.8, distanceToLine);
    float inset = mark.z > 3.5 ? 0.24 : 0.018;
    float endFade = equator ? 1.0 : smoothstep(inset, inset + 0.03, min(along, 1.0 - along));
    float strength = equator ? 1.05 : (mark.z < 1.5 ? 2.05 : (mark.z < 2.5 ? 2.25 : 1.3));
    vec3 color = mark.z < 1.5 ? vec3(0.50, 0.84, 1.0) : vec3(0.20, 0.61, 1.0);
    return color * (core + glow * 0.10) * strength * endFade * step(0.5, mark.z);
  }
`;

function DistrictInstances({ geometry, buildings, material }: District & { material: MeshStandardMaterial }) {
  const mesh = useRef<InstancedMesh>(null);
  const invalidate = useThree(state => state.invalidate);
  useLayoutEffect(() => {
    const batch = mesh.current!;
    const transform = new Object3D(), color = new Color();
    buildings.forEach(({ position, size, yaw, shade }, i) => {
      transform.position.set(...position);
      transform.scale.set(...size);
      transform.rotation.y = yaw;
      transform.updateMatrix();
      batch.setMatrixAt(i, transform.matrix);
      batch.setColorAt(i, color.setScalar(shade));
    });
    batch.instanceMatrix.needsUpdate = true;
    batch.instanceColor!.needsUpdate = true;
    batch.computeBoundingBox();
    batch.computeBoundingSphere();
    invalidate();
    return () => batch.dispose();
  }, [buildings, geometry, material, invalidate]);
  return <instancedMesh ref={mesh} args={[geometry, material, buildings.length]} />;
}

export function EntranceRuin({ ruin, atmosphere, storm, mobile, onAnchor }: {
  ruin: Monument; atmosphere: Atmosphere; storm?: SandstormUniforms; mobile: boolean;
  onAnchor: (object: Object3D | null) => void;
}) {
  const { nodes } = useLoader(GLTFLoader, '/expanse/entrance-ruin.glb');
  const geometry = (nodes.Tower as Mesh<BufferGeometry>).geometry;
  const anchor = useMemo(() => {
    // Intersect the solid equipment housing below the antenna in GLB-local space.
    const probe = new Raycaster(new Vector3(0, .22, 1), new Vector3(0, 0, -1));
    const target = new Mesh(geometry, (nodes.Tower as Mesh).material);
    const hit = probe.intersectObject(target)[0];
    return hit?.point.addScaledVector(hit.normal ?? new Vector3(0, 0, 1), .002);
  }, [geometry, nodes]);
  const { gl, invalidate } = useThree();
  const material = useMemo(() => {
    const stone = new MeshStandardMaterial({ color: '#aa9a84', roughness: .91 });
    applyAerialPerspective(stone, atmosphere, false, storm, mobile);
    return stone;
  }, [atmosphere, mobile, storm]);
  useLayoutEffect(() => {
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [gl, invalidate]);
  useEffect(() => () => material.dispose(), [material]);
  return <mesh geometry={geometry} material={material} position={ruin.position}
    quaternion={ruin.quaternion} scale={ruin.scale} castShadow receiveShadow dispose={null}>
    {anchor && <object3D ref={onAnchor} position={anchor} />}
  </mesh>;
}

export function FutureCity({ atmosphere, storm, mobile, visible, reduced, debug, onAnchor, onAirshipAnchor }: {
  atmosphere: Atmosphere; storm?: SandstormUniforms; mobile: boolean; visible: boolean; reduced: boolean; debug: boolean;
  onAnchor: (object: Object3D | null) => void;
  onAirshipAnchor: (object: Object3D | null) => void;
}) {
  const pivot = useRef<Group>(null);
  const track = useRef<Mesh>(null);
  const secondaryTrack = useRef<Mesh>(null);
  const orbit = useRef<Mesh>(null);
  const elapsed = useRef(0);
  const skyline = useMemo(() => buildSkyline(city, EXPANSE.seed, mobile), [mobile]);
  const material = useMemo(() => {
    const alloy = new MeshStandardMaterial({ vertexColors: true, ...legacyCityFinish });
    alloy.customProgramCacheKey = () => 'city-surface-finish';
    alloy.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec3 cityMark;
          attribute vec2 cityFinish;
          varying vec3 vCityMark;
          varying vec2 vCityFinish;
        `)
        .replace('#include <begin_vertex>', `
          #include <begin_vertex>
          vCityMark = cityMark;
          vCityFinish = cityFinish;
          #ifdef USE_INSTANCING_COLOR
            vCityMark.z *= step(0.96, instanceColor.r);
          #endif
        `);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${skylineEmission}`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vCityFinish.x;')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vCityFinish.y;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += skylineLight(vCityMark);');
    };
    applyAerialPerspective(alloy, { ...atmosphere, distantFade: new Vector4(...city.fog) }, true, storm, mobile, true);
    return alloy;
  }, [atmosphere, storm, mobile]);
  useEffect(() => () => {
    skyline.civic.dispose();
    skyline.ring.dispose();
    skyline.secondaryRing.dispose();
    skyline.satellites.dispose();
    skyline.batches.forEach(batch => batch.geometry.dispose());
  }, [skyline]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ gl }, delta) => {
    if (!visible) return;
    // A demand-rendered frame can include time spent in a hidden tab.
    if (!reduced) elapsed.current += Math.min(delta, 0.08);
    const time = reduced ? 0 : elapsed.current;
    if (debug) gl.domElement.dataset.cityTime = time.toFixed(3);
    poseSkylineRing(pivot.current!, track.current!, city.ring, time);
    poseSecondaryRing(secondaryTrack.current!, city.secondaryRing, time);
    poseSkylineOrbit(orbit.current!, city.satellites, time);
  }, -0.5);
  return <group position={[...city.center]} scale={city.scale} dispose={null}>
    <mesh geometry={skyline.civic} material={material} />
    <group ref={pivot}>
      <mesh ref={track} geometry={skyline.ring} material={material}>
        {skyline.ringAnchor && <object3D ref={onAnchor} position={[...skyline.ringAnchor]} />}
        <DockedAirship material={material} onAnchor={onAirshipAnchor} />
      </mesh>
      <mesh ref={secondaryTrack} geometry={skyline.secondaryRing} material={material}
        position-y={city.secondaryRing.height - city.ring.height} />
    </group>
    <mesh ref={orbit} geometry={skyline.satellites} material={material} />
    <CityTraffic material={material} elapsed={elapsed} reduced={reduced} />
    <CirclingAirship material={material} elapsed={elapsed} reduced={reduced} />
    {skyline.batches.map(batch => <DistrictInstances key={batch.id} {...batch} material={material} />)}
  </group>;
}
