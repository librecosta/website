import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { gsap } from 'gsap';
import { useSiteAudio } from '@/components/audio/AudioProvider';
import { expanseBrand, observationIds, observationRecords, witnessSequence, type NarrativeCue } from './narrative';
import styles from './narrative.module.css';

const charactersPerSecond = 14;

const entryCharacters = witnessSequence.map(record => record.lines.map(line => Array.from(line)));

function ObserverLog({ active, ready, reduced }: { active: NarrativeCue; ready: boolean; reduced: boolean }) {
  const { cue, stopTextCue } = useSiteAudio();
  const history = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const [historyBounds, setHistoryBounds] = useState({ older: false, newer: false });
  const [draft, setDraft] = useState({ index: -1, count: 0 });
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const { index, animate } = active;
  const total = entryCharacters[index].reduce((sum, line) => sum + line.length, 0);
  const write = ready && animate && !reduced;
  const count = draft.index === index ? draft.count : 0;
  const typing = write && count < total;
  const last = reduced ? witnessSequence.length - 1 : index;

  const updateBounds = useCallback(() => {
    const view = history.current!;
    const older = view.scrollTop > 1;
    const newer = view.scrollHeight - view.clientHeight - view.scrollTop > 1;
    setHistoryBounds(previous => previous.older === older && previous.newer === newer ? previous : { older, newer });
    return newer;
  }, []);
  useLayoutEffect(() => {
    const view = history.current!;
    const refresh = () => {
      if (following.current) view.scrollTop = view.scrollHeight;
      updateBounds();
    };
    refresh();
    const observer = new ResizeObserver(refresh);
    observer.observe(view);
    return () => observer.disconnect();
  }, [updateBounds]);
  useLayoutEffect(() => {
    const view = history.current!;
    if (following.current) view.scrollTop = view.scrollHeight;
    updateBounds();
  }, [draft, last, ready, write, updateBounds]);

  useEffect(() => {
    if (!write) return;
    const sequence = gsap.timeline({ paused: true });
    timeline.current = sequence;
    let at = .28, revealed = 0;
    for (const line of entryCharacters[index]) {
      let previous = '';
      for (const character of line) {
        if ((previous === '…' && character !== '…') || (previous === '.' && character !== '.')) at += .27;
        const next = ++revealed;
        sequence.call(() => {
          setDraft({ index, count: next });
          cue('text');
        }, [], at);
        previous = character;
        at += 1 / charactersPerSecond;
      }
      at += .57;
    }
    sequence.play();
    return () => {
      sequence.kill();
      timeline.current = null;
      stopTextCue();
    };
  }, [write, index, cue, stopTextCue]);

  const complete = () => {
    if (!typing) return;
    timeline.current?.kill();
    stopTextCue();
    setDraft({ index, count: total });
  };
  const move = (latest: boolean) => {
    const view = history.current!;
    following.current = latest;
    view.scrollTop = latest ? view.scrollHeight : view.scrollTop - view.clientHeight / 2;
    updateBounds();
  };
  let remaining = count;
  let cursorPlaced = false;
  return <section className={styles.observer} aria-label="观察日志" data-observer-log={witnessSequence[last].id}
    data-writing={typing} data-history={historyBounds.newer}>
    <span className={styles.glass} aria-hidden="true" />
    <svg className={styles.guide} viewBox="0 0 352 92" preserveAspectRatio="none" fill="none" aria-hidden="true">
      <path className={styles.trace} d="M0 91V29L16 10H226L238 1H351M12 41V32L25 18H45M294 9H351" />
      <path className={styles.traceLight} d="M0 39V29L16 10H66M226 10L238 1H260" />
    </svg>
    <header className={styles.logHeader}>
      <i key={index} className={styles.lamp} aria-hidden="true" />
      <span lang="en">WITNESS / OBSERVATION LOG</span>
      <span className={styles.recordNumber}>{witnessSequence[last].id}</span>
    </header>
    <div className={styles.history} ref={history} tabIndex={historyBounds.older || historyBounds.newer ? 0 : -1}
      aria-label="独白历史" onClick={complete} onScroll={() => { following.current = !updateBounds(); }}>
      {ready && witnessSequence.slice(0, last + 1).flatMap((record, entry) =>
        entryCharacters[entry].map((line, lineIndex) => {
          const current = write && entry === index;
          const cursor = typing && current && !cursorPlaced && remaining < line.length && remaining >= 0;
          cursorPlaced ||= cursor;
          const text = current ? line.slice(0, Math.max(0, remaining)).join('') : line.join('');
          if (current) remaining -= line.length;
          return text || cursor ? <p key={`${record.id}-${lineIndex}`} className={styles.line} data-current-line={cursor}>
            {text}{cursor && <i className={styles.cursor} aria-hidden="true" />}
          </p> : null;
        }))}
    </div>
    <div className={styles.logControls}>
      <button type="button" aria-label="立即显示完整独白" title="立即显示完整独白" disabled={!typing} onClick={complete}>
        <svg viewBox="0 0 14 14" aria-hidden="true"><path d="m2 4 3 3-3 3m5-6 3 3-3 3" /></svg>
      </button>
      <button type="button" aria-label="查看较早日志" title="查看较早日志" disabled={!historyBounds.older} onClick={() => move(false)}>
        <svg viewBox="0 0 14 14" aria-hidden="true"><path d="m3 8 4-4 4 4" /></svg>
      </button>
      <button type="button" aria-label="返回最新日志" title="返回最新日志" disabled={!historyBounds.newer} onClick={() => move(true)}>
        <svg viewBox="0 0 14 14" aria-hidden="true"><path d="m3 5 4 4 4-4" /></svg>
      </button>
    </div>
  </section>;
}

function BrandReveal({ cinematic = false, active = true }: { cinematic?: boolean; active?: boolean }) {
  return <section className={cinematic ? styles.brandReveal : styles.brandStatic}
    data-brand-reveal={cinematic ? '' : undefined} inert={!active} aria-hidden={!active}>
    <h2 data-reveal-part="title">{expanseBrand.title}</h2>
    <p data-reveal-part="description">{expanseBrand.description}</p>
    <p className={styles.signature} data-reveal-part="signature">{expanseBrand.signature}</p>
    <div className={styles.actions} data-reveal-part="actions">
      {expanseBrand.actions.map(label => <button key={label} type="button" disabled>{label}</button>)}
    </div>
  </section>;
}

export function ExpanseNarrative({ layer, active, ready, reduced, unavailable, brandActive }: {
  layer: RefObject<HTMLDivElement | null>; active: NarrativeCue; ready: boolean; reduced: boolean;
  unavailable: boolean; brandActive: boolean;
}) {
  return <div className={styles.layer} ref={layer} lang="zh-CN">
    {!unavailable && <ObserverLog active={active} ready={ready} reduced={reduced} />}
    <BrandReveal cinematic active={ready && brandActive && !reduced} />
  </div>;
}

export function ExpanseTranscript() {
  return <article id="expanse-transcript" className={styles.transcript} lang="zh-CN">
    <h2>第一幕 · 荒原</h2>
    {witnessSequence.map(record => <section key={record.id} aria-label={`独白 ${record.id}`}>
      {record.lines.map((line, index) => <p key={index}>{line}</p>)}
    </section>)}
    <section className={styles.transcriptSignals} aria-labelledby="expanse-transcript-signals">
      <h3 id="expanse-transcript-signals">观测记录</h3>
      {observationIds.map(id => <details key={id}>
        <summary>{observationRecords[id].id} · {observationRecords[id].name}</summary>
        {observationRecords[id].lines.map(line => <p key={line}>{line}</p>)}
      </details>)}
    </section>
    <BrandReveal />
  </article>;
}
