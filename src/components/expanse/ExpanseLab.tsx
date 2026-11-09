'use client';

import dynamic from 'next/dynamic';
import { Component, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { EXPANSE, SKY_VIEWS, WIND_VIEWS, type JourneySignal, type SkyView, type WindView } from './parameters';
import { mapJourneyProgress } from './journey-timing';
import { ExpanseInstrument, WordmarkStudy } from './ExpanseInstrument';
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
    root.current?.style.setProperty('--journey-distance', `${(EXPANSE.journey.screens - 1) * window.innerHeight}px`);
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
    const paint = () => {
      signal.current.invalidate();
      const progress = Math.max(0, Math.min(1, signal.current.raw));
      if (hint.current) hint.current.style.opacity = String(1 - Math.min(1, progress / .02));
      if (progressFill.current) progressFill.current.style.transform = `scaleX(${progress})`;
      progressBar.current?.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
      if (debugOutput.current) debugOutput.current.value = progressText(signal.current, reduced || contextLost);
    };
    const context = gsap.context(() => {
      if (!reduced && !contextLost) gsap.to(signal.current, {
        value: 1, ease: 'none', onUpdate: paint,
        scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom bottom',
          scrub: EXPANSE.journey.scrubSeconds,
          onUpdate: self => { signal.current.raw = self.progress; paint(); },
          onRefresh: self => { signal.current.raw = self.progress; paint(); } },
      });
    }, root);
    paint(); ScrollTrigger.refresh();
    return () => context.revert();
  }, [reduced, contextLost]);
  const seek = (progress: number) => {
    const distance = Math.max(0, root.current!.offsetHeight - window.innerHeight);
    window.scrollTo({ top: root.current!.offsetTop + distance * progress, behavior: 'instant' });
  };
  return <main ref={root} className={styles.journey} data-reduced={reduced || contextLost} data-ready={ready}
    style={{ '--journey-screens': EXPANSE.journey.screens } as CSSProperties}>
    <figure ref={stage} className={styles.stage} aria-label="连续沙脊围出浅谷，稀疏柱阵之后是远方的主体巨构。">
      <SceneBoundary onFail={onContextLost}>
        {contextLost ? <Unavailable /> : <ExpanseCanvas stage={stage} signal={signal} mobile={mobile} reduced={reduced}
          debug={debug} skyView={skyView} windView={windView}
          onReady={onReady} onContextLost={onContextLost} />}
        {!ready && !contextLost && <p className={styles.loading} role="status">正在展开荒原</p>}
      </SceneBoundary>
      <ExpanseInstrument ready={ready} reduced={reduced} unavailable={contextLost}
        hint={hint} progressBar={progressBar} progressFill={progressFill} />
      <h1 className={styles.srOnly}>The Expanse — 荒原</h1>
      <noscript><div className={styles.unavailable}><p>连续沙脊与苍白浅谷，远方的倾斜柱阵与巨构。启用 JavaScript 后可进入空间。</p></div></noscript>
      {debug && <aside className={styles.debug} aria-label="场景调试">
        <output ref={debugOutput} aria-label="章节进度、平滑滚动与原路径位置">{progressText({ raw: 0, value: 0 }, false)}</output>
        <div>{([['起点 · Passage', 0], ['50%', .5], ['终点', 1]] as const)
          .map(([label, progress]) => <button key={label} type="button" disabled={reduced || contextLost} onClick={() => seek(progress)}>{label}</button>)}</div>
        <label><input type="checkbox" checked={forceReduced} onChange={event => setForceReduced(event.target.checked)} />验证减少动态效果</label>
        <label>风沙 <select disabled={reduced || contextLost} value={reduced ? 'static' : windView}
          onChange={event => setWindView(event.target.value as WindView)}>
          {Object.entries(WIND_VIEWS).map(([view, label]) => <option key={view} value={view}>{label}</option>)}
        </select></label>
        <label>天空分层 <select disabled={contextLost} value={skyView} onChange={event => setSkyView(event.target.value as SkyView)}>
          {Object.entries(SKY_VIEWS).map(([view, label]) => <option key={view} value={view}>{label}</option>)}
        </select></label>
        <a href="/lab/monument-surface">主碑展开图</a>
        <WordmarkStudy />
      </aside>}
      <figcaption className={styles.srOnly}>以页面滚动走近遗落巨构。随时停止，向上滚动可以原路返回。</figcaption>
    </figure>
  </main>;
}
