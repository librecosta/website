import Link from 'next/link';
import type { RefObject } from 'react';
import { ExpanseSoundToggle } from './ExpanseAudio';
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

function Wordmark({ pixel = false }: { pixel?: boolean }) {
  return pixel ? <svg viewBox="0 0 61 9" aria-hidden="true" fill="currentColor">
    <path d={pixelPath} />
  </svg> : <svg viewBox="0 0 171 22" aria-hidden="true" fill="none" stroke="currentColor"
    strokeWidth="2.45" strokeLinejoin="bevel" strokeLinecap="square">
    {techGlyphs.map(([x, path]) => <path key={x} d={path} transform={`translate(${x})`} />)}
  </svg>;
}

const corners = [styles.topLeft, styles.topRight, styles.bottomLeft, styles.bottomRight];

export function WordmarkStudy() {
  return <details className={styles.wordmarkStudy}>
    <summary>字标对照</summary>
    <dl className={styles.wordmarkSamples} lang="en">
      <div><dt>Tech Precision</dt><dd><Wordmark /></dd></div>
      <div><dt>Pixel Modular</dt><dd><Wordmark pixel /></dd></div>
    </dl>
  </details>;
}

export function ExpanseInstrument({ ready, reduced, unavailable, hint, progressBar, progressFill }: {
  ready: boolean; reduced: boolean; unavailable: boolean;
  hint: RefObject<HTMLParagraphElement | null>;
  progressBar: RefObject<HTMLDivElement | null>;
  progressFill: RefObject<HTMLSpanElement | null>;
}) {
  return <div className={styles.instrument}>
    {corners.map(corner => <svg key={corner} className={`${styles.corner} ${corner}`} viewBox="0 0 108 62"
      aria-hidden="true" fill="none" stroke="currentColor">
      <path d="M1 61V17L17 1H91" vectorEffect="non-scaling-stroke" />
      <path className={styles.cornerInlay} d="M6 45V20L20 6H64M6 29L27 8H43M97 1H107"
        vectorEffect="non-scaling-stroke" />
    </svg>)}
    <header className={styles.instrumentHeader}>
      <Link href="/" className={styles.brand} aria-label="LibreCosta 首页"><Wordmark /></Link>
      <div className={styles.instrumentRight}>
        <ExpanseSoundToggle />
        <div className={styles.reservedNav} lang="en" aria-hidden="true"><span>Works</span><span>About</span></div>
        <div className={styles.chapterGauge}>
          <svg viewBox="0 0 65 16" aria-hidden="true" fill="none" stroke="currentColor">
            <path d="M1.5 4 4.5 1h54l2 2v10l-2 2h-54l-3-3Z M61 5h3v6h-3" />
            <path d="M6 4h8v8H6z" fill="currentColor" stroke="none" />
            <path className={styles.unlitCells} d="M17 4h8v8h-8z M28 4h8v8h-8z M39 4h8v8h-8z M50 4h8v8h-8z"
              fill="currentColor" stroke="none" />
          </svg>
          <span className={styles.srOnly}>第 1 章，共 5 章</span>
          <span aria-hidden="true">01 <span className={styles.gaugeSlash}>/</span> 05</span>
        </div>
      </div>
    </header>
    {ready && <svg className={styles.reticle} viewBox="0 0 22 22" aria-hidden="true" fill="none">
      <path d="M11 1v6m0 8v6M1 11h6m8 0h6" stroke="var(--instrument-glint)" strokeWidth="2.4" />
      <path d="M11 1v6m0 8v6M1 11h6m8 0h6" stroke="currentColor" strokeWidth="1" />
      <path d="M10.3 10.3h1.4v1.4h-1.4z" fill="currentColor" />
    </svg>}
    {!unavailable && <div className={styles.readout}>
      {reduced ? <p className={styles.staticNote}>静态观览 · 已减少动态效果</p> : <>
        <p ref={hint} className={styles.hint}>开始探索</p>
        <div className={styles.trackLabel} lang="en"><span>01</span><span>The Expanse</span></div>
        <div ref={progressBar} className={styles.progress} role="progressbar" aria-label="旅程进度"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}>
          <span ref={progressFill} />
        </div>
      </>}
    </div>}
  </div>;
}
