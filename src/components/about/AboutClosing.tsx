import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FocusEvent, type PointerEvent, type RefObject } from 'react';
import { AnimatePresence, animate, m, useInView, useMotionValue, useSpring } from 'motion/react';
import { localePath } from '@/site/locale-contract';
import { useSiteCopy, useSiteLocale } from '@/site/LocaleProvider';
import { useSoftFocus } from '../soft-focus';
import styles from './about-closing.module.css';

const links = [
  { label: 'WORKS', href: '/works', image: '/about/closing/works-world.webp', aspect: 720 / 450, width: 252 },
  { label: 'GOPHERATLAS', href: 'https://gopheratlas.com/', image: '/about/gopheratlas-og.png', aspect: 1200 / 630, width: 252 },
  { label: 'GITHUB', href: 'https://github.com/librecosta', image: '/about/closing/librecosta-github.webp', aspect: 1, width: 160 },
] as const;

const previewEase = [.2, .8, .2, 1] as const;
const previewSpring = { stiffness: 280, damping: 34, mass: .65 };

export function AboutClosing({ reduced }: { reduced: boolean }) {
  const { locale, defaultLocale } = useSiteLocale();
  const text = useSiteCopy().about.closing;
  const copy = useRef<HTMLDivElement>(null);
  const inView = useInView(copy, { amount: .3 });
  const clock = useMotionValue(0);
  const title = useSoftFocus(clock, 0, .72, 8, 13);
  const intro = useSoftFocus(clock, .15, .61, 5, 9);
  const contact = useSoftFocus(clock, .31, .6, 4, 8);

  useEffect(() => {
    if (reduced) return;
    const playback = animate(clock, inView ? 1 : 0, {
      duration: inView ? .95 : .24,
      ease: 'linear',
    });
    return () => playback.stop();
  }, [clock, inView, reduced]);

  return <section className={styles.closing} id="closing" aria-labelledby="closing-title">
    <div className={styles.copy} ref={copy}>
      <m.h2 id="closing-title" className={styles.title} lang="en" style={reduced ? undefined : title} data-closing-reveal>LET’S TALK.</m.h2>
      <m.p className={styles.intro} style={reduced ? undefined : intro} data-closing-reveal>{text.intro}</m.p>
      <m.div className={styles.contact} style={reduced ? undefined : contact} data-closing-reveal>
        <Link href={localePath('/contact', locale, defaultLocale)} prefetch={false}>{text.contact}
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
            <path d="M2 8h11M8 3l5 5-5 5" />
          </svg>
        </Link>
      </m.div>
    </div>
    <ClosingLinks copy={copy} reduced={reduced} />
  </section>;
}

type Target = { index: number; link: HTMLAnchorElement; point?: { x: number; y: number } };

// Adapt the Hover Preview planner to viewport coordinates. Keep the full
// rotated rectangle clear of the text and the fixed instrument.
function planPreview(target: Target, row: DOMRect, copy: DOMRect, width: number, height: number) {
  const link = target.link.getBoundingClientRect();
  if (link.bottom <= 0 || link.top >= height) return null;
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const x = target.point ? clamp((target.point.x - link.left) / link.width * 2 - 1, -1, 1) : 0;
  const y = target.point ? clamp((target.point.y - link.top) / link.height * 2 - 1, -1, 1) : 0;
  const angle = x * 4;
  const radians = angle * Math.PI / 180;
  const asset = links[target.index];
  const { aspect } = asset;
  const boundWidth = Math.cos(radians) + Math.abs(Math.sin(radians)) / aspect;
  const boundHeight = Math.abs(Math.sin(radians)) + Math.cos(radians) / aspect;
  const gutter = 16;
  const top = Math.min(90, .138 * height);
  const bottom = height - Math.min(106, .18 * height);
  const lowerEdge = Math.max(top, row.bottom + gutter);
  const upperEdge = Math.min(bottom, copy.top - gutter);
  const below = bottom - lowerEdge;
  const above = upperEdge - top;
  const preferredWidth = Math.min(asset.width, width * .63);
  const useBelow = below >= preferredWidth * boundHeight * .84 || below >= above;
  const previewWidth = Math.min(preferredWidth, (width - gutter * 2) / boundWidth, (useBelow ? below : above) / boundHeight);
  if (previewWidth < 52) return null;

  const halfWidth = previewWidth * boundWidth / 2;
  const halfHeight = previewWidth * boundHeight / 2;
  const center = link.left + link.width / 2 + x * 12;
  return {
    width: previewWidth, height: previewWidth / aspect, angle,
    x: clamp(center, gutter + halfWidth, width - gutter - halfWidth),
    y: useBelow
      ? clamp(lowerEdge + halfHeight + Math.max(y, 0) * 10, lowerEdge + halfHeight, bottom - halfHeight)
      : clamp(upperEdge - halfHeight + Math.min(y, 0) * 10, top + halfHeight, upperEdge - halfHeight),
  };
}

function ClosingLinks({ copy, reduced }: { copy: RefObject<HTMLDivElement | null>; reduced: boolean }) {
  const { locale, defaultLocale } = useSiteLocale();
  const { about, shared } = useSiteCopy();
  const row = useRef<HTMLElement>(null);
  const hovered = useRef<Target | null>(null);
  const focused = useRef<Target | null>(null);
  const active = useRef<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const x = useSpring(0, previewSpring);
  const y = useSpring(0, previewSpring);
  const rotate = useSpring(0, previewSpring);
  const width = useMotionValue(0);
  const height = useMotionValue(0);

  const show = useCallback((target: Target | null, snap = false) => {
    const plan = target && row.current && copy.current && planPreview(reduced ? { ...target, point: undefined } : target,
      row.current.getBoundingClientRect(), copy.current.getBoundingClientRect(), window.innerWidth, window.innerHeight);
    if (!plan || !target) {
      active.current = null;
      setPreview(null);
      return;
    }
    const jump = snap || reduced || active.current === null;
    // Snap if the preview has to move to the other side of the content.
    const navTop = row.current?.getBoundingClientRect().top ?? 0;
    const changedSide = (plan.y < navTop) !== (y.get() < navTop);
    const update = jump || changedSide ? 'jump' : 'set';
    x[update](plan.x);
    y[update](plan.y);
    rotate[update](plan.angle);
    width.set(plan.width);
    height.set(plan.height);
    if (active.current !== target.index) {
      active.current = target.index;
      setPreview(target.index);
    }
  }, [copy, height, reduced, rotate, width, x, y]);

  useEffect(() => {
    if (preview === null) return;
    const resize = () => show(hovered.current ?? focused.current, true);
    const scroll = () => {
      hovered.current = null;
      show(focused.current, true);
    };
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', scroll, { passive: true });
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', scroll);
    };
  }, [preview, show]);

  function point(event: PointerEvent<HTMLAnchorElement>, index: number) {
    return { index, link: event.currentTarget, point: { x: event.clientX, y: event.clientY } };
  }

  return <nav className={styles.links} ref={row} aria-label={about.closing.links}
    onKeyDown={event => {
      if (event.key !== 'Escape') return;
      hovered.current = focused.current = null;
      show(null);
    }}>
    {links.map(({ label, href }, index) => {
      const handlers = {
        onPointerEnter(event: PointerEvent<HTMLAnchorElement>) {
          if (event.pointerType !== 'touch') show(hovered.current = point(event, index));
        },
        onPointerMove(event: PointerEvent<HTMLAnchorElement>) {
          if (!reduced && hovered.current?.index === index && event.pointerType !== 'touch') {
            show(hovered.current = point(event, index));
          }
        },
        onPointerLeave() {
          hovered.current = null;
          show(focused.current);
        },
        onFocus(event: FocusEvent<HTMLAnchorElement>) {
          if (event.currentTarget.matches(':focus-visible')) show(focused.current = { index, link: event.currentTarget });
        },
        onBlur() {
          focused.current = null;
          show(hovered.current);
        },
      };
      return href === '/works'
        ? <Link key={href} href={localePath(href, locale, defaultLocale)} prefetch={false} {...handlers}>{about.closing.works}</Link>
        : <a key={href} href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label}${shared.newTab}`} {...handlers}>{label}</a>;
    })}
    <m.div className={styles.previewPosition} style={{ x, y, rotate, width, height }} aria-hidden="true">
      <AnimatePresence>
        {preview !== null && <m.div className={styles.preview}
          initial={reduced ? false : { opacity: 0, scale: .94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: .94, transition: { duration: .15, ease: previewEase } }}
          transition={{ duration: reduced ? 0 : .2, ease: previewEase }}>
          <img src={links[preview].image} alt="" draggable={false} />
        </m.div>}
      </AnimatePresence>
    </m.div>
  </nav>;
}
