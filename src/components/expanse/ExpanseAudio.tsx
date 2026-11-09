import { useEffect, useRef, useState } from 'react';
import { useSiteAudio } from '@/components/audio/AudioProvider';
import type { AudioBus, MusicStudy } from '@/components/audio/site-audio';
import styles from './expanse.module.css';

export function ExpanseSoundToggle() {
  const { enabled, enable, cue, windStatus, setWindActive } = useSiteAudio();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setWindActive(true);
    return () => setWindActive(false);
  }, [setWindActive]);

  return <button type="button" className={styles.soundToggle} aria-label="场景声音" aria-pressed={enabled}
    title={failed ? '浏览器无法开启音频' : windStatus === 'missing' ? '本地风声文件未生成' : undefined}
    onPointerEnter={event => { if (event.pointerType === 'mouse') cue('hover'); }}
    onClick={async () => {
      if (enabled) cue('click');
      const success = await enable(!enabled);
      setFailed(!success && !enabled);
      if (success && !enabled) cue('confirm');
    }}>
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor"
      strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round">
      <path d="M2 8h3l4-3v10l-4-3H2z" />
      {enabled ? <path d="M12 7c2 1.5 2 4.5 0 6m2-8c3.5 2.5 3.5 7.5 0 10" /> : <path d="m12.5 8 4 4m0-4-4 4" />}
    </svg>
    <span aria-hidden="true">{enabled ? '声音开' : '声音关'}</span>
  </button>;
}

const studies = [
  ['warm-atmosphere', 'A · Warm Atmosphere'],
  ['ethereal-machinery', 'B · Ethereal Machinery'],
] as const;
const labels: Record<AudioBus, string> = { wind: '风声', music: '环境音乐', ui: '界面提示' };

export function ExpanseAudioStudy() {
  const { levels, setLevel, windStatus, chooseMusic, cue } = useSiteAudio();
  const [selection, setSelection] = useState<MusicStudy | null>(null);
  const [status, setStatus] = useState('');
  const request = useRef(0);
  useEffect(() => () => { ++request.current; void chooseMusic(null); }, [chooseMusic]);

  const select = async (track: MusicStudy | null) => {
    const id = ++request.current;
    cue('click');
    setStatus(track ? '正在加载小样…' : '');
    try {
      await chooseMusic(track);
      if (id !== request.current) return;
      setSelection(track);
      setStatus('');
      if (track) cue('confirm');
    } catch {
      if (id === request.current) setStatus('无法加载小样，请检查本地音频文件。');
    }
  };

  return <details className={styles.wordmarkStudy}>
    <summary onPointerEnter={event => { if (event.pointerType === 'mouse') cue('hover'); }} onClick={() => cue('click')}>声音与小样</summary>
    {Object.entries(labels).map(([key, label]) => {
      const bus = key as AudioBus;
      return <label key={bus}>{label}<input type="range" min={0} max={100} value={Math.round(levels[bus] * 100)}
        onChange={event => setLevel(bus, Number(event.target.value) / 100)} /></label>;
    })}
    <div className={styles.audioStudies}>
      {studies.map(([track, label]) => <button key={track} type="button" aria-pressed={selection === track}
        onClick={() => void select(track)}>{label}</button>)}
      <button type="button" onClick={() => void select(null)}>停止试听</button>
    </div>
    <output role="status">{status || (windStatus === 'missing' ? '本地风声文件未生成。' : '')}</output>
  </details>;
}
