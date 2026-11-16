'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  LazyMotion, animate, cubicBezier, domAnimation, m, useAnimate, useMotionValue,
  useReducedMotion, useScroll, useTransform,
  type MotionValue,
} from 'motion/react';
import { WorkshopFrame } from '@/components/WorkshopFrame';
import { AboutSectionNav, AboutScrollGauge, scrollToAboutSection } from './AboutControls';
import { AboutClosing } from './AboutClosing';
import { ProjectArchive } from './ProjectArchive';
import { PracticeSection } from './PracticeSection';
import styles from './about.module.css';

const openingEase = [.22, .66, .24, 1] as const;

function Opening({ reduced }: { reduced: boolean }) {
  const [scope, animate] = useAnimate<HTMLElement>();
  const { scrollYProgress } = useScroll({ target: scope, offset: ['start start', 'end start'] });
  const opacity = useTransform(scrollYProgress, [0, .22, .59], [1, 1, 0]);
  const firstLineY = useTransform(scrollYProgress, [0, .1, .72, 1], ['0%', '0%', '-20%', '-42%']);
  const secondLineY = useTransform(scrollYProgress, [0, .17, .76, 1], ['0%', '0%', '-12%', '-36%']);
  const captionY = useTransform(scrollYProgress, [0, .23, .82], [0, 0, -18]);

  useEffect(() => {
    if (reduced || window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.scrollY > 40) return;
    const animation = animate([
      ['[data-opening-line="first"]', { y: ['105%', '0%'], x: ['-.28em', '0em'] }, { duration: .83, ease: openingEase }],
      ['[data-opening-line="second"]', { y: ['105%', '0%'], x: ['.22em', '0em'] }, { at: .13, duration: .89, ease: openingEase }],
      ['[data-opening-brand]', { y: ['105%', '0%'] }, { at: .48, duration: .43, ease: openingEase }],
      ['[data-opening-description]', { y: ['105%', '0%'] }, { at: .61, duration: .45, ease: openingEase }],
    ]);
    const stopWatching = scrollYProgress.on('change', progress => {
      if (progress > .14) animation.complete();
    });
    void animation.then(stopWatching);
    return () => { stopWatching(); animation.cancel(); };
  }, [animate, reduced, scrollYProgress]);

  return <section className={styles.opening} ref={scope} id="opening" aria-labelledby="about-title">
    <m.div className={styles.openingContent} style={reduced ? undefined : { opacity }} data-about-motion>
      <h1 className={styles.openingTitle} id="about-title" lang="en">
        <span className={styles.lineMask}>
          <m.span style={reduced ? undefined : { y: firstLineY }} data-about-motion>
            <span data-opening-line="first">Independent software,</span>
          </m.span>
        </span>
        <span className={styles.lineMask}>
          <m.span style={reduced ? undefined : { y: secondLineY }} data-about-motion>
            <span data-opening-line="second">Thoughtfully built.</span>
          </m.span>
        </span>
      </h1>
      <m.p className={styles.openingCaption} style={reduced ? undefined : { y: captionY }} data-about-motion>
        <span className={styles.captionMask}><strong data-opening-brand>LibreCosta · 远岸开物</strong></span>
        <span className={styles.captionMask}><span data-opening-description>独立软件、效率工具与数字体验</span></span>
      </m.p>
    </m.div>
    <m.button type="button" className={styles.explore} aria-controls="studio"
      onClick={() => scrollToAboutSection('studio', reduced)} whileTap={reduced ? undefined : { scale: .96 }}>
      <svg viewBox="0 0 10 12" aria-hidden="true" fill="currentColor"><path d="M1 2h8L5 6zm0 5h8l-4 4z" /></svg>
      探索 LibreCosta
    </m.button>
  </section>;
}

const studioLines = ['FROM THE TOOLS', 'WE USE TO THE WORLDS', 'WE IMAGINE.'] as const;
const studioEase = cubicBezier(.35, .05, .26, 1);
const studioTransition = { ease: studioEase };

function useStudioEntrance(target: RefObject<HTMLElement | null>, amount: number, reduced: boolean) {
  const entrance = useMotionValue(0);

  useEffect(() => {
    if (reduced) { entrance.jump(0); return; }
    const element = target.current;
    if (!element) return;
    let destination = 0;
    let animation: ReturnType<typeof animate> | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      // Keep the entrance settled throughout the scroll-driven exit.
      const next = entry.intersectionRatio >= amount ? 1 : entry.isIntersecting ? destination : 0;
      if (next === destination) return;
      destination = next;
      animation?.stop();
      animation = animate(entrance, destination, { duration: destination ? 1.45 : .35, ease: 'linear' });
    }, { threshold: [0, amount] });
    observer.observe(element);
    return () => { observer.disconnect(); animation?.stop(); };
  }, [amount, entrance, reduced, target]);

  return entrance;
}

function StudioLine({ children, entrance, progress, index, reduced }: {
  children: string; entrance: MotionValue<number>; progress: MotionValue<number>; index: number; reduced: boolean;
}) {
  const delay = index * .1;
  const x = useTransform(entrance, [delay, .78 + delay], [[-16, 22, -10][index], 0], studioTransition);
  const revealY = useTransform(entrance, [delay, .78 + delay], [106, 0], studioTransition);
  const exitDelay = index * .018;
  const exitY = useTransform(progress, [.67 + exitDelay, .92 + exitDelay], [0, -32]);
  const y = useTransform(() => `${revealY.get() + exitY.get()}%`);
  const opacity = useTransform(progress, [.69 + exitDelay, .93 + exitDelay], [1, 0]);
  const mobileOffset = useTransform(revealY, value => `${value * .055}px`);
  const style = { x, y, opacity, '--studio-offset': mobileOffset };
  return <span className={styles.lineMask}>
    <m.span style={reduced ? undefined : style} data-about-motion>{children}</m.span>
  </span>;
}

function Studio({ reduced }: { reduced: boolean }) {
  const statement = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const entrance = useStudioEntrance(title, .72, reduced);
  const { scrollYProgress } = useScroll({ target: statement, offset: ['start end', 'end start'] });

  return <section id="studio" aria-labelledby="studio-statement">
    <div className={styles.statement} ref={statement}>
      <div>
        <p className={styles.label}>从实用软件，到创意体验</p>
        <h2 ref={title} className={`${styles.display} ${styles.studioTitle}`} id="studio-statement" lang="en" aria-label={studioLines.join(' ')}>
          {studioLines.map((line, index) => <StudioLine key={line} entrance={entrance} progress={scrollYProgress} index={index} reduced={reduced}>{line}</StudioLine>)}
        </h2>
        <p className={styles.statementCopy}>
          我们从真实的需求出发，也始终为好奇心留下空间。<br />
          每一个工具、每一次实验，都是让想法成为现实的更进一步。
        </p>
      </div>
    </div>
    <StudioProfile reduced={reduced} />
  </section>;
}

function StudioProfileMark({ className }: { className: string }) {
  return <svg className={`${styles.profileMark} ${className}`} viewBox="0 0 220 120" aria-hidden="true" focusable="false">
    <path d="M0 42H36 M52 42H220 M44 0V34 M44 50V120 M44 34L52 42L44 50L36 42Z" />
  </svg>;
}

function StudioProfile({ reduced }: { reduced: boolean }) {
  const profile = useRef<HTMLDivElement>(null);
  const entrance = useStudioEntrance(profile, .47, reduced);
  const identityX = useTransform(entrance, [0, .77], [-16, 0], studioTransition);
  const identityY = useTransform(entrance, [0, .77], [26, 0], studioTransition);
  const copyX = useTransform(entrance, [.18, 1], [22, 0], studioTransition);
  const copyY = useTransform(entrance, [.18, 1], [52, 0], studioTransition);
  const identityStyle = { x: identityX, y: identityY, '--studio-offset': useTransform(identityY, value => `${value * .17}px`) };
  const copyStyle = { x: copyX, y: copyY, '--studio-offset': useTransform(copyY, value => `${value * .13}px`) };

  return <div className={`${styles.contentWidth} ${styles.profile}`} ref={profile}>
    <m.div className={styles.profileIdentity} style={reduced ? undefined : identityStyle} data-about-motion>
      <StudioProfileMark className={styles.profileMarkLeft} />
      <h3 className={styles.label} lang="en">About LibreCosta</h3>
      <dl className={styles.details}>
        <div><dt>品牌</dt><dd>LibreCosta · 远岸开物</dd></div>
        <div><dt>运营主体</dt><dd>成都远岸开物科技有限公司</dd></div>
      </dl>
    </m.div>
    <m.div className={styles.profileCopy} style={reduced ? undefined : copyStyle} data-about-motion>
      <StudioProfileMark className={styles.profileMarkRight} />
      <p className={styles.lead}>LibreCosta 开发面向社群、创作者和开发者的软件产品，包括在线服务、效率工具和可自行部署的开源系统。同时，我们也投入网页交互、图形技术与数字体验的创作。</p>
      <p>我们在 GitHub 维护开源项目，并通过 GopherAtlas 分享技术文章、实验记录与工程实践。从软件的实际用途到实现过程中的设计取舍，这些作品与记录都是我们持续探索的一部分。</p>
    </m.div>
  </div>;
}

function AboutContents({ reduced }: { reduced: boolean }) {
  return <>
    <Opening reduced={reduced} />
    <Studio reduced={reduced} />
    <ProjectArchive reduced={reduced} />
    <PracticeSection reduced={reduced} />
    <AboutClosing reduced={reduced} />
  </>;
}

export function AboutExperience() {
  const [ready, setReady] = useState(false);
  const reducedMotion = useReducedMotion();
  const reduced = !ready || reducedMotion === true;
  const { scrollYProgress } = useScroll({ trackContentSize: true });
  useEffect(() => setReady(true), []);

  return <LazyMotion features={domAnimation}>
    <WorkshopFrame route="/about" className={styles.about} reduced={reduced}
      sectionNav={<AboutSectionNav progress={scrollYProgress} reduced={reduced} />}
      scrollGauge={<AboutScrollGauge progress={scrollYProgress} reduced={reduced} />}>
      <main className={styles.main}>
        <AboutContents reduced={reduced} />
      </main>
    </WorkshopFrame>
  </LazyMotion>;
}
