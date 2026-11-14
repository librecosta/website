'use client';

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ProjectMark } from './ProjectMark';
import { categories, projects, type Project } from './projects';
import type { AtlasScene } from './works-scene';
import styles from './works.module.css';

type Panel = { kind: 'index' } | { kind: 'project'; project: Project };

export function WorksAtlas() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<AtlasScene | null>(null);
  const points = useRef(new Map<string, HTMLButtonElement>());
  const sheet = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const index = useRef<HTMLButtonElement>(null);
  const focusReturn = useRef<HTMLElement | null>(null);
  const markPress = useRef<{ x: number; y: number; dragged: boolean } | null>(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState(false);
  const [hover, setHover] = useState<Project | null>(null);
  const [markerHover, setMarkerHover] = useState<Project | null>(null);
  const [focus, setFocus] = useState<Project | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [mounted, setMounted] = useState(false);
  const selected = panel?.kind === 'project' ? panel.project : null;
  const active = markerHover ?? focus ?? hover;
  const ready = count === projects.length && !error;

  useEffect(() => {
    const surface = canvas.current;
    if (!surface) return;
    let cancelled = false;
    setMounted(true);
    import('./works-scene').then(({ mountAtlas }) => {
      if (cancelled) return;
      scene.current = mountAtlas(surface, projects, {
        points: points.current,
        hover: setHover,
        select: project => {
          focusReturn.current = points.current.get(project.slug) ?? null;
          setPanel({ kind: 'project', project });
        },
        loaded: loaded => { setCount(loaded); setError(false); },
        failed: () => setError(true),
      });
    }).catch(() => { if (!cancelled) setError(true); });
    return () => {
      cancelled = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const node = sheet.current;
    function update() {
      const rect = node?.getBoundingClientRect();
      const isBottom = matchMedia('(max-width: 759px)').matches;
      scene.current?.update(selected, markerHover ?? focus, rect
        ? { side: isBottom ? 'bottom' : 'right', size: isBottom ? rect.height : innerWidth - node!.offsetLeft }
        : null);
    }
    update();
    if (!node) return;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    window.addEventListener('resize', update);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, [selected, panel, markerHover, focus, count]);

  useLayoutEffect(() => {
    if (panel) heading.current?.focus({ preventScroll: true });
    else if (focusReturn.current) {
      const target = focusReturn.current;
      focusReturn.current = null;
      // The map returns to its previous frame on the next render. Make the
      // returning landmark focusable before that frame, without scrolling.
      const landmark = target.dataset.project;
      if (landmark && ready) target.dataset.outside = 'false';
      if (target.offsetWidth && !target.matches(':disabled')) target.focus({ preventScroll: true });
      else index.current?.focus({ preventScroll: true });
    }
  }, [panel]);

  function openIndex() {
    focusReturn.current = index.current;
    setPanel({ kind: 'index' });
  }

  function openProject(project: Project, source?: HTMLElement) {
    if (source) focusReturn.current = source;
    setPanel({ kind: 'project', project });
  }

  function panelKeys(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setPanel(null);
    }
    if (event.key !== 'Tab' || !sheet.current) return;
    const controls = Array.from(sheet.current.querySelectorAll<HTMLElement>('button, a[href]'));
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && (document.activeElement === heading.current || document.activeElement === first)) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return <section className={styles.experience} aria-labelledby="works-title" data-world={ready ? 'ready' : error ? 'fallback' : 'loading'}
    onKeyDown={event => { if (!panel && scene.current?.nudge(event.key)) event.preventDefault(); }}>
    <canvas className={styles.ocean} aria-hidden="true" ref={canvas} />
    <div className={styles.hud} inert={!!panel}>
      <header className={styles.mast}>
        <a href="/" aria-label="LibreCosta 首页">LibreCosta</a>
        <h1 id="works-title" lang="en">Works</h1>
      </header>
      <div className={styles.tools}>
        <button type="button" disabled={!ready} onClick={() => scene.current?.overview()}>
          <span className={styles.crosshair} aria-hidden="true" />世界总览
        </button>
        <button type="button" ref={index} onClick={openIndex} hidden={!mounted}
          aria-haspopup="dialog" aria-expanded={panel?.kind === 'index'}>
          <span aria-hidden="true" className={styles.indexIcon} />作品索引
        </button>
      </div>
      <div className={styles.markers} aria-label="作品岛屿">
        {projects.map((project, i) => <button key={project.slug} type="button" className={styles.point}
          disabled={!ready} data-project={project.slug} aria-haspopup="dialog"
          aria-label={project.name + ' · ' + project.island.name} aria-describedby={'island-information-' + i}
          ref={element => { if (element) points.current.set(project.slug, element); else points.current.delete(project.slug); }}
          onPointerEnter={event => { if (event.pointerType === 'mouse') setMarkerHover(project); }}
          onPointerLeave={() => setMarkerHover(null)}
          onPointerDown={event => {
            markPress.current = { x: event.clientX, y: event.clientY, dragged: false };
          }}
          onPointerMove={event => {
            const press = markPress.current;
            if (event.buttons && press && Math.hypot(event.clientX - press.x, event.clientY - press.y) >= 8) press.dragged = true;
          }}
          onPointerCancel={() => { markPress.current = null; }}
          onFocus={event => { if (event.currentTarget.matches(':focus-visible')) setFocus(project); }}
          onBlur={() => setFocus(null)}
          onClick={event => {
            if (event.detail && markPress.current?.dragged) return;
            openProject(project, event.currentTarget);
          }}>
          <span className={styles.waypoint}><ProjectMark landmark={project.landmark} /></span>
          <span className={styles.chartName} aria-hidden="true">{project.name}</span>
          <span id={'island-information-' + i} className={styles.sr}>{categories[project.category].label}。{project.description}</span>
          {active === project && !panel && <span className={styles.preview} aria-hidden="true">
            <span className={styles.previewRegion}>{project.island.name} · {categories[project.category].label}</span>
            <strong lang="en">{project.name}</strong>
            <span>{project.description}</span>
          </span>}
        </button>)}
      </div>
      {ready && <p className={styles.instruction}>拖动海面探索 · 选择岛屿查看作品</p>}
      {!ready && <div className={styles.fallback}>
        {mounted && !error && <p role="status">正在绘制群岛 <span>{count} / {projects.length}</span></p>}
        <details open={error || undefined}>
          <summary>查看作品列表</summary>
          <ul>{projects.map(project => <li key={project.slug}>
            <strong lang="en">{project.name}</strong>
            <p>{project.description}</p>
            {project.links.map(link => link && <a key={link.href} href={link.href}>{link.label}</a>)}
          </li>)}</ul>
        </details>
      </div>}
    </div>

    {panel && <aside className={styles.sheet} data-panel={panel.kind} ref={sheet} role="dialog"
      aria-labelledby="works-sheet-title" aria-modal="true" onKeyDown={panelKeys}>
      <div className={styles.paper} key={selected?.slug ?? 'index'}>
        <div className={styles.binding} aria-hidden="true" />
        <button type="button" className={styles.close} aria-label="关闭档案菜单" onClick={() => setPanel(null)}>
          <span aria-hidden="true">×</span>
        </button>
        <div className={styles.sheetScroll}>
          {selected ? <>
            <header className={styles.plate}>
              <p>{selected.island.name} <span>{categories[selected.category].label}</span></p>
              <h2 id="works-sheet-title" tabIndex={-1} ref={heading} lang="en">{selected.name}</h2>
            </header>
            <p className={styles.bodyCopy}>{selected.description}</p>
            <figure className={styles.figure}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selected.media.src} alt={selected.media.alt} decoding="async" />
              <figcaption>{selected.media.alt}</figcaption>
            </figure>
            {selected.note && <p className={styles.bodyCopy}>{selected.note}</p>}
            <p className={styles.status}>{selected.status}</p>
            <div className={styles.links}>{selected.links.map(link => link && <a key={link.href} href={link.href}>
              {link.label} <span aria-hidden="true">↗</span>
            </a>)}</div>
          </> : <>
            <header className={styles.plate}>
              <h2 id="works-sheet-title" tabIndex={-1} ref={heading}>群岛索引</h2>
            </header>
            <ul className={styles.list}>{projects.map(project => <li key={project.slug}><button type="button"
              data-destination={project.slug} onClick={() => openProject(project)}>
              <ProjectMark landmark={project.landmark} />
              <span><strong lang="en">{project.name}</strong><small>{project.island.name}</small></span>
              <span aria-hidden="true">↗</span>
            </button></li>)}</ul>
          </>}
        </div>
      </div>
    </aside>}
  </section>;
}
