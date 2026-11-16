'use client';

import { animate, cancelFrame, frame, useMotionValue, useMotionValueEvent } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent } from 'react';
import { WorkshopFrame } from '../WorkshopFrame';
import {
  arcStep, cardHeight, orbitCount, orbitDuration, orbitEase, orbitFlip, orbitIndex, orbitPose,
  orbitTransform, projectPose, ringSpin, wrapOrbit,
} from './orbit-reel';
import styles from './orbit-reel.module.css';

const cards = Array.from({ length: orbitCount }, (_, index) => ({
  index, number: String(index + 1).padStart(2, '0'), pose: orbitPose(index, 0, 0),
}));
const numberAt = (index: number) => cards[index].number;
const motionPreference = '(prefers-reduced-motion: reduce)';
const prefersReducedMotion = () => window.matchMedia(motionPreference).matches;
const serverMotionPreference = () => false;

function subscribeMotionPreference(update: () => void) {
  const media = window.matchMedia(motionPreference);
  media.addEventListener('change', update);
  return () => media.removeEventListener('change', update);
}

type View = 'ring' | 'arc';
type Playback = ReturnType<typeof animate>;
type Drag = {
  pointer: number;
  x: number;
  y: number;
  centerX: number;
  centerY: number;
  unit: number;
  angle: number;
  position: number;
  time: number;
  velocity: number;
  moved: boolean;
};

function CardGlyph({ index }: { index: number }) {
  return <svg viewBox="0 0 80 80" aria-hidden="true" className={styles.glyph}>
    {[
      <circle key="ring" cx="40" cy="40" r="24" fill="none" stroke="currentColor" strokeWidth="7" />,
      <path key="facets" d="M40 12 68 40 40 68 12 40Z M40 28 28 40 40 52 52 40Z" fill="currentColor" fillRule="evenodd" />,
      <path key="split" d="M14 16H36V64H14ZM44 16H66V64H44Z" fill="currentColor" />,
      <path key="steps" d="M13 64V47H30V31H47V16H66V64Z" fill="currentColor" />,
    ][index % 4]}
  </svg>;
}

export function WorksReel() {
  const reduced = useSyncExternalStore(subscribeMotionPreference, prefersReducedMotion, serverMotionPreference);
  const [view, setView] = useState<View>('ring');
  const [selection, setSelection] = useState(0);
  const [project, setProject] = useState<number | null>(null);
  const [visible, setVisible] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [paused, setPaused] = useState(false);
  const position = useMotionValue(0);
  const mix = useMotionValue(0);
  const detail = useMotionValue(0);
  const cardsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const centerRef = useRef<HTMLDivElement>(null);
  const viewButton = useRef<HTMLButtonElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const projectRef = useRef<number | null>(null);
  const restoreFocus = useRef<HTMLButtonElement | null>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const closing = useRef(false);
  const elapsed = useRef(0);
  const lastSelection = useRef(0);
  const destination = useRef(0);
  const positionPlayback = useRef<Playback | null>(null);
  const viewPlayback = useRef<Playback | null>(null);
  const detailPlayback = useRef<Playback | null>(null);

  const paint = useCallback(() => {
    const slot = position.get();
    const blend = mix.get();
    const progress = detail.get();
    const openProject = projectRef.current;
    const selected = orbitIndex(slot);
    if (selected !== lastSelection.current) {
      lastSelection.current = selected;
      setSelection(selected);
    }
    cardsRef.current.forEach((button, index) => {
      if (!button) return;
      const base = orbitPose(index, slot, blend);
      const chosen = openProject === index;
      const pose = openProject === null ? base : projectPose(base, progress, chosen);
      const available = openProject === null && pose.opacity > .12;
      const flipAngle = wrapOrbit(orbitFlip(elapsed.current, pose.distance), 360) * (1 - blend) * (chosen ? 1 - orbitEase(progress / .55) : 1);
      button.style.transform = `${orbitTransform(pose)} rotateY(${flipAngle.toFixed(2)}deg)`;
      button.style.opacity = pose.opacity.toFixed(3);
      button.style.zIndex = String(pose.depth);
      button.style.visibility = pose.opacity > .005 ? 'visible' : 'hidden';
      button.tabIndex = available && index === selected ? 0 : -1;
      button.toggleAttribute('data-selected', index === selected);
      button.toggleAttribute('inert', !available);
    });
  }, [position, mix, detail]);

  const schedulePaint = useCallback(() => frame.render(paint), [paint]);
  useMotionValueEvent(position, 'change', schedulePaint);
  useMotionValueEvent(mix, 'change', schedulePaint);
  useMotionValueEvent(detail, 'change', schedulePaint);

  useLayoutEffect(() => {
    paint();
    return () => cancelFrame(paint);
  }, [paint]);

  useEffect(() => {
    function onVisibility() {
      const shown = !document.hidden;
      setVisible(shown);
      if (!shown && drag.current) {
        drag.current = null;
        suppressClick.current = true;
        setDragging(false);
      }
      for (const playback of [positionPlayback.current, viewPlayback.current, detailPlayback.current]) {
        if (shown && playback?.state === 'paused') playback.play();
        if (!shown && playback?.state === 'running') playback.pause();
      }
    }
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      positionPlayback.current?.stop();
      viewPlayback.current?.stop();
      detailPlayback.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!visible || reduced || paused || view !== 'ring' || hovered || focused || dragging || project !== null) return;
    function spin({ delta }: { delta: number }) {
      if (document.hidden || drag.current || projectRef.current !== null || positionPlayback.current?.state === 'running') return;
      const seconds = Math.min(delta, 50) / 1000;
      elapsed.current += seconds;
      position.set(position.get() - ringSpin * seconds);
    }
    frame.update(spin, true);
    return () => cancelFrame(spin);
  }, [dragging, focused, hovered, paused, position, project, reduced, view, visible]);

  useEffect(() => {
    if (!reduced) return;
    elapsed.current = 0;
    for (const playback of [positionPlayback.current, viewPlayback.current, detailPlayback.current]) {
      if (playback?.state === 'running' || playback?.state === 'paused') playback.complete();
    }
    schedulePaint();
  }, [reduced, schedulePaint]);

  useLayoutEffect(() => {
    if (project !== null) backButton.current?.focus({ preventScroll: true });
    else if (restoreFocus.current) {
      paint();
      restoreFocus.current.focus({ preventScroll: true });
      restoreFocus.current = null;
    }
  }, [paint, project]);

  function goTo(target: number, focusCard = false) {
    destination.current = target;
    positionPlayback.current?.stop();
    function onComplete() {
      if (!focusCard) return;
      paint();
      cardsRef.current[orbitIndex(target)]?.focus({ preventScroll: true });
    }
    positionPlayback.current = animate(position, target, { duration: reduced ? 0 : orbitDuration, ease: orbitEase, onComplete });
  }

  function currentSlot() {
    return positionPlayback.current?.state === 'running' ? destination.current : Math.round(position.get());
  }

  function setMode(next: View) {
    viewPlayback.current?.stop();
    elapsed.current = 0;
    setView(next);
    goTo(Math.round(position.get()));
    viewPlayback.current = animate(mix, next === 'arc' ? 1 : 0, { duration: reduced ? 0 : orbitDuration, ease: orbitEase });
    schedulePaint();
  }

  function showProject(index: number, origin: HTMLButtonElement) {
    positionPlayback.current?.stop();
    viewPlayback.current?.stop();
    restoreFocus.current = origin;
    projectRef.current = index;
    setProject(index);
    detailPlayback.current = animate(detail, 1, { duration: reduced ? 0 : orbitDuration, ease: 'linear' });
    schedulePaint();
  }

  function closeProject() {
    if (closing.current) return;
    closing.current = true;
    detailPlayback.current?.stop();
    detailPlayback.current = animate(detail, 0, {
      duration: reduced ? 0 : orbitDuration * detail.get(), ease: 'linear',
      onComplete() {
        closing.current = false;
        projectRef.current = null;
        setProject(null);
        viewPlayback.current = animate(mix, view === 'arc' ? 1 : 0, { duration: reduced ? 0 : orbitDuration, ease: orbitEase });
        schedulePaint();
      },
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const fromCard = (event.target as HTMLElement).closest('[data-reel-card]') !== null;
    if (event.key === 'Escape') {
      if (project !== null) closeProject();
      else if (view === 'arc') {
        setMode('ring');
        viewButton.current?.focus({ preventScroll: true });
      }
      else return;
    } else if (project === null && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      const slot = currentSlot();
      const first = slot - orbitIndex(slot);
      const target = { ArrowLeft: slot - 1, ArrowRight: slot + 1, Home: first, End: first + orbitCount - 1 }[event.key];
      goTo(target!, fromCard);
    } else return;
    event.preventDefault();
  }

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (projectRef.current !== null || drag.current || !event.isPrimary || event.button !== 0) return;
    if ((event.target as HTMLElement).closest('[data-reel-control]')) return;
    const center = centerRef.current?.getBoundingClientRect();
    const card = cardsRef.current[0];
    if (!center || !card) return;
    suppressClick.current = false;
    positionPlayback.current?.stop();
    drag.current = {
      pointer: event.pointerId, x: event.clientX, y: event.clientY, centerX: center.x, centerY: center.y,
      unit: card.offsetHeight / cardHeight, angle: Math.atan2(event.clientX - center.x, center.y - event.clientY),
      position: position.get(), time: event.timeStamp, velocity: 0, moved: false,
    };
    setDragging(true);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    if (!active.moved) {
      if (Math.hypot(dx, dy) < 5) return;
      active.moved = true;
      suppressClick.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const angle = Math.atan2(event.clientX - active.centerX, active.centerY - event.clientY);
    const target = view === 'ring' ? position.get() - wrapOrbit(angle - active.angle, 2 * Math.PI) * orbitCount / (2 * Math.PI)
      : active.position - dx / (arcStep * active.unit);
    const seconds = (event.timeStamp - active.time) / 1000;
    if (seconds > 0) active.velocity = (target - position.get()) / seconds;
    active.time = event.timeStamp;
    active.angle = angle;
    position.set(target);
  }

  function endDrag(event: PointerEvent<HTMLElement>) {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(active.pointer)) event.currentTarget.releasePointerCapture(active.pointer);
    // A stationary pointer can leave the stage before releasing.
    setDragging(false);
    if (!active.moved) return;
    const fling = event.type === 'pointerup' && event.timeStamp - active.time < 95 ? active.velocity * .14 : 0;
    goTo(Math.round(position.get() + Math.max(-2.2, Math.min(2.2, fling))));
  }

  return <WorkshopFrame route="/works" reduced={reduced}>
    <main className={styles.stage} aria-label="作品档案轮盘" data-reel-view={view} data-project={project !== null ? numberAt(project) : undefined}
      onKeyDown={onKeyDown}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
      onLostPointerCapture={(event) => { if (event.target === event.currentTarget) endDrag(event); }}
      onPointerOver={(event) => {
        if (event.pointerType !== 'touch' && (event.target as HTMLElement).closest('button')) setHovered(true);
      }}
      onPointerOut={(event) => {
        if (!(event.relatedTarget instanceof Element && event.relatedTarget.closest('button'))) setHovered(false);
      }}
      onPointerLeave={(event) => {
        setHovered(false);
        if (!drag.current?.moved) endDrag(event);
      }}>
      <h1 className={styles.srOnly}>WORKS</h1>
      <div ref={centerRef} className={styles.center} aria-hidden="true" />
      {cards.map(({ index, number, pose }) => <button
        key={number} ref={(element) => { cardsRef.current[index] = element; }}
        type="button" className={styles.card} data-reel-card={number} aria-label={`打开档案 ${number}`}
        tabIndex={index === 0 ? 0 : -1}
        style={{ transform: orbitTransform(pose), zIndex: pose.depth }}
        onClick={(event) => {
          if (event.detail === 0 || !suppressClick.current) showProject(index, event.currentTarget);
        }}>
        <span className={styles.face}><span className={styles.number}>{number}</span><CardGlyph index={index} /></span>
        <span className={`${styles.face} ${styles.reverse}`} aria-hidden="true"><span className={styles.number}>{number}</span><CardGlyph index={index} /></span>
      </button>)}
      {project === null && <>
        <button type="button" className={`${styles.control} ${styles.mode}`} data-reel-control
          ref={viewButton} onClick={() => setMode(view === 'ring' ? 'arc' : 'ring')}>
          {view === 'ring' ? '展开浏览' : '返回总览'}
        </button>
        {view === 'arc' && <div className={styles.pager} aria-label="档案切换">
          <button className={styles.control} data-reel-control type="button" aria-label="上一张档案" onClick={() => goTo(currentSlot() - 1)}><span aria-hidden="true">‹</span></button>
          <output aria-live="polite">{numberAt(selection)} / {orbitCount}</output>
          <button className={styles.control} data-reel-control type="button" aria-label="下一张档案" onClick={() => goTo(currentSlot() + 1)}><span aria-hidden="true">›</span></button>
        </div>}
        {!reduced && view === 'ring' && <button type="button" className={`${styles.control} ${styles.pause}`} data-reel-control
          aria-label={paused ? '继续自动旋转' : '暂停自动旋转'} aria-pressed={paused} onClick={() => setPaused(!paused)}>
          {paused ? <svg viewBox="0 0 12 12" aria-hidden="true"><path d="m4 2 6 4-6 4Z" fill="currentColor" /></svg>
            : <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2v8m4-8v8" stroke="currentColor" strokeWidth="1.4" /></svg>}
        </button>}
      </>}
      {project !== null && <section className={styles.detail} aria-label={`档案 ${numberAt(project)}`}>
        <button ref={backButton} className={`${styles.control} ${styles.mode}`} data-reel-control type="button" onClick={closeProject}>返回轮盘</button>
      </section>}
    </main>
  </WorkshopFrame>;
}
