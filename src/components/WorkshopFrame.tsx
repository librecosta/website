import { useEffect, type ReactNode } from 'react';
import { stagger, useAnimate } from 'motion/react';
import { InstrumentCorners, InstrumentHeader, InstrumentSocialLinks } from './expanse/ExpanseInstrument';
import instrument from './expanse/expanse.module.css';
import styles from './workshop-frame.module.css';

const dossiers = {
  '/about': {
    id: 'LC-01',
    title: 'ABOUT',
    rows: [['FIELD', 'SOFTWARE / TOOLS'], ['PRACTICE', 'OPEN SOURCE / DESIGN']],
  },
  '/contact': {
    id: 'LC-02',
    title: 'CONTACT',
    rows: [['CHANNELS', 'EMAIL / X']],
  },
  '/works': {
    id: 'LC-03',
    title: 'WORKS',
    rows: [],
  },
} as const;

type WorkshopRoute = keyof typeof dossiers;

function Dossier({ route, reduced }: { route: WorkshopRoute; reduced: boolean }) {
  const [scope, animate] = useAnimate<HTMLElement>();
  const { id, title, rows } = dossiers[route];

  useEffect(() => {
    if (reduced || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = animate('[data-dossier-line]', {
      clipPath: ['inset(0 0 100% 0)', 'inset(0 0 0% 0)'], y: [5, 0],
    }, { delay: stagger(.065, { startDelay: .57 }), duration: .37, ease: [.22, .66, .24, 1] });
    return () => animation.cancel();
  }, [animate, reduced]);

  return <aside ref={scope} className={`${instrument.observationData} ${styles.dossier}`} lang="en" aria-label="LibreCosta dossier">
    <p className={instrument.observationSite} data-dossier-line>DOSSIER / {id}</p>
    <p data-dossier-line>LIBRECOSTA · {title}</p>
    {rows.length > 0 && <dl>
      {rows.map(([label, value]) => <div key={label} data-dossier-line><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>}
  </aside>;
}

function Language() {
  return <div className={styles.language} role="group" aria-label="页面语言">
    <span lang="zh-CN" aria-current="true" aria-label="中文">中</span>
    <span aria-hidden="true">/</span>
    <button type="button" lang="en" disabled aria-label="English (unavailable)">EN</button>
  </div>;
}

export function WorkshopFrame({ route, reduced, className, sectionNav, scrollGauge, children }: {
  route: WorkshopRoute;
  reduced: boolean;
  className?: string;
  sectionNav?: ReactNode;
  scrollGauge?: ReactNode;
  children: ReactNode;
}) {
  return <div className={className ? `${styles.page} ${className}` : styles.page}>
    <div className={`${instrument.instrument} ${styles.frame}`}>
      <InstrumentCorners />
      <InstrumentHeader currentPage={route} reduced={reduced} className={styles.header} navigationPrefix={<Language />} />
      {sectionNav}
      <Dossier route={route} reduced={reduced} />
      {scrollGauge}
      <InstrumentSocialLinks />
    </div>
    {children}
  </div>;
}
