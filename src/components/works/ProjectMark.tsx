import styles from './works.module.css';
import type { Landmark } from './projects';

const imageMarks = {
  terrace: '/works/gofurry.svg',
  workshop: '/works/tool4furry-mark.webp',
} as const;

export function ProjectMark({ landmark }: { landmark: Landmark }) {
  if (landmark === 'terrace' || landmark === 'workshop') {
    return <span className={styles.mark} data-mark={landmark}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageMarks[landmark]} alt="" draggable={false} />
    </span>;
  }

  const paths: Record<Exclude<Landmark, keyof typeof imageMarks>, React.ReactNode> = {
    observatory: <>
      <path d="M5 20h7l3.5-8 5.5 16 4-8h10" strokeWidth="2" />
      <path d="M7 13a15 15 0 0 1 26 0M33 27a15 15 0 0 1-26 0" opacity=".56" />
    </>,
    collector: <>
      <path d="M20 34V10M20 24C12 24 8 19 8 12c8 0 12 5 12 12Zm0 5c8 0 12-5 12-12-8 0-12 5-12 12Z" />
      <path d="M20 15c-5-4-5-8 0-12 5 4 5 8 0 12Z" fill="currentColor" stroke="none" />
    </>,
    prism: <>
      <rect x="10" y="8" width="22" height="22" rx="7" fill="currentColor" fillOpacity=".18" />
      <rect x="6" y="13" width="22" height="22" rx="7" />
      <path d="M16 12h8c2 0 4 2 4 4" opacity=".68" />
    </>,
    ribs: <>
      <path d="M3 27c9 0 10-13 17-13 6 0 9 9 17 9M3 31c8 0 12-12 18-12 6 0 10 8 16 8" />
      <path d="M3 23c8 0 10-13 17-13 7 0 10 9 17 9" opacity=".6" />
    </>,
    gates: <>
      <path d="M12 4h16l8 8v16l-8 8H12l-8-8V12Z" opacity=".5" />
      <path d="M15 9h10l6 6v10l-6 6H15l-6-6V15Z" />
      <path d="M18 14h4l4 4v4l-4 4h-4l-4-4v-4Z" fill="currentColor" fillOpacity=".23" />
      <path d="m20 17 3 3-3 3-3-3Z" fill="currentColor" stroke="none" />
    </>,
    archive: <>
      <path d="M20 11c-4-5-9-6-15-4v22c6-2 11-1 15 4 4-5 9-6 15-4V7c-6-2-11-1-15 4Zm0 0v22" />
      <path d="M9 13c3 0 5 0 7 2m-7 3c3 0 5 0 7 2m8-5c2-2 4-2 7-2m-7 7c2-2 4-2 7-2" opacity=".63" />
    </>,
  };

  return <svg className={styles.mark} viewBox="0 0 40 40" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {paths[landmark]}
  </svg>;
}
