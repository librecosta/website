import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { gsap } from 'gsap';
import { useSiteAudio } from '@/components/audio/AudioProvider';
import { expanseBrand, observationIds, observationRecords, witnessSequence, type NarrativeCue } from './narrative';
import styles from './narrative.module.css';

const charactersPerSecond = 14;

const entryCharacters = witnessSequence.map(record => record.lines.map(line => Array.from(line)));

function GlassCorner({ right = false }: { right?: boolean }) {
  return <svg className={styles.glassCorner} data-right={right} viewBox="0 0 46 24" fill="none" aria-hidden="true">
    <path className={styles.cornerBracket} d="M2 17 15 4h25v4H17L5 20Z" />
    <path className={styles.cornerRim} d="M2 17 15 4h25M6 21 19 8h20" />
    <path className={styles.cornerLight} d="M7 15 17 5h12" />
    <path className={styles.cornerEtch} d="m16 15 5-5h12m2 0h4m2 0h3" />
  </svg>;
}

function ObserverLog({ active, ready, reduced }: { active: NarrativeCue; ready: boolean; reduced: boolean }) {
  const { cue, stopTextCue } = useSiteAudio();
  const history = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const [draft, setDraft] = useState({ index: -1, count: 0 });
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const { index, animate } = active;
  const visible = ready && index >= 0;
  const total = entryCharacters[index]?.reduce((sum, line) => sum + line.length, 0) ?? 0;
  const write = visible && animate && !reduced;
  const count = draft.index === index ? draft.count : 0;
  const typing = write && count < total;

  const refreshHistory = useCallback(() => {
    const view = history.current!;
    if (following.current) view.scrollTop = view.scrollHeight;
    view.toggleAttribute('data-overflow', view.scrollHeight - view.clientHeight > 1);
  }, []);
  useLayoutEffect(() => {
    const view = history.current!;
    const observer = new ResizeObserver(refreshHistory);
    observer.observe(view);
    return () => observer.disconnect();
  }, [refreshHistory]);
  useLayoutEffect(refreshHistory, [draft, index, visible, write, refreshHistory]);

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
  let remaining = count;
  let cursorPlaced = false;
  return <section className={styles.observer} aria-label="观察日志" data-observer-log={witnessSequence[index]?.id ?? ''}
    data-writing={typing} data-reading={visible}>
    <span className={styles.glass} aria-hidden="true" />
    <GlassCorner />
    <GlassCorner right />
    <div className={styles.history} ref={history} role="region" aria-label="独白历史"
      aria-description={typing ? '按 Enter 显示完整独白' : undefined} tabIndex={visible ? 0 : -1}
      onClick={complete} onKeyDown={event => { if (event.key === 'Enter') complete(); }}
      onScroll={({ currentTarget: view }) => {
        following.current = view.scrollHeight - view.clientHeight - view.scrollTop <= 1;
      }}>
      {visible && witnessSequence.slice(0, index + 1).flatMap((record, entry) =>
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
  </section>;
}

function BrandReveal({ cinematic = false, active = true }: { cinematic?: boolean; active?: boolean }) {
  return <section className={cinematic ? styles.brandReveal : styles.brandStatic}
    data-brand-reveal={cinematic ? '' : undefined} inert={!active} aria-hidden={!active}>
    <h2 data-reveal-part="title">{expanseBrand.title}</h2>
    <p data-reveal-part="description">{expanseBrand.description[0]}<br />{expanseBrand.description[1]}</p>
    <p className={styles.signature} data-reveal-part="signature">{expanseBrand.signature}</p>
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
