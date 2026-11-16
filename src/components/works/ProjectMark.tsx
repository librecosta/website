import styles from './project-mark.module.css';
import type { Landmark } from './projects';

const markImages: Record<Landmark, string> = {
  terrace: '/works/gofurry.svg',
  workshop: '/works/tool4furry-mark.webp',
  observatory: '/works/uptime-mark.svg',
  collector: '/works/harvest-mark.svg',
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
