import { useRef, useSyncExternalStore, type CSSProperties } from 'react';
import { m, useMotionValueEvent, useScroll, useTransform, type MotionValue } from 'motion/react';
import styles from './project-archive.module.css';

type ProjectCard = {
  number: string;
  preview?: { src: string; alt: string; background: string };
  title?: string;
  summary?: string;
  status?: string;
  website?: string;
  source?: string;
};

const cards: readonly ProjectCard[] = [
  {
    number: '01',
    title: 'GoFurry',
    summary: '面向 Furry 社群的浏览器起始页与资源发现平台。',
    status: '开发中',
    source: 'https://github.com/librecosta/gofurry',
    preview: { src: '/about/gofurry-og.png', alt: '浅橙色背景上的 GoFurry 标志与字标', background: '#ffdec2' },
  },
  {
    number: '02',
    title: 'Tool4Furry',
    summary: '面向 Furry 创作者的开源浏览器工具箱。',
    status: '开发中',
    source: 'https://github.com/librecosta/tool4furry',
    preview: { src: '/about/tool4furry-og.png', alt: '深灰背景上的白色 Tool4Furry 标志与字标', background: '#30343a' },
  },
  { number: '03' },
  { number: '04' },
  { number: '05' },
];
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

function ArchiveCard({ card, linksInert }: { card: ProjectCard; linksInert: MotionValue<boolean> }) {
  const entries = useRef<HTMLDivElement>(null);
  useMotionValueEvent(linksInert, 'change', inert => {
    if (entries.current) entries.current.inert = inert;
  });

  return <article className={styles.card} data-filled={Boolean(card.title)} aria-label={card.title ?? `项目档案 ${card.number}`}>
    <header className={styles.cardHeader}><span>{card.number}</span></header>
    <div className={styles.preview} style={card.preview ? { background: card.preview.background } : undefined}>
      {card.preview ? <img src={card.preview.src} alt={card.preview.alt} width={1200} height={630} /> : <svg viewBox="0 0 96 80" fill="none" aria-hidden="true">
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
      <div className={styles.entries} ref={entries} inert={linksInert.get()}>
        {card.website && <a href={card.website} target="_blank" rel="noopener noreferrer">访问项目</a>}
        {card.source && <a href={card.source} target="_blank" rel="noopener noreferrer" aria-label={`${card.title} GitHub 源码`}>GitHub 源码</a>}
        {!card.website && !card.source && <span className={styles.entryPlaceholder} aria-hidden="true" />}
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
  // Keep source links out of the focus order while their group is concealed by the stack.
  const linksInert = useTransform(distance, value => !reduced && Math.abs(value) > .015);
  const style = {
    '--group-index': index,
    ...(reduced ? {} : { scale, y, opacity, filter }),
  };
  return <m.div className={styles.group} style={style}>
    {group.map(card => <ArchiveCard key={card.number} card={card} linksInert={linksInert} />)}
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
