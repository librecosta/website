'use client';

import Link from 'next/link';
import { domAnimation, LazyMotion, m, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useSiteAudio } from '@/components/audio/AudioProvider';
import { homePage, localeIds, locales, pagePath, type Locale, type SitePage } from './locale-contract';
import { useSiteCopy, useSiteLocale } from './LocaleProvider';
import { publications } from './publication-catalog';
import styles from './language-menu.module.css';

// TuneShape Dropdown Menu, MIT. See public/License/tuneshape-dropdown.txt.
const ease = [.25, .1, .25, 1] as const;
const panelDuration = .4;
const itemDuration = .312;

export function LanguageMenu({ page, reduced, onLocaleChange }: {
  page: SitePage | null; reduced: boolean; onLocaleChange?: (locale: Locale) => void;
}) {
  const { locale, publication } = useSiteLocale();
  const choices = localeIds.filter(choice => publication.publishedLocales.includes(choice));
  const target = publications[publication.id === 'cn' ? 'intl' : 'cn'];
  const targetLocale = target.publishedLocales.includes(locale) ? locale : target.defaultLocale;
  const targetPath = pagePath(page ?? homePage(target.id), targetLocale, target);
  const { cue } = useSiteAudio();
  const copy = useSiteCopy().shared;
  const reduceMotion = useReducedMotion();
  const instant = reduced || reduceMotion;
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<'first' | 'last' | null>(null);
  const [open, setOpen] = useState(false);
  const step = Math.min(.0344, (panelDuration - itemDuration) / Math.max(1, choices.length));
  function itemTransition(index: number) {
    const delay = (open ? index : choices.length - index) * step;
    return { ease, duration: instant ? 0 : itemDuration, delay: instant ? 0 : delay };
  }
  const itemChoices = () => Array.from(panel.current?.querySelectorAll<HTMLElement>('[data-language-choice]') ?? []);
  const transition = { duration: instant ? 0 : panelDuration, ease };

  useEffect(() => {
    if (!open) return;
    if (pendingFocus.current) {
      const choices = panel.current?.querySelectorAll<HTMLElement>('[data-language-choice]');
      if (choices?.length) choices[pendingFocus.current === 'first' ? 0 : choices.length - 1].focus();
      pendingFocus.current = null;
    }
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      trigger.current?.focus();
      setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onEscape, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onEscape, true);
    };
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const { key } = event;
    if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'Home' && key !== 'End') return;
    if (!open && key !== 'ArrowDown' && key !== 'ArrowUp') return;
    event.preventDefault();
    const last = key === 'ArrowUp' || key === 'End';
    if (!open) {
      pendingFocus.current = last ? 'last' : 'first';
      setOpen(true);
      return;
    }
    const choices = itemChoices();
    if (!choices.length) return;
    const index = choices.indexOf(document.activeElement as HTMLElement);
    const next = key === 'Home' || key === 'End' || index === -1
      ? (last ? choices.length - 1 : 0)
      : (index + (last ? -1 : 1) + choices.length) % choices.length;
    choices[next].focus();
  }

  function select() {
    cue('click');
    trigger.current?.focus();
    setOpen(false);
  }

  return <div ref={root} className={styles.language} data-audio-ui data-language-menu onKeyDown={onKeyDown}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <LazyMotion features={domAnimation}>
      <button type="button" ref={trigger} className={styles.trigger} aria-expanded={open} aria-controls={id}
        aria-label={`${copy.language} · ${locales[locale].name}`} data-language-trigger onClick={() => {
          cue('click');
          setOpen(value => !value);
        }}>
        <span lang={locale}>{locales[locale].abbreviation}</span>
        <m.svg aria-hidden="true" viewBox="0 0 12 12" fill="none" initial={false}
          animate={{ rotate: open ? 180 : 0 }} transition={transition}>
          <path d="m2.5 4.5 3.5 3 3.5-3" stroke="currentColor" strokeWidth="1.25" />
        </m.svg>
      </button>
      <div ref={panel} id={id} className={styles.panel} inert={!open} aria-hidden={!open} data-language-panel>
        <m.div className={styles.surface} aria-hidden="true" initial={false}
          animate={open ? { y: 0, scale: 1, opacity: 1 } : { y: -7, scale: .985, opacity: 0 }} transition={transition} />
        <ul aria-label={copy.language}>
          {choices.map((choice, index) => {
            const current = choice === locale;
            const label = <span lang={choice}>{locales[choice].name}</span>;
            return <m.li key={choice} initial={false} animate={{ opacity: open ? 1 : 0 }}
              transition={itemTransition(index)}>
              {current || onLocaleChange ? <button className={styles.option} type="button" aria-current={current || undefined}
                data-language-choice onClick={() => { select(); onLocaleChange?.(choice); }}>
                {label}{current && <span aria-hidden="true">✓</span>}
              </button> :
                <Link className={styles.option} href={pagePath(page ?? homePage(publication.id), choice, publication)} hrefLang={choice}
                  prefetch={false} data-language-choice onClick={select}>{label}</Link>}
            </m.li>;
          })}
          {target.origin && <m.li className={styles.siteSwitch} initial={false} animate={{ opacity: open ? 1 : 0 }}
            transition={itemTransition(choices.length)}>
            <p className={styles.siteLabel}>{copy.siteSwitch.label}</p>
            <a className={styles.option} href={target.origin + targetPath} hrefLang={targetLocale}
              data-language-choice data-region-switch onClick={select}>
              <span>
                {copy.siteSwitch[target.id]}
                {locale !== targetLocale && <small className={styles.siteHint}>
                  {copy.siteSwitch.fallback.replace('{language}', locales[targetLocale].name)}
                </small>}
              </span>
              <span aria-hidden="true">↗</span>
            </a>
          </m.li>}
        </ul>
      </div>
    </LazyMotion>
  </div>;
}
