'use client';

import { ErrorDocument } from '@/components/errors/ErrorDocument';
import { publication } from '@/site/publication';

export default function GlobalError({ retry }: { retry: () => void }) {
  return <ErrorDocument kind="server" publication={publication} retry={retry} />;
}
