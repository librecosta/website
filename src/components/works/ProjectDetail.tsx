import { useMotionValueEvent, type MotionValue } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useEnglish } from '@/site/LocaleProvider';
import { islandPreview, type Project } from './projects';
import type { IslandScene } from './works-scene';
import styles from './project-detail.module.css';

type SceneStatus = 'loading' | 'ready' | 'fallback';

function IslandStage({ project }: { project: Project }) {
  const english = useEnglish();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<IslandScene | null>(null);
  const [status, setStatus] = useState<SceneStatus>('loading');

  useEffect(() => {
    const canvas = canvasRef.current;
    let active = true;
    function failed() { if (active) setStatus('fallback'); }

    void import('./works-scene').then(({ mountIsland }) => {
      if (!active || !canvas) return;
      sceneRef.current = mountIsland(canvas, project, {
        ready() { if (active) setStatus('ready'); },
        failed,
      });
    }).catch(failed);

    return () => {
      active = false;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [project]);

  return <div className={styles.island} data-island-status={status}>
    <div className={styles.viewport}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.islandPreview} src={islandPreview(project)} alt={english ? `${project.name} — Static Island Preview` : `${project.island.name}岛屿预览`}
        width={560} height={420} aria-hidden={status === 'ready'} draggable={false} />
      {status !== 'fallback' && <canvas ref={canvasRef} tabIndex={status === 'ready' ? 0 : -1}
        aria-label={english ? `${project.name} — Island View. Use the arrow keys to rotate, plus or minus to zoom, and Home to reset.` : `${project.island.name}三维岛屿。方向键旋转，增减键缩放，Home 重置。`} aria-hidden={status !== 'ready'} />}
    </div>
    <div className={styles.viewTools}>
      {status === 'ready' && <div role="group" aria-label={english ? 'Island View' : '岛屿视角'}>
        <button type="button" aria-label={english ? 'Zoom Out' : '缩小岛屿'} onClick={() => sceneRef.current?.zoom(1 / 1.15)}>−</button>
        <button type="button" onClick={() => sceneRef.current?.resetView()}>{english ? 'Reset View' : '重置视角'}</button>
        <button type="button" aria-label={english ? 'Zoom In' : '放大岛屿'} onClick={() => sceneRef.current?.zoom(1.15)}>+</button>
      </div>}
      {status === 'fallback' && <p>{english ? 'Static Island Preview' : '静态岛屿预览'}</p>}
    </div>
  </div>;
}

export function ProjectDetail({ project, reveal, closing }: {
  project: Project;
  reveal: MotionValue<number>;
  closing: boolean;
}) {
  const english = useEnglish();
  const layout = useRef<HTMLDivElement>(null);
  useMotionValueEvent(reveal, 'change', opacity => {
    if (layout.current) layout.current.style.opacity = String(opacity);
  });

  return <div ref={layout} className={styles.layout} style={{ opacity: reveal.get() }} inert={closing}>
    <div className={styles.exhibit}>
      <IslandStage key={project.slug} project={project} />
    </div>
    <article className={styles.archive}>
      <header>
        <h2>{project.name}</h2>
        <p className={styles.status}>{english && `${project.type} · `}{project.status}</p>
      </header>
      <p className={styles.description}>{project.description}</p>
      <div className={styles.projectMedia} style={{ backgroundColor: project.media.background }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={project.media.src} alt={project.media.alt} />
      </div>
      <div className={styles.entries} role="group" aria-label={english ? 'Project Links' : '项目链接'}>
        {project.links.map(({ href, label }) => <a key={href} href={href} target="_blank" rel="noopener noreferrer">
          {label}<span aria-hidden="true">↗</span>
        </a>)}
      </div>
    </article>
  </div>;
}
