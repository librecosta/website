'use client';

import { addAfterEffect, Canvas, useFrame, useThree } from '@react-three/fiber';
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  ACESFilmicToneMapping, BufferAttribute, BufferGeometry, InstancedMesh, MathUtils,
  MeshStandardMaterial, Object3D, PCFShadowMap, PerspectiveCamera, Quaternion, SRGBColorSpace, WebGLRenderer,
  type Camera, type Group, type Material,
} from 'three';
import { EXPANSE, type JourneySignal, type SkyView, type WindView } from './parameters';
import { buildAeolianTerrain, buildMonuments, buildSlottedMonolithData, fingerprint, fitVerticalFov, sampleJourney, windSurfaceAbove, type Monument } from './world';
import { mapJourneyProgress } from './journey-timing';
import { createAeolianMaterial } from './aeolian-material';
import { AtmosphericSky } from './AtmosphericSky';
import { applyAerialPerspective, createAtmosphere, type Atmosphere } from './atmosphere';
import { SandDust } from './SandDust';
import { renderedGround } from './sand-transport';
import { createSandstorm } from './sandstorm';
import { StormGrit } from './StormGrit';
import { addRuinDeposits } from './dressing-terrain';
import { createDistantSteleMaterial } from './ensemble-material';
import { EnvironmentalDressing } from './EnvironmentalDressing';
import { EntranceRuin, FutureCity } from './FutureCity';
import { ObservationProjection, type BoardPreviews, type ObservationElements } from './ObservationProjection';
import type { ExpanseEditorMount } from './ExpanseTransformEditor';
import { observationIds, type ObservationId } from './narrative';
import styles from './expanse.module.css';

type Props = { stage: RefObject<HTMLElement | null>; signal: RefObject<JourneySignal>; mobile: boolean; reduced: boolean; debug: boolean;
  skyView: SkyView; cameraRef: RefObject<Camera | null>; observationElements: RefObject<ObservationElements>;
  editor?: ExpanseEditorMount; editorDragging: RefObject<boolean>;
  windView: WindView; onReady: () => void; onContextLost: () => void };

const ExpanseTransformEditor = lazy(() => import('./ExpanseTransformEditor'));

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
  // The horizon batch sits outside the fixed shadow map.
  return <instancedMesh ref={mesh} args={[geometry, material, items.length]} castShadow={!distant}
    receiveShadow={!distant} dispose={null} />;
}

function World({ mobile, windView, skyView, visible, reduced, debug, atmosphere, observationElements, editor, stage, signal, editorDragging }:
  Pick<Props, 'mobile' | 'windView' | 'skyView' | 'reduced' | 'debug' | 'observationElements' | 'editor' | 'stage' | 'signal' | 'editorDragging'> &
  { visible: boolean; atmosphere: Atmosphere }) {
  const { invalidate, gl } = useThree();
  const opaque = useRef<Group>(null);
  const anchors = useRef<Partial<Record<ObservationId, Object3D | null>>>({});
  const attach = useMemo(() => Object.fromEntries(observationIds.map(id => [id, (object: Object3D | null) => {
    anchors.current[id] = object;
    invalidate();
  }])) as Record<ObservationId, (object: Object3D | null) => void>, [invalidate]);
  const monuments = useMemo(() => buildMonuments(EXPANSE), []);
  const entrance = monuments.find(item => item.id === EXPANSE.futureCity.ruin.id);
  const distantStelae = useMemo(() => monuments.filter(item => item.family === 'Distant Stelae'), [monuments]);
  const terrain = useMemo(() => {
    const resolution = EXPANSE.terrain.resolution[mobile ? 'mobile' : 'desktop'];
    const data = buildAeolianTerrain(EXPANSE, resolution);
    const baseGround = renderedGround(data.positions.slice(), resolution, EXPANSE.terrain);
    addRuinDeposits(data.positions, monuments, baseGround, EXPANSE);
    const geometry = indexedGeometry(data);
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    return { geometry, fingerprint: fingerprint(data.positions) };
  }, [mobile, monuments]);
  const groundHeight = useMemo(() => renderedGround(terrain.geometry.getAttribute('position').array,
    EXPANSE.terrain.resolution[mobile ? 'mobile' : 'desktop'], EXPANSE.terrain), [terrain, mobile]);
  const { center: [duneX, duneZ], height: duneOffset } = EXPANSE.duneObservation;
  const previews = useRef<BoardPreviews>({ drafts: {} });
  const windSurface = useMemo(() => windSurfaceAbove(groundHeight, monuments), [groundHeight, monuments]);
  const windActive = windView !== 'static';
  const storm = useMemo(() => windActive ? createSandstorm() : null, [windActive]);
  useEffect(() => () => storm?.stormNoise.value.dispose(), [storm]);
  const stelaGeometry = useMemo(() => indexedGeometry(
    buildSlottedMonolithData(EXPANSE.distantSteleGroove, EXPANSE.distantSteleTaper)), []);
  const resources = useMemo(() => {
    const ground = createAeolianMaterial();
    const dressing = new MeshStandardMaterial({ roughness: 0.94, vertexColors: true });
    const distant = createDistantSteleMaterial();
    for (const material of [ground, dressing]) {
      applyAerialPerspective(material, atmosphere, false, storm ?? undefined, mobile);
    }
    applyAerialPerspective(distant, atmosphere, true, storm ?? undefined, mobile);
    return { ground, distant, dressing };
  }, [atmosphere, storm, mobile]);
  useLayoutEffect(() => {
    gl.domElement.dataset.windView = windView;
    if (storm) storm.stormDebug.value = windView === 'concentration';
    if (windView === 'static') {
      delete gl.domElement.dataset.windTime;
      delete gl.domElement.dataset.sandPeak;
      delete gl.domElement.dataset.sandWindow;
      delete gl.domElement.dataset.sandBudget;
      delete gl.domElement.dataset.sandExposure;
    }
    invalidate();
  }, [gl, invalidate, windView, storm]);
  useLayoutEffect(() => {
    gl.domElement.dataset.terrain = terrain.fingerprint;
    gl.domElement.dataset.quality = mobile ? 'mobile' : 'desktop';
    gl.domElement.dataset.instances = String(monuments.length);
    gl.shadowMap.needsUpdate = true; invalidate();
  }, [terrain, gl, invalidate, mobile, monuments]);
  useEffect(() => () => terrain.geometry.dispose(), [terrain]);
  useEffect(() => () => stelaGeometry.dispose(), [stelaGeometry]);
  useEffect(() => () => {
    resources.ground.dispose();
    resources.distant.dispose(); resources.dressing.dispose();
  }, [resources]);
  return <group dispose={null}>
    <AtmosphericSky atmosphere={atmosphere} view={skyView}
      storm={storm ?? undefined} mobile={mobile} />
    <mesh geometry={terrain.geometry} material={resources.ground} receiveShadow />
    <group ref={opaque}>
      <FutureCity atmosphere={atmosphere} storm={storm ?? undefined} mobile={mobile} visible={visible} reduced={reduced}
        debug={debug} onAnchor={attach.ring} onAirshipAnchor={attach.airship} />
      {entrance && <Suspense fallback={null}>
        <EntranceRuin ruin={entrance} atmosphere={atmosphere} storm={storm ?? undefined} mobile={mobile} onAnchor={attach.ruin} />
      </Suspense>}
      <EnvironmentalDressing ground={groundHeight} mobile={mobile} material={resources.dressing} onAnchor={attach.bones} />
      <Instances items={distantStelae} geometry={stelaGeometry} material={resources.distant} distant />
    </group>
    <object3D ref={attach.dune} position={[duneX, groundHeight(duneX, duneZ) + duneOffset, duneZ]} />
    <ObservationProjection anchors={anchors.current} elements={observationElements} opaque={opaque} mobile={mobile} reduced={reduced}
      terrain={terrain.geometry.boundingBox!} ground={groundHeight} previews={previews} />
    {editor && <Suspense fallback={null}>
      <ExpanseTransformEditor mount={editor} stage={stage} signal={signal} reduced={reduced}
        previews={previews} anchors={anchors.current} dragging={editorDragging} />
    </Suspense>}
    {storm && windView !== 'static' && <SandDust terrain={terrain.geometry} ground={groundHeight} windSurface={windSurface}
      storm={storm} mobile={mobile} mode={windView} visible={visible} debug={debug} />}
    {storm && windView === 'transport' && <StormGrit uniforms={storm} mobile={mobile} />}
  </group>;
}

function Observation({ stage, signal, mobile, reduced, debug: inspect, onReady, onContextLost, cameraRef, visible, editorDragging }:
  Props & { visible: boolean }) {
  const { camera, invalidate, gl, size } = useThree();
  useEffect(() => {
    cameraRef.current = camera;
    return () => { cameraRef.current = null; };
  }, [camera, cameraRef]);
  const ready = useRef(false), frames = useRef(0), readback = useRef(false);
  const lastPose = useRef({ smoothed: -1, aspect: 0, camera, reduced, rotation: new Quaternion(), x: 0, y: 0 });
  const pointer = useRef({ x: 0, y: 0, targetX: 0, targetY: 0, sampledAt: null as number | null });
  const animated = visible && !reduced;
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
      if (editorDragging.current || event.pointerType !== 'mouse' || !fineHover.matches || document.hidden) return;
      // Retain the last scene sample over controls and when the pointer leaves the viewport.
      if (event.target instanceof Element && event.target.closest('a, button, aside, [data-transform-inspector]')) return;
      const { left, top, width, height } = container.getBoundingClientRect();
      const x = (event.clientX - left) / width, y = (event.clientY - top) / height;
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      setTarget(2 * x - 1, 1 - 2 * y);
    };
    const reset = () => {
      const moved = motion.x !== 0 || motion.y !== 0;
      motion.x = motion.y = motion.targetX = motion.targetY = 0;
      motion.sampledAt = null;
      if (moved) signal.current.invalidate();
    };
    container.addEventListener('pointermove', move, { passive: true });
    fineHover.addEventListener('change', reset);
    return () => {
      container.removeEventListener('pointermove', move);
      fineHover.removeEventListener('change', reset);
      reset();
    };
  }, [stage, signal, reduced, visible, editorDragging]);
  useEffect(() => addAfterEffect(timestamp => {
    if (!readback.current) return;
    readback.current = false;
    const dataset = gl.domElement.dataset;
    dataset.frames = String(frames.current); dataset.drawCalls = String(gl.info.render.calls);
    dataset.triangles = String(gl.info.render.triangles); dataset.geometries = String(gl.info.memory.geometries);
    if (inspect) {
      dataset.frameAt = timestamp.toFixed(3);
      dataset.textures = String(gl.info.memory.textures);
    }
    if (!ready.current) { ready.current = true; onReady(); }
  }), [gl, inspect, onReady]);
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
    if (editorDragging.current) {
      motion.targetX = motion.x;
      motion.targetY = motion.y;
      motion.sampledAt = null;
    } else if (!reduced && visible && !document.hidden && motion.sampledAt !== null) {
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
  const atmosphere = useMemo(createAtmosphere, []);
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
  const daylight = a.daylight;
  const quality = props.mobile ? 'mobile' : 'desktop';
  const shadowResolution = a.shadowResolution[quality];
  // Changing mapSize alone doesn't resize Three's existing shadow render target.
  // A new light on quality changes gives each tier its own correctly sized map.
  return <Canvas className={styles.canvas} data-rendering={visible ? 'on-demand' : 'paused'}
    style={{ pointerEvents: 'none', touchAction: 'pan-y' }}
    frameloop={visible ? 'demand' : 'never'} dpr={[1, props.mobile ? 1.25 : 1.5]}
    camera={{ near: 3, far: EXPANSE.futureCity.cameraFar, fov: 47 }}
    shadows={{ type: PCFShadowMap }}
    gl={defaults => {
      const canvas = defaults.canvas as HTMLCanvasElement;
      const context = canvas.getContext('webgl2', { antialias: !props.mobile, alpha: false, powerPreference: 'high-performance' });
      if (!context) throw new Error('WebGL2 is unavailable');
      // Keep adjacent architectural surfaces separable across the valley-to-skyline depth range.
      const renderer = new WebGLRenderer({
        ...defaults, canvas, context, antialias: !props.mobile, alpha: false, logarithmicDepthBuffer: true,
      });
      renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = a.exposure;
      renderer.outputColorSpace = SRGBColorSpace; renderer.shadowMap.autoUpdate = false;
      return renderer;
    }} fallback={<p>苍白荒原与半埋巨构。三维视图需要 WebGL2。</p>}>
    <color attach="background" args={[atmosphere.horizon]} />
    <fog attach="fog" args={[atmosphere.horizon, ...atmosphere.fogRange]} />
    <hemisphereLight color={daylight.hemisphereSky} groundColor={daylight.hemisphereGround} intensity={daylight.hemisphereIntensity} />
    <primitive object={target} />
    <directionalLight key={quality} position={[...daylight.sunPosition]} target={target} color={daylight.sunColor} intensity={daylight.sunIntensity}
      castShadow shadow-mapSize={[shadowResolution, shadowResolution]} shadow-intensity={daylight.shadowStrength}
      shadow-radius={a.shadowRadius[quality]} shadow-bias={a.shadowBias} shadow-normalBias={a.shadowNormalBias}>
      <orthographicCamera attach="shadow-camera" args={[...daylight.shadowBounds]} />
    </directionalLight>
    <World mobile={props.mobile} windView={windView} skyView={props.skyView} reduced={props.reduced}
      visible={visible} debug={props.debug} atmosphere={atmosphere} observationElements={props.observationElements}
      editor={props.editor} stage={props.stage} signal={props.signal} editorDragging={props.editorDragging} />
    <Observation {...props} visible={visible} />
  </Canvas>;
}
