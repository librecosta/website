import { useEffect, useRef, useState, type RefObject } from 'react';
import { gsap } from 'gsap';
import { useSiteAudio } from '@/components/audio/AudioProvider';
import { expanseBrand, observationIds, observationRecords, witnessSequence } from './narrative';
import expanseStyles from './expanse.module.css';
import styles from './narrative.module.css';

const charactersPerSecond = 14;
const subtitleHoldSeconds = 2.5;

const entryCharacters = witnessSequence.map(record => record.lines.map(line => Array.from(line)));

function WitnessSubtitle({ index }: { index: number }) {
  const { cue, stopTextCue } = useSiteAudio();
  const element = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const record = witnessSequence[index];
  const lines = entryCharacters[index];
  const total = lines.reduce((sum, line) => sum + line.length, 0);

  useEffect(() => {
    const node = element.current!;
    const context = gsap.context(() => {
      const sequence = gsap.timeline();
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
          at += 1 / charactersPerSecond;
        }
      }
      sequence.to(node, { opacity: 0, duration: .42, ease: 'sine.inOut', onComplete: () => setFinished(true) },
        at - 1 / charactersPerSecond + subtitleHoldSeconds);
    }, node);
    return () => {
      context.revert();
      stopTextCue();
    };
  }, [lines, cue, stopTextCue]);

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

export function ExpanseNarrative({ layer, subtitle, ready, reduced, unavailable, brandActive }: {
  layer: RefObject<HTMLDivElement | null>; subtitle: number | null; ready: boolean; reduced: boolean;
  unavailable: boolean; brandActive: boolean;
}) {
  return <div className={styles.layer} ref={layer} lang="zh-CN">
    {ready && !reduced && !unavailable && !brandActive && subtitle !== null &&
      <WitnessSubtitle key={subtitle} index={subtitle} />}
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
