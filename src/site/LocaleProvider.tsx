'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { siteCopy } from './content';
import type { cnCompliance } from './cn-compliance';
import type { Locale, Publication } from './locale-contract';

type SiteLocale = {
  locale: Locale;
  publication: Publication;
  compliance?: typeof cnCompliance;
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

export function useSiteCopy() {
  return siteCopy[useSiteLocale().locale];
}
