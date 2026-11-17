'use client';

import Link from 'next/link';
import { domAnimation, LazyMotion, m, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useSiteAudio } from '@/components/audio/AudioProvider';
import { languageControlCopy } from './content';
import { localeIds, localePath, locales, type SiteRoute } from './locale-contract';
import { useSiteLocale } from './LocaleProvider';
import styles from './language-menu.module.css';

// TuneShape Dropdown Menu, MIT. See public/License/tuneshape-dropdown.txt.
const ease = [.25, .1, .25, 1] as const;
const panelDuration = .4;
const itemDuration = .312;
const itemStep = Math.min(.0344, (panelDuration - itemDuration) / (localeIds.length - 1));

export function LanguageMenu({ route, reduced }: { route: SiteRoute; reduced: boolean }) {
  const { locale, defaultLocale, publishedLocales } = useSiteLocale();
  const { cue } = useSiteAudio();
  const copy = languageControlCopy[locale] ?? languageControlCopy.en;
  const reduceMotion = useReducedMotion();
  const instant = reduced || reduceMotion;
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<'first' | 'last' | null>(null);
  const [open, setOpen] = useState(false);
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

  return <div ref={root} className={styles.language} data-audio-ui onKeyDown={onKeyDown}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <LazyMotion features={domAnimation}>
      <button type="button" ref={trigger} className={styles.trigger} aria-expanded={open} aria-controls={id}
        aria-label={`${copy.label} · ${locales[locale].name}`} data-language-trigger onClick={() => {
          cue('click');
          setOpen(value => !value);
        }}>
        <span lang={locale}>{locales[locale].abbreviation}</span>
        <m.svg aria-hidden="true" viewBox="0 0 12 12" fill="none" initial={false}
          animate={{ rotate: open ? 180 : 0 }} transition={transition}>
          <path d="m2.5 4.5 3.5 3 3.5-3" stroke="currentColor" strokeWidth="1.25" />
        </m.svg>
      </button>
      <m.div ref={panel} id={id} className={styles.panel} inert={!open} aria-hidden={!open} data-language-panel
        initial={false} animate={open ? { y: 0, scale: 1, opacity: 1 } : { y: -7, scale: .985, opacity: 0 }}
        transition={transition}>
        <ul aria-label={copy.label}>
          {localeIds.map((choice, index) => {
            const current = choice === locale;
            const available = publishedLocales.includes(choice);
            // Keep the .4 s envelope, reversing the stagger on close.
            const delay = (open ? index : localeIds.length - 1 - index) * itemStep;
            const label = <span lang={choice}>{locales[choice].name}</span>;
            return <m.li key={choice} initial={false} animate={open ? { y: 0, opacity: 1 } : { y: -4, opacity: 0 }}
              transition={{ ease, duration: instant ? 0 : itemDuration, delay: instant ? 0 : delay }}>
              {!available ? <span className={styles.option} aria-disabled="true" aria-current={current || undefined}>
                {label}<small>{copy.pending}</small>
              </span> : current ? <button className={styles.option} type="button" aria-current="true"
                data-language-choice onClick={select}>{label}<span aria-hidden="true">✓</span></button> :
                <Link className={styles.option} href={localePath(route, choice, defaultLocale)} hrefLang={choice}
                  prefetch={false} data-language-choice onClick={select}>{label}</Link>}
            </m.li>;
          })}
        </ul>
      </m.div>
    </LazyMotion>
  </div>;
}
