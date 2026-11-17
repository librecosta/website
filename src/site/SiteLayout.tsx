import type { Metadata } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import { AudioProvider } from '@/components/audio/AudioProvider';
import { usesOriginalLayout } from './content';
import { LocaleProvider } from './LocaleProvider';
import type { Locale } from './locale-contract';
import { publication } from './publication';
import { isPublicationPreview } from './publication-config';
import '@/app/globals.css';

const instrumentFont = localFont({
  src: '../components/expanse/fonts/oxanium-600-latin.woff2',
  weight: '600',
  variable: '--instrument-type',
  // Let the first paint keep its fallback if the preloaded font arrives late.
  display: 'optional',
  fallback: ['Bahnschrift', 'Segoe UI', 'sans-serif'],
  adjustFontFallback: false,
});

export function siteMetadata(locale: Locale): Metadata {
  return {
    title: locale === 'zh' ? 'LibreCosta — 远岸开物' : 'LibreCosta',
    description: locale === 'zh' ? 'LibreCosta 官方网站。' : undefined,
    robots: isPublicationPreview(publication) ? { index: false, follow: false } : undefined,
  };
}

export function SiteLayout({ locale, children }: { locale: Locale; children: ReactNode }) {
  const { defaultLocale, publishedLocales } = publication;
  return <html lang={locale} className={instrumentFont.variable} data-localized={!usesOriginalLayout(locale) || undefined}><body>
    <LocaleProvider value={{ locale, defaultLocale, publishedLocales }}>
      <AudioProvider>{children}</AudioProvider>
    </LocaleProvider>
  </body></html>;
}
