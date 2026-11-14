'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ProjectMark } from './ProjectMark';
import { projects, regions, type Project } from './projects';
import type { AtlasScene } from './works-scene';
import styles from './works.module.css';

type Panel = { type: 'index' } | { type: 'project'; project: Project };

export function WorksAtlas() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [panel, setPanel] = useState<Panel | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const map = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<AtlasScene | null>(null);
  const indexToggle = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const nextFocus = useRef<string | null>(null);
  const indexOpen = panel?.type === 'index';
  const selected = panel?.type === 'project' ? panel.project : null;
  const active = selected?.slug ?? (indexOpen ? null : focused ?? hovered);

  useEffect(() => {
    const surface = canvas.current;
    const interaction = map.current;
    if (!surface || !interaction) return;
    let cancelled = false;
    import('./works-scene').then(({ mountAtlas }) => {
      if (cancelled) return;
      scene.current = mountAtlas(surface, interaction, projects, buttons.current, available => {
        setStatus(available ? 'ready' : 'fallback');
      });
      setStatus('ready');
    }).catch(() => {
      if (!cancelled) setStatus('fallback');
    });
    return () => {
      cancelled = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    scene.current?.update(active, panel !== null);
  }, [active, panel, status]);

  useLayoutEffect(() => {
    const target = nextFocus.current;
    if (!target) return;
    nextFocus.current = null;
    if (target === 'panel') {
      title.current?.focus({ preventScroll: true });
      title.current?.closest('section')?.scrollIntoView({ block: 'nearest' });
    } else {
      (buttons.current.get(target) ?? indexToggle.current)?.focus();
    }
  }, [panel]);

  function openProject(project: Project) {
    nextFocus.current = 'panel';
    setHovered(null);
    setFocused(null);
    setPanel({ type: 'project', project });
  }

  function toggleIndex() {
    if (indexOpen) {
      closePanel();
      return;
    }
    nextFocus.current = 'panel';
    setHovered(null);
    setFocused(null);
    setPanel({ type: 'index' });
  }

  function closePanel() {
    nextFocus.current = status === 'ready' && selected ? selected.slug : 'index';
    setPanel(null);
  }

  return <section className={styles.atlas} aria-labelledby="works-title" data-status={status}
    onKeyDown={event => {
      if (event.key === 'Escape' && panel) {
        event.preventDefault();
        closePanel();
      }
    }}>
    <header className={styles.header}>
      <a className={styles.wordmark} href="/" aria-label="LibreCosta 首页" lang="en">LibreCosta</a>
      <button type="button" ref={indexToggle} className={styles.indexToggle} aria-expanded={indexOpen}
        aria-controls={indexOpen ? 'works-panel' : undefined} onClick={toggleIndex}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M6 4h9M6 9h9M6 14h9M2 4h1M2 9h1M2 14h1" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        项目索引
      </button>
    </header>

    <div className={styles.content}>
      <h1 id="works-title" lang="en">Works</h1>
      <div className={styles.layout} data-panel={!!panel}>
        <div className={styles.stage}>
          <div className={styles.map} ref={map} role="group" aria-label="三维作品沙盘">
            <canvas className={styles.canvas} aria-hidden="true" ref={canvas} />
            {projects.map(project => <button key={project.slug} type="button" data-project={project.slug}
              className={styles.node} aria-label={project.name} aria-expanded={selected === project}
              aria-controls={selected === project ? 'works-panel' : undefined} tabIndex={panel ? -1 : undefined}
              ref={element => {
                if (element) buttons.current.set(project.slug, element);
                else buttons.current.delete(project.slug);
              }}
              onPointerEnter={event => { if (event.pointerType === 'mouse') setHovered(project.slug); }}
              onPointerLeave={() => setHovered(current => current === project.slug ? null : current)}
              onFocus={event => { if (event.currentTarget.matches(':focus-visible')) setFocused(project.slug); }}
              onBlur={() => setFocused(current => current === project.slug ? null : current)}
              onClick={() => openProject(project)}>
              <ProjectMark landmark={project.landmark} />
              {active === project.slug && !panel && <span className={styles.tooltip} aria-hidden="true">
                <strong lang="en">{project.name}</strong>
                <span>{regions[project.region].label}</span>
              </span>}
            </button>)}
          </div>
          {status === 'ready' && <p className={styles.hint}>左右拖动旋转 · 选择地标查看作品</p>}
          {status !== 'ready' && !panel && <details className={styles.fallback}>
            <summary>作品列表</summary>
            <ul>{projects.map(project => <li key={project.slug}>
              <strong lang="en">{project.name}</strong>
              <p>{project.description}</p>
              {project.links.map(link => link && <a key={link.href} href={link.href}>{link.label}</a>)}
            </li>)}</ul>
          </details>}
        </div>

        {panel && <section id="works-panel" className={styles.panel} aria-labelledby="works-panel-title"
          key={selected?.slug ?? 'index'}>
          <button type="button" className={styles.close} aria-label={indexOpen ? '关闭项目索引' : '关闭项目详情'}
            onClick={closePanel}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>

          {selected ? <>
            <p className={styles.region}>{regions[selected.region].label} · <span lang="en">{regions[selected.region].name}</span></p>
            <h2 id="works-panel-title" tabIndex={-1} ref={title} lang="en">{selected.name}</h2>
            <p className={styles.description}>{selected.description}</p>
            <div className={styles.preview}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selected.media.src} alt={selected.media.alt} decoding="async" />
            </div>
            <div className={styles.links}>{selected.links.map(link => link && <a key={link.href} href={link.href}>
              {link.label}<span aria-hidden="true">↗</span>
            </a>)}</div>
          </> : <>
            <h2 id="works-panel-title" tabIndex={-1} ref={title}>项目索引</h2>
            <ul className={styles.indexList}>{projects.map(project => <li key={project.slug}>
              <button type="button" onClick={() => openProject(project)}>
                <ProjectMark landmark={project.landmark} />
                <span><strong lang="en">{project.name}</strong><small>{regions[project.region].label}</small></span>
                <span aria-hidden="true">›</span>
              </button>
            </li>)}</ul>
          </>}
        </section>}
      </div>
    </div>
  </section>;
}
