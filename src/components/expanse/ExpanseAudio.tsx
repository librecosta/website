import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { gsap } from 'gsap';
import { useSiteAudio } from '@/components/audio/AudioProvider';
import type { AudioBus } from '@/components/audio/site-audio';
import styles from './expanse.module.css';

function AudioStartPrompt({ stage, onEnable }: { stage: RefObject<HTMLElement | null>; onEnable: () => void }) {
  const prompt = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const surface = stage.current, label = prompt.current;
    if (!surface || !label) return;
    const finePointer = window.matchMedia('(any-hover: hover) and (any-pointer: fine)');
    const context = gsap.context(() => {
      const motion = { duration: .48, ease: 'power2.out' };
      const followX = gsap.quickTo(label, 'x', motion);
      const followY = gsap.quickTo(label, 'y', motion);
      let width = 0, height = 0;
      const hide = () => { delete label.dataset.visible; };
      const overControl = (target: EventTarget | null) =>
        target instanceof Element && !!target.closest('a, button, aside, [role="img"]');
      const move = (event: PointerEvent) => {
        if (event.pointerType !== 'mouse' || !finePointer.matches || overControl(event.target)) {
          hide();
          return;
        }
        const { clientX, clientY } = event;
        const entering = label.dataset.visible !== 'true';
        if (entering) {
          width = label.offsetWidth;
          height = label.offsetHeight;
        }
        const x = Math.min(clientX + 16, window.innerWidth - width - 12);
        const y = clientY + height + 24 <= window.innerHeight ? clientY + 16 : clientY - height - 14;
        followX(x, entering ? x : undefined);
        followY(y, entering ? y : undefined);
        label.dataset.visible = 'true';
      };
      const click = (event: MouseEvent) => {
        if (event.button === 0 && label.dataset.visible === 'true' && !overControl(event.target)) onEnable();
      };
      surface.addEventListener('pointermove', move, { passive: true });
      surface.addEventListener('pointerleave', hide);
      surface.addEventListener('click', click);
      finePointer.addEventListener('change', hide);
      document.addEventListener('visibilitychange', hide);
      return () => {
        surface.removeEventListener('pointermove', move);
        surface.removeEventListener('pointerleave', hide);
        surface.removeEventListener('click', click);
        finePointer.removeEventListener('change', hide);
        document.removeEventListener('visibilitychange', hide);
        hide();
      };
    }, surface);
    return () => context.revert();
  }, [onEnable, stage]);

  return <div ref={prompt} className={styles.audioStartPrompt} lang="en" aria-hidden="true">
    <span>Click to<br />enable audio</span>
  </div>;
}

export function ExpanseSoundToggle({ stage, showPrompt }: { stage: RefObject<HTMLElement | null>; showPrompt: boolean }) {
  const { enabled, enable, cue, windStatus, setWindActive } = useSiteAudio();
  const [failed, setFailed] = useState(false);
  const [started, setStarted] = useState(enabled);
  useEffect(() => {
    setWindActive(true);
    return () => setWindActive(false);
  }, [setWindActive]);

  const setSound = useCallback(async (next: boolean) => {
    if (!next) cue('click');
    const success = await enable(next);
    setFailed(!success && next);
    if (success && next) {
      setStarted(true);
      cue('confirm');
    }
  }, [enable, cue]);
  const start = useCallback(() => { void setSound(true); }, [setSound]);

  return <>
    <button type="button" className={styles.soundToggle} lang="en" aria-label="Scene sound" aria-pressed={enabled}
      title={failed ? 'Audio could not start' : windStatus === 'missing' ? 'Local wind audio is unavailable' : undefined}
      onPointerEnter={event => { if (event.pointerType === 'mouse') cue('hover'); }}
      onClick={() => void setSound(!enabled)}>
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor"
        strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round">
        <path d="M2 8h3l4-3v10l-4-3H2z" />
        {enabled ? <path d="M12 7c2 1.5 2 4.5 0 6m2-8c3.5 2.5 3.5 7.5 0 10" /> : <path d="m12.5 8 4 4m0-4-4 4" />}
      </svg>
      <span aria-hidden="true">{enabled ? 'Sound On' : 'Sound Off'}</span>
    </button>
    {showPrompt && !started && !enabled && <AudioStartPrompt stage={stage} onEnable={start} />}
  </>;
}

const labels: Record<AudioBus, string> = { wind: '风声', music: '环境音乐', ui: '界面提示' };

export function ExpanseAudioLevels() {
  const { levels, setLevel, windStatus, cue } = useSiteAudio();
  return <details className={styles.wordmarkStudy}>
    <summary onPointerEnter={event => { if (event.pointerType === 'mouse') cue('hover'); }} onClick={() => cue('click')}>声音音量</summary>
    {Object.entries(labels).map(([key, label]) => {
      const bus = key as AudioBus;
      return <label key={bus}>{label}<input type="range" min={0} max={100} value={Math.round(levels[bus] * 100)}
        onChange={event => setLevel(bus, Number(event.target.value) / 100)} /></label>;
    })}
    {windStatus === 'missing' && <output role="status">本地风声文件未生成。</output>}
  </details>;
}
