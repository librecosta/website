import Link from 'next/link';
import { useEffect, useRef, type ComponentPropsWithoutRef, type ReactNode, type RefObject } from 'react';
import type { Camera } from 'three';
import { useSiteAudio } from '@/components/audio/AudioProvider';
import { ExpanseSoundToggle } from './ExpanseAudio';
import { EncryptedLabel, useEncryptedText } from './EncryptedText';
import styles from './expanse.module.css';

// Hand-drawn centerlines. The short diagonal cuts are shared across the wordmark.
const techGlyphs = [
  [0, 'M2 2V16L5 19H12'], // L
  [16, 'M2 2H9M5.5 2V19M2 19H9'], // I
  [29, 'M2 19V2H10.5L13 4.5V7.5L10.5 10H2M10.5 10L13.5 13V16L10.5 19H2'], // B
  [47, 'M2 19V2H11L14 5V8L11 11H2M9 11L14 19'], // R
  [65, 'M12 2H5L2 5V16L5 19H12M2 10.5H10'], // E
  [82, 'M13.5 4L11.5 2H5L2 5V16L5 19H11.5L13.5 17'], // C
  [100, 'M5 2H11L14 5V16L11 19H5L2 16V5Z'], // O
  [119, 'M13 2H5L2 5V8L4.5 10.5H10.5L13 13V16L10 19H2'], // S
  [137, 'M1.5 2H14M7.75 2V19'], // T
  [154, 'M2 19V8L6 2H10L14 8V19M2 12H14'], // A
] as const;

const pixelGlyphs = [
  ['10000', '10000', '10000', '10000', '10000', '10000', '11111'], // L
  ['11111', '00100', '00100', '00100', '00100', '00100', '11111'], // I
  ['11110', '10001', '10001', '11110', '10001', '10001', '11110'], // B
  ['11110', '10001', '10001', '11110', '10100', '10010', '10001'], // R
  ['11111', '10000', '10000', '11110', '10000', '10000', '11111'], // E
  ['01111', '10000', '10000', '10000', '10000', '10000', '01111'], // C
  ['01110', '10001', '10001', '10001', '10001', '10001', '01110'], // O
  ['01111', '10000', '10000', '01110', '00001', '00001', '11110'], // S
  ['11111', '00100', '00100', '00100', '00100', '00100', '00100'], // T
  ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], // A
];

const pixelPath = pixelGlyphs.map((glyph, i) => glyph.map((row, y) =>
  Array.from(row.matchAll(/1+/g), ({ 0: run, index }) =>
    `M${i * 6 + (i >= 5 ? 1 : 0) + index} ${y + 1}h${run.length}v1h-${run.length}Z`).join(' '),
).join(' ')).join(' ');

function Wordmark({ pixel = false, noise }: { pixel?: boolean; noise?: string[] | null }) {
  return pixel ? <svg viewBox="0 0 61 9" aria-hidden="true" fill="currentColor">
    <path d={pixelPath} />
  </svg> : <svg viewBox="0 0 171 22" aria-hidden="true" fill="none" stroke="currentColor"
    strokeWidth="2.45" strokeLinejoin="bevel" strokeLinecap="square">
    {techGlyphs.map(([x, path], index) => noise?.[index]
      ? <text key={x} x={x + 8} y="17" className={styles.wordmarkNoise}>{noise[index]}</text>
      : <path key={x} d={path} transform={`translate(${x})`} />)}
  </svg>;
}

const corners = [styles.topLeft, styles.topRight, styles.bottomLeft, styles.bottomRight];

function InstrumentLink({ href, text, reduced, external = false, current = false }: {
  href: string; text: string; reduced: boolean; external?: boolean; current?: boolean;
}) {
  const { cue } = useSiteAudio();
  const { play, noise } = useEncryptedText(text, reduced);
  const props: ComponentPropsWithoutRef<'a'> = {
    lang: 'en',
    'aria-label': external ? `${text} (opens in a new tab)` : text,
    'aria-current': current ? 'page' : undefined,
    onPointerEnter: event => {
      if (event.pointerType === 'mouse') {
        cue('hover');
        play();
      }
    },
    onFocus: event => { if (event.currentTarget.matches(':focus-visible')) play(); },
    onClick: () => cue('click'),
  };
  const label = <EncryptedLabel text={text} noise={noise} />;
  return external
    ? <a {...props} href={href} target="_blank" rel="noopener noreferrer">{label}</a>
    : <Link {...props} href={href} prefetch={false}>{label}</Link>;
}

export function WordmarkStudy() {
  return <details className={styles.wordmarkStudy}>
    <summary>字标对照</summary>
    <dl className={styles.wordmarkSamples} lang="en">
      <div><dt>Tech Precision</dt><dd><Wordmark /></dd></div>
      <div><dt>Pixel Modular</dt><dd><Wordmark pixel /></dd></div>
    </dl>
  </details>;
}

const coordinateFormat = new Intl.NumberFormat('en', {
  minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero', useGrouping: false,
});

function ObservationReadout({ cameraRef }: { cameraRef: RefObject<Camera | null> }) {
  const time = useRef<HTMLElement>(null);
  const position = useRef<HTMLElement>(null);
  useEffect(() => {
    const started = performance.now();
    const update = () => {
      if (document.hidden) return;
      const elapsed = Math.floor((performance.now() - started) / 1000);
      const clock = [Math.floor(elapsed / 3600), Math.floor(elapsed / 60) % 60, elapsed % 60]
        .map(part => String(part).padStart(2, '0')).join(':');
      if (time.current && time.current.textContent !== clock) time.current.textContent = clock;
      // Read the translation of the last rendered camera's world matrix.
      const world = cameraRef.current?.matrixWorld.elements;
      const coords = world
        ? [world[12], world[13], world[14]].map(value => coordinateFormat.format(value)).join(' / ')
        : '— / — / —';
      if (position.current && position.current.textContent !== coords) position.current.textContent = coords;
    };
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [cameraRef]);

  return <div className={styles.observationData} lang="en">
    <p className={styles.observationSite}>SITE / EX-01</p>
    <p>PALE BASIN <span aria-hidden="true">·</span> SECTOR 07</p>
    <dl>
      <div><dt>OBS T+</dt><dd ref={time}>00:00:00</dd></div>
      <div><dt>POS X / Y / Z</dt><dd ref={position}>— / — / —</dd></div>
    </dl>
  </div>;
}

export function InstrumentCorners() {
  return <>{corners.map(corner => <svg key={corner} className={`${styles.corner} ${corner}`} viewBox="0 0 103 57"
    aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M8 50V18L19 7H81 M8 23L24 7" />
    <path className={styles.cornerInlay} d="M16 43V25L26 15H51" />
  </svg>)}</>;
}

export function InstrumentHeader({ reduced, soundToggle, gauge, about = false, className }: {
  reduced: boolean; soundToggle?: ReactNode; gauge?: ReactNode; about?: boolean; className?: string;
}) {
  const { enabled, cue } = useSiteAudio();
  const brand = useEncryptedText('LIBRECOSTA', reduced);
  return <header className={className ? `${styles.instrumentHeader} ${className}` : styles.instrumentHeader}>
    <div className={styles.brandCluster}>
      <Link href="/" className={styles.brand} aria-label="LibreCosta 首页"
        onPointerEnter={event => { if (event.pointerType === 'mouse') { cue('hover'); brand.play(); } }}
        onFocus={event => { if (event.currentTarget.matches(':focus-visible')) brand.play(); }}
        onClick={() => cue('click')}><Wordmark noise={brand.noise} /></Link>
      {soundToggle && <span className={styles.soundIndicator} role="img" aria-label={enabled ? '声音开启' : '声音关闭'} data-enabled={enabled} />}
    </div>
    {soundToggle}
    <nav className={styles.instrumentNav} aria-label="站点导航" data-audio-ui>
      <InstrumentLink href="/works" text="WORKS" reduced={reduced} />
      <InstrumentLink href="/about" text="ABOUT" reduced={reduced} current={about} />
      <InstrumentLink href="https://gopheratlas.com/" text="BLOG" reduced={reduced} external />
      <InstrumentLink href="/contact" text="CONTACT" reduced={reduced} />
    </nav>
    {gauge}
  </header>;
}

function ChapterGauge() {
  return <div className={styles.chapterGauge}>
    <svg viewBox="0 0 65 16" aria-hidden="true" fill="none" stroke="currentColor">
      <path d="M1.5 4 4.5 1h54l2 2v10l-2 2h-54l-3-3Z M61 5h3v6h-3" />
      <path d="M6 4h8v8H6z" fill="currentColor" stroke="none" />
      <path className={styles.unlitCells} d="M17 4h8v8h-8z M28 4h8v8h-8z M39 4h8v8h-8z M50 4h8v8h-8z"
        fill="currentColor" stroke="none" />
    </svg>
    <span className={styles.srOnly}>第 1 章，共 5 章</span>
    <span aria-hidden="true">01 <span className={styles.gaugeSlash}>/</span> 05</span>
  </div>;
}

export function InstrumentSocialLinks() {
  const { cue } = useSiteAudio();
  return <nav className={styles.socialLinks} aria-label="社交媒体" onClick={() => cue('click')}>
    <a href="https://x.com/LibreCostaHQ" target="_blank" rel="noopener noreferrer"
      aria-label="X（在新标签页打开）" onPointerEnter={event => { if (event.pointerType === 'mouse') cue('hover'); }}>
      <svg viewBox="-100 -86.5 1400 1400" aria-hidden="true" fill="currentColor">
        {/* X's official monochrome mark, framed to match the Bilibili icon. */}
        <path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z" />
      </svg>
    </a>
    <a href="https://space.bilibili.com/37124259" target="_blank" rel="noopener noreferrer"
      aria-label="Bilibili（在新标签页打开）" onPointerEnter={event => { if (event.pointerType === 'mouse') cue('hover'); }}>
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="m7.5 3.5 3.4 4m5.6-4-3.4 4M5 7.5h14l2 2v9.5l-2 2H5l-2-2V9.5Z M7 13.5l3-1m4 0 3 1" />
      </svg>
    </a>
  </nav>;
}

export function InstrumentProgress({ progressBar, progressFill, label = '旅程进度' }: {
  progressBar: RefObject<HTMLDivElement | null>;
  progressFill: RefObject<HTMLSpanElement | null>;
  label?: string;
}) {
  return <div ref={progressBar} className={styles.progress} role="progressbar" aria-label={label}
    aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}>
    <span ref={progressFill} />
  </div>;
}

export function ExpanseInstrument({ ready, reduced, unavailable, stage, hint, progressBar, progressFill, cameraRef }: {
  ready: boolean; reduced: boolean; unavailable: boolean;
  stage: RefObject<HTMLElement | null>;
  hint: RefObject<HTMLParagraphElement | null>;
  progressBar: RefObject<HTMLDivElement | null>;
  progressFill: RefObject<HTMLSpanElement | null>;
  cameraRef: RefObject<Camera | null>;
}) {
  return <div className={styles.instrument}>
    <InstrumentCorners />
    <InstrumentHeader reduced={reduced} gauge={<ChapterGauge />}
      soundToggle={<ExpanseSoundToggle stage={stage} showPrompt={ready && !reduced && !unavailable} reduced={reduced} />} />
    {ready && <svg className={styles.reticle} viewBox="0 0 22 22" aria-hidden="true" fill="none">
      <path d="M11 1v6m0 8v6M1 11h6m8 0h6" stroke="var(--instrument-glint)" strokeWidth="2.4" />
      <path d="M11 1v6m0 8v6M1 11h6m8 0h6" stroke="currentColor" strokeWidth="1" />
      <path d="M10.3 10.3h1.4v1.4h-1.4z" fill="currentColor" />
    </svg>}
    {!unavailable && <ObservationReadout cameraRef={cameraRef} />}
    <InstrumentSocialLinks />
    {!unavailable && <div className={styles.readout}>
      {reduced ? <p className={styles.staticNote}>静态观览 · <a href="#expanse-transcript">阅读本幕</a></p> : <>
        <p ref={hint} className={styles.hint} lang="en">
          <svg viewBox="0 0 10 12" aria-hidden="true" fill="currentColor"><path d="M1 2h8L5 6zm0 5h8l-4 4z" /></svg>
          Scroll to explore
        </p>
        <div className={styles.trackLabel} lang="en"><span>01</span><span>The Expanse</span></div>
        <InstrumentProgress progressBar={progressBar} progressFill={progressFill} />
      </>}
    </div>}
  </div>;
}
