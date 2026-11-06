'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Component, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { EXPANSE, type JourneySignal } from './parameters';
import styles from './expanse.module.css';

const ExpanseCanvas = dynamic(() => import('./ExpanseCanvas'), { ssr: false });

function Unavailable() {
  return <div className={styles.unavailable} role="status">
    <h1>The Expanse</h1>
    <p>苍白荒原中，倾斜的巨构半埋于起伏地表。前方，两座巨板围出通向远方的门槛。</p>
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
  const debugOutput = useRef<HTMLOutputElement>(null);
  const signal = useRef<JourneySignal>({ value: 0, raw: 0, invalidate: () => {} });
  const [mobile, setMobile] = useState(false), [mediaReduced, setMediaReduced] = useState(false);
  const [debug, setDebug] = useState(false), [forceReduced, setForceReduced] = useState(false);
  const [ready, setReady] = useState(false), [contextLost, setContextLost] = useState(false);
  const reduced = mediaReduced || forceReduced;
  const onReady = useCallback(() => setReady(true), []);
  const onContextLost = useCallback(() => { setContextLost(true); setReady(false); }, []);
  useEffect(() => {
    if (debugOutput.current) debugOutput.current.value = `${(signal.current.raw * 100).toFixed(1)}% / ${(signal.current.value * 100).toFixed(1)}%`;
  }, [debug]);
  useEffect(() => {
    const narrow = window.matchMedia('(max-width: 700px)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setMobile(narrow.matches); setMediaReduced(motion.matches); };
    update(); setDebug(new URLSearchParams(window.location.search).get('debug') === '1');
    narrow.addEventListener('change', update); motion.addEventListener('change', update);
    return () => { narrow.removeEventListener('change', update); motion.removeEventListener('change', update); };
  }, []);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    signal.current.value = reduced || contextLost ? EXPANSE.journey.reducedProgress : 0;
    signal.current.raw = 0;
    const paint = () => {
      signal.current.invalidate();
      if (hint.current) hint.current.style.opacity = String(1 - Math.min(1, signal.current.value * 18));
      if (debugOutput.current) debugOutput.current.value = `${(signal.current.raw * 100).toFixed(1)}% / ${(signal.current.value * 100).toFixed(1)}%`;
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
    <figure className={styles.stage} aria-label="苍白荒原中，少量倾斜巨构半埋于地表，远方双板之间留有巨大的门槛。">
      <SceneBoundary onFail={onContextLost}>
        {contextLost ? <Unavailable /> : <ExpanseCanvas signal={signal} mobile={mobile} reduced={reduced}
          debug={debug} onReady={onReady} onContextLost={onContextLost} />}
        {!ready && !contextLost && <p className={styles.loading} role="status">正在展开荒原</p>}
      </SceneBoundary>
      <Link href="/" className={styles.brand} aria-label="LibreCosta 首页">LibreCosta</Link>
      <h1 className={styles.srOnly}>The Expanse — 荒原</h1>
      <figcaption className={styles.srOnly}>以页面滚动走近遗落巨构。随时停止，向上滚动可以原路返回。</figcaption>
      {!reduced && !contextLost && <p ref={hint} className={styles.hint}>滚动，走向远方<span aria-hidden="true" /></p>}
      {reduced && <p className={styles.staticNote}>静态观览 · 已减少动态效果</p>}
      <noscript><div className={styles.unavailable}><p>苍白荒原，倾斜巨构，通向远方的门槛。启用 JavaScript 后可进入空间。</p></div></noscript>
      {debug && <aside className={styles.debug} aria-label="场景调试">
        <output ref={debugOutput} aria-label="滚动进度与相机进度">0% / 0%</output>
        <div>{[0,.25,.55,.8,1].map(p => <button key={p} type="button" onClick={() => seek(p)}>{Math.round(p * 100)}%</button>)}</div>
        <label><input type="checkbox" checked={forceReduced} onChange={event => setForceReduced(event.target.checked)} />静态模式验证</label>
      </aside>}
    </figure>
  </main>;
}
