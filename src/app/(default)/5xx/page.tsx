import type { Metadata } from 'next';
import { ErrorExperience } from '@/components/errors/ErrorExperience';
import { publication } from '@/site/publication';

const { defaultLocale } = publication;

export const metadata: Metadata = { title: null, robots: { index: false } };

export default function ServerErrorTemplate() {
  return <ErrorExperience kind="server" publication={publication} />;
}
