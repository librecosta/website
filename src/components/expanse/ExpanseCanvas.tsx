'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  ACESFilmicToneMapping, BoxGeometry, BufferAttribute, BufferGeometry, Color, InstancedMesh, MathUtils,
  MeshBasicMaterial, MeshStandardMaterial, Object3D, PCFShadowMap, PerspectiveCamera, SRGBColorSpace, WebGLRenderer,
  type Material,
} from 'three';
import { EXPANSE, type JourneySignal, type SurfaceView } from './parameters';
import { analyzeSurface, buildDrifts, buildSurfaceTerrain } from './surface';
import { buildMonuments, buildSlottedMonolithData, buildTerrainData, buildWedgeData, fingerprint, fitVerticalFov, heightAt, sampleJourney, valleyAt, valueNoise, worldVertices, type Monument } from './world';
import styles from './expanse.module.css';

type Props = { signal: RefObject<JourneySignal>; mobile: boolean; reduced: boolean; debug: boolean;
  surfaceView: SurfaceView; onReady: () => void; onContextLost: () => void };

function solidGeometry(data: ReturnType<typeof buildWedgeData>) {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(data.positions, 3));
  g.setIndex(new BufferAttribute(data.indices, 1));
  g.computeVertexNormals();
  return g;
}

function createSurfaceMaterial() {
  const { hardpan, sand } = EXPANSE.surface.material;
  const material = new MeshStandardMaterial({ color: hardpan.color, roughness: hardpan.roughness, metalness: 0 });
  const sandColor = new Color(sand.color);
  material.onBeforeCompile = shader => {
    shader.uniforms.paleSandColor = { value: sandColor };
    shader.uniforms.paleSandRoughness = { value: sand.roughness };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float sandCoverage;\nvarying float vSandCoverage;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSandCoverage = sandCoverage;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vSandCoverage;\nuniform vec3 paleSandColor;\nuniform float paleSandRoughness;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, paleSandColor, vSandCoverage);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, paleSandRoughness, vSandCoverage);');
  };
  return material;
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
    if (distant) {
      const { sky, distantSilhouette, distantFadeDepth } = EXPANSE.atmosphere;
      const skyColor = new Color(sky);
      const stoneColor = new Color(distantSilhouette);
      const tint = new Color();
      items.forEach((item, i) => {
        const fade = MathUtils.smoothstep(-item.position[2], ...distantFadeDepth);
        object.setColorAt(i, tint.copy(stoneColor).lerp(skyColor, fade * 0.8));
      });
      if (object.instanceColor) object.instanceColor.needsUpdate = true;
    }
    object.computeBoundingBox(); object.computeBoundingSphere(); invalidate();
    return () => object.dispose();
  }, [items, geometry, material, distant, invalidate]);
  // The main stele receives self-shadow inside its groove. The horizon batch
  // sits outside the useful range of the fixed shadow map.
  return <instancedMesh ref={mesh} args={[geometry, material, items.length]} castShadow={!distant}
    receiveShadow={!distant && items[0]?.kind === 'slotted'} dispose={null} />;
}

function World({ mobile, surfaceView }: { mobile: boolean; surfaceView: SurfaceView }) {
  const { invalidate, gl } = useThree();
  const analysis = useMemo(() => analyzeSurface(EXPANSE, { heightAt, valleyAt }), []);
  const monuments = useMemo(() => buildMonuments(EXPANSE), []);
  const drifts = useMemo(() => buildDrifts(EXPANSE, analysis.relief, monuments, { worldVertices, valleyAt }), [analysis, monuments]);
  const batches = useMemo(() => {
    return { box: monuments.filter(x => x.kind === 'box'), wedge: monuments.filter(x => x.kind === 'wedge'),
      slotted: monuments.filter(x => x.kind === 'slotted' && x.family !== 'Distant Stelae'),
      distant: monuments.filter(x => x.family === 'Distant Stelae') };
  }, [monuments]);
  const resources = useMemo(() => {
    const base = buildTerrainData(EXPANSE, EXPANSE.terrain.resolution[mobile ? 'mobile' : 'desktop']);
    const data = buildSurfaceTerrain(EXPANSE, base, analysis, valueNoise, drifts);
    const terrain = new BufferGeometry();
    terrain.setAttribute('position', new BufferAttribute(data.positions, 3));
    terrain.setAttribute('sandCoverage', new BufferAttribute(data.masks.sandCoverage, 1));
    terrain.setIndex(new BufferAttribute(data.indices, 1)); terrain.computeVertexNormals(); terrain.computeBoundingSphere();
    return {
      terrain, box: new BoxGeometry(1,1,1), wedge: batches.wedge.length ? solidGeometry(buildWedgeData()) : null,
      slotted: solidGeometry(buildSlottedMonolithData(EXPANSE.hero.groove,EXPANSE.hero.topScale)),
      ground: createSurfaceMaterial(),
      debugGround: new MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false }),
      stone: new MeshStandardMaterial({ color: EXPANSE.atmosphere.monumentColor, roughness: 1, metalness: 0, flatShading: true }),
      // The instance tints carry the atmospheric falloff beyond the foreground fog.
      // Normal depth testing lets the sand crests still mask the bases.
      distant: new MeshBasicMaterial({ fog: false, toneMapped: false }),
      fingerprint: fingerprint(data.positions),
      masks: data.masks,
    };
  }, [mobile, batches, analysis, drifts]);
  useLayoutEffect(() => {
    gl.domElement.dataset.surfaceView = surfaceView;
    if (surfaceView !== 'finalMaterial') {
      const mask = resources.masks[surfaceView];
      const attribute = resources.terrain.getAttribute('color') ?? new BufferAttribute(new Float32Array(mask.length * 3), 3);
      const colors = attribute.array as Float32Array;
      const gray = new Color();
      for (let i = 0; i < mask.length; i++) {
        gray.setRGB(mask[i], mask[i], mask[i], SRGBColorSpace).toArray(colors, i * 3);
      }
      resources.terrain.setAttribute('color', attribute);
      attribute.needsUpdate = true;
    }
    invalidate();
  }, [gl, invalidate, resources, surfaceView]);
  useLayoutEffect(() => {
    gl.domElement.dataset.terrain = resources.fingerprint;
    gl.domElement.dataset.quality = mobile ? 'mobile' : 'desktop';
    gl.domElement.dataset.instances = String(batches.box.length + batches.wedge.length + batches.slotted.length + batches.distant.length);
    gl.shadowMap.needsUpdate = true; invalidate();
  }, [resources, gl, invalidate, mobile, batches]);
  useEffect(() => () => {
    resources.terrain.dispose(); resources.box.dispose(); resources.wedge?.dispose(); resources.slotted.dispose();
    resources.ground.dispose(); resources.debugGround.dispose(); resources.stone.dispose(); resources.distant.dispose();
  }, [resources]);
  return <group dispose={null}>
    <mesh geometry={resources.terrain} material={surfaceView === 'finalMaterial' ? resources.ground : resources.debugGround} receiveShadow />
    <Instances items={batches.box} geometry={resources.box} material={resources.stone} />
    {resources.wedge && <Instances items={batches.wedge} geometry={resources.wedge} material={resources.stone} />}
    <Instances items={batches.slotted} geometry={resources.slotted} material={resources.stone} />
    <Instances items={batches.distant} geometry={resources.slotted} material={resources.distant} distant />
  </group>;
}

function Observation({ signal, mobile, reduced, debug: inspect, onReady, onContextLost }: Props) {
  const { camera, invalidate, gl, size } = useThree();
  const ready = useRef(false), frames = useRef(0), readback = useRef(0);
  useEffect(() => {
    const current = signal.current;
    current.invalidate = invalidate;
    invalidate();
    return () => { current.invalidate = () => {}; };
  }, [signal, invalidate, mobile, reduced]);
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
  // Sole camera writer: GSAP changes only signal.value, never camera properties.
  useFrame(() => {
    const progress = reduced ? EXPANSE.journey.reducedProgress : signal.current.value;
    const pose = sampleJourney(progress, EXPANSE);
    camera.position.set(...pose.position);
    camera.up.set(0,1,0); camera.lookAt(pose.target[0],pose.target[1],pose.target[2]);
    camera.rotateZ(pose.roll);
    const fittedFov = fitVerticalFov(pose.fov, size.width / size.height, EXPANSE.journey.framingAspect);
    if ((camera as PerspectiveCamera).fov !== fittedFov) {
      (camera as PerspectiveCamera).fov = fittedFov;
      (camera as PerspectiveCamera).updateProjectionMatrix();
    }
    gl.domElement.dataset.progress = progress.toFixed(5);
    if (inspect) {
      gl.domElement.dataset.scrollProgress = signal.current.raw.toFixed(5);
      gl.domElement.dataset.camera = JSON.stringify(pose.position.map(x => +x.toFixed(3)));
      gl.domElement.dataset.rotation = JSON.stringify(camera.quaternion.toArray().map(x => +x.toFixed(6)));
      gl.domElement.dataset.fov = fittedFov.toFixed(3);
    }
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
  const quality = props.mobile ? 'mobile' : 'desktop';
  const shadowResolution = a.shadowResolution[quality];
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
    <color attach="background" args={[a.sky]} />
    <fog attach="fog" args={[a.sky, a.fogNear, a.fogFar]} />
    <hemisphereLight args={[a.hemisphereSky, a.hemisphereGround, a.hemisphereIntensity]} />
    <primitive object={target} />
    <directionalLight position={[...a.sunPosition]} target={target} color={a.sunColor} intensity={a.sunIntensity}
      castShadow shadow-mapSize={[shadowResolution, shadowResolution]}
      shadow-radius={a.shadowRadius[quality]} shadow-bias={a.shadowBias} shadow-normalBias={a.shadowNormalBias}>
      <orthographicCamera attach="shadow-camera" args={[...a.shadowBounds]} />
    </directionalLight>
    <World mobile={props.mobile} surfaceView={props.surfaceView} />
    <Observation {...props} />
  </Canvas>;
}
