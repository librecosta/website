"use client";

import { useEffect, useRef, useState } from "react";
import {
  ACESFilmicToneMapping,
  Color,
  HalfFloatType,
  Mesh,
  PerspectiveCamera,
  Scene,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { createSurface, views, type SurfaceView } from "./surface";
import styles from "./cube-surface.module.css";

type Settings = { view: SurfaceView; glow: boolean; emission: number };
const defaults: Settings = { view: "Composite", glow: true, emission: 1 };

export default function CubeSurfaceLab() {
  const viewport = useRef<HTMLDivElement>(null);
  const draw = useRef<((settings: Settings) => void) | null>(null);
  const settingsRef = useRef(defaults);
  const [settings, setSettings] = useState(defaults);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = viewport.current!;
    let renderer: WebGLRenderer;
    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl2", { alpha: false, antialias: false });
      if (!context) throw new Error("WebGL 2 unavailable");
      renderer = new WebGLRenderer({ canvas, context });
    } catch {
      setFailed(true);
      return;
    }

    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.domElement.setAttribute("aria-label", "Fixed three-quarter view of the cube");
    renderer.domElement.setAttribute("role", "img");
    host.append(renderer.domElement);

    const scene = new Scene();
    const background = new Color("#050d20");
    scene.background = background;
    const camera = new PerspectiveCamera(29, 1, 0.1, 30);
    camera.position.set(3.7, 3.2, 5.7);
    camera.lookAt(0, 0, 0);
    const surface = createSurface();
    const cube = new Mesh(surface.geometry, surface.materials);
    cube.rotation.z = 0.23;
    scene.add(cube);

    const composer = new EffectComposer(renderer, new WebGLRenderTarget(1, 1, {
      type: HalfFloatType,
      samples: Math.min(4, renderer.capabilities.maxSamples),
    }));
    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new Vector2(1, 1), 0.37, 0.42, 0.58);
    const output = new OutputPass();
    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composer.addPass(output);

    const render = ({ view, glow, emission }: Settings) => {
      const bloomOnly = view === "Bloom only";
      background.set(bloomOnly ? "#000000" : "#050d20");
      // Bloom-only captures the same composite input, then shows the bloom
      // buffer without the source object. Channel views bypass the glow pass.
      bloomPass.enabled = bloomOnly || (view === "Composite" && glow);
      for (const material of surface.materials) {
        material.uniforms.uView.value = bloomOnly ? 0 : views.indexOf(view);
        material.uniforms.uEmission.value = emission;
      }
      if (bloomOnly) {
        output.enabled = false;
        composer.renderToScreen = false;
        composer.render();
        output.renderToScreen = true;
        output.render(renderer, composer.writeBuffer, bloomPass.renderTargetsHorizontal[0], 0, false);
        output.enabled = true;
        composer.renderToScreen = true;
      } else {
        composer.render();
      }
    };
    draw.current = render;

    const resize = () => {
      const { clientWidth: width, clientHeight: height } = host;
      if (!width || !height) return;
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      camera.aspect = width / height;
      camera.fov = Math.max(29, 2 * Math.atan(Math.tan(29 * Math.PI / 360) / camera.aspect) * 180 / Math.PI);
      camera.updateProjectionMatrix();
      if (renderer.getPixelRatio() !== dpr) {
        renderer.setPixelRatio(dpr);
        composer.setPixelRatio(dpr);
      }
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
      render(settingsRef.current);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const contextLost = () => setFailed(true);
    const contextRestored = () => {
      setFailed(false);
      resize();
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    renderer.domElement.addEventListener("webglcontextrestored", contextRestored);
    return () => {
      observer.disconnect();
      draw.current = null;
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", contextRestored);
      renderer.domElement.remove();
      surface.dispose();
      bloomPass.dispose();
      output.dispose();
      composer.dispose();
      renderer.dispose();
    };
  }, []);

  function update(values: Partial<Settings>) {
    const next = { ...settingsRef.current, ...values };
    settingsRef.current = next;
    setSettings(next);
    draw.current?.(next);
  }

  return (
    <main className={styles.lab}>
      <header className={styles.header}>
        <a href="/">LibreCosta</a>
        <h1>Cube Surface Study</h1>
      </header>
      <div className={styles.viewport} ref={viewport}>
        {failed && <p className={styles.fallback}>WebGL 2 is required to view the material study.</p>}
      </div>
      <section className={styles.controls} aria-label="Material channels">
        <label>
          View
          <select value={settings.view} onChange={(event) => update({ view: event.target.value as SurfaceView })}>
            {views.map((view) => <option key={view}>{view}</option>)}
          </select>
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={settings.glow} onChange={(event) => update({ glow: event.target.checked })} />
          Bloom in composite
        </label>
        <label>
          Emission
          <input type="range" min="0" max="1.5" step="0.05" value={settings.emission}
            onChange={(event) => update({ emission: Number(event.target.value) })} />
        </label>
      </section>
    </main>
  );
}
