import { de } from './copy/de.ts';
import { en } from './copy/en.ts';
import { es } from './copy/es.ts';
import { fr } from './copy/fr.ts';
import { ja } from './copy/ja.ts';
import { zh } from './copy/zh.ts';
import type { SiteCopy } from './copy/types';
import { localeIds, type Locale } from './locale-contract.ts';

export const siteCopy: Readonly<Record<Locale, SiteCopy>> = { zh, en, ja, de, fr, es };
export const reviewedContentLocales: readonly Locale[] = localeIds;

export function verifyLocaleCopy(locale: Locale) {
  function verify(value: unknown, path: string) {
    if (typeof value === 'string' && value.trim()) return;
    if (value && typeof value === 'object') {
      for (const [key, entry] of Object.entries(value)) verify(entry, `${path}.${key}`);
      return;
    }
    throw new Error(`Missing locale copy at ${path}.`);
  }
  verify(siteCopy[locale], locale);
}

export function usesOriginalLayout(locale: Locale) {
  return locale === 'zh' || locale === 'en';
}
