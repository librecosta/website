'use client';

import { animate, domAnimation, LazyMotion, m, useMotionValue, useReducedMotion } from 'motion/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { WorkshopFrame } from '@/components/WorkshopFrame';
import { useSoftFocus } from '@/components/soft-focus';
import { siteCopy, usesOriginalLayout } from '@/site/content';
import type { ErrorScreenKind } from '@/site/copy/types';
import { LocaleProvider } from '@/site/LocaleProvider';
import { homePage, isLocale, pagePath, type Publication } from '@/site/locale-contract';
import styles from './error-screen.module.css';

const statusCodes = { notFound: '404', request: '4XX', server: '5XX' } as const;

// The same static error document can be the first response for any locale. Run
// before its visible content is parsed so streamed HTML cannot flash the default.
const prepareErrorPaint = `(() => {
  const frame = document.currentScript.parentElement;
  const titles = JSON.parse(frame.dataset.errorTitles);
  const prefix = location.pathname.split('/')[1];
  const fallback = frame.dataset.defaultLocale;
  const locale = Object.hasOwn(titles, prefix) ? prefix : fallback;
  document.title = titles[locale];
  const localized = locale !== fallback;
  if (localized || !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    frame.dataset.errorPending = localized ? 'locale' : 'motion';
    // Keep the static recovery links available if the main bundle fails.
    window.addEventListener('load', () => {
      setTimeout(() => frame.removeAttribute('data-error-pending'), 1500);
    }, { once: true });
  }
})();`;

export type ErrorExperienceProps = {
  kind: ErrorScreenKind;
  publication: Publication;
  retry?: () => void;
};

export function ErrorExperience({ kind, publication, retry }: ErrorExperienceProps) {
  const { defaultLocale, publishedLocales } = publication;
  const [locale, setLocale] = useState(defaultLocale);
  const [ready, setReady] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion() === true;
  const clock = useMotionValue(0);
  const heading = useSoftFocus(clock, 0, .69, 8, 13);
  const detail = useSoftFocus(clock, .16, .61, 5, 9);
  const actions = useSoftFocus(clock, .32, .59, 4, 8);
  const copy = siteCopy[locale].shared.errors;
  const server = kind === 'server';
  const code = statusCodes[kind];
  const titles = Object.fromEntries([defaultLocale, ...publishedLocales].map(lang =>
    [lang, `${code} · ${siteCopy[lang].shared.errors[kind].title} | LibreCosta`],
  ));
  const home = pagePath(homePage(publication.id), locale, publication);
  const works = pagePath('works', locale, publication);

  useLayoutEffect(() => {
    // One exported error document can be served at a requested locale's URL.
    const prefix = window.location.pathname.split('/')[1];
    if (isLocale(prefix) && publishedLocales.includes(prefix)) setLocale(prefix);
    setReady(true);
  }, [publishedLocales]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousLang = root.lang;
    const previousLocalized = root.getAttribute('data-localized');
    root.lang = locale;
    root.toggleAttribute('data-localized', !usesOriginalLayout(locale));
    return () => {
      root.lang = previousLang;
      if (previousLocalized === null) root.removeAttribute('data-localized');
      else root.setAttribute('data-localized', previousLocalized);
    };
  }, [locale]);

  useLayoutEffect(() => {
    if (!ready) return;
    const showMotion = !reduced && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    clock.jump(showMotion ? 0 : 1);
    frame.current?.removeAttribute('data-error-pending');
    if (!showMotion) return;
    const entrance = animate(clock, 1, { duration: .86, ease: 'linear' });
    return () => entrance.stop();
  }, [clock, ready, reduced]);

  return <LocaleProvider value={{ locale, publication }}>
    <title suppressHydrationWarning>{ready ? titles[locale] : `${code} | LibreCosta`}</title>
    <div ref={frame} className={styles.frame} data-default-locale={defaultLocale} data-error-titles={JSON.stringify(titles)}
      data-error-animate={ready && !reduced || undefined} suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: prepareErrorPaint }} />
      <LazyMotion features={domAnimation}>
        <WorkshopFrame reduced={reduced} onLocaleChange={setLocale} statusDossier={{
          id: server ? 'LC-05' : 'LC-04',
          title: server ? copy.service : copy.routing,
          rows: [['HTTP', code]],
        }}>
          <main className={styles.screen} aria-labelledby="error-title">
            <div className={styles.content}>
              <m.h1 id="error-title" className={styles.heading} style={reduced ? undefined : heading} data-error-reveal>
                <span className={styles.code}>{code}</span>
                <span>{copy[kind].title}</span>
              </m.h1>
              <m.p className={styles.detail} style={reduced ? undefined : detail} data-error-reveal>{copy[kind].detail}</m.p>
              <m.div className={styles.actions} style={reduced ? undefined : actions} data-error-reveal>
                {server && (retry
                  ? <button className={styles.primary} type="button" onClick={retry}>{copy.retry}</button>
                  : <a className={styles.primary} href="">{copy.retry}</a>)}
                <a className={server ? styles.secondary : styles.primary} href={home}>{copy.home}</a>
                {!server && <a className={styles.secondary} href={works}>{copy.works}</a>}
              </m.div>
            </div>
          </main>
        </WorkshopFrame>
      </LazyMotion>
    </div>
  </LocaleProvider>;
}
