import type { Metadata } from 'next';
import { ErrorExperience } from '@/components/errors/ErrorExperience';
import { publication } from '@/site/publication';

const { defaultLocale, publishedLocales } = publication;

export const metadata: Metadata = { title: null, robots: { index: false } };

export default function ClientErrorTemplate() {
  return <ErrorExperience kind="request" defaultLocale={defaultLocale} publishedLocales={publishedLocales} />;
}
