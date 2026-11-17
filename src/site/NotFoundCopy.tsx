'use client';

import { useLayoutEffect, useState } from 'react';
import { isLocale, localePath, type Locale } from './locale-contract';

type Labels = { title: string; home: string };

export function NotFoundCopy({ defaultLocale, labels }: {
  defaultLocale: Locale; labels: Partial<Record<Locale, Labels>>;
}) {
  const [locale, setLocale] = useState(defaultLocale);
  useLayoutEffect(() => {
    // Static hosts can use one 404 document for all paths while retaining the requested URL.
    const prefix = window.location.pathname.split('/')[1];
    if (!isLocale(prefix) || !labels[prefix]) return;
    document.documentElement.lang = prefix;
    document.title = `${labels[prefix].title} | LibreCosta`;
    setLocale(prefix);
  }, [labels]);

  return <main>
    <h1>404 · {labels[locale]!.title}</h1>
    <a href={localePath('/', locale, defaultLocale)}>{labels[locale]!.home}</a>
  </main>;
}
