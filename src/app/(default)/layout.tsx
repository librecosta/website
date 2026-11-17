import type { ReactNode } from 'react';
import { publication } from '@/site/publication';
import { SiteLayout, siteMetadata } from '@/site/SiteLayout';

export const metadata = siteMetadata(publication.defaultLocale);

export default function DefaultLayout({ children }: { children: ReactNode }) {
  return <SiteLayout locale={publication.defaultLocale}>{children}</SiteLayout>;
}
