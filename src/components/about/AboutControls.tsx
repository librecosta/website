import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { m, useMotionValue, useMotionValueEvent, useSpring, useTransform, type MotionValue } from 'motion/react';
import styles from './about-controls.module.css';
import { createSidebarField, sectionOffset, sidebarEase } from './sidebar-field';

const sections = [
  { id: 'opening', label: '序幕' },
  { id: 'studio', label: '创作宣言' },
  { id: 'profile', label: '公司介绍' },
  { id: 'collections', label: '作品索引' },
  { id: 'practice', label: '创作方法' },
  { id: 'closing', label: '联系我们' },
] as const;

type ControlsProps = { progress: MotionValue<number>; reduced: boolean };

// (38px reach + 144px label + 15px gap − 18px resting mark) / 2.
const centerInset = 89.5;

export function AboutLanguage() {
  return <div className={styles.language} role="group" aria-label="页面语言">
    <span lang="zh-CN" aria-current="true" aria-label="中文">中</span>
    <span aria-hidden="true">/</span>
    <button type="button" lang="en" disabled aria-label="English (unavailable)">EN</button>
  </div>;
}

export function AboutSectionNav({ progress, reduced }: ControlsProps) {
  const [active, setActive] = useState(0);
  const [pointed, setPointed] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const nav = useRef<HTMLElement>(null);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const anchors = useRef<(HTMLElement | null)[]>([]);
  const lastPointerY = useRef<number | null>(null);
  const touch = useRef<{ id: number; index: number } | null>(null);
  const labelY = useMotionValue(sectionOffset(0, sections.length, true));
  const [field] = useState(() => createSidebarField(sections.length, (index, line) => {
    const mark = links.current[index]?.firstElementChild as HTMLElement | null;
    if (!mark) return;
    mark.style.opacity = String(line.opacity);
    mark.style.transform = `scaleX(${line.width / 80}) scaleY(${line.scaleY})`;
  }, value => labelY.set(value)));

  const updateActive = useCallback((value: number) => {
    const readingLine = window.innerHeight * .32;
    const index = value >= .999 ? sections.length - 1
      : anchors.current.findLastIndex(anchor => anchor && anchor.getBoundingClientRect().top <= readingLine);
    setActive(Math.max(0, index));
  }, []);

  useMotionValueEvent(progress, 'change', updateActive);
  useEffect(() => {
    anchors.current = sections.map(({ id }) => document.getElementById(id));
    const refresh = () => updateActive(progress.get());
    refresh();
    window.addEventListener('resize', refresh);
    return () => window.removeEventListener('resize', refresh);
  }, [progress, updateActive]);

  useEffect(() => { field.configure(active, reduced); }, [field, active, reduced]);
  useEffect(() => () => field.stop(), [field]);

  const leave = useCallback(() => {
    lastPointerY.current = null;
    setExpanded(false);
    field.leave();
  }, [field]);

  useEffect(() => {
    if (!expanded) return;
    const dismiss = (event: globalThis.PointerEvent) => {
      if (event.target instanceof Node && !nav.current?.contains(event.target)) leave();
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [expanded, leave]);

  function pointAt(index: number) {
    setExpanded(true);
    setPointed(Math.round(index));
    field.move(index);
  }

  function indexAt(clientY: number) {
    const first = links.current[0]?.getBoundingClientRect();
    const last = links.current.at(-1)?.getBoundingClientRect();
    if (!first || !last) return active;
    const index = (clientY - first.top - first.height / 2) / (last.top - first.top) * (sections.length - 1);
    return Math.max(0, Math.min(index, sections.length - 1));
  }

  function movePointer(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === 'touch' && touch.current?.id !== event.pointerId) return;
    if (lastPointerY.current === event.clientY) return;
    lastPointerY.current = event.clientY;
    const index = indexAt(event.clientY);
    if (touch.current) touch.current.index = Math.round(index);
    pointAt(index);
  }

  function goToSection(index: number) {
    const section = anchors.current[index];
    if (!section) return;
    const hash = `#${section.id}`;
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    section.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth' });
    pointAt(index);
  }

  function selectSection(event: MouseEvent<HTMLAnchorElement>, index: number) {
    if (event.nativeEvent instanceof globalThis.PointerEvent && event.nativeEvent.pointerType === 'touch') {
      event.preventDefault();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !anchors.current[index]) return;
    event.preventDefault();
    goToSection(index);
  }

  function navigateKeys(event: KeyboardEvent<HTMLAnchorElement>, index: number) {
    if (event.key === 'Escape') {
      event.preventDefault();
      leave();
      return;
    }
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1
      : event.key === 'ArrowDown' || event.key === 'ArrowRight' ? (index + 1) % sections.length
      : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? (index + sections.length - 1) % sections.length
      : -1;
    if (next !== -1) {
      event.preventDefault();
      links.current[next]?.focus({ preventScroll: true });
    } else if (event.key === ' ') {
      event.preventDefault();
      event.currentTarget.click();
    }
  }

  const poseTransition = { duration: reduced ? 0 : .4, ease: sidebarEase };
  return <nav className={styles.sectionNav} ref={nav} aria-label="ABOUT 章节"
    data-expanded={expanded} onPointerEnter={movePointer} onPointerMove={movePointer}
    onPointerLeave={event => { if (event.pointerType !== 'touch') leave(); }}
    onPointerDown={event => {
      if (event.pointerType !== 'touch' || !event.isPrimary) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const index = Math.round(indexAt(event.clientY));
      touch.current = { id: event.pointerId, index };
      lastPointerY.current = event.clientY;
      pointAt(index);
    }}
    onPointerUp={event => {
      if (touch.current?.id !== event.pointerId) return;
      const { index } = touch.current;
      touch.current = null;
      goToSection(index);
    }}
    onLostPointerCapture={event => {
      if (touch.current?.id !== event.pointerId) return;
      touch.current = null;
      leave();
    }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) leave(); }}>
    <m.div className={styles.sectionRail} initial={false} animate={{ x: expanded ? 0 : -centerInset }} transition={poseTransition}>
      {sections.map(({ id, label }, index) => <m.a key={id} href={`#${id}`} className={styles.sectionMark}
        ref={node => { links.current[index] = node; }} aria-label={label} aria-current={index === active ? 'location' : undefined}
        tabIndex={index === active ? 0 : -1} draggable={false} initial={false} animate={{ y: sectionOffset(index, sections.length, expanded) }}
        transition={poseTransition} onFocus={event => { if (event.currentTarget.matches(':focus-visible')) pointAt(index); }}
        onClick={event => selectSection(event, index)} onKeyDown={event => navigateKeys(event, index)}>
        <span aria-hidden="true" />
      </m.a>)}
      <m.span className={styles.sectionLabel} aria-hidden="true" style={{ y: labelY }} initial={false}
        animate={expanded ? { x: 0, scale: 1, opacity: 1 } : { x: -8, scale: .96, opacity: 0 }}
        transition={reduced ? { duration: 0 } : { duration: .3384615, ease: sidebarEase, opacity: { duration: .2153846 } }}>
        {sections[pointed].label}
      </m.span>
    </m.div>
  </nav>;
}

const gaugeSpring = { stiffness: 300, damping: 36, mass: .6, restDelta: .001, skipInitialAnimation: true };
const scrollSteps: Readonly<Record<string, number | undefined>> = {
  ArrowUp: .025, ArrowDown: -.025, ArrowRight: .025, ArrowLeft: -.025, PageDown: .1, PageUp: -.1,
};

function scrollToProgress(value: number) {
  const root = document.scrollingElement;
  if (!root) return;
  window.scrollTo({ top: Math.max(0, Math.min(value, 1)) * (root.scrollHeight - root.clientHeight), behavior: 'instant' });
}

export function AboutScrollGauge({ progress, reduced }: ControlsProps) {
  const track = useRef<HTMLSpanElement>(null);
  const drag = useRef<AbortController | null>(null);
  const [dragging, setDragging] = useState(false);
  const [percent, setPercent] = useState(0);
  const smooth = useSpring(progress, gaugeSpring);
  const level = useTransform(reduced || dragging ? progress : smooth, value => Math.max(0, Math.min(value, 1)));
  const position = useTransform(level, value => `${value * 100}%`);
  const paint = (value: number) => setPercent(Math.round(value * 100));
  useMotionValueEvent(progress, 'change', paint);
  useEffect(() => setPercent(Math.round(progress.get() * 100)), [progress]);
  useEffect(() => () => drag.current?.abort(), []);

  function scrollAtPointer(clientY: number) {
    const bounds = track.current?.getBoundingClientRect();
    if (bounds?.height) scrollToProgress((bounds.bottom - clientY) / bounds.height);
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0 || drag.current) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    // A grab on the level marker should start from the current page position.
    if (!(event.target instanceof Element && event.target.closest('[data-scroll-level]'))) scrollAtPointer(event.clientY);

    const pointer = event.pointerId;
    const controller = new AbortController();
    drag.current = controller;
    setDragging(true);
    const stop = () => {
      controller.abort();
      drag.current = null;
      smooth.jump(progress.get());
      setDragging(false);
    };
    const options = { signal: controller.signal };
    window.addEventListener('pointermove', move => {
      if (move.pointerId !== pointer) return;
      if (move.buttons === 0) stop();
      else scrollAtPointer(move.clientY);
    }, options);
    window.addEventListener('pointerup', end => { if (end.pointerId === pointer) stop(); }, options);
    window.addEventListener('pointercancel', end => { if (end.pointerId === pointer) stop(); }, options);
    window.addEventListener('blur', stop, options);
  }

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    const step = scrollSteps[event.key];
    if (step === undefined && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    scrollToProgress(event.key === 'Home' ? 0 : event.key === 'End' ? 1 : progress.get() + (step ?? 0));
  }

  return <div className={styles.scrollControl} role="slider" tabIndex={0} aria-orientation="vertical"
    aria-label="页面滚动位置" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${percent}%`}
    data-dragging={dragging} onKeyDown={handleKey} onPointerDown={startDrag}>
    <span ref={track} className={styles.scrollTrack} aria-hidden="true">
      <span className={styles.scrollTicks} />
      <m.span className={styles.scrollFill} style={{ scaleY: level }} />
      <m.span className={styles.scrollPosition} style={{ bottom: position }}>
        <span className={styles.scrollPercent}>{percent}%</span>
        <span className={styles.scrollMarker} data-scroll-level />
      </m.span>
    </span>
  </div>;
}
