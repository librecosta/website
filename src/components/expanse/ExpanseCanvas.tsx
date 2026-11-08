'use client';

import { addAfterEffect, Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  ACESFilmicToneMapping, BoxGeometry, BufferAttribute, BufferGeometry, InstancedMesh, MathUtils,
  MeshBasicMaterial, MeshStandardMaterial, Object3D, PCFShadowMap, PerspectiveCamera, Quaternion, SRGBColorSpace, WebGLRenderer,
  type Material,
} from 'three';
import { EXPANSE, type JourneySignal, type LightingLook, type MonumentFinish, type MonumentLayer, type MonumentView, type SkyView, type SurfaceView, type WindView } from './parameters';
import { buildAeolianTerrain, buildBeveledMonolithData, buildMonumentCoreData, buildMonuments, buildSlottedMonolithData, buildWedgeData, fingerprint, fitVerticalFov, sampleJourney, type Monument } from './world';
import { mapJourneyProgress } from './journey-timing';
import { createAeolianMaterial } from './aeolian-material';
import { createMonumentStudy } from './monument-material';
import { AtmosphericSky } from './AtmosphericSky';
import { applyAerialPerspective, createAtmosphere, type Atmosphere } from './atmosphere';
import { SandDust } from './SandDust';
import styles from './expanse.module.css';

type Props = { stage: RefObject<HTMLElement | null>; signal: RefObject<JourneySignal>; mobile: boolean; reduced: boolean; debug: boolean;
  surfaceView: SurfaceView; lightingLook: LightingLook; skyView: SkyView; monumentView: MonumentView;
  monumentFinish: MonumentFinish; monumentLayer: MonumentLayer;
  windView: WindView; onReady: () => void; onContextLost: () => void };

function indexedGeometry(data: { positions: Float32Array; indices: Uint16Array | Uint32Array; normals?: Float32Array }) {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(data.positions, 3));
  g.setIndex(new BufferAttribute(data.indices, 1));
  if (data.normals) g.setAttribute('normal', new BufferAttribute(data.normals, 3));
  else g.computeVertexNormals();
  return g;
}

function Instances({ items, geometry, material, distant = false }: {
  items: Monument[]; geometry: BufferGeometry; material: Material; distant?: boolean;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const invalidate = useThree(s => s.invalidate);
  useLayoutEffect(() => {
    const object = mesh.current!;
    const transform = new Object3D();
    items.forEach((item, i) => {
      transform.position.set(...item.position); transform.quaternion.fromArray(item.quaternion);
      transform.scale.set(...item.scale); transform.updateMatrix(); object.setMatrixAt(i, transform.matrix);
    });
    object.instanceMatrix.needsUpdate = true;
    object.computeBoundingBox(); object.computeBoundingSphere(); invalidate();
    return () => object.dispose();
  }, [items, geometry, material, distant, invalidate]);
  // The main stele receives self-shadow inside its groove. The horizon batch
  // sits outside the useful range of the fixed shadow map.
  return <instancedMesh ref={mesh} args={[geometry, material, items.length]} castShadow={!distant}
    receiveShadow={!distant && items[0]?.kind === 'slotted'} dispose={null} />;
}

function World({ mobile, surfaceView, lightingLook, monumentView, monumentFinish, monumentLayer, windView, visible, debug, atmosphere }:
  Pick<Props, 'mobile' | 'surfaceView' | 'lightingLook' | 'monumentView' | 'monumentFinish' | 'monumentLayer' | 'windView' | 'debug'> & { visible: boolean; atmosphere: Atmosphere }) {
  const { invalidate, gl } = useThree();
  const monuments = useMemo(() => buildMonuments(EXPANSE), []);
  const batches = useMemo(() => {
    return { box: monuments.filter(x => x.kind === 'box'), wedge: monuments.filter(x => x.kind === 'wedge'),
      hero: monuments.filter(x => x.id === EXPANSE.hero.id),
      distant: monuments.filter(x => x.family === 'Distant Stelae') };
  }, [monuments]);
  const original = surfaceView === 'original';
  const terrain = useMemo(() => {
    const data = buildAeolianTerrain(EXPANSE, EXPANSE.terrain.resolution[mobile ? 'mobile' : 'desktop'], original);
    const geometry = indexedGeometry(data);
    geometry.computeBoundingSphere();
    return { geometry, fingerprint: fingerprint(data.positions) };
  }, [mobile, original]);
  const geometries = useMemo(() => ({
    box: new BoxGeometry(1,1,1), wedge: batches.wedge.length ? indexedGeometry(buildWedgeData()) : null,
    slotted: indexedGeometry(buildSlottedMonolithData(EXPANSE.hero.groove,EXPANSE.hero.topScale)),
    beveled: indexedGeometry(buildBeveledMonolithData(EXPANSE.hero)),
    core: indexedGeometry(buildMonumentCoreData(EXPANSE.hero)),
  }), [batches]);
  const resources = useMemo(() => {
    const ground = createAeolianMaterial();
    const stone = new MeshStandardMaterial({ color: EXPANSE.atmosphere.monumentColor, roughness: 1, metalness: 0, flatShading: true });
    const heroStone = stone.clone();
    heroStone.flatShading = false;
    const study = createMonumentStudy(heroStone);
    const distant = new MeshBasicMaterial({ color: EXPANSE.atmosphere.distantSilhouette, toneMapped: false });
    applyAerialPerspective(ground.material, atmosphere);
    applyAerialPerspective(stone, atmosphere);
    applyAerialPerspective(heroStone, atmosphere);
    applyAerialPerspective(study.material, atmosphere);
    applyAerialPerspective(distant, atmosphere, true);
    return { ground, stone, heroStone, study, distant };
  }, [atmosphere]);
  const finish = monumentView === 'beveled' ? monumentFinish : 'gray';
  const heroGeometry = geometries[monumentView === 'original' ? 'slotted' : monumentView];
  useLayoutEffect(() => {
    if (finish !== 'gray') resources.study.select(finish, monumentLayer);
    if (debug) {
      gl.domElement.dataset.monumentFinish = finish;
      gl.domElement.dataset.monumentLayer = finish === 'gray' ? 'full' : monumentLayer;
    }
    invalidate();
  }, [debug, finish, gl, invalidate, monumentLayer, resources]);
  useLayoutEffect(() => {
    resources.ground.uniforms.duneRipples.value = surfaceView === 'ripples' || surfaceView === 'finalMaterial';
    resources.ground.uniforms.duneFinish.value = surfaceView === 'finalMaterial';
    gl.domElement.dataset.surfaceView = surfaceView;
    invalidate();
  }, [gl, invalidate, resources, surfaceView]);
  useLayoutEffect(() => {
    gl.domElement.dataset.windView = windView;
    if (windView === 'static') {
      delete gl.domElement.dataset.windTime;
      delete gl.domElement.dataset.sandPeak;
      delete gl.domElement.dataset.sandWindow;
    }
    invalidate();
  }, [gl, invalidate, windView]);
  useLayoutEffect(() => {
    gl.domElement.dataset.terrain = terrain.fingerprint;
    gl.domElement.dataset.quality = mobile ? 'mobile' : 'desktop';
    gl.domElement.dataset.instances = String(batches.box.length + batches.wedge.length + batches.hero.length + batches.distant.length);
    gl.domElement.dataset.lightingLook = lightingLook;
    if (debug) gl.domElement.dataset.monumentView = monumentView;
    gl.shadowMap.needsUpdate = true; invalidate();
  }, [terrain, gl, invalidate, mobile, batches, lightingLook, debug, monumentView]);
  useEffect(() => () => terrain.geometry.dispose(), [terrain]);
  useEffect(() => () => {
    geometries.box.dispose(); geometries.wedge?.dispose(); geometries.slotted.dispose();
    geometries.beveled.dispose(); geometries.core.dispose();
  }, [geometries]);
  useEffect(() => () => {
    resources.ground.material.dispose(); resources.stone.dispose(); resources.heroStone.dispose();
    resources.study.dispose(); resources.distant.dispose();
  }, [resources]);
  return <group dispose={null}>
    <mesh geometry={terrain.geometry} material={resources.ground.material} receiveShadow />
    <Instances items={batches.box} geometry={geometries.box} material={resources.stone} />
    {geometries.wedge && <Instances items={batches.wedge} geometry={geometries.wedge} material={resources.stone} />}
    <Instances items={batches.hero} geometry={heroGeometry}
      material={monumentView === 'original' ? resources.stone : finish === 'gray' ? resources.heroStone : resources.study.material} />
    <Instances items={batches.distant} geometry={geometries.slotted} material={resources.distant} distant />
    {windView !== 'static' && <SandDust terrain={terrain.geometry} monuments={monuments} mobile={mobile}
      mode={windView} lightingLook={lightingLook} visible={visible} debug={debug} />}
  </group>;
}

function Observation({ stage, signal, mobile, reduced, debug: inspect, onReady, onContextLost, windView, visible }:
  Props & { visible: boolean }) {
  const { camera, invalidate, gl, size } = useThree();
  const ready = useRef(false), frames = useRef(0), readback = useRef(false);
  const lastPose = useRef({ smoothed: -1, aspect: 0, camera, reduced, rotation: new Quaternion(), x: 0, y: 0 });
  const pointer = useRef({ x: 0, y: 0, targetX: 0, targetY: 0, sampledAt: null as number | null });
  const animated = visible && windView !== 'static';
  useEffect(() => {
    const current = signal.current;
    const interval = 1000 / EXPANSE.windMotion.fps[mobile ? 'mobile' : 'desktop'];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let deadline = 0;
    const tick = () => {
      timer = undefined;
      if (document.hidden || !animated) return;
      invalidate();
      const now = performance.now();
      deadline += interval * (1 + Math.floor(Math.max(0, now - deadline) / interval));
      timer = setTimeout(tick, Math.max(0, deadline - now));
    };
    current.invalidate = () => {
      if (!visible || document.hidden) return;
      if (animated) {
        if (timer === undefined) {
          deadline = performance.now();
          tick();
        }
      } else {
        clearTimeout(timer);
        timer = undefined;
        invalidate();
      }
    };
    current.invalidate();
    return () => {
      clearTimeout(timer);
      current.invalidate = () => {};
    };
  }, [signal, invalidate, mobile, animated, visible]);
  useEffect(() => {
    const container = stage.current;
    if (!container || reduced || !visible) return;
    const fineHover = window.matchMedia('(any-pointer: fine) and (any-hover: hover)');
    const motion = pointer.current;
    const setTarget = (x: number, y: number) => {
      if (x === motion.targetX && y === motion.targetY) return;
      motion.targetX = x;
      motion.targetY = y;
      // A demand-rendered frame delta can include the entire preceding idle period.
      motion.sampledAt ??= performance.now();
      signal.current.invalidate();
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !fineHover.matches || document.hidden) return;
      if (event.target instanceof Element && event.target.closest('a, aside')) {
        setTarget(0, 0);
        return;
      }
      const { left, top, width, height } = container.getBoundingClientRect();
      setTarget(
        MathUtils.clamp(2 * (event.clientX - left) / width - 1, -1, 1),
        MathUtils.clamp(1 - 2 * (event.clientY - top) / height, -1, 1),
      );
    };
    const leave = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') setTarget(0, 0);
    };
    const reset = () => {
      const moved = motion.x !== 0 || motion.y !== 0;
      motion.x = motion.y = motion.targetX = motion.targetY = 0;
      motion.sampledAt = null;
      if (moved) signal.current.invalidate();
    };
    container.addEventListener('pointermove', move, { passive: true });
    container.addEventListener('pointerleave', leave);
    container.addEventListener('pointercancel', leave);
    fineHover.addEventListener('change', reset);
    return () => {
      container.removeEventListener('pointermove', move);
      container.removeEventListener('pointerleave', leave);
      container.removeEventListener('pointercancel', leave);
      fineHover.removeEventListener('change', reset);
      reset();
    };
  }, [stage, signal, reduced, visible]);
  useEffect(() => addAfterEffect(() => {
    if (!readback.current) return;
    readback.current = false;
    const dataset = gl.domElement.dataset;
    dataset.frames = String(frames.current); dataset.drawCalls = String(gl.info.render.calls);
    dataset.triangles = String(gl.info.render.triangles); dataset.geometries = String(gl.info.memory.geometries);
    if (!ready.current) { ready.current = true; onReady(); }
  }), [gl, onReady]);
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => { event.preventDefault(); onContextLost(); };
    canvas.addEventListener('webglcontextlost', lost);
    const context = gl.getContext();
    canvas.dataset.webgl = context.getParameter(context.VERSION);
    const debug = context.getExtension('WEBGL_debug_renderer_info');
    canvas.dataset.renderer = debug ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER);
    return () => canvas.removeEventListener('webglcontextlost', lost);
  }, [gl, onContextLost]);
  // Sole camera writer: GSAP changes only signal.value, never camera properties.
  useFrame(() => {
    const smoothed = signal.current.value;
    const aspect = size.width / size.height;
    const previous = lastPose.current;
    const dataset = gl.domElement.dataset;
    const motion = pointer.current;
    const settings = EXPANSE.journey.pointer;
    if (!reduced && visible && !document.hidden && motion.sampledAt !== null) {
      const now = performance.now();
      const weight = -Math.expm1(-(now - motion.sampledAt) / settings.responseMs);
      motion.x = MathUtils.lerp(motion.x, motion.targetX, weight);
      motion.y = MathUtils.lerp(motion.y, motion.targetY, weight);
      if (Math.max(Math.abs(motion.x - motion.targetX), Math.abs(motion.y - motion.targetY)) <= settings.settleDistance) {
        motion.x = motion.targetX;
        motion.y = motion.targetY;
        motion.sampledAt = null;
      } else {
        motion.sampledAt = now;
        signal.current.invalidate();
      }
    }
    const baseChanged = previous.smoothed !== smoothed || previous.aspect !== aspect || previous.camera !== camera || previous.reduced !== reduced;
    if (baseChanged) {
      const progress = reduced ? EXPANSE.journey.reducedProgress : mapJourneyProgress(smoothed, EXPANSE.journey.timing);
      const pose = sampleJourney(progress, EXPANSE);
      camera.position.set(...pose.position);
      camera.up.set(0,1,0); camera.lookAt(pose.target[0],pose.target[1],pose.target[2]);
      camera.rotateZ(pose.roll);
      previous.rotation.copy(camera.quaternion);
      const fittedFov = fitVerticalFov(pose.fov, aspect, EXPANSE.journey.framingAspect);
      if ((camera as PerspectiveCamera).fov !== fittedFov) {
        (camera as PerspectiveCamera).fov = fittedFov;
        (camera as PerspectiveCamera).updateProjectionMatrix();
      }
      previous.smoothed = smoothed; previous.aspect = aspect; previous.camera = camera; previous.reduced = reduced;
      dataset.progress = progress.toFixed(5);
      if (inspect) {
        dataset.camera = JSON.stringify(pose.position.map(x => +x.toFixed(3)));
        dataset.fov = fittedFov.toFixed(3);
      }
    }
    const x = reduced ? 0 : motion.x;
    const y = reduced ? 0 : motion.y;
    if (baseChanged || previous.x !== x || previous.y !== y) {
      camera.quaternion.copy(previous.rotation);
      camera.rotateY(MathUtils.degToRad(-x * settings.yawDegrees));
      camera.rotateX(MathUtils.degToRad(y * settings.pitchDegrees));
      previous.x = x;
      previous.y = y;
      if (inspect) dataset.rotation = JSON.stringify(camera.quaternion.toArray().map(x => +x.toFixed(6)));
    }
    if (inspect) {
      dataset.scrollProgress = signal.current.raw.toFixed(5);
      dataset.smoothedProgress = smoothed.toFixed(5);
    }
    frames.current++;
    readback.current = true;
  }, -1);
  return null;
}

export default function ExpanseCanvas(props: Props) {
  const [visible, setVisible] = useState(true);
  const windView = props.reduced ? 'static' : props.windView;
  const atmosphere = useMemo(() => createAtmosphere(props.lightingLook), [props.lightingLook]);
  useEffect(() => () => atmosphere.uniforms.airSky.value.dispose(), [atmosphere]);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update(); document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  const target = useMemo(() => {
    const object = new Object3D(); object.position.set(...EXPANSE.atmosphere.sunTarget); return object;
  }, []);
  const a = EXPANSE.atmosphere;
  const look = a.looks[props.lightingLook];
  const quality = props.mobile ? 'mobile' : 'desktop';
  const shadowResolution = a.shadowResolution[quality];
  // Changing mapSize alone doesn't resize Three's existing shadow render target.
  // A new light on quality changes gives each tier its own correctly sized map.
  return <Canvas className={styles.canvas} data-rendering={visible ? 'on-demand' : 'paused'}
    style={{ pointerEvents: 'none', touchAction: 'pan-y' }}
    frameloop={visible ? 'demand' : 'never'} dpr={[1, props.mobile ? 1.25 : 1.5]}
    camera={{ near: 3, far: a.cameraFar, fov: 47 }} shadows={{ type: PCFShadowMap }}
    gl={defaults => {
      const canvas = defaults.canvas as HTMLCanvasElement;
      const context = canvas.getContext('webgl2', { antialias: !props.mobile, alpha: false, powerPreference: 'high-performance' });
      if (!context) throw new Error('WebGL2 is unavailable');
      const renderer = new WebGLRenderer({ ...defaults, canvas, context, antialias: !props.mobile, alpha: false });
      renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = a.exposure;
      renderer.outputColorSpace = SRGBColorSpace; renderer.shadowMap.autoUpdate = false;
      return renderer;
    }} fallback={<p>苍白荒原与半埋巨构。三维视图需要 WebGL2。</p>}>
    <color attach="background" args={[atmosphere.horizon]} />
    <fog attach="fog" args={[atmosphere.horizon, ...atmosphere.fogRange]} />
    <AtmosphericSky atmosphere={atmosphere} view={props.skyView} />
    <hemisphereLight color={look.hemisphereSky} groundColor={look.hemisphereGround} intensity={look.hemisphereIntensity} />
    <primitive object={target} />
    <directionalLight key={quality} position={[...look.sunPosition]} target={target} color={look.sunColor} intensity={look.sunIntensity}
      castShadow shadow-mapSize={[shadowResolution, shadowResolution]} shadow-intensity={look.shadowStrength}
      shadow-radius={a.shadowRadius[quality]} shadow-bias={a.shadowBias} shadow-normalBias={a.shadowNormalBias}>
      <orthographicCamera attach="shadow-camera" args={[...look.shadowBounds]} />
    </directionalLight>
    <World mobile={props.mobile} surfaceView={props.surfaceView} lightingLook={props.lightingLook} monumentView={props.monumentView}
      monumentFinish={props.monumentFinish} monumentLayer={props.monumentLayer} windView={windView}
      visible={visible} debug={props.debug} atmosphere={atmosphere} />
    <Observation {...props} windView={windView} visible={visible} />
  </Canvas>;
}
