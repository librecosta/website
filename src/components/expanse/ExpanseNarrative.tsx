import { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useSiteAudio } from '@/components/audio/AudioProvider';
import { expanseBrand, narrativeTiming, observationIds, observationRecords, witnessRecords, witnessSequence,
  type SubtitleCue } from './narrative';
import expanseStyles from './expanse.module.css';
import styles from './narrative.module.css';

const charactersPerSecond = 14;
const subtitleHoldSeconds = 2.5;
const subtitleFadeSeconds = .42;

const entryCharacters = witnessSequence.map(record => record.lines.map(line => Array.from(line)));

function WitnessSubtitle({ index, animate, onFinish }: SubtitleCue & { onFinish?: () => void }) {
  const { cue, stopTextCue } = useSiteAudio();
  const element = useRef<HTMLDivElement>(null);
  const record = witnessSequence[index];
  const lines = entryCharacters[index];
  const total = lines.reduce((sum, line) => sum + line.length, 0);
  const hold = record === witnessRecords.arrival ? narrativeTiming.arrivalHoldSeconds - subtitleFadeSeconds : subtitleHoldSeconds;
  const [count, setCount] = useState(animate ? 0 : total);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const node = element.current!;
    const context = gsap.context(() => {
      const sequence = gsap.timeline();
      let lastCharacterAt = 0;
      if (animate) {
        let at = .20, revealed = 0;
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
      }
      sequence.to(node, { opacity: 0, duration: subtitleFadeSeconds, ease: 'sine.inOut',
        onComplete: onFinish ?? (() => setFinished(true)) },
        lastCharacterAt + hold);
    }, node);
    return () => {
      context.revert();
      stopTextCue();
    };
  }, [lines, animate, hold, onFinish, cue, stopTextCue]);

  if (finished) return null;
  let remaining = count;
  return <div className={styles.subtitle} ref={element} data-witness-subtitle={record.id} data-lines={lines.length}>
    {lines.map((line, lineIndex) => {
      const text = line.slice(0, Math.max(0, remaining)).join('');
      remaining -= line.length;
      return text && <p key={lineIndex} aria-hidden="true">{text}</p>;
    })}
    <span className={expanseStyles.srOnly} role="status">{count === total ? record.lines.join(' ') : ''}</span>
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

export function ExpanseNarrative({ subtitle, ready, reduced, unavailable }: {
  subtitle: SubtitleCue | null; ready: boolean; reduced: boolean; unavailable: boolean;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const brandTimeline = useRef<gsap.core.Timeline | null>(null);
  const [endingComplete, setEndingComplete] = useState(false);
  const finishEnding = useCallback(() => setEndingComplete(true), []);
  const cinematic = ready && !reduced && !unavailable;
  const arrival = subtitle !== null && witnessSequence[subtitle.index] === witnessRecords.arrival;
  const brandActive = cinematic && arrival && endingComplete;

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
    if (brandActive) brandTimeline.current?.play();
    else if (cinematic) brandTimeline.current?.reverse();
    else brandTimeline.current?.pause(0);
  }, [brandActive, cinematic]);

  return <div className={styles.layer} ref={layer} lang="zh-CN">
    {cinematic && !brandActive && subtitle !== null &&
      <WitnessSubtitle key={subtitle.index} {...subtitle} onFinish={arrival ? finishEnding : undefined} />}
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
