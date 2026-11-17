import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AudioProvider } from '@/components/audio/AudioProvider';
import { LocaleProvider } from './LocaleProvider';
import type { Locale } from './locale-contract';
import { publication } from './publication';
import { isPublicationPreview } from './publication-config';
import '@/app/globals.css';

export function siteMetadata(locale: Locale): Metadata {
  return {
    title: locale === 'zh' ? 'LibreCosta — 远岸开物' : 'LibreCosta',
    description: locale === 'zh' ? 'LibreCosta 官方网站。' : undefined,
    robots: isPublicationPreview(publication) ? { index: false, follow: false } : undefined,
  };
}

export function SiteLayout({ locale, children }: { locale: Locale; children: ReactNode }) {
  const { defaultLocale, publishedLocales } = publication;
  return <html lang={locale}><body>
    <LocaleProvider value={{ locale, defaultLocale, publishedLocales }}>
      <AudioProvider>{children}</AudioProvider>
    </LocaleProvider>
  </body></html>;
}
