import type { Metadata } from 'next';
import { ErrorDocument } from '@/components/errors/ErrorDocument';
import { publication } from '@/site/publication';
import { brandIcons } from '@/site/seo';

export const metadata: Metadata = { icons: brandIcons, robots: { index: false, follow: false } };

export default function GlobalNotFound() {
  return <ErrorDocument kind="notFound" publication={publication} />;
}
