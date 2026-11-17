'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Locale, Publication } from './locale-contract';

type SiteLocale = {
  locale: Locale;
  defaultLocale: Locale;
  publishedLocales: Publication['publishedLocales'];
};

const LocaleContext = createContext<SiteLocale | null>(null);

export function LocaleProvider({ value, children }: { value: SiteLocale; children: ReactNode }) {
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useSiteLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('LocaleProvider is missing');
  return value;
}

export function useEnglish() {
  return useSiteLocale().locale === 'en';
}
