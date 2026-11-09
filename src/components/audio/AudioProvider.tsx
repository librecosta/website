'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { defaultLevels, SiteAudio, type AudioBus, type AudioCue } from './site-audio';

type AudioControls = {
  enabled: boolean;
  levels: typeof defaultLevels;
  windStatus: 'idle' | 'ready' | 'missing';
  enable: (value: boolean) => Promise<boolean>;
  setLevel: (bus: AudioBus, level: number) => void;
  setWindActive: (active: boolean) => void;
  cue: (kind: AudioCue) => void;
  stopTextCue: () => void;
};

const AudioContext = createContext<AudioControls | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const engine = useRef<SiteAudio | null>(null);
  const requested = useRef(false);
  const windActive = useRef(false);
  const currentLevels = useRef(defaultLevels);
  const [enabled, setEnabled] = useState(false);
  const [levels, setLevels] = useState(defaultLevels);
  const [windStatus, setWindStatus] = useState<AudioControls['windStatus']>('idle');

  useEffect(() => () => { engine.current?.close(); engine.current = null; }, []);

  const enable = useCallback(async (value: boolean) => {
    requested.current = value;
    try {
      if (value && !engine.current) {
        engine.current = new SiteAudio(currentLevels.current, setWindStatus);
        engine.current.setWindActive(windActive.current);
      }
      const activation = engine.current?.setEnabled(value);
      setEnabled(value);
      await activation;
      return requested.current === value;
    } catch {
      if (requested.current === value) {
        requested.current = false;
        setEnabled(false);
        void engine.current?.setEnabled(false).catch(() => {});
      }
      return false;
    }
  }, []);

  const setWindActive = useCallback((active: boolean) => {
    windActive.current = active;
    engine.current?.setWindActive(active);
  }, []);
  const cue = useCallback((kind: AudioCue) => engine.current?.cue(kind), []);
  const stopTextCue = useCallback(() => engine.current?.stopTextCue(), []);

  return <AudioContext.Provider value={{ enabled, levels, windStatus, enable, setWindActive,
    setLevel: (bus, level) => {
      currentLevels.current = { ...currentLevels.current, [bus]: level };
      setLevels(currentLevels.current);
      engine.current?.setLevel(bus, level);
    },
    cue, stopTextCue,
  }}>{children}</AudioContext.Provider>;
}

export function useSiteAudio() {
  const audio = useContext(AudioContext);
  if (!audio) throw new Error('AudioProvider is missing');
  return audio;
}
