import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { animate, m, useInView, useMotionValue, useMotionValueEvent, useScroll, useTransform } from 'motion/react';
import { useEnglish } from '@/site/LocaleProvider';
import { englishAbout } from './copy';
import { captureLiquidFrame, createLiquidRenderer, drawLiquidFace, measureLiquidCard, type LiquidDirection } from './practice-liquid';
import styles from './practice.module.css';

const chinesePrinciples = [
  {
    title: '实用优先', art: '/about/practice/useful-first.svg', tint: 'rgba(38, 46, 56, .52)',
  },
  {
    title: '体验优先', art: '/about/practice/experience-first.svg', tint: 'rgba(20, 26, 36, .52)',
  },
  {
    title: '长期主义', art: '/about/practice/built-to-last.svg', tint: 'rgba(38, 46, 56, .52)',
  },
] as const;
const practiceCopy = englishAbout.practice;
const englishPrinciples = chinesePrinciples.map((principle, index) => ({ ...principle, title: practiceCopy.titles[index] }));
const autoplaySeconds = 3;
const transitionSeconds = 1.6;

export function PracticeSection({ reduced }: { reduced: boolean }) {
  const english = useEnglish();
  const principles = english ? englishPrinciples : chinesePrinciples;
  const section = useRef<HTMLElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const carousel = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const images = useRef<(HTMLImageElement | null)[]>([]);
  const pages = useRef<(HTMLButtonElement | null)[]>([]);
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const activeIndex = useRef(0);
  const [selected, setSelected] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const inView = useInView(carousel, { amount: .45 });
  const frame = useRef<{ direction: LiquidDirection } | null>(null);
  const renderer = useRef<ReturnType<typeof createLiquidRenderer>>(null);
  const snapshot = useRef<HTMLCanvasElement | null>(null);
  const faces = useRef<HTMLCanvasElement[]>([]);
  const playback = useRef<ReturnType<typeof animate> | null>(null);
  const liquidProgress = useMotionValue(1);
  const pageProgress = useMotionValue(1);
  const countingDown = useRef(false);
  const { scrollYProgress } = useScroll({ target: section, offset: ['start end', 'end start'] });
  const { scrollYProgress: copyEntrance } = useScroll({ target: copy, offset: ['start 88%', 'start 47%'] });
  const copyY = useTransform(scrollYProgress, [0, .3, .72, 1], [26, 0, 0, -24]);
  const titleY = useTransform(copyEntrance, [.03, .7], ['108%', '0%']);
  const introY = useTransform(copyEntrance, [.27, 1], [18, 0]);
  const introOpacity = useTransform(copyEntrance, [.27, .94], [0, 1]);
  const cardY = useTransform(scrollYProgress, [0, .35, .7, 1], [34, 0, 0, -27]);
  const current = principles[selected];
  const number = `0${selected + 1}`;

  useMotionValueEvent(liquidProgress, 'change', progress => {
    const active = frame.current;
    if (!countingDown.current) pageProgress.set(progress);
    if (active && progress > 0) renderer.current?.draw(progress, active.direction);
  });

  useEffect(() => {
    const element = card.current;
    const buffer = canvas.current;
    const settle = () => {
      frame.current = null;
      playback.current?.stop();
      playback.current = null;
      snapshot.current = null;
      element?.removeAttribute('data-moving');
    };
    const lost = () => {
      settle();
      renderer.current = null;
      liquidProgress.jump(1);
    };
    buffer?.addEventListener('webglcontextlost', lost);
    return () => {
      buffer?.removeEventListener('webglcontextlost', lost);
      settle();
    };
  }, [liquidProgress, reduced]);

  useEffect(() => () => {
    renderer.current?.dispose();
    renderer.current = null;
  }, []);

  const startLiquid = useCallback((next: number, direction: LiquidDirection) => {
    const interrupted = frame.current !== null;
    frame.current = null;
    playback.current?.stop();
    playback.current = null;
    const surface = card.current;
    const buffer = canvas.current;
    const previous = images.current[activeIndex.current];
    const incoming = images.current[next];
    const effect = !reduced && buffer && (renderer.current ??= createLiquidRenderer(buffer));
    if (!surface || !buffer || !effect || !buffer.clientWidth || !buffer.clientHeight
      || !previous?.naturalWidth || !incoming?.naturalWidth) {
      snapshot.current = null;
      liquidProgress.jump(1);
      surface?.removeAttribute('data-moving');
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.round(buffer.clientWidth * dpr);
    const height = Math.round(buffer.clientHeight * dpr);
    const layout = measureLiquidCard(surface);
    const paint = (texture: HTMLCanvasElement, index: number, image: HTMLImageElement) => {
      const { tint, title } = principles[index];
      return drawLiquidFace(texture, layout, { tint, title, number: `0${index + 1}`, image }, width, height);
    };
    let from = faces.current[0] ??= document.createElement('canvas');
    const to = faces.current[1] ??= document.createElement('canvas');
    if (!paint(to, next, incoming)) {
      surface.removeAttribute('data-moving');
      return;
    }
    if (interrupted) {
      // Retarget from the full visible composite, including the two card tints.
      const saved = snapshot.current ??= document.createElement('canvas');
      if (captureLiquidFrame(buffer, saved)) from = saved;
    }
    if (from !== snapshot.current && !paint(from, activeIndex.current, previous)) {
      surface.removeAttribute('data-moving');
      return;
    }
    const keepVisibleFrame = from === snapshot.current && buffer.width === width && buffer.height === height;
    if (buffer.width !== width) buffer.width = width;
    if (buffer.height !== height) buffer.height = height;
    const nextFrame = { direction };
    effect.prepare(from, to);
    liquidProgress.jump(0);
    frame.current = nextFrame;
    if (!keepVisibleFrame) effect.draw(0, direction);
    surface.dataset.moving = 'true';
    playback.current = animate(liquidProgress, 1, {
      duration: transitionSeconds,
      ease: 'linear',
      onComplete: () => {
        if (frame.current !== nextFrame) return;
        frame.current = null;
        playback.current = null;
        snapshot.current = null;
        surface.removeAttribute('data-moving');
      },
    });
  }, [liquidProgress, principles, reduced]);

  const select = useCallback((index: number, direction?: LiquidDirection) => {
    const next = (index + principles.length) % principles.length;
    if (next === activeIndex.current) return;
    const toward = direction ?? (next > activeIndex.current ? 1 : -1);
    startLiquid(next, toward);
    activeIndex.current = next;
    setSelected(next);
  }, [principles.length, startLiquid]);

  useEffect(() => {
    if (reduced || !inView || !autoplay || hovered || keyboardFocused) {
      pageProgress.jump(frame.current ? liquidProgress.get() : 1);
      return;
    }
    let countdown: ReturnType<typeof animate> | undefined;
    const schedule = () => {
      countdown?.stop();
      countingDown.current = !document.hidden;
      if (document.hidden) return;
      pageProgress.jump(0);
      countdown = animate(pageProgress, 1, {
        duration: autoplaySeconds,
        ease: 'linear',
        onComplete: () => {
          if (!document.hidden && !pointer.current) select(activeIndex.current + 1, 1);
          else schedule();
        },
      });
    };
    schedule();
    document.addEventListener('visibilitychange', schedule);
    return () => {
      countdown?.stop();
      countingDown.current = false;
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [autoplay, hovered, inView, keyboardFocused, liquidProgress, pageProgress, reduced, select, selected]);

  function keySelect(event: KeyboardEvent<HTMLElement>) {
    const { key, target } = event;
    if (key !== 'ArrowRight' && key !== 'ArrowLeft' && key !== 'Home' && key !== 'End') return;
    event.preventDefault();
    const direction = key === 'ArrowRight' || key === 'End' ? 1 : -1;
    const next = key === 'Home' ? 0 : key === 'End' ? principles.length - 1 : activeIndex.current + direction;
    select(next, direction);
    if (target instanceof HTMLElement && target.dataset.practicePage !== undefined) {
      pages.current[(next + principles.length) % principles.length]?.focus({ preventScroll: true });
    }
  }

  function beginSwipe(event: PointerEvent<HTMLElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function endSwipe(event: PointerEvent<HTMLElement>) {
    const start = pointer.current;
    if (start?.id !== event.pointerId) return;
    pointer.current = null;
    const x = event.clientX - start.x;
    const y = event.clientY - start.y;
    if (Math.abs(x) <= 24 || Math.abs(x) <= Math.abs(y) * 1.3) return;
    const direction = x < 0 ? 1 : -1;
    select(activeIndex.current + direction, direction);
  }

  return <section id="practice" ref={section} className={styles.practice} aria-labelledby="practice-title">
    <m.div ref={copy} className={styles.copy} style={reduced ? undefined : { y: copyY }} data-about-motion>
      <h2 id="practice-title" className={styles.title} lang="en">
        <m.span style={reduced ? undefined : { y: titleY }} data-about-motion>HOW WE BUILD</m.span>
      </h2>
      <m.p className={styles.intro} style={reduced ? undefined : { y: introY, opacity: introOpacity }} data-about-motion>
        {english ? practiceCopy.intro : '我们关心的不只是做出功能，更是它为何存在、如何被使用，以及能否经得起时间。'}
      </m.p>
    </m.div>
    <m.div className={styles.carousel} ref={carousel} role="group" aria-label={english ? practiceCopy.carousel : '建造原则轮播'} onKeyDown={keySelect}
      style={reduced ? undefined : { y: cardY }} data-about-motion
      onPointerEnter={event => { if (event.pointerType === 'mouse') setHovered(true); }}
      onPointerLeave={event => { if (event.pointerType === 'mouse') setHovered(false); }}
      onFocusCapture={event => setKeyboardFocused(event.target.matches(':focus-visible'))}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setKeyboardFocused(false);
      }}>
      <article id="practice-card" className={styles.card} ref={card} aria-labelledby="practice-card-title" tabIndex={0}
        style={{ '--card-tint': current.tint } as CSSProperties}
        onPointerDown={beginSwipe} onPointerUp={endSwipe} onLostPointerCapture={() => { pointer.current = null; }}>
        <div className={styles.tint} aria-hidden="true" />
        <div className={styles.cardHeader}>
          <span data-liquid-part>{number}</span>
          <span className={styles.cardRules} aria-hidden="true"><span data-liquid-part /><span data-liquid-part /></span>
        </div>
        <div className={styles.artwork} data-liquid-part aria-hidden="true">
          {principles.map(({ art }, index) => <img key={art} src={art} alt="" width={320} height={240} draggable={false}
            data-current={index === selected ? '' : undefined} ref={element => { images.current[index] = element; }} />)}
        </div>
        <div className={styles.caption} aria-live={autoplay && !reduced && !keyboardFocused ? 'off' : 'polite'} aria-atomic="true">
          <p id="practice-card-title" className={styles.cardTitle} data-liquid-part>{current.title}</p>
        </div>
        <canvas className={styles.liquidCanvas} ref={canvas} aria-hidden="true" />
      </article>
      <div className={styles.controls} role="group" aria-label={english ? practiceCopy.pagination : '选择原则'}>
        <button className={styles.arrow} type="button" aria-label={english ? practiceCopy.previous : '上一条原则'} aria-controls="practice-card"
          onClick={() => select(activeIndex.current - 1, -1)}><Chevron previous /></button>
        {principles.map(({ title }, index) => <button className={styles.page} key={title} type="button"
          ref={element => { pages.current[index] = element; }} data-practice-page={index}
          aria-label={title} aria-pressed={index === selected} aria-controls="practice-card"
          onClick={() => select(index)}>
          <span className={styles.pageTrack} aria-hidden="true">
            <m.span className={styles.pageFill} style={{ scaleX: index === selected ? pageProgress : 0 }} />
          </span>
        </button>)}
        <button className={styles.arrow} type="button" aria-label={english ? practiceCopy.next : '下一条原则'} aria-controls="practice-card"
          onClick={() => select(activeIndex.current + 1, 1)}><Chevron /></button>
        {!reduced && <button className={styles.arrow} type="button" aria-label={english ? (autoplay ? practiceCopy.pause : practiceCopy.resume) : (autoplay ? '暂停自动轮播' : '继续自动轮播')}
          aria-controls="practice-card" onClick={() => setAutoplay(value => !value)}>
          <svg viewBox="0 0 18 18" aria-hidden="true" fill="none">
            <path d={autoplay ? 'M7 5v8m4-8v8' : 'm7 5 6 4-6 4Z'} />
          </svg>
        </button>}
      </div>
    </m.div>
  </section>;
}

function Chevron({ previous = false }: { previous?: boolean }) {
  return <svg viewBox="0 0 18 18" aria-hidden="true" fill="none">
    <path d={previous ? 'm11 4-5 5 5 5' : 'm7 4 5 5-5 5'} />
  </svg>;
}
