import { useEffect, useRef, useState, type RefObject } from 'react';
import { gsap } from 'gsap';
import { useSiteAudio } from '@/components/audio/AudioProvider';
import { expanseBrand, observationIds, observationRecords, witnessRecords, type NarrativeCue, type ObservationId,
  type WitnessRecord } from './narrative';
import ui from './expanse.module.css';
import styles from './narrative.module.css';

const charactersPerSecond = 14;

function TypewrittenRecord({ record, animate, onComplete }: {
  record: WitnessRecord; animate: boolean; onComplete?: () => void;
}) {
  const { cue, stopTextCue } = useSiteAudio();
  const [visible, setVisible] = useState(0);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const lines = record.lines.map(line => Array.from(line));
  const total = lines.reduce((sum, line) => sum + line.length, 0);
  const typing = animate && visible < total;

  useEffect(() => {
    if (!animate) return;
    const sequence = gsap.timeline({ paused: true });
    timeline.current = sequence;
    let at = .28, count = 0;
    for (const line of record.lines) {
      let previous = '';
      for (const character of line) {
        if ((previous === '…' && character !== '…') || (previous === '.' && character !== '.')) at += .27;
        const next = ++count;
        sequence.call(() => {
          setVisible(next);
          if (!/[.…！？。]/u.test(character)) cue('text');
          if (next === total) onComplete?.();
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
  }, [animate, record, cue, stopTextCue, total, onComplete]);

  let remaining = animate ? visible : total;
  let cursorPlaced = false;
  return <div className={styles.record}>
    <div className={ui.srOnly}>{record.lines.map((line, index) => <p key={index}>{line}</p>)}</div>
    <div aria-hidden="true">
      {lines.map((line, index) => {
        const text = line.slice(0, Math.max(0, remaining)).join('');
        const cursor = typing && !cursorPlaced && remaining < line.length;
        cursorPlaced ||= cursor;
        remaining -= line.length;
        return <p key={index}><span className={styles.line}>
          <span className={styles.lineMeasure}>{line.join('')}</span>
          <span className={styles.lineText}>{text}{cursor && <i className={styles.cursor} />}</span>
        </span></p>;
      })}
    </div>
    {animate && <button type="button" className={styles.complete} aria-label="立即显示完整独白"
      aria-disabled={!typing} tabIndex={typing ? 0 : -1} onClick={() => {
        if (!typing) return;
        timeline.current?.kill();
        stopTextCue();
        setVisible(total);
        onComplete?.();
      }} />}
  </div>;
}

export function ObserverLog({ record, animate, onComplete, onClose }: {
  record: WitnessRecord; animate: boolean; onComplete?: () => void; onClose?: () => void;
}) {
  return <section className={styles.observer} aria-label="观察日志" data-observer-log={record.id}
    id={onClose ? 'expanse-signal-log' : undefined} data-optional={onClose ? '' : undefined}>
    <header className={styles.logHeader}>
      <span lang="en">WITNESS / OBSERVATION LOG</span>
      <span>{record.id}</span>
      {onClose && <button className={styles.closeLog} type="button" aria-label="关闭观测记录" onClick={onClose}>×</button>}
    </header>
    <TypewrittenRecord key={record.id} record={record} animate={animate} onComplete={onComplete} />
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

export function ExpanseNarrative({ layer, active, enabled, observation, onRead, onClose }: {
  layer: RefObject<HTMLDivElement | null>; active: NarrativeCue; enabled: boolean;
  observation: { id: ObservationId; animate: boolean } | null;
  onRead: () => void;
  onClose: () => void;
}) {
  const beat = enabled ? active?.beat : null;
  const animate = active?.animate ?? false;
  return <div className={styles.layer} ref={layer} lang="zh-CN" data-narrative-beat={beat ?? 'quiet'}>
    {observation && beat !== 'brand' && <ObserverLog key={observation.id} record={observationRecords[observation.id]}
      animate={observation.animate} onComplete={onRead} onClose={onClose} />}
    {!observation && beat === 'opening' && <section className={styles.opening} aria-label="苏醒" data-opening>
      <TypewrittenRecord record={witnessRecords.opening} animate={animate} />
    </section>}
    {!observation && (beat === 'passage' || beat === 'arrival') &&
      <ObserverLog key={beat} record={witnessRecords[beat]} animate={animate} />}
    <BrandReveal cinematic active={beat === 'brand'} />
  </div>;
}

export function ExpanseTranscript() {
  return <article id="expanse-transcript" className={styles.transcript} lang="zh-CN">
    <h2>第一幕 · 荒原</h2>
    {Object.values(witnessRecords).map(record => <section key={record.id} aria-label={`独白 ${record.id}`}>
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
