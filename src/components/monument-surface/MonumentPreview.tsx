'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { Component, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { BufferAttribute, BufferGeometry, SRGBColorSpace, TextureLoader, type Texture } from 'three';
import { artwork, core, hero, net, stone, svgUrl } from './artwork';
import styles from './study.module.css';

const cameras: [number, number, number][] = [[.99, .12, 1.97], [1.97, .12, -.99],
  [-.99, .12, -1.97], [-1.97, .12, .99]];

type Maps = { color: Texture; emission: Texture };

function Model({ angle, maps }: { angle: number; maps: Maps }) {
  const { camera, invalidate } = useThree();
  const geometry = useMemo(() => {
    const mesh = new BufferGeometry();
    mesh.setAttribute('position', new BufferAttribute(core.positions, 3));
    mesh.setAttribute('normal', new BufferAttribute(core.normals, 3));
    mesh.setIndex(new BufferAttribute(core.indices, 1));
    const uv = new Float32Array(core.positions.length / 3 * 2);
    let end = 0;
    for (const face of net.faces) {
      mesh.addGroup(end, face.indexStart - end, 0);
      mesh.addGroup(face.indexStart, face.indexCount, 1);
      end = face.indexStart + face.indexCount;
      for (const id of [face.outline, ...face.holes].flat()) {
        const [x, y] = face.projectVertex(id);
        uv.set([(x - net.left) / net.width, 1 - (y - net.top) / net.height], id * 2);
      }
    }
    mesh.addGroup(end, core.indices.length - end, 0);
    mesh.setAttribute('uv', new BufferAttribute(uv, 2));
    return mesh;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useLayoutEffect(() => {
    camera.position.set(...cameras[angle]);
    camera.lookAt(0, .015, 0);
    invalidate();
  }, [angle, camera, invalidate]);
  return <mesh geometry={geometry} scale={[hero.scale[0] / hero.scale[1], 1, hero.scale[2] / hero.scale[1]]}>
    <meshStandardMaterial attach="material-0" color={stone} roughness={.88} />
    <meshStandardMaterial attach="material-1" map={maps.color} roughness={.88}
      emissive="#fff1d1" emissiveMap={maps.emission} emissiveIntensity={.12} />
  </mesh>;
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
  const [maps, setMaps] = useState<Maps>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const probe = document.createElement('canvas').getContext('webgl2');
    if (!probe) { setFailed(true); return; }
    probe.getExtension('WEBGL_lose_context')?.loseContext();
    let active = true;
    const loader = new TextureLoader();
    let ready = 0;
    const onLoad = (texture: Texture) => {
      if (texture === color) texture.colorSpace = SRGBColorSpace;
      if (++ready === 2 && active) setMaps({ color, emission });
    };
    const onError = () => { if (active) setFailed(true); };
    const color = loader.load(svgUrl(artwork('composite', { textureSize: 2048 })), onLoad, undefined, onError);
    const emission = loader.load(svgUrl(artwork('fine', { mask: true, textureSize: 2048 })), onLoad, undefined, onError);
    return () => { active = false; color.dispose(); emission.dispose(); };
  }, []);
  if (failed) return <Fallback />;
  if (!maps) return <p className={styles.previewMessage} role="status">正在载入碑体</p>;
  return <PreviewBoundary><Canvas frameloop="demand" camera={{ fov: 33 }} dpr={[1, 1.5]} fallback={<Fallback />}>
    <hemisphereLight args={['#f1eee2', '#797e76', 1.9]} />
    <directionalLight position={[-3, 3, 2]} intensity={2.2} color="#fff4e2" />
    <Model angle={angle} maps={maps} />
  </Canvas></PreviewBoundary>;
}
