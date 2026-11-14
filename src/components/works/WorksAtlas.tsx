'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { ProjectMark } from './ProjectMark';
import { categories, projects, regions, type Project } from './projects';
import terrainProjection from './terrain-projection.json';
import styles from './works.module.css';

const projectedDepth: Record<string, number> = terrainProjection;

function mapDepth(project: Project) {
  return (projectedDepth[project.position.join(',')] ?? 38 + .843 * project.position[1]) / 630;
}

function mapPoint(project: Project): CSSProperties {
  return { left: project.position[0] / 10 + '%', top: mapDepth(project) * 100 + '%' };
}

function lightOrb(event: PointerEvent<HTMLButtonElement>) {
  if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const node = event.currentTarget;
  const bounds = node.getBoundingClientRect();
  node.style.setProperty('--specular-x', (20 + 55 * (event.clientX - bounds.left) / bounds.width) + '%');
  node.style.setProperty('--specular-y', (10 + 42 * (event.clientY - bounds.top) / bounds.height) + '%');
}

function Close({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className={styles.close} aria-label={label} onClick={onClick}>
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  </button>;
}

function ProjectPreview({ project }: { project: Project }) {
  const { media } = project;
  return 'src' in media
    ? <figure className={styles.preview}>
        <div className={styles.previewImage} data-fit={media.fit}>
          {/* The source image is local and sized for this panel. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={media.src} alt={media.alt} decoding="async" />
        </div>
        <figcaption>{media.caption}</figcaption>
      </figure>
    : <figure className={styles.preview}>
        <div className={styles.typePreview}>
          <ProjectMark landmark={project.landmark} />
          <div><strong lang="en">{media.title}</strong><span>{media.detail}</span></div>
        </div>
        <figcaption>项目标识</figcaption>
      </figure>;
}

export function WorksAtlas() {
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<Project | null>(null);
  const [indexOpen, setIndexOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const panelTitle = useRef<HTMLHeadingElement>(null);
  const markers = useRef(new Map<string, HTMLButtonElement>());
  const nextFocus = useRef<string | null>(null);
  const activeProject = indexOpen ? null : selected;
  const panel = indexOpen ? 'index' : activeProject ? 'project' : null;
  const side = activeProject && activeProject.position[0] < 520 ? 'right' : 'left';

  useEffect(() => setReady(true), []);

  function openProject(project: Project) {
    if (activeProject === project) {
      panelTitle.current?.focus({ preventScroll: true });
      return;
    }
    nextFocus.current = '#panel';
    setSelected(project);
    setIndexOpen(false);
  }

  const closePanel = useCallback(() => {
    if (indexOpen) {
      nextFocus.current = '#index';
      setIndexOpen(false);
    } else if (selected) {
      nextFocus.current = selected.slug;
      setSelected(null);
    }
  }, [indexOpen, selected]);

  useLayoutEffect(() => {
    const target = nextFocus.current;
    if (!target) return;
    nextFocus.current = null;
    const element = target === '#panel' ? panelTitle.current : target === '#index' ? toggle.current : markers.current.get(target);
    element?.focus({ preventScroll: true });
  }, [indexOpen, selected]);

  useEffect(() => {
    if (!panel) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      closePanel();
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [panel, closePanel]);

  return <section className={styles.atlas} aria-labelledby="works-title" data-ready={ready}
    data-panel={panel ?? 'none'} data-side={side}
    style={activeProject ? { '--selection-offset': .5 - mapDepth(activeProject) } as CSSProperties : undefined}>
    <header className={styles.header}>
      <a className={styles.wordmark} href="/" aria-label="LibreCosta 首页" lang="en">LIBRECOSTA</a>
      <h1 id="works-title" className={styles.heading} lang="en">WORKS</h1>
    </header>
    <div className={styles.map} role="group" aria-label="作品海图">
      <div className={styles.world}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.terrain} src="/works/terrain.webp" width="1650" height="1040"
          alt="" fetchPriority="high" draggable={false} />
        {Object.entries(regions).map(([id, region]) => <span key={id} className={styles.region} lang="en"
          aria-hidden="true" style={{ left: region.labelAt[0] / 10 + '%', top: region.labelAt[1] / 6.3 + '%' }}>
          {region.name}
        </span>)}
        {projects.map(project => <button key={project.slug} type="button" disabled={!ready}
          className={styles.node} aria-label={project.name} aria-expanded={activeProject === project}
          aria-controls={activeProject === project ? 'works-project' : undefined}
          tabIndex={panel ? -1 : 0}
          data-anchor={project.anchor} data-category={project.category} data-label-side={project.labelSide}
          style={mapPoint(project)}
          ref={node => {
            if (node) markers.current.set(project.slug, node);
            else markers.current.delete(project.slug);
          }}
          onPointerMove={lightOrb}
          onPointerLeave={event => {
            event.currentTarget.style.removeProperty('--specular-x');
            event.currentTarget.style.removeProperty('--specular-y');
          }}
          onClick={() => openProject(project)}>
          <span className={styles.projection} aria-hidden="true" />
          <span className={styles.orb} aria-hidden="true"><ProjectMark landmark={project.landmark} /></span>
          <span className={styles.nodeLabel} lang="en" aria-hidden="true">{project.name}</span>
        </button>)}
      </div>
    </div>

    <div className={styles.frame} aria-hidden="true" />

    {activeProject && <section id="works-project" className={styles.panel} data-kind="project" aria-labelledby="works-project-title" key={activeProject.slug}>
      <div className={styles.panelTop}>
        <span>{regions[activeProject.region].label} / <span lang="en">{regions[activeProject.region].name}</span></span>
      </div>
      <h2 id="works-project-title" tabIndex={-1} ref={panelTitle} lang="en">{activeProject.name}</h2>
      <Close label="关闭项目卡片" onClick={closePanel} />
      <p className={styles.meta}><span>{categories[activeProject.category].label}</span><span>{activeProject.status}</span></p>
      <p className={styles.description}>{activeProject.description}</p>
      <ProjectPreview project={activeProject} />
      <div className={styles.links}>{activeProject.links.map(link => link && <a key={link.href} href={link.href}>{link.label}
        <span aria-hidden="true">↗</span>
      </a>)}</div>
    </section>}

    {indexOpen && <section id="works-index" className={styles.panel} data-kind="index" aria-labelledby="works-index-title">
      <h2 id="works-index-title" tabIndex={-1} ref={panelTitle}>项目索引</h2>
      <Close label="关闭项目索引" onClick={closePanel} />
      <ul className={styles.indexList}>{projects.map(project => <li key={project.slug}>
        <button type="button" onClick={() => openProject(project)}>
          <ProjectMark landmark={project.landmark} />
          <span className={styles.indexText}>
            <span><strong lang="en">{project.name}</strong><small>{categories[project.category].label}</small></span>
            <span className={styles.indexDescription}>{project.description}</span>
          </span>
          <span aria-hidden="true">↗</span>
        </button>
      </li>)}</ul>
    </section>}

    <footer className={styles.toolbar}>
      <span className={styles.mapTitle}>作品海图</span>
      <button ref={toggle} className={styles.indexToggle} type="button" disabled={!ready}
        aria-label="项目索引" aria-expanded={indexOpen} aria-controls={indexOpen ? 'works-index' : undefined}
        onClick={() => {
          if (indexOpen) closePanel();
          else {
            nextFocus.current = '#panel';
            setIndexOpen(true);
          }
        }}>
        <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M6 4h9M6 9h9M6 14h9M2 4h1M2 9h1M2 14h1" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        <span lang="en">PROJECT INDEX</span>
      </button>
      <span className={styles.count}>{projects.length} 件作品</span>
    </footer>

    {!ready && <details className={styles.fallback}>
      <summary>项目索引</summary>
      <ul>{projects.map(project => <li key={project.slug}>
        <strong lang="en">{project.name}</strong>
        <span>{categories[project.category].label} · {project.description}</span>
        {project.links.map(link => link && <a key={link.href} href={link.href}>{link.label}</a>)}
      </li>)}</ul>
    </details>}
  </section>;
}
