import Link from 'next/link';
import { useEffect, useRef, type ComponentPropsWithoutRef, type ReactNode, type RefObject } from 'react';
import type { Camera } from 'three';
import { useSiteAudio } from '@/components/audio/AudioProvider';
import { PublicationCompliance } from '@/components/PublicationCompliance';
import { usesOriginalLayout } from '@/site/content';
import { LanguageMenu } from '@/site/LanguageMenu';
import { homePage, pagePath, type Locale, type SitePage } from '@/site/locale-contract';
import { useSiteCopy, useSiteLocale } from '@/site/LocaleProvider';
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
  const { locale } = useSiteLocale();
  const { blogNewTab } = useSiteCopy().shared;
  const { play, noise } = useEncryptedText(text, reduced);
  const props: ComponentPropsWithoutRef<'a'> = {
    lang: usesOriginalLayout(locale) ? 'en' : undefined,
    'aria-label': external ? `${text}${blogNewTab}` : text,
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
  const { locale } = useSiteLocale();
  const { readout } = useSiteCopy().world;
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

  return <div className={styles.observationData} lang={usesOriginalLayout(locale) ? 'en' : undefined}>
    <p className={styles.observationSite}>{readout.site} / EX-01</p>
    <p>{readout.basin} <span aria-hidden="true">·</span> {readout.sector} 07</p>
    <dl>
      <div><dt>{readout.time}</dt><dd ref={time}>00:00:00</dd></div>
      <div><dt>{readout.position}</dt><dd ref={position}>— / — / —</dd></div>
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

export function InstrumentHeader({ reduced, soundToggle, gauge, currentPage = 'world', className, onLocaleChange }: {
  reduced: boolean; soundToggle?: ReactNode; gauge?: ReactNode; currentPage?: SitePage | null;
  onLocaleChange?: (locale: Locale) => void;
  className?: string;
}) {
  const { enabled, cue } = useSiteAudio();
  const { locale, publication } = useSiteLocale();
  const { shared: copy, world: { audio } } = useSiteCopy();
  const href = (page: SitePage) => pagePath(page, locale, publication);
  const brand = useEncryptedText('LIBRECOSTA', reduced);
  return <header className={className ? `${styles.instrumentHeader} ${className}` : styles.instrumentHeader}>
    <div className={styles.brandCluster}>
      <Link href={href(homePage(publication.id))} className={styles.brand} aria-label={copy.home}
        onPointerEnter={event => { if (event.pointerType === 'mouse') { cue('hover'); brand.play(); } }}
        onFocus={event => { if (event.currentTarget.matches(':focus-visible')) brand.play(); }}
        onClick={() => cue('click')}><span className={styles.brandMark} aria-hidden="true" /><Wordmark noise={brand.noise} /></Link>
      {soundToggle && <span className={styles.soundIndicator} role="img"
        aria-label={enabled ? audio.indicatorOn : audio.indicatorOff} data-enabled={enabled} />}
    </div>
    {soundToggle}
    <LanguageMenu page={currentPage} reduced={reduced} onLocaleChange={onLocaleChange} />
    <nav className={styles.instrumentNav} aria-label={copy.navigation} data-audio-ui>
      {currentPage !== 'world' && <InstrumentLink href={href('world')} text={copy.nav.world} reduced={reduced} />}
      <InstrumentLink href={href('works')} text={copy.nav.works} reduced={reduced} current={currentPage === 'works'} />
      <InstrumentLink href={href('about')} text={copy.nav.about} reduced={reduced} current={currentPage === 'about'} />
      <InstrumentLink href="https://gopheratlas.com/" text={copy.nav.blog} reduced={reduced} external />
      <InstrumentLink href={href('contact')} text={copy.nav.contact} reduced={reduced} current={currentPage === 'contact'} />
    </nav>
    {gauge}
  </header>;
}

function ChapterGauge() {
  const { readout } = useSiteCopy().world;
  return <div className={styles.chapterGauge}>
    <svg viewBox="0 0 65 16" aria-hidden="true" fill="none" stroke="currentColor">
      <path d="M1.5 4 4.5 1h54l2 2v10l-2 2h-54l-3-3Z M61 5h3v6h-3" />
      <path d="M6 4h8v8H6z" fill="currentColor" stroke="none" />
      <path className={styles.unlitCells} d="M17 4h8v8h-8z M28 4h8v8h-8z M39 4h8v8h-8z M50 4h8v8h-8z"
        fill="currentColor" stroke="none" />
    </svg>
    <span className={styles.srOnly}>{readout.chapter}</span>
    <span aria-hidden="true">01 <span className={styles.gaugeSlash}>/</span> 05</span>
  </div>;
}

export function InstrumentSocialLinks() {
  const { cue } = useSiteAudio();
  const copy = useSiteCopy().shared;
  return <nav className={styles.socialLinks} aria-label={copy.social} onClick={() => cue('click')}>
    <a href="https://github.com/librecosta/website" target="_blank" rel="noopener noreferrer"
      aria-label={`GitHub${copy.newTab}`} onPointerEnter={event => { if (event.pointerType === 'mouse') cue('hover'); }}>
      {/* GitHub Invertocat from Primer Octicons. See public/License/github-octicons.txt. */}
      <svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
        <path d="M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656" />
      </svg>
    </a>
    <a href="https://space.bilibili.com/37124259" target="_blank" rel="noopener noreferrer"
      aria-label={`Bilibili${copy.newTab}`} onPointerEnter={event => { if (event.pointerType === 'mouse') cue('hover'); }}>
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="m7.5 3.5 3.4 4m5.6-4-3.4 4M5 7.5h14l2 2v9.5l-2 2H5l-2-2V9.5Z M7 13.5l3-1m4 0 3 1" />
      </svg>
    </a>
    <a href="https://x.com/LibreCostaHQ" target="_blank" rel="noopener noreferrer"
      aria-label={`X${copy.newTab}`} onPointerEnter={event => { if (event.pointerType === 'mouse') cue('hover'); }}>
      <svg viewBox="-100 -86.5 1400 1400" aria-hidden="true" fill="currentColor">
        {/* X's official monochrome mark, framed to match the Bilibili icon. */}
        <path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z" />
      </svg>
    </a>
  </nav>;
}

export function InstrumentProgress({ progressBar, progressFill, label }: {
  progressBar: RefObject<HTMLDivElement | null>;
  progressFill: RefObject<HTMLSpanElement | null>;
  label: string;
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
  const copy = useSiteCopy().world;
  const { locale } = useSiteLocale();
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
      {reduced ? <p className={styles.staticNote}>{copy.staticView} · <a href="#expanse-transcript">{copy.readAct}</a></p> : <>
        <p ref={hint} className={styles.hint} lang={usesOriginalLayout(locale) ? 'en' : undefined}>
          <svg viewBox="0 0 10 12" aria-hidden="true" fill="currentColor"><path d="M1 2h8L5 6zm0 5h8l-4 4z" /></svg>
          {copy.scroll}
        </p>
        <div className={styles.trackLabel} lang="en"><span>01</span><span>The Expanse</span></div>
        <InstrumentProgress progressBar={progressBar} progressFill={progressFill} label={copy.progress} />
      </>}
    </div>}
    <PublicationCompliance docked />
  </div>;
}
