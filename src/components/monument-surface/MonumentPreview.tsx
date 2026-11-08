'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { Component, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { hero } from './artwork';
import { createMonumentGeometry, createMonumentMaterial, useMonumentAtlas } from './atlas';
import styles from './study.module.css';

const cameras: [number, number, number][] = [[.99, .12, 1.97], [1.97, .12, -.99],
  [-.99, .12, -1.97], [-1.97, .12, .99]];

function Model({ angle }: { angle: number }) {
  const { camera, invalidate, gl } = useThree();
  const maps = useMonumentAtlas(gl, invalidate);
  const geometry = useMemo(createMonumentGeometry, []);
  const material = useMemo(() => createMonumentMaterial(maps), [maps]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useLayoutEffect(() => {
    camera.position.set(...cameras[angle]);
    camera.lookAt(0, .015, 0);
    invalidate();
  }, [angle, camera, invalidate]);
  return <mesh geometry={geometry} material={material} dispose={null}
    scale={[hero.scale[0] / hero.scale[1], 1, hero.scale[2] / hero.scale[1]]} />;
}

function Fallback() {
  return <p className={styles.previewMessage}>三维预览需要 WebGL2。仍可查看四面展开和分层图。</p>;
}

class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <Fallback /> : this.props.children; }
}

export default function MonumentPreview({ angle }: { angle: number }) {
  const [available, setAvailable] = useState<boolean>();
  useEffect(() => {
    const probe = document.createElement('canvas').getContext('webgl2');
    setAvailable(Boolean(probe));
    probe?.getExtension('WEBGL_lose_context')?.loseContext();
  }, []);
  if (available === false) return <Fallback />;
  if (available === undefined) return <p className={styles.previewMessage} role="status">正在载入碑体</p>;
  return <PreviewBoundary><Canvas frameloop="demand" camera={{ fov: 33 }} dpr={[1, 1.5]} fallback={<Fallback />}>
    <hemisphereLight args={['#f1eee2', '#797e76', 1.9]} />
    <directionalLight position={[-3, 3, 2]} intensity={2.2} color="#fff4e2" />
    <Model angle={angle} />
  </Canvas></PreviewBoundary>;
}
