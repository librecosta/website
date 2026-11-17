import { useEffect, useRef, useState, type PointerEventHandler } from 'react';
import { gsap } from 'gsap';
import styles from './expanse.module.css';

// TuneShape Encrypted Text frame cadence and character selection.
// License and source details are in public/License/tuneshape-encrypted-text.txt.
const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-={}[];:,.<>/?';
const flipMs = 50;
const durationMs = 550;

export function useEncryptedText(text: string, reduced: boolean) {
  const [frame, setFrame] = useState<{ text: string; noise: string[] } | null>(null);
  const tween = useRef<gsap.core.Tween | null>(null);
  useEffect(() => () => { tween.current?.kill(); }, []);

  const play = () => {
    if (reduced) return;
    tween.current?.kill();
    const letters = Array.from(text);
    const elapsed = { ms: 0 };
    let lastFlip = -1, lastReveal = -1;
    const paint = () => {
      const flip = Math.floor(elapsed.ms / flipMs);
      const reveal = Math.floor(elapsed.ms / durationMs * letters.length);
      if (flip === lastFlip && reveal === lastReveal) return;
      lastFlip = flip;
      lastReveal = reveal;
      const noise = letters.map((letter, index) => {
        if (index < reveal || /\s/u.test(letter)) return '';
        const seed = Math.imul(index + 17, 374761393) ^ Math.imul(flip + 31, 668265263);
        return charset[(Math.imul(seed ^ (seed >>> 13), 1274126177) >>> 0) % charset.length];
      });
      setFrame({ text, noise });
    };
    paint();
    tween.current = gsap.to(elapsed, {
      ms: durationMs, duration: durationMs / 1000, ease: 'none',
      onUpdate: paint, onComplete: () => setFrame(null),
    });
  };

  return { play, noise: !reduced && frame?.text === text ? frame.noise : null };
}

export function EncryptedLabel({ text, noise, onPointerEnter }: {
  text: string; noise: string[] | null; onPointerEnter?: PointerEventHandler<HTMLSpanElement>;
}) {
  return <span className={styles.encryptedLabel} aria-hidden="true" onPointerEnter={onPointerEnter}>
    {Array.from(text, (letter, index) => {
      const scrambled = noise?.[index];
      return <span key={index} className={styles.encryptedCell}>
        <span style={scrambled ? { visibility: 'hidden' } : undefined}>{letter}</span>
        {scrambled && <span className={styles.encryptedNoise}>{scrambled}</span>}
      </span>;
    })}
  </span>;
}
