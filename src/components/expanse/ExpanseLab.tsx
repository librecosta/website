'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Component, useCallback, useEffect, useState, type ReactNode } from 'react';
import { EXPANSE } from './parameters';
import styles from './expanse.module.css';

const ExpanseCanvas = dynamic(() => import('./ExpanseCanvas'), { ssr: false });

function Unavailable() {
  return <div className={styles.unavailable} role="status">
    <p>三维视图暂不可用</p>
    <p>可以继续切换下方观察点，阅读空间说明。此视图需要 WebGL2。</p>
    <button type="button" onClick={() => window.location.reload()}>刷新后重试</button>
  </div>;
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <Unavailable /> : this.props.children; }
}

export default function ExpanseLab() {
  const [view, setView] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [ready, setReady] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const onContextLost = useCallback(() => { setContextLost(true); setReady(false); }, []);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 700px)');
    const update = () => setMobile(query.matches);
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const selected = EXPANSE.views[view];
  return <main className={styles.lab}>
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>LibreCosta</Link>
      <div className={styles.title}><h1>The Expanse</h1><span>荒原 · 空间研究</span></div>
      <span className={styles.revision}>P1-A</span>
    </header>
    <figure className={styles.stage} aria-label={`${selected.label}：${selected.description}`} data-view={selected.id}>
      <SceneBoundary>
        {contextLost ? <Unavailable /> : <ExpanseCanvas view={view} mobile={mobile} onReady={onReady} onContextLost={onContextLost} />}
        {!ready && !contextLost && <p className={styles.loading} role="status">正在准备三维视图</p>}
      </SceneBoundary>
      <noscript><p className={styles.unavailable}>JavaScript 未启用。空间说明保留在页面下方。</p></noscript>
      <figcaption className={styles.caption}><span>苍白荒漠 / 几何巨构</span><span>固定观察点</span></figcaption>
    </figure>
    <footer className={styles.observations}>
      <nav className={styles.views} aria-label="固定观察视点">
        {EXPANSE.views.map((preset, index) => <button key={preset.id} type="button"
          aria-pressed={index === view} onClick={() => setView(index)}>
          <span className={styles.number}>0{index + 1}</span>{preset.label}
        </button>)}
      </nav>
      <p className={styles.description} aria-live="polite">{selected.description}</p>
      <noscript><ol>{EXPANSE.views.map(preset => <li key={preset.id}>{preset.label}：{preset.description}</li>)}</ol></noscript>
    </footer>
  </main>;
}
