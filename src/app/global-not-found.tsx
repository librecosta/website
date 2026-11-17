import type { Metadata } from 'next';
import { siteCopy } from '@/site/content';
import { NotFoundCopy } from '@/site/NotFoundCopy';
import { publication } from '@/site/publication';
import './globals.css';

const { defaultLocale, publishedLocales } = publication;
const fallback = siteCopy[defaultLocale].shared.notFound;
const labels = Object.fromEntries([defaultLocale, ...publishedLocales].map(locale => [locale, siteCopy[locale].shared.notFound]));

export const metadata: Metadata = { title: `${fallback.title} | LibreCosta` };

export default function GlobalNotFound() {
  return <html lang={defaultLocale}><body>
    <NotFoundCopy defaultLocale={defaultLocale} labels={labels} />
  </body></html>;
}
