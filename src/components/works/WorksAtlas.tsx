'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ProjectMark } from './ProjectMark';
import { categories, projects, regions, type Project } from './projects';
import type { AtlasScene } from './works-scene';
import styles from './works.module.css';

function Close({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className={styles.close} aria-label={label} onClick={onClick}>
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  </button>;
}

function ProjectPreview({ project }: { project: Project }) {
  const { media } = project;
  return <div className={styles.preview} data-fit={media.fit}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={media.src} alt={media.alt} decoding="async" />
  </div>;
}

export function WorksAtlas() {
  const [status, setStatus] = useState<'loading'|'ready'|'fallback'>('loading');
  const [zoom, setZoom] = useState(1);
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<Project | null>(null);
  const [indexOpen, setIndexOpen] = useState(false);
  const map = useRef<HTMLDivElement>(null);
  const mount = useRef<HTMLDivElement>(null);
  const scene = useRef<AtlasScene | null>(null);
  const indexToggle = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const markers = useRef(new Map<string, HTMLButtonElement>());
  const nextFocus = useRef<string | null>(null);
  const panel = indexOpen || selected !== null;

  useEffect(() => {
    const container = mount.current;
    const interaction = map.current;
    if (!container || !interaction) return;
    let mounted = true;
    let canvas: HTMLCanvasElement | null = null;
    function lostContext(event: Event) {
      event.preventDefault();
      setStatus('fallback');
    }
    function restoredContext() {
      setStatus('ready');
      scene.current?.reset();
    }
    import('./works-scene').then(({ mountAtlas }) => {
      if (!mounted) return;
      scene.current = mountAtlas(container,interaction,projects,setZoom);
      canvas = container.querySelector('canvas');
      canvas?.addEventListener('webglcontextlost',lostContext);
      canvas?.addEventListener('webglcontextrestored',restoredContext);
      setStatus('ready');
    }).catch(() => {
      if (mounted) setStatus('fallback');
    });
    return () => {
      mounted = false;
      canvas?.removeEventListener('webglcontextlost',lostContext);
      canvas?.removeEventListener('webglcontextrestored',restoredContext);
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);

  useEffect(() => {
    scene.current?.highlight(hover, selected?.slug ?? null);
  }, [hover, selected, status]);

  function openProject(project: Project, fromIndex = false) {
    scene.current?.reveal(project,fromIndex);
    nextFocus.current = '#panel';
    setSelected(project);
    setIndexOpen(false);
    setHover(null);
  }

  function openIndex() {
    nextFocus.current = '#panel';
    setSelected(null);
    setHover(null);
    setIndexOpen(true);
  }

  function close() {
    nextFocus.current = indexOpen ? '#index' : selected?.slug ?? '#index';
    setIndexOpen(false);
    setSelected(null);
  }

  useLayoutEffect(() => {
    const target = nextFocus.current;
    if (!target) return;
    nextFocus.current = null;
    const element = target === '#panel' ? title.current : target === '#index' ? indexToggle.current : markers.current.get(target);
    (element?.offsetParent ? element : indexToggle.current)?.focus({preventScroll:true});
  }, [indexOpen, selected]);

  return <section className={styles.atlas} aria-labelledby="works-title"
    data-status={status} data-panel={panel} data-side={selected && selected.position[0] < 0 ? 'right' : 'left'}
    onKeyDown={event => {
      if (event.key === 'Escape' && panel) {
        event.preventDefault();
        close();
      }
    }}>
    <header className={styles.header}>
      <a className={styles.wordmark} href="/" aria-label="LibreCosta 首页" lang="en">LIBRECOSTA</a>
      <h1 id="works-title" lang="en">WORKS</h1>
    </header>

    <div className={styles.map} ref={map} role="group" aria-label="三维作品地图">
      <div className={styles.canvas} ref={mount} />
      <div className={styles.markers}>
        {status === 'ready' && Object.entries(regions).map(([id,region]) => <span key={id} className={styles.region} lang="en"
          aria-hidden="true" ref={element => scene.current?.label(id, element)}>
          {region.name}
        </span>)}
        {status === 'ready' && projects.map(project => <button key={project.slug} type="button"
          className={styles.node} aria-label={project.name} aria-expanded={selected === project}
          aria-controls={selected === project ? 'works-project' : undefined}
          tabIndex={panel ? -1 : 0}
          ref={element => {
            if (element) markers.current.set(project.slug,element);
            else markers.current.delete(project.slug);
            scene.current?.marker(project.slug,element);
          }}
          onPointerEnter={event => { if (event.pointerType !== 'touch') setHover(project.slug); }}
          onPointerLeave={() => setHover(current => current === project.slug ? null : current)}
          onFocus={event => { if (event.currentTarget.matches(':focus-visible')) setHover(project.slug); }}
          onBlur={() => setHover(current => current === project.slug ? null : current)}
          onClick={() => openProject(project)}>
          <span className={styles.nodeName} lang="en" aria-hidden="true">{project.name}</span>
          {hover === project.slug && !panel && <span className={styles.hover} aria-hidden="true">
            <span className={styles.hoverRegion}>{regions[project.region].label}</span>
            <strong lang="en">{project.name}</strong>
            <span>{project.description}</span>
          </span>}
        </button>)}
      </div>
    </div>

    <div className={styles.frame} aria-hidden="true" />

    {selected && <section id="works-project" className={styles.panel} aria-labelledby="works-project-title" key={selected.slug}>
      <p className={styles.panelRegion}>{regions[selected.region].label} <span lang="en">{regions[selected.region].name}</span></p>
      <h2 id="works-project-title" tabIndex={-1} ref={title} lang="en">{selected.name}</h2>
      <Close label="关闭项目详情" onClick={close} />
      <p className={styles.description}>{selected.description}</p>
      <ProjectPreview project={selected} />
      <div className={styles.links}>{selected.links.map(link => link && <a key={link.href} href={link.href}>{link.label}
        <span aria-hidden="true">↗</span>
      </a>)}</div>
    </section>}

    {indexOpen && <section id="works-index" className={styles.panel} data-index aria-labelledby="works-index-title">
      <h2 id="works-index-title" tabIndex={-1} ref={title}>项目索引</h2>
      <Close label="关闭项目索引" onClick={close} />
      <ul className={styles.indexList}>{projects.map(project => <li key={project.slug}>
        <button type="button" onClick={() => openProject(project,true)}>
          <ProjectMark landmark={project.landmark} />
          <span><strong lang="en">{project.name}</strong><small>{regions[project.region].label}</small></span>
          <span aria-hidden="true">↗</span>
        </button>
      </li>)}</ul>
    </section>}

    <footer className={styles.toolbar}>
      <span className={styles.guide}>拖动地图 · 滚轮缩放</span>
      <button type="button" ref={indexToggle} className={styles.indexToggle} aria-expanded={indexOpen}
        aria-controls={indexOpen ? 'works-index' : undefined} onClick={indexOpen ? close : openIndex}>
        <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M6 4h9M6 9h9M6 14h9M2 4h1M2 9h1M2 14h1" stroke="currentColor" strokeWidth="1.3" />
        </svg>
        项目索引
      </button>
      <div className={styles.zoom} aria-label="地图缩放">
        <button type="button" aria-label="缩小地图" disabled={status !== 'ready' || zoom <= 1} onClick={() => scene.current?.zoom(1/1.28)}>−</button>
        <button type="button" aria-label="恢复地图总览" disabled={status !== 'ready'} onClick={() => scene.current?.reset()}>
          <span>{Math.round(zoom*100)}%</span>
        </button>
        <button type="button" aria-label="放大地图" disabled={status !== 'ready' || zoom >= 3.4} onClick={() => scene.current?.zoom(1.28)}>+</button>
      </div>
    </footer>

    {status !== 'ready' && !panel && <details className={styles.fallback}>
      <summary>作品列表</summary>
      <ul>{projects.map(project => <li key={project.slug}>
        <strong lang="en">{project.name}</strong>
        <span>{categories[project.category].label} · {project.description}</span>
        {project.links.map(link => link && <a key={link.href} href={link.href}>{link.label}</a>)}
      </li>)}</ul>
    </details>}
  </section>;
}
