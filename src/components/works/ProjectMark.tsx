import styles from './works.module.css';
import type { Landmark } from './projects';

export const markImages: Record<Landmark, string> = {
  terrace: '/works/gofurry.svg',
  observatory: '/works/uptime-mark.svg',
  prism: '/works/liquid-glass-mark.svg',
  ribs: '/works/wavefield-mark.svg',
  gates: '/works/sofaraway-mark.svg',
  archive: '/works/gopheratlas-mark.svg',
};

export function ProjectMark({ landmark }: { landmark: Landmark }) {
  return <span className={styles.mark} data-mark={landmark}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={markImages[landmark]} alt="" draggable={false} />
  </span>;
}
