import { useRef, useSyncExternalStore, type CSSProperties } from 'react';
import { m, useScroll, useTransform, type MotionValue } from 'motion/react';
import styles from './project-archive.module.css';

type ProjectCard = {
  number: string;
  preview?: { src: string; alt: string };
  title?: string;
  summary?: string;
  status?: string;
  website?: string;
  source?: string;
};

const cards: readonly ProjectCard[] = Array.from({ length: 5 }, (_, index) => ({
  number: String(index + 1).padStart(2, '0'),
}));
const pairQuery = '(min-width: 1280px)';
const hold = .28;

function subscribeToPairLayout(notify: () => void) {
  const query = window.matchMedia(pairQuery);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
}

function getPairLayout() { return window.matchMedia(pairQuery).matches; }
function getServerPairLayout() { return false; }
function clampProgress(value: number) { return Math.min(1, Math.max(0, value)); }

function ArchiveCard({ card }: { card: ProjectCard }) {
  return <article className={styles.card} aria-label={card.title ?? `项目档案 ${card.number}`}>
    <header className={styles.cardHeader}><span>{card.number}</span></header>
    <div className={styles.preview}>
      {card.preview ? <img src={card.preview.src} alt={card.preview.alt} /> : <svg viewBox="0 0 96 80" fill="none" aria-hidden="true">
        <path className={styles.drawingGuide} d="M10 40h76M48 6v68M13 13h8m-8 0v8m70 46h-8m8 0v-8" />
        <path className={styles.drawingOutline} d="M48 15 74 40 48 65 22 40Z M48 27 62 40 48 53 34 40Z" />
      </svg>}
    </div>
    <div className={styles.description}>
      {card.title ? <h3>{card.title}</h3> : <span className={styles.titlePlaceholder} aria-hidden="true" />}
      {card.summary ? <p>{card.summary}</p> : <span className={styles.summaryPlaceholder} aria-hidden="true" />}
    </div>
    <footer className={styles.cardFooter}>
      {card.status ? <span>{card.status}</span> : <span className={styles.statusPlaceholder} aria-hidden="true" />}
      <div className={styles.entries}>
        {card.website ? <a href={card.website}>访问项目</a> : <span className={styles.entryPlaceholder} aria-hidden="true" />}
        {card.source && <a href={card.source}>源码</a>}
      </div>
    </footer>
  </article>;
}

function ArchiveGroup({ group, index, count, progress, reduced }: {
  group: readonly ProjectCard[];
  index: number;
  count: number;
  progress: MotionValue<number>;
  reduced: boolean;
}) {
  // Skiper-16 group geometry. See /License/tuneshape-skiper-16.txt.
  const start = index / (count - 1);
  const targetScale = Math.max(.5, 1 - (count - index - 1) * .1);
  const scale = useTransform(progress, value => {
    const shrink = start === 1 ? 0 : clampProgress((value - start) / (1 - start));
    return 1 + (targetScale - 1) * shrink;
  });
  const distance = useTransform(progress, value => value * (count - 1) - index);
  const y = useTransform(distance, value => `${Math.max(0, -value) * 100}%`);
  const opacity = useTransform(distance, [-1, -.68, 0, 1, 2], [0, 1, 1, .9, .62]);
  const filter = useTransform(distance, [0, 1, 2], ['brightness(1)', 'brightness(.38)', 'brightness(.28)']);
  const style = {
    '--group-index': index,
    ...(reduced ? {} : { scale, y, opacity, filter }),
  };
  return <m.div className={styles.group} style={style}>
    {group.map(card => <ArchiveCard key={card.number} card={card} />)}
  </m.div>;
}

export function ProjectArchive({ reduced }: { reduced: boolean }) {
  const section = useRef<HTMLElement>(null);
  const paired = useSyncExternalStore(subscribeToPairLayout, getPairLayout, getServerPairLayout);
  const columns = paired ? 2 : 1;
  const groups = Array.from({ length: Math.ceil(cards.length / columns) }, (_, index) =>
    cards.slice(index * columns, (index + 1) * columns));
  const travel = groups.length - 1 + hold;
  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'], trackContentSize: true });
  const progress = useTransform(scrollYProgress, value => {
    // Each whole step settles at the corresponding Skiper pose before the next arrival.
    const phase = value * travel;
    const step = Math.floor(phase);
    const transition = clampProgress((phase - step - hold) / (1 - hold));
    return (step + transition) / (groups.length - 1);
  });

  return <section ref={section} className={styles.section} id="collections" aria-labelledby="collections-title"
    data-paired={paired} data-sticky={!reduced}
    style={{ '--group-count': groups.length, '--travel': travel } as CSSProperties}>
    <div className={styles.stage}>
      <div className={styles.archive}>
        <h2 className={styles.heading} id="collections-title" tabIndex={0}>作品索引</h2>
        <div className={styles.deck}>
          {groups.map((group, index) => <ArchiveGroup key={group[0].number} group={group} index={index}
            count={groups.length} progress={progress} reduced={reduced} />)}
        </div>
      </div>
    </div>
  </section>;
}
