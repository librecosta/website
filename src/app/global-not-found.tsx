import type { Metadata } from 'next';
import { ErrorDocument } from '@/components/errors/ErrorDocument';
import { publication } from '@/site/publication';

const { defaultLocale, publishedLocales } = publication;

export const metadata: Metadata = { robots: { index: false } };

export default function GlobalNotFound() {
  return <ErrorDocument kind="notFound" defaultLocale={defaultLocale} publishedLocales={publishedLocales} />;
}
