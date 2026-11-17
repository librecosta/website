import localFont from 'next/font/local';

export const instrumentFont = localFont({
  src: '../components/expanse/fonts/oxanium-600-latin.woff2',
  weight: '600',
  variable: '--instrument-type',
  // Let the first paint keep its fallback if the preloaded font arrives late.
  display: 'optional',
  fallback: ['Bahnschrift', 'Segoe UI', 'sans-serif'],
  adjustFontFallback: false,
});
