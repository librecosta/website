import { useRef, useSyncExternalStore, type CSSProperties } from 'react';
import { m, useMotionValueEvent, useScroll, useTransform, type MotionValue } from 'motion/react';
import { useSiteCopy } from '@/site/LocaleProvider';
import { projectPreviews } from '../project-previews';
import styles from './project-archive.module.css';

type ProjectCard = {
  number: string;
  preview?: { src: string; alt: string; width: number; height: number; background: string };
  title: string;
  summary: string;
  status: string;
  entry?: { href: string; label: string };
  source?: string;
  sourceLabel?: string;
};

const archiveEntries = [
  { id: 'gofurry', title: 'GoFurry', status: 'development', href: 'https://github.com/librecosta/gofurry', action: 'source' },
  { id: 'tool4furry', title: 'Tool4Furry', status: 'development', href: 'https://github.com/librecosta/tool4furry', action: 'source' },
  { id: 'gopheratlas', title: 'GopherAtlas', status: 'ongoing', href: 'https://gopheratlas.com/', action: 'site' },
  { id: 'uptime', title: 'LibreCosta Uptime', status: 'released', href: 'https://github.com/librecosta/uptime/releases', action: 'releases' },
  { id: 'sofaraway', title: 'SoFarAway', status: 'development', href: 'https://sofaraway.librecosta.com/', action: 'site' },
] as const;
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

  const { preview } = card;

  return <article className={styles.card} aria-label={card.title}>
    <header className={styles.cardHeader}><span>{card.number}</span></header>
    <div className={styles.preview} style={preview ? { background: preview.background } : undefined}>
      {preview ? <img src={preview.src} alt={preview.alt} width={preview.width} height={preview.height} /> : <svg viewBox="0 0 96 80" fill="none" aria-hidden="true">
        <path className={styles.drawingGuide} d="M10 40h76M48 6v68M13 13h8m-8 0v8m70 46h-8m8 0v-8" />
        <path className={styles.drawingOutline} d="M48 15 74 40 48 65 22 40Z M48 27 62 40 48 53 34 40Z" />
      </svg>}
    </div>
    <div className={styles.description}>
      <h3>{card.title}</h3>
      <p>{card.summary}</p>
    </div>
    <footer className={styles.cardFooter}>
      <span>{card.status}</span>
      <div className={styles.entries} ref={entries} inert={linksInert.get()}>
        {card.entry && <a href={card.entry.href} target="_blank" rel="noopener noreferrer" aria-label={`${card.entry.label} · ${card.title}`}>{card.entry.label}</a>}
        {card.source && <a href={card.source} target="_blank" rel="noopener noreferrer" aria-label={`${card.title} ${card.sourceLabel ?? 'GitHub 源码'}`}>{card.sourceLabel ?? 'GitHub 源码'}</a>}
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
  const brightness = useTransform(distance, [0, 1, 2], [1, .38, .28]);
  const filter = useTransform(brightness, value => value === 1 ? 'none' : `brightness(${value})`);
  const detailOpacity = useTransform(distance, [0, .38], [1, 0]);
  // Keep source links out of the focus order while their group is concealed by the stack.
  const linksInert = useTransform(distance, value => !reduced && Math.abs(value) > .015);

  const style = {
    '--group-index': index,
    ...(reduced ? {} : { scale, y, opacity, filter, '--archive-detail-opacity': detailOpacity }),
  };
  return <m.div className={styles.group} style={style}>
    {group.map(card => <ArchiveCard key={card.number} card={card} linksInert={linksInert} />)}
  </m.div>;
}

export function ProjectArchive({ reduced }: { reduced: boolean }) {
  const { about: { collections: copy }, works } = useSiteCopy();
  const cards = archiveEntries.map(({ id, title, status, href, action }, index): ProjectCard => ({
    number: `0${index + 1}`, title, summary: copy.descriptions[id], status: works.statuses[status],
    preview: { ...projectPreviews[id], alt: works.projects[id].alt },
    ...(action === 'source' ? { source: href, sourceLabel: copy.source } : { entry: { href, label: copy[action] } }),
  }));
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
        <h2 className={styles.heading} id="collections-title" tabIndex={0}>{copy.label}</h2>
        <div className={styles.deck}>
          {groups.map((group, index) => <ArchiveGroup key={group[0].number} group={group} index={index}
            count={groups.length} progress={progress} reduced={reduced} />)}
        </div>
      </div>
    </div>
  </section>;
}
