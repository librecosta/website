import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AudioProvider } from '@/components/audio/AudioProvider';
import { cnCompliance } from './cn-compliance';
import { usesOriginalLayout } from './content';
import { LocaleProvider } from './LocaleProvider';
import type { Locale } from './locale-contract';
import { publication } from './publication';
import { brandIcons, indexingAllowed } from './seo';
import { instrumentFont } from './instrument-font';
import '@/app/globals.css';

export function siteMetadata(locale: Locale): Metadata {
  return {
    title: locale === 'zh' ? 'LibreCosta — 远岸开物' : 'LibreCosta',
    description: locale === 'zh' ? 'LibreCosta 官方网站。' : undefined,
    icons: brandIcons,
    robots: indexingAllowed(publication) ? undefined : { index: false, follow: false },
    verification: publication.id === 'cn'
      ? { other: { 'baidu-site-verification': 'codeva-VqPM8zReFt' } }
      : undefined,
  };
}

export function SiteLayout({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <html lang={locale} className={instrumentFont.variable} data-localized={!usesOriginalLayout(locale) || undefined}><body>
    <LocaleProvider value={{ locale, publication, compliance: publication.id === 'cn' ? cnCompliance : undefined }}>
      <AudioProvider>{children}</AudioProvider>
    </LocaleProvider>
  </body></html>;
}
