import { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useSiteAudio } from '@/components/audio/AudioProvider';
import { expanseBrand, narrativeTiming, observationIds, observationRecords, witnessRecords, witnessSequence,
  type NarrativeEndpoint, type WitnessId, type WitnessRecord } from './narrative';
import expanseStyles from './expanse.module.css';
import styles from './narrative.module.css';

const charactersPerSecond = 14;
const subtitleHoldSeconds = 2.5;
const subtitleFadeSeconds = .42;

const entryCharacters = Object.fromEntries(witnessSequence.map(record => [record.id, record.lines.map(line => Array.from(line))]));

function WitnessSubtitle({ record, playing, onFinish }: {
  record: WitnessRecord & { id: WitnessId }; playing: boolean; onFinish: (id: WitnessId) => void;
}) {
  const { cue } = useSiteAudio();
  const element = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const lines = entryCharacters[record.id];
  const total = lines.reduce((sum, line) => sum + line.length, 0);
  const hold = record.id === witnessRecords.arrival.id ? narrativeTiming.arrivalHoldSeconds - subtitleFadeSeconds : subtitleHoldSeconds;
  const [count, setCount] = useState(0);

  useEffect(() => {
    const node = element.current!;
    const context = gsap.context(() => {
      const sequence = gsap.timeline({ paused: true, onComplete: () => onFinish(record.id) });
      timeline.current = sequence;
      let at = .20, revealed = 0;
      let lastCharacterAt = 0;
      for (const line of lines) {
        if (revealed) at += .57;
        let previous = '';
        for (const character of line) {
          if ((previous === '…' && character !== '…') || (previous === '.' && character !== '.')) at += .27;
          const next = ++revealed;
          sequence.call(() => {
            setCount(next);
            cue('text');
          }, [], at);
          previous = character;
          lastCharacterAt = at;
          at += 1 / charactersPerSecond;
        }
      }
      sequence.addLabel('typed', lastCharacterAt)
        .to(node, { opacity: 0, duration: subtitleFadeSeconds, ease: 'sine.inOut' }, `typed+=${hold}`);
    }, node);
    return () => {
      context.revert();
      timeline.current = null;
    };
  }, [lines, hold, onFinish, record.id, cue]);
  useEffect(() => {
    timeline.current?.paused(!playing);
  }, [playing]);

  let remaining = count;
  return <div className={styles.subtitle} ref={element} data-witness-subtitle={record.id} data-typed={count === total}>
    {lines.map((line, lineIndex) => {
      const text = line.slice(0, Math.max(0, remaining)).join('');
      remaining -= line.length;
      return text && <p key={lineIndex} aria-hidden="true">{text}</p>;
    })}
    <span className={expanseStyles.srOnly} role="status" aria-atomic="true">{count === total ? record.lines.join(' ') : ''}</span>
  </div>;
}

function BrandReveal({ cinematic = false, active = true }: { cinematic?: boolean; active?: boolean }) {
  return <section className={cinematic ? styles.brandReveal : styles.brandStatic}
    data-brand-reveal={cinematic ? '' : undefined} inert={!active} aria-hidden={!active}>
    <h2 data-reveal-part="title">{expanseBrand.title}</h2>
    <p data-reveal-part="description">{expanseBrand.description[0]}<br />{expanseBrand.description[1]}</p>
    <p className={styles.signature} data-reveal-part="signature">{expanseBrand.signature}</p>
  </section>;
}

export function ExpanseNarrative({ subtitles, endpointState, ready, reduced, unavailable }: {
  subtitles: readonly WitnessId[]; endpointState: NarrativeEndpoint; ready: boolean; reduced: boolean; unavailable: boolean;
}) {
  const { stopTextCue } = useSiteAudio();
  const layer = useRef<HTMLDivElement>(null);
  const brandTimeline = useRef<gsap.core.Timeline | null>(null);
  const [finished, setFinished] = useState<readonly WitnessId[]>([]);
  const [brandStarted, setBrandStarted] = useState(false);
  const [visible, setVisible] = useState(true);
  const finishSubtitle = useCallback((id: WitnessId) => setFinished(previous => [...previous, id]), []);
  const cinematic = ready && !reduced && !unavailable;
  const playing = cinematic && visible;
  const active = witnessSequence.filter(record => subtitles.includes(record.id) && !finished.includes(record.id));
  const canReveal = cinematic && finished.includes(witnessRecords.arrival.id) && !active.length;
  const brandActive = canReveal && brandStarted && endpointState !== 'away';

  useEffect(() => {
    // The near band keeps an existing reveal steady but never starts one.
    setBrandStarted(started => canReveal && (endpointState === 'reached' || (started && endpointState === 'near')));
  }, [canReveal, endpointState]);

  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  useEffect(() => {
    if (!playing) stopTextCue();
  }, [playing, stopTextCue]);
  useEffect(() => () => stopTextCue(), [stopTextCue]);

  useEffect(() => {
    const context = gsap.context(() => {
      const parts = layer.current!.querySelectorAll('[data-brand-reveal] [data-reveal-part]');
      gsap.set(parts, { autoAlpha: 0, y: 9 });
      brandTimeline.current = gsap.timeline({ paused: true, defaults: { autoAlpha: 1, y: 0, ease: 'sine.out' } })
        .to(parts[0], { duration: .25 }, 0)
        .to(parts[1], { duration: .22 }, .11)
        .to(parts[2], { duration: .18 }, .20);
    }, layer);
    return () => {
      context.revert();
      brandTimeline.current = null;
    };
  }, []);
  useEffect(() => {
    if (!cinematic) brandTimeline.current?.pause(0);
    else if (!visible) brandTimeline.current?.pause();
    else if (brandActive) brandTimeline.current?.play();
    else brandTimeline.current?.reverse();
  }, [brandActive, cinematic, visible]);

  return <div className={styles.layer} ref={layer} lang="zh-CN">
    <div className={styles.subtitles} hidden={!cinematic}>
      {active.map(record => <WitnessSubtitle key={record.id} record={record} playing={playing} onFinish={finishSubtitle} />)}
    </div>
    <BrandReveal cinematic active={brandActive} />
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
