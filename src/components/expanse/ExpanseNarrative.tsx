import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useSiteAudio } from '@/components/audio/AudioProvider';
import { useSiteCopy, useSiteLocale } from '@/site/LocaleProvider';
import { usesOriginalLayout } from '@/site/content';
import { narrativeTiming, observationCodes, observationIds, witnessSequence, type NarrativeEndpoint, type WitnessId } from './narrative';
import expanseStyles from './expanse.module.css';
import styles from './narrative.module.css';

const charactersPerSecond = 14;
const subtitleHoldSeconds = 2.5;
const subtitleFadeSeconds = .42;

function WitnessSubtitle({ id, text, adaptive, playing, onFinish }: {
  id: WitnessId; text: readonly string[]; adaptive: boolean; playing: boolean; onFinish: (id: WitnessId) => void;
}) {
  const { cue } = useSiteAudio();
  const element = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const lines = useMemo(() => text.map(line => Array.from(line)), [text]);
  const total = lines.reduce((sum, line) => sum + line.length, 0);
  const hold = id === '03' ? narrativeTiming.arrivalHoldSeconds - subtitleFadeSeconds : subtitleHoldSeconds;
  // Keep longer translations within the same reading window.
  const speed = adaptive ? Math.max(charactersPerSecond, total / 2.8) : charactersPerSecond;
  const [count, setCount] = useState(0);

  useEffect(() => {
    const node = element.current!;
    const context = gsap.context(() => {
      const sequence = gsap.timeline({ paused: true, onComplete: () => onFinish(id) });
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
          at += 1 / speed;
        }
      }
      sequence.addLabel('typed', lastCharacterAt)
        .to(node, { opacity: 0, duration: subtitleFadeSeconds, ease: 'sine.inOut' }, `typed+=${hold}`);
    }, node);
    return () => {
      context.revert();
      timeline.current = null;
    };
  }, [lines, hold, onFinish, id, cue, speed]);
  useEffect(() => {
    timeline.current?.paused(!playing);
  }, [playing]);

  let remaining = count;
  return <div className={styles.subtitle} ref={element} data-witness-subtitle={id} data-typed={count === total}>
    {lines.map((line, lineIndex) => {
      const text = line.slice(0, Math.max(0, remaining)).join('');
      remaining -= line.length;
      return text && <p key={lineIndex} aria-hidden="true">{text}</p>;
    })}
    <span className={expanseStyles.srOnly} role="status" aria-atomic="true">{count === total ? text.join(' ') : ''}</span>
  </div>;
}

function BrandReveal({ cinematic = false, active = true }: { cinematic?: boolean; active?: boolean }) {
  const { brand } = useSiteCopy().world;
  return <section className={cinematic ? styles.brandReveal : styles.brandStatic}
    data-brand-reveal={cinematic ? '' : undefined} inert={!active} aria-hidden={!active}>
    <h2 data-reveal-part="title">{brand.title}</h2>
    <p data-reveal-part="description">{brand.description[0]}<br />{brand.description[1]}</p>
    <p className={styles.signature} data-reveal-part="signature">{brand.signature}</p>
  </section>;
}

export function ExpanseNarrative({ subtitles, endpointState, ready, reduced, unavailable }: {
  subtitles: readonly WitnessId[]; endpointState: NarrativeEndpoint; ready: boolean; reduced: boolean; unavailable: boolean;
}) {
  const { locale } = useSiteLocale();
  const copy = useSiteCopy().world;
  const adaptive = !usesOriginalLayout(locale);
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
  const canReveal = cinematic && finished.includes('03') && !active.length;
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

  return <div className={styles.layer} ref={layer}>
    <div className={styles.subtitles} hidden={!cinematic}>
      {(adaptive ? active.slice(0, 1) : active).map(({ id }) =>
        <WitnessSubtitle key={id} id={id} text={copy.witness[id]} adaptive={adaptive} playing={playing} onFinish={finishSubtitle} />)}
    </div>
    <BrandReveal cinematic active={brandActive} />
  </div>;
}

export function ExpanseTranscript() {
  const copy = useSiteCopy().world;
  const records = copy.observations;
  return <article id="expanse-transcript" className={styles.transcript}>
    <h2>{copy.transcript}</h2>
    {witnessSequence.map(({ id }) => <section key={id} aria-label={`${copy.witnessLabel} ${id}`}>
      {copy.witness[id].map((line, index) => <p key={index}>{line}</p>)}
    </section>)}
    <section className={styles.transcriptSignals} aria-labelledby="expanse-transcript-signals">
      <h3 id="expanse-transcript-signals">{copy.observationsLabel}</h3>
      {observationIds.map(id => <details key={id}>
        <summary>{observationCodes[id]} · {records[id].name}</summary>
        {records[id].lines.map(line => <p key={line}>{line}</p>)}
      </details>)}
    </section>
    <BrandReveal />
  </article>;
}
