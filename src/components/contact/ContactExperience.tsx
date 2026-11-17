'use client';

import { useLayoutEffect } from 'react';
import { animate, domAnimation, LazyMotion, m, useMotionValue, useReducedMotion } from 'motion/react';
import { WorkshopFrame } from '@/components/WorkshopFrame';
import { useSoftFocus } from '@/components/soft-focus';
import { languageControlCopy } from '@/site/content';
import { useEnglish } from '@/site/LocaleProvider';
import styles from './contact.module.css';

export function ContactExperience() {
  const english = useEnglish();
  const reduced = useReducedMotion() === true;
  const clock = useMotionValue(1);
  const title = useSoftFocus(clock, 0, .72, 8, 13);
  const intro = useSoftFocus(clock, .15, .61, 5, 9);
  const links = useSoftFocus(clock, .31, .6, 4, 8);

  useLayoutEffect(() => {
    if (reduced || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    clock.jump(0);
    const entrance = animate(clock, 1, { duration: .95, ease: 'linear' });
    return () => entrance.stop();
  }, [clock, reduced]);

  return <LazyMotion features={domAnimation}>
    <WorkshopFrame route="/contact" reduced={reduced}>
      <main className={styles.screen} aria-labelledby="contact-title">
        <div className={styles.content}>
          <m.h1 id="contact-title" className={styles.title} lang="en" style={reduced ? undefined : title} data-contact-reveal>
            CONTACT
          </m.h1>
          <m.p className={styles.intro} style={reduced ? undefined : intro} data-contact-reveal>
            {english ? "For collaborations or conversations, we'd love to hear from you." : '不管是合作还是交流都欢迎您的来信。'}
          </m.p>
          <m.div className={styles.channels} style={reduced ? undefined : links} data-contact-reveal>
            <a className={styles.email} href="mailto:contact@librecosta.com" lang="en">contact@librecosta.com</a>
            <a className={styles.x} href="https://x.com/LibreCostaHQ" target="_blank" rel="noopener noreferrer"
              aria-label={`@LibreCostaHQ${languageControlCopy[english ? 'en' : 'zh'].newTab}`}>@LibreCostaHQ</a>
          </m.div>
        </div>
      </main>
    </WorkshopFrame>
  </LazyMotion>;
}
