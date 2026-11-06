'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ACESFilmicToneMapping, BoxGeometry, BufferAttribute, BufferGeometry, InstancedMesh,
  MeshStandardMaterial, Object3D, PCFShadowMap, PerspectiveCamera, SRGBColorSpace, WebGLRenderer,
} from 'three';
import { EXPANSE } from './parameters';
import { buildMonuments, buildTerrainData, buildWedgeData, fingerprint, heightAt, type Monument } from './world';

type Props = { view: number; mobile: boolean; onReady: () => void; onContextLost: () => void };

function wedgeGeometry() {
  const g = new BufferGeometry();
  const data = buildWedgeData();
  g.setAttribute('position', new BufferAttribute(data.positions, 3));
  g.setIndex(new BufferAttribute(data.indices, 1));
  g.computeVertexNormals();
  return g;
}

function Instances({ items, geometry, material }: { items: Monument[]; geometry: BufferGeometry; material: MeshStandardMaterial }) {
  const mesh = useRef<InstancedMesh>(null);
  const invalidate = useThree(s => s.invalidate);
  useLayoutEffect(() => {
    const object = mesh.current!;
    const transform = new Object3D();
    items.forEach((item, i) => {
      transform.position.set(...item.position); transform.rotation.set(0, item.rotation, 0);
      transform.scale.set(...item.scale); transform.updateMatrix(); object.setMatrixAt(i, transform.matrix);
    });
    object.instanceMatrix.needsUpdate = true;
    object.computeBoundingBox(); object.computeBoundingSphere(); invalidate();
    return () => object.dispose();
  }, [items, geometry, material, invalidate]);
  return <instancedMesh ref={mesh} args={[geometry, material, items.length]} castShadow receiveShadow dispose={null} />;
}

function World({ mobile }: { mobile: boolean }) {
  const { invalidate, gl } = useThree();
  const resources = useMemo(() => {
    const data = buildTerrainData(EXPANSE, EXPANSE.terrain.resolution[mobile ? 'mobile' : 'desktop']);
    const terrain = new BufferGeometry();
    terrain.setAttribute('position', new BufferAttribute(data.positions, 3));
    terrain.setIndex(new BufferAttribute(data.indices, 1)); terrain.computeVertexNormals(); terrain.computeBoundingSphere();
    return {
      terrain, box: new BoxGeometry(1,1,1), wedge: wedgeGeometry(),
      ground: new MeshStandardMaterial({ color: EXPANSE.atmosphere.terrainColor, roughness: 1, metalness: 0 }),
      stone: new MeshStandardMaterial({ color: EXPANSE.atmosphere.monumentColor, roughness: 1, metalness: 0, flatShading: true }),
      fingerprint: fingerprint(data.positions),
    };
  }, [mobile]);
  const batches = useMemo(() => {
    const all = buildMonuments(EXPANSE);
    return { box: all.filter(x => x.kind === 'box'), wedge: all.filter(x => x.kind === 'wedge') };
  }, []);
  useLayoutEffect(() => {
    gl.domElement.dataset.terrain = resources.fingerprint;
    gl.domElement.dataset.quality = mobile ? 'mobile' : 'desktop';
    gl.domElement.dataset.instances = String(batches.box.length + batches.wedge.length);
    gl.shadowMap.needsUpdate = true; invalidate();
  }, [resources, gl, invalidate, mobile, batches]);
  useEffect(() => () => {
    resources.terrain.dispose(); resources.box.dispose(); resources.wedge.dispose();
    resources.ground.dispose(); resources.stone.dispose();
  }, [resources]);
  return <group dispose={null}>
    <mesh geometry={resources.terrain} material={resources.ground} receiveShadow />
    <Instances items={batches.box} geometry={resources.box} material={resources.stone} />
    <Instances items={batches.wedge} geometry={resources.wedge} material={resources.stone} />
  </group>;
}

function Observation({ view, mobile, onReady, onContextLost }: Props) {
  const { camera, size, invalidate, gl } = useThree();
  const ready = useRef(false), frames = useRef(0), readback = useRef(0);
  useLayoutEffect(() => {
    const preset = EXPANSE.views[view][mobile ? 'mobile' : 'desktop'];
    const [x, eyeHeight, z] = preset.position;
    camera.position.set(x, heightAt(x, z, EXPANSE) + eyeHeight, z);
    camera.up.set(0,1,0); camera.lookAt(preset.target[0], preset.target[1], preset.target[2]);
    (camera as PerspectiveCamera).fov = preset.fov;
    (camera as PerspectiveCamera).updateProjectionMatrix();
    gl.domElement.dataset.view = EXPANSE.views[view].id;
    invalidate();
  }, [camera, size.width, size.height, view, mobile, invalidate, gl]);
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => { event.preventDefault(); onContextLost(); };
    canvas.addEventListener('webglcontextlost', lost);
    const context = gl.getContext();
    canvas.dataset.webgl = context.getParameter(context.VERSION);
    const debug = context.getExtension('WEBGL_debug_renderer_info');
    canvas.dataset.renderer = debug ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER);
    return () => { canvas.removeEventListener('webglcontextlost', lost); cancelAnimationFrame(readback.current); };
  }, [gl, onContextLost]);
  // No continuous animation. Capture actual render counters after a requested frame.
  useFrame(() => {
    frames.current++;
    cancelAnimationFrame(readback.current);
    readback.current = requestAnimationFrame(() => {
      const dataset = gl.domElement.dataset;
      dataset.frames = String(frames.current); dataset.drawCalls = String(gl.info.render.calls);
      dataset.triangles = String(gl.info.render.triangles); dataset.geometries = String(gl.info.memory.geometries);
      if (!ready.current) { ready.current = true; onReady(); }
    });
  });
  return null;
}

export default function ExpanseCanvas(props: Props) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update(); document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  const target = useMemo(() => {
    const object = new Object3D(); object.position.set(...EXPANSE.atmosphere.sunTarget); return object;
  }, []);
  const a = EXPANSE.atmosphere;
  return <Canvas data-rendering={visible ? 'on-demand' : 'paused'}
    frameloop={visible ? 'demand' : 'never'} dpr={[1, props.mobile ? 1.25 : 1.5]}
    camera={{ near: 1, far: 8500, fov: 43 }} shadows={{ type: PCFShadowMap }}
    gl={defaults => {
      const canvas = defaults.canvas as HTMLCanvasElement;
      const context = canvas.getContext('webgl2', { antialias: !props.mobile, alpha: false, powerPreference: 'high-performance' });
      if (!context) throw new Error('WebGL2 is unavailable');
      const renderer = new WebGLRenderer({ ...defaults, canvas, context, antialias: !props.mobile, alpha: false });
      renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = a.exposure;
      renderer.outputColorSpace = SRGBColorSpace; renderer.shadowMap.autoUpdate = false;
      return renderer;
    }} fallback={<p>苍白地形与几何巨构。可通过下方按钮切换三个观察点。</p>}>
    <color attach="background" args={[a.sky]} />
    <fog attach="fog" args={[a.sky, a.fogNear, a.fogFar]} />
    <hemisphereLight args={[a.hemisphereSky, a.hemisphereGround, a.hemisphereIntensity]} />
    <primitive object={target} />
    <directionalLight position={[...a.sunPosition]} target={target} color={a.sunColor} intensity={a.sunIntensity}
      castShadow shadow-mapSize={[props.mobile ? 1024 : 2048, props.mobile ? 1024 : 2048]}
      shadow-bias={-.00015} shadow-normalBias={1.2}>
      <orthographicCamera attach="shadow-camera" args={[-2100,2100,2100,-2100,50,6500]} />
    </directionalLight>
    <World mobile={props.mobile} />
    <Observation {...props} />
  </Canvas>;
}
