import { reviewedContentLocales, verifyLocaleCopy } from './content.ts';
import { isLocale, type Locale, type Publication } from './locale-contract.ts';

export function parsePublication(value: unknown): Publication {
  if (!value || typeof value !== 'object') throw new Error('Invalid publication configuration.');
  const { id, defaultLocale, origin, publishedLocales } = value as Record<string, unknown>;
  if ((id !== 'cn' && id !== 'intl') || !isLocale(defaultLocale)) {
    throw new Error('Invalid publication region or default locale.');
  }
  if (origin !== null && (typeof origin !== 'string' || !origin.startsWith('https://') || new URL(origin).origin !== origin)) {
    throw new Error(`Invalid HTTPS origin for ${id}.`);
  }
  if (!Array.isArray(publishedLocales) || !publishedLocales.every(isLocale) || new Set(publishedLocales).size !== publishedLocales.length) {
    throw new Error(`Invalid published locales for ${id}.`);
  }
  const unreviewed = publishedLocales.filter((locale: Locale) => !reviewedContentLocales.includes(locale));
  if (unreviewed.length) throw new Error(`${id} enables unreviewed content: ${unreviewed.join(', ')}.`);
  publishedLocales.forEach(verifyLocaleCopy);
  return { id, defaultLocale, origin, publishedLocales };
}

export function isPublicationPreview(publication: Publication) {
  return !publication.publishedLocales.includes(publication.defaultLocale);
}

export function prefixedLocales(publication: Publication) {
  return publication.publishedLocales.filter(locale => locale !== publication.defaultLocale);
}
