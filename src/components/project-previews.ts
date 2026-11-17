// Site screenshots and artwork shared by the archive and the Works dossier.
export const projectPreviews = {
  gofurry: { src: '/about/gofurry-og.png', width: 1200, height: 630, background: '#ffdec2' },
  tool4furry: { src: '/about/tool4furry-og.png', width: 1200, height: 630, background: '#30343a' },
  gopheratlas: { src: '/about/gopheratlas-og.png', width: 1200, height: 630, background: '#101215' },
  uptime: { src: '/about/uptime-dashboard.webp', width: 1672, height: 941, background: '#f1f6fd' },
  sofaraway: { src: '/about/sofaraway.webp', width: 800, height: 450, background: '#101a20' },
  harvest: { src: '/works/harvest.webp' },
  'liquid-glass': { src: '/works/liquid-glass.webp' },
  wavefield: { src: '/works/wavefield-preview.webp' },
} as const;

export type ProjectId = keyof typeof projectPreviews;
