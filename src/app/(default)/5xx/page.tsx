import type { Metadata } from 'next';
import { ErrorExperience } from '@/components/errors/ErrorExperience';
import { publication } from '@/site/publication';

const { defaultLocale, publishedLocales } = publication;

export const metadata: Metadata = { title: null, robots: { index: false } };

export default function ServerErrorTemplate() {
  return <ErrorExperience kind="server" defaultLocale={defaultLocale} publishedLocales={publishedLocales} />;
}
