'use client';

import dynamic from 'next/dynamic';
import { Component, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Camera } from 'three';
import { EXPANSE, SKY_VIEWS, WIND_VIEWS, type JourneySignal, type SkyView, type WindView } from './parameters';
import { mapJourneyProgress } from './journey-timing';
import { ExpanseInstrument, WordmarkStudy } from './ExpanseInstrument';
import { ExpanseAudioLevels } from './ExpanseAudio';
import { ExpanseNarrative, ExpanseTranscript } from './ExpanseNarrative';
import { narrativeTiming, type NarrativeBeat, type NarrativeCue } from './narrative';
import styles from './expanse.module.css';

const ExpanseCanvas = dynamic(() => import('./ExpanseCanvas'), { ssr: false });

function progressText({ raw, value }: Pick<JourneySignal, 'raw' | 'value'>, staticView: boolean) {
  const journey = staticView ? EXPANSE.journey.reducedProgress : mapJourneyProgress(value, EXPANSE.journey.timing);
  return `章节 ${(raw * 100).toFixed(1)}% / 平滑 ${(value * 100).toFixed(1)}% / 原路径 u=${journey.toFixed(3)}`;
}

function Unavailable() {
  return <div className={styles.unavailable} role="status">
    <h1>The Expanse</h1>
    <p>连续沙脊围出苍白浅谷。稀疏的倾斜柱阵之后，更高的巨构隐入远方。</p>
    <p>三维视图暂不可用。此体验需要 WebGL2。</p>
    <a href="#expanse-transcript">阅读本幕</a>
    <button type="button" onClick={() => window.location.reload()}>刷新后重试</button>
  </div>;
}

class SceneBoundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFail(); }
  render() { return this.state.failed ? <Unavailable /> : this.props.children; }
}

export default function ExpanseLab() {
  const root = useRef<HTMLElement>(null), hint = useRef<HTMLParagraphElement>(null);
  const stage = useRef<HTMLElement>(null);
  const debugOutput = useRef<HTMLOutputElement>(null);
  const progressBar = useRef<HTMLDivElement>(null), progressFill = useRef<HTMLSpanElement>(null);
  const distances = useRef({ intro: 0, travel: 0, hold: 0 });
  const narrativeLayer = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set<NarrativeBeat>());
  const shown = useRef<NarrativeBeat | null>(null);
  const [narrative, setNarrative] = useState<NarrativeCue>(null);
  const cameraRef = useRef<Camera>(null);
  const signal = useRef<JourneySignal>({ value: 0, raw: 0, invalidate: () => {} });
  const [mobile, setMobile] = useState(false), [mediaReduced, setMediaReduced] = useState(false);
  const [debug, setDebug] = useState(false), [forceReduced, setForceReduced] = useState(false);
  const [skyView, setSkyView] = useState<SkyView>('color');
  const [windView, setWindView] = useState<WindView>('transport');
  const [ready, setReady] = useState(false), [contextLost, setContextLost] = useState(false);
  const reduced = mediaReduced || forceReduced;
  const onReady = useCallback(() => setReady(true), []);
  const onContextLost = useCallback(() => { setContextLost(true); setReady(false); }, []);
  useEffect(() => {
    if (debugOutput.current) debugOutput.current.value = progressText(signal.current, reduced || contextLost);
  }, [debug, reduced, contextLost]);
  useEffect(() => {
    // A resize changes the film gate, not the travelled distance. Keep the
    // native scroll range fixed for this visit; the sticky stage stays fluid.
    const { introScreens, screens, holdScreens } = EXPANSE.journey;
    const height = window.innerHeight;
    distances.current = { intro: introScreens * height, travel: (screens - 1) * height, hold: holdScreens * height };
    const { intro, travel, hold } = distances.current;
    root.current?.style.setProperty('--journey-distance', `${intro + travel + hold}px`);
    const narrow = window.matchMedia('(max-width: 700px)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setMobile(narrow.matches); setMediaReduced(motion.matches); };
    update();
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === '1') {
      setDebug(true);
      const wind = params.get('wind');
      if (wind === 'static' || wind === 'concentration') setWindView(wind);
    }
    narrow.addEventListener('change', update); motion.addEventListener('change', update);
    return () => { narrow.removeEventListener('change', update); motion.removeEventListener('change', update); };
  }, []);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    signal.current.value = 0;
    signal.current.raw = 0;
    const element = root.current!, layer = narrativeLayer.current!;
    const { intro, travel, hold } = distances.current;
    let updateNarrative = () => {};
    const paint = () => {
      signal.current.invalidate();
      const progress = Math.max(0, Math.min(1, signal.current.raw));
      progressBar.current?.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
      if (debugOutput.current) debugOutput.current.value = progressText(signal.current, reduced || contextLost);
      updateNarrative();
    };
    const context = gsap.context(() => {
      if (reduced || contextLost) {
        shown.current = null;
        setNarrative(null);
        return;
      }
      const entranceEnd = `top+=${intro} top`;
      const updateEntrance = ({ progress }: ScrollTrigger) => {
        if (hint.current) hint.current.style.opacity = String(1 - progress * progress * (3 - 2 * progress));
        element.toggleAttribute('data-exploring', progress === 1);
      };
      ScrollTrigger.create({
        trigger: root.current, start: 'top top', end: entranceEnd,
        onUpdate: updateEntrance, onRefresh: updateEntrance,
      });

      const parts = layer.querySelectorAll('[data-brand-reveal] [data-reveal-part]');
      const brand = gsap.timeline({ paused: true, defaults: { autoAlpha: 1, y: 0, ease: 'sine.out' } });
      gsap.set(parts, { autoAlpha: 0, y: 9 });
      brand.to(parts[0], { duration: .25 }, narrativeTiming.brandStart)
        .to(parts[1], { duration: .22 }, .68)
        .to(parts[2], { duration: .18 }, .77)
        .to(parts[3], { duration: .16 }, .84);
      let previousOffset: number | undefined, forward = false;
      let openingOpacity = 1, logOpacity = 1, revealTime = 0;
      let routeStart = element.offsetTop;
      const clamp = gsap.utils.clamp(0, 1);
      const easeFade = gsap.parseEase('sine.inOut');
      const [cityIn, cityOut] = narrativeTiming.city;
      const [logFadeIn, logFadeOut] = narrativeTiming.logFade;
      updateNarrative = () => {
        const offset = window.scrollY - routeStart;
        const raw = mapJourneyProgress((offset - intro) / travel, EXPANSE.journey.timing);
        const path = mapJourneyProgress(signal.current.value, EXPANSE.journey.timing);
        const tail = clamp((offset - intro - travel) / hold);
        if (offset !== previousOffset) {
          forward = previousOffset !== undefined && offset > previousOffset;
          previousOffset = offset;
        }
        const nextOpeningOpacity = 1 - easeFade(clamp((offset / intro - .64) / .36));
        const nextLogOpacity = 1 - easeFade(clamp((tail - logFadeIn) / (logFadeOut - logFadeIn)));
        if (openingOpacity !== nextOpeningOpacity) {
          openingOpacity = nextOpeningOpacity;
          layer.style.setProperty('--opening-opacity', String(openingOpacity));
        }
        if (logOpacity !== nextLogOpacity) {
          logOpacity = nextLogOpacity;
          layer.style.setProperty('--log-opacity', String(logOpacity));
        }
        const showBrand = tail >= narrativeTiming.brandStart && path >= .995;
        const nextRevealTime = showBrand ? tail : 0;
        if (revealTime !== nextRevealTime) {
          revealTime = nextRevealTime;
          brand.time(revealTime);
        }
        let beat: NarrativeBeat | null = null;
        if (showBrand) beat = 'brand';
        else if (offset < intro) beat = 'opening';
        else if (raw >= cityIn && raw < cityOut && path >= cityIn && path < cityOut) beat = 'passage';
        else if (raw >= narrativeTiming.arrival && path >= narrativeTiming.arrival && tail < logFadeOut) beat = 'arrival';
        if (beat === shown.current) return;
        shown.current = beat;
        const animate = beat !== null && beat !== 'brand' && !seen.current.has(beat) && (beat === 'opening' || forward);
        if (beat) seen.current.add(beat);
        setNarrative(beat ? { beat, animate } : null);
      };
      ScrollTrigger.create({
        trigger: element, start: 'top top', end: 'bottom bottom',
        onUpdate: updateNarrative,
        onRefresh: trigger => { routeStart = trigger.start; updateNarrative(); },
      });
      const fill = progressFill.current;
      const follow = fill && gsap.quickTo(fill, 'scaleX', { duration: .55, ease: 'power2.out' });
      const updateScroll = (trigger: ScrollTrigger) => {
        signal.current.raw = trigger.progress;
        paint();
        follow?.(trigger.progress);
      };
      gsap.to(signal.current, {
        value: 1, ease: 'none', onUpdate: paint,
        scrollTrigger: { trigger: root.current, start: entranceEnd, end: `top+=${intro + travel} top`,
          scrub: EXPANSE.journey.scrubSeconds,
          onUpdate: updateScroll, onRefresh: updateScroll },
      });
    }, root);
    paint(); ScrollTrigger.refresh();
    return () => {
      context.revert();
      element.removeAttribute('data-exploring');
      layer.style.removeProperty('--opening-opacity');
      layer.style.removeProperty('--log-opacity');
    };
  }, [reduced, contextLost]);
  const seek = (progress: number, reveal = false) => {
    const { intro, travel, hold } = distances.current;
    const offset = progress === 0 ? 0 : intro + travel * progress + (reveal ? hold : 0);
    window.scrollTo({ top: root.current!.offsetTop + offset, behavior: 'instant' });
  };
  return <main ref={root} className={styles.journey} data-reduced={reduced || contextLost} data-ready={ready}
    style={{ '--journey-screens': EXPANSE.journey.screens, '--journey-intro': EXPANSE.journey.introScreens,
      '--journey-hold': EXPANSE.journey.holdScreens } as CSSProperties}>
    <figure ref={stage} className={styles.stage} aria-label="连续沙脊围出浅谷，稀疏柱阵之后是远方的主体巨构。">
      <SceneBoundary onFail={onContextLost}>
        {contextLost ? <Unavailable /> : <ExpanseCanvas stage={stage} signal={signal} mobile={mobile} reduced={reduced}
          debug={debug} skyView={skyView} windView={windView} cameraRef={cameraRef}
          onReady={onReady} onContextLost={onContextLost} />}
        {!ready && !contextLost && <p className={styles.loading} role="status">正在展开荒原</p>}
      </SceneBoundary>
      <ExpanseInstrument ready={ready} reduced={reduced} unavailable={contextLost} stage={stage}
        hint={hint} progressBar={progressBar} progressFill={progressFill} cameraRef={cameraRef} />
      <ExpanseNarrative layer={narrativeLayer} active={narrative} enabled={ready && !reduced && !contextLost} />
      <h1 className={styles.srOnly}>The Expanse — 荒原</h1>
      <noscript><div className={styles.unavailable}><p>连续沙脊与苍白浅谷，远方的倾斜柱阵与巨构。启用 JavaScript 后可进入空间。</p></div></noscript>
      {debug && <aside className={styles.debug} aria-label="场景调试">
        <output ref={debugOutput} aria-label="章节进度、平滑滚动与原路径位置">{progressText({ raw: 0, value: 0 }, false)}</output>
        <div>{([['起点 · Passage', 0], ['50%', .5], ['终点', 1]] as const)
          .map(([label, progress]) => <button key={label} type="button" disabled={reduced || contextLost} onClick={() => seek(progress)}>{label}</button>)}
          <button type="button" disabled={reduced || contextLost} onClick={() => seek(1, true)}>品牌</button>
        </div>
        <label><input type="checkbox" checked={forceReduced} onChange={event => setForceReduced(event.target.checked)} />验证减少动态效果</label>
        <label>风沙 <select disabled={reduced || contextLost} value={reduced ? 'static' : windView}
          onChange={event => setWindView(event.target.value as WindView)}>
          {Object.entries(WIND_VIEWS).map(([view, label]) => <option key={view} value={view}>{label}</option>)}
        </select></label>
        <label>天空分层 <select disabled={contextLost} value={skyView} onChange={event => setSkyView(event.target.value as SkyView)}>
          {Object.entries(SKY_VIEWS).map(([view, label]) => <option key={view} value={view}>{label}</option>)}
        </select></label>
        <WordmarkStudy />
        <ExpanseAudioLevels />
      </aside>}
      <figcaption className={styles.srOnly}>以页面滚动走近遗落巨构。随时停止，向上滚动可以原路返回。</figcaption>
    </figure>
    {(reduced || contextLost) && <ExpanseTranscript />}
  </main>;
}
