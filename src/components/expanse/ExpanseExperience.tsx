'use client';

import dynamic from 'next/dynamic';
import { Component, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Camera } from 'three';
import { useSiteAudio } from '@/components/audio/AudioProvider';
import { useSiteCopy } from '@/site/LocaleProvider';
import type { AudioCue } from '@/components/audio/site-audio';
import { EXPANSE, SKY_VIEWS, WIND_VIEWS, type JourneySignal, type SkyView, type WindView } from './parameters';
import { mapJourneyProgress } from './journey-timing';
import { ExpanseInstrument, WordmarkStudy } from './ExpanseInstrument';
import { ExpanseAudioLevels } from './ExpanseAudio';
import { ExpanseNarrative, ExpanseTranscript } from './ExpanseNarrative';
import { narrativeTiming, witnessSequence, type NarrativeEndpoint, type ObservationId, type WitnessId } from './narrative';
import { ExpanseSignals, SignalReadouts } from './ExpanseSignals';
import { ExpanseLoading, type LoadingPhase } from './ExpanseLoading';
import type { ObservationElements } from './ObservationProjection';
import styles from './expanse.module.css';

const ExpanseCanvas = dynamic(() => import('./ExpanseCanvas'), { ssr: false });
const scanCue = {
  bones: 'scanBones', ruin: 'scanRuin', ring: 'scanRing', airship: 'scanRing', dune: 'scanBones',
} satisfies Record<ObservationId, AudioCue>;

function progressText({ raw, value }: Pick<JourneySignal, 'raw' | 'value'>, staticView: boolean) {
  const journey = staticView ? EXPANSE.journey.reducedProgress : mapJourneyProgress(value, EXPANSE.journey.timing);
  return `章节 ${(raw * 100).toFixed(1)}% / 平滑 ${(value * 100).toFixed(1)}% / 原路径 u=${journey.toFixed(3)}`;
}

function Unavailable() {
  const copy = useSiteCopy().world;
  return <div className={styles.unavailable} role="status">
    <h1>The Expanse</h1>
    <p>{copy.landscape}</p>
    <p>{copy.webgl}</p>
    <a href="#expanse-transcript">{copy.readAct}</a>
    <button type="button" onClick={() => window.location.reload()}>{copy.reload}</button>
  </div>;
}

class SceneBoundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFail(); }
  render() { return this.state.failed ? <Unavailable /> : this.props.children; }
}

export default function ExpanseExperience() {
  const copy = useSiteCopy().world;
  const root = useRef<HTMLElement>(null), hint = useRef<HTMLParagraphElement>(null);
  const stage = useRef<HTMLElement>(null);
  const editorHost = useRef<HTMLDivElement>(null), editorDragging = useRef(false);
  const editorToggle = useRef<HTMLButtonElement>(null);
  const debugOutput = useRef<HTMLOutputElement>(null);
  const progressBar = useRef<HTMLDivElement>(null), progressFill = useRef<HTMLSpanElement>(null);
  const distances = useRef({ intro: 0, travel: 0, hold: 0 });
  const triggeredSubtitles = useRef<readonly WitnessId[]>([]);
  const sceneReady = useRef(false);
  const syncNarrative = useRef<(() => void) | null>(null);
  const [subtitles, setSubtitles] = useState<readonly WitnessId[]>([]);
  const [endpointState, setEndpointState] = useState<NarrativeEndpoint>('away');
  const observationElements = useRef<ObservationElements>({ buttons: {}, readouts: {}, card: null });
  const [observation, setObservation] = useState<ObservationId | null>(null);
  const [read, setRead] = useState<ReadonlySet<ObservationId>>(() => new Set());
  const { cue } = useSiteAudio();
  const cameraRef = useRef<Camera>(null);
  const signal = useRef<JourneySignal>({ value: 0, raw: 0, invalidate: () => {} });
  const invalidateScene = useCallback(() => signal.current.invalidate(), []);
  const [mobile, setMobile] = useState(false), [mediaReduced, setMediaReduced] = useState(false);
  const [debug, setDebug] = useState(false), [forceReduced, setForceReduced] = useState(false);
  const [skyView, setSkyView] = useState<SkyView>('color');
  const [windView, setWindView] = useState<WindView>('transport');
  const [phase, setPhase] = useState<LoadingPhase | 'failed'>('starting');
  const [revealed, setRevealed] = useState(false);
  const [editorStarted, setEditorStarted] = useState(false), [editorOpen, setEditorOpen] = useState(false);
  const closeEditor = useCallback(() => setEditorOpen(false), []);
  useEffect(() => {
    if (editorStarted && !editorOpen) editorToggle.current?.focus({ preventScroll: true });
  }, [editorOpen, editorStarted]);
  const reduced = mediaReduced || forceReduced;
  const ready = phase === 'ready';
  const contextLost = phase === 'failed';
  const showLoading = !contextLost && (!ready || !reduced && !revealed);
  const onRevealed = useCallback(() => setRevealed(true), []);
  const onLoading = useCallback((next: 'assets' | 'presenting') => {
    setPhase(current => current === 'starting' || current === 'assets' ? next : current);
  }, []);
  const onReady = useCallback(() => {
    sceneReady.current = true;
    setPhase(current => current === 'failed' ? current : 'ready');
    syncNarrative.current?.();
  }, []);
  const onContextLost = useCallback(() => {
    sceneReady.current = false;
    setPhase('failed');
    setObservation(null);
  }, []);
  useEffect(() => {
    if (ready || contextLost) return;
    let timeout: ReturnType<typeof setTimeout>;
    // A hidden tab can legitimately defer its first frame.
    function watchLoading() {
      clearTimeout(timeout);
      if (!document.hidden) timeout = setTimeout(onContextLost, 60_000);
    }
    watchLoading();
    document.addEventListener('visibilitychange', watchLoading);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('visibilitychange', watchLoading);
    };
  }, [ready, contextLost, onContextLost]);
  const closeObservation = useCallback(() => {
    if (!observation) return;
    const marker = observationElements.current.buttons[observation];
    if (marker?.dataset.state === 'visible') marker.focus({ preventScroll: true });
    setObservation(null);
  }, [observation]);
  const selectObservation = (id: ObservationId) => {
    if (id === observation) { closeObservation(); return; }
    cue(scanCue[id]);
    setRead(previous => previous.has(id) ? previous : new Set([...previous, id]));
    setObservation(id);
  };
  useEffect(() => {
    if (!observation) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') closeObservation(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [observation, closeObservation]);
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
    if (process.env.NODE_ENV === 'development') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('debug') === '1') {
        setDebug(true);
        const wind = params.get('wind');
        if (wind === 'static' || wind === 'concentration') setWindView(wind);
      }
    }
    narrow.addEventListener('change', update); motion.addEventListener('change', update);
    return () => { narrow.removeEventListener('change', update); motion.removeEventListener('change', update); };
  }, []);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    signal.current.value = 0;
    signal.current.raw = 0;
    const element = root.current!;
    const { intro, travel } = distances.current;
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
        setEndpointState('away');
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

      let routeStart = element.offsetTop;
      let furthestRawPath = -1;
      let lastEndpointState: NarrativeEndpoint = 'away';
      const endpoint = Math.round(intro + travel);
      updateNarrative = () => {
        if (!sceneReady.current) return;
        const offset = window.scrollY - routeStart;
        const raw = offset >= Math.round(intro)
          ? mapJourneyProgress((offset - intro) / travel, EXPANSE.journey.timing) : -1;
        const path = mapJourneyProgress(signal.current.value, EXPANSE.journey.timing);
        // Follow the camera on the way in. A reversal still owes every cue
        // crossed by native scroll while the camera was catching up.
        furthestRawPath = Math.max(furthestRawPath, raw);
        const progress = raw < furthestRawPath ? furthestRawPath : Math.min(raw, path);
        const triggered = triggeredSubtitles.current;
        const next = witnessSequence.filter(record => record.path <= progress && !triggered.includes(record.id));
        if (next.length) {
          triggeredSubtitles.current = [...triggered, ...next.map(record => record.id)];
          setSubtitles(triggeredSubtitles.current);
        }
        const endpointState = offset >= endpoint && path >= narrativeTiming.brandSettledPath ? 'reached'
          : offset >= endpoint - narrativeTiming.brandExitPixels ? 'near' : 'away';
        if (endpointState !== lastEndpointState) {
          lastEndpointState = endpointState;
          setEndpointState(endpointState);
        }
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
    syncNarrative.current = updateNarrative;
    paint(); ScrollTrigger.refresh();
    return () => {
      syncNarrative.current = null;
      context.revert();
      element.removeAttribute('data-exploring');
    };
  }, [reduced, contextLost]);
  const seek = (progress: number) => {
    const { intro, travel } = distances.current;
    const offset = progress === 0 ? 0 : intro + travel * progress;
    window.scrollTo({ top: root.current!.offsetTop + offset, behavior: 'instant' });
  };
  return <main ref={root} className={styles.journey} data-reduced={reduced || contextLost} data-ready={ready}
    style={{ '--journey-screens': EXPANSE.journey.screens, '--journey-intro': EXPANSE.journey.introScreens,
      '--journey-hold': EXPANSE.journey.holdScreens } as CSSProperties}>
    <figure ref={stage} className={styles.stage} aria-label={copy.sceneLabel}>
      <SceneBoundary onFail={onContextLost}>
        {contextLost ? <Unavailable /> : <ExpanseCanvas stage={stage} signal={signal} mobile={mobile} reduced={reduced}
          debug={debug} skyView={skyView} windView={windView} cameraRef={cameraRef} observationElements={observationElements}
          editor={editorStarted ? { host: editorHost, open: editorOpen, close: closeEditor } : undefined}
          editorDragging={editorDragging}
          onLoading={onLoading} onReady={onReady} onContextLost={onContextLost} />}
      </SceneBoundary>
      <div inert={showLoading}>
        <ExpanseInstrument ready={ready} reduced={reduced} unavailable={contextLost} stage={stage}
          hint={hint} progressBar={progressBar} progressFill={progressFill} cameraRef={cameraRef} />
        <ExpanseSignals elements={observationElements} enabled={ready && !contextLost}
          active={observation} read={read} onSelect={selectObservation}
          invalidate={invalidateScene} />
        <ExpanseNarrative subtitles={subtitles} endpointState={endpointState}
          ready={ready} reduced={reduced} unavailable={contextLost} />
        <h1 className={styles.srOnly}>{copy.title}</h1>
        {process.env.NODE_ENV === 'development' && debug && <aside className={styles.debug} data-editor-open={editorOpen && !contextLost} aria-label="场景调试">
          <output ref={debugOutput} aria-label="章节进度、平滑滚动与原路径位置">{progressText({ raw: 0, value: 0 }, false)}</output>
          <div>主线 {subtitles.length} / {witnessSequence.length} · 全息卡 {observation ?? '关闭'}</div>
          <div>{([['起点 · Passage', 0], ['50%', .5], ['终点', 1]] as const)
            .map(([label, progress]) => <button key={label} type="button" disabled={reduced || contextLost} onClick={() => seek(progress)}>{label}</button>)}</div>
          <button ref={editorToggle} type="button" disabled={!ready || contextLost} aria-expanded={editorOpen && !contextLost}
            aria-controls={editorStarted ? 'expanse-transform-inspector' : undefined}
            onClick={() => { setEditorStarted(true); setEditorOpen(!editorOpen); }}>
            {editorOpen ? '关闭物体变换' : '打开物体变换'}
          </button>
          <label><input type="checkbox" checked={forceReduced} onChange={event => setForceReduced(event.target.checked)} />验证减少动态效果</label>
          <label>风沙 <select disabled={reduced || contextLost} value={reduced ? 'static' : windView}
            onChange={event => setWindView(event.target.value as WindView)}>
            {Object.entries(WIND_VIEWS).map(([view, label]) => <option key={view} value={view}>{label}</option>)}
          </select></label>
          <label>天空分层 <select disabled={contextLost} value={skyView} onChange={event => setSkyView(event.target.value as SkyView)}>
            {Object.entries(SKY_VIEWS).map(([view, label]) => <option key={view} value={view}>{label}</option>)}
          </select></label>
          <WordmarkStudy />
          <SignalReadouts elements={observationElements} />
          <ExpanseAudioLevels />
        </aside>}
        {process.env.NODE_ENV === 'development' && debug && editorStarted && <div ref={editorHost} id="expanse-transform-inspector"
          className={styles.transformEditor} data-transform-inspector
          hidden={!editorOpen || contextLost} />}
      </div>
      {showLoading && <ExpanseLoading phase={phase} onRevealed={onRevealed} />}
      <noscript>
        <style>{'[data-expanse-loading] { display: none; }'}</style>
        <div className={styles.unavailable}><p>{copy.noScript}</p></div>
      </noscript>
      <figcaption className={styles.srOnly}>{copy.instructions}</figcaption>
    </figure>
    {(reduced || contextLost) && <ExpanseTranscript />}
  </main>;
}
