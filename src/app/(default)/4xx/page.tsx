import type { Metadata } from 'next';
import { ErrorExperience } from '@/components/errors/ErrorExperience';
import { publication } from '@/site/publication';

const { defaultLocale } = publication;

export const metadata: Metadata = { title: null, robots: { index: false } };

export default function ClientErrorTemplate() {
  return <ErrorExperience kind="request" publication={publication} />;
}
