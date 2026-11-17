'use client';

import { useReducedMotion } from 'motion/react';
import { WorkshopFrame } from '@/components/WorkshopFrame';
import type { SiteRoute } from './locale-contract';
import styles from './publication-preview.module.css';

export function PublicationPreview({ route, title }: { route: SiteRoute; title: string }) {
  const reduced = useReducedMotion() === true;
  return <WorkshopFrame route={route} reduced={reduced} className={styles.frame}>
    <main className={styles.content}>
      <h1>{title}</h1>
      <p>Internal preview. English content is pending.</p>
    </main>
  </WorkshopFrame>;
}
