'use client';

import { ErrorDocument } from '@/components/errors/ErrorDocument';
import { publication } from '@/site/publication';

export default function GlobalError({ retry }: { retry: () => void }) {
  return <ErrorDocument kind="server" defaultLocale={publication.defaultLocale}
    publishedLocales={publication.publishedLocales} retry={retry} />;
}
