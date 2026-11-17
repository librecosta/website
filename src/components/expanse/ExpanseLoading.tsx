import { LazyMotion, domAnimation, m } from 'motion/react';
import { useSiteCopy } from '@/site/LocaleProvider';
import styles from './expanse-loading.module.css';

export type LoadingPhase = 'starting' | 'assets' | 'presenting' | 'ready';

const segmentCount = 12;
const filledSegments: Record<LoadingPhase, number> = { starting: 0, assets: 3, presenting: 7, ready: 12 };

export function ExpanseLoading({ phase, onRevealed }: { phase: LoadingPhase; onRevealed: () => void }) {
  const copy = useSiteCopy().world.loading;
  const ready = phase === 'ready';

  return <LazyMotion features={domAnimation}>
    <m.div className={styles.layer} data-expanse-loading={phase} initial={false}
      animate={ready ? { opacity: 0 } : { opacity: 1 }}
      transition={{ duration: .54, ease: [.22, .66, .28, 1] }}
      onAnimationComplete={() => { if (ready) onRevealed(); }}>
      <m.div className={styles.content} initial={false}
        animate={ready ? { scale: .985, y: -3, filter: 'blur(2px)' } : { scale: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: .46, ease: [.22, .66, .28, 1] }}>
        <svg viewBox="0 0 74 74" className={styles.mark} fill="none" aria-hidden="true">
          <circle cx="37" cy="37" r="31.5" stroke="#bdc2ba" strokeWidth="1.2" />
          <circle cx="37" cy="37" r="24" pathLength="360" stroke="#97a297" strokeWidth="1.15"
            strokeDasharray="6 4" strokeDashoffset="8" />
          <path d="M37 0v17m0 40v17M0 37h17m40 0h17" stroke="#a3ada3" strokeWidth="1.6" />
          <path d="M37 24v26M24 37h26" stroke="#b2b9af" strokeWidth="1.2" />
          <path d="m37 17 18 20-18 20-18-20Z" stroke="#637269" strokeWidth="1.15" />
          <circle cx="37" cy="37" r="4.7" fill="#637269" className={styles.center} />
        </svg>
        <p className={styles.title} lang="en">THE EXPANSE</p>
        <p className={styles.subtitle} lang="en">INITIALIZING THE WORLD</p>
        <div className={styles.segments} aria-hidden="true">
          {Array.from({ length: segmentCount }, (_, index) =>
            <span key={index} data-filled={index < filledSegments[phase]} />)}
        </div>
        <p className={styles.status} role="status">{copy[phase]}</p>
      </m.div>
    </m.div>
  </LazyMotion>;
}
