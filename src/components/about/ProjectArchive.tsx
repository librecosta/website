import { useRef, useSyncExternalStore, type CSSProperties } from 'react';
import { m, useMotionValueEvent, useScroll, useTransform, type MotionValue } from 'motion/react';
import styles from './project-archive.module.css';

type ProjectCard = {
  number: string;
  preview?: { src: string; alt: string; width: number; height: number; background: string };
  title: string;
  summary: string;
  status: string;
  entry?: { href: string; label: string };
  source?: string;
};

const cards: readonly ProjectCard[] = [
  {
    number: '01',
    title: 'GoFurry',
    summary: '面向 Furry 社群的浏览器起始页与资源发现平台。',
    status: '开发中',
    source: 'https://github.com/librecosta/gofurry',
    preview: { src: '/about/gofurry-og.png', alt: '浅橙色背景上的 GoFurry 标志与字标', width: 1200, height: 630, background: '#ffdec2' },
  },
  {
    number: '02',
    title: 'Tool4Furry',
    summary: '面向 Furry 创作者的开源浏览器工具箱。',
    status: '开发中',
    source: 'https://github.com/librecosta/tool4furry',
    preview: { src: '/about/tool4furry-og.png', alt: '深灰背景上的白色 Tool4Furry 标志与字标', width: 1200, height: 630, background: '#30343a' },
  },
  {
    number: '03',
    title: 'GopherAtlas',
    summary: '面向 Go 开发者的技术出版平台，汇集原创实践、精选文章与专题阅读。',
    status: '持续更新',
    entry: { href: 'https://gopheratlas.com/', label: '访问官网' },
    preview: { src: '/about/gopheratlas-og.png', alt: '深色背景上的 GopherAtlas 品牌字标', width: 1200, height: 630, background: '#101215' },
  },
  {
    number: '04',
    title: 'LibreCosta Uptime',
    summary: '轻量、可自托管的 HTTP/HTTPS 可用性监测与告警工具。',
    status: '已发布',
    entry: { href: 'https://github.com/librecosta/uptime/releases', label: '查看发布版' },
    preview: { src: '/about/uptime-dashboard.webp', alt: 'LibreCosta Uptime 仪表盘，显示服务状态、可用率和监测时间线', width: 1672, height: 941, background: '#f1f6fd' },
  },
  {
    number: '05',
    title: 'SoFarAway',
    summary: '一款将高速飞行与音乐节奏融为一体的浏览器游戏，画面与音乐均在运行时程序化生成。',
    status: '开发中',
    entry: { href: 'https://sofaraway.librecosta.com/', label: '访问官网' },
  },
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
        {card.source && <a href={card.source} target="_blank" rel="noopener noreferrer" aria-label={`${card.title} GitHub 源码`}>GitHub 源码</a>}
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
