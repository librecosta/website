import { useEffect, type ReactNode } from 'react';
import { stagger, useAnimate } from 'motion/react';
import { useSiteCopy, useSiteLocale } from '@/site/LocaleProvider';
import { usesOriginalLayout } from '@/site/content';
import type { Locale, SitePage } from '@/site/locale-contract';
import { PublicationCompliance } from './PublicationCompliance';
import { InstrumentCorners, InstrumentHeader, InstrumentSocialLinks } from './expanse/ExpanseInstrument';
import instrument from './expanse/expanse.module.css';
import styles from './workshop-frame.module.css';

const dossiers = {
  'about': {
    id: 'LC-01',
    title: 'about',
  },
  'contact': {
    id: 'LC-02',
    title: 'contact',
  },
  'works': {
    id: 'LC-03',
    title: 'works',
  },
} as const;

type DossierEntry = { id: string; title: string; rows: readonly (readonly [string, string])[] };

function Dossier({ entry, reduced }: { entry: DossierEntry; reduced: boolean }) {
  const [scope, animate] = useAnimate<HTMLElement>();
  const { id, title, rows } = entry;
  const { locale } = useSiteLocale();
  const { dossier } = useSiteCopy().shared;

  useEffect(() => {
    if (reduced || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = animate('[data-dossier-line]', {
      clipPath: ['inset(0 0 100% 0)', 'inset(0 0 0% 0)'], y: [5, 0],
    }, { delay: stagger(.065, { startDelay: .57 }), duration: .37, ease: [.22, .66, .24, 1] });
    return () => animation.cancel();
  }, [animate, reduced]);

  return <aside ref={scope} className={`${instrument.observationData} ${styles.dossier}`} lang={usesOriginalLayout(locale) ? 'en' : undefined} aria-label={usesOriginalLayout(locale) ? 'LibreCosta dossier' : `${dossier.name} · LibreCosta`}>
    <p className={instrument.observationSite} data-dossier-line>{dossier.name} / {id}</p>
    <p data-dossier-line>LIBRECOSTA · {title}</p>
    {rows.length > 0 && <dl>
      {rows.map(([label, value]) => <div key={label} data-dossier-line><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>}
  </aside>;
}

export function WorkshopFrame({ route, reduced, className, sectionNav, scrollGauge, statusDossier, onLocaleChange, children }: {
  route?: SitePage;
  reduced: boolean;
  className?: string;
  sectionNav?: ReactNode;
  scrollGauge?: ReactNode;
  statusDossier?: DossierEntry;
  onLocaleChange?: (locale: Locale) => void;
  children: ReactNode;
}) {
  const { dossier, nav } = useSiteCopy().shared;
  const page = route && route !== 'world' ? dossiers[route] : undefined;
  const entry: DossierEntry | undefined = statusDossier ?? (page ? {
    id: page.id,
    title: nav[page.title],
    rows: route === 'about' ? [[dossier.field, dossier.software], [dossier.practice, dossier.design]]
      : route === 'contact' ? [[dossier.channels, `${dossier.email} / X`]] : [],
  } : undefined);
  const shades = <div className={styles.shades} aria-hidden="true" />;
  return <div className={className ? `${styles.page} ${className}` : styles.page} data-workshop-page={route}>
    {route === 'works' && shades}
    <div className={`${instrument.instrument} ${styles.frame}`}>
      {route !== 'works' && shades}
      <InstrumentCorners />
      <InstrumentHeader currentPage={route ?? null} reduced={reduced} className={styles.header} onLocaleChange={onLocaleChange} />
      {sectionNav}
      {entry && <Dossier entry={entry} reduced={reduced} />}
      {scrollGauge}
      <InstrumentSocialLinks />
      {(route === 'works' || route === 'contact') && <PublicationCompliance docked />}
    </div>
    {children}
    {route === 'about' && <PublicationCompliance />}
  </div>;
}
