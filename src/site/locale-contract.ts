export const locales = {
  zh: { name: '简体中文', abbreviation: '中' },
  en: { name: 'English', abbreviation: 'EN' },
  ja: { name: '日本語', abbreviation: 'JA' },
  de: { name: 'Deutsch', abbreviation: 'DE' },
  fr: { name: 'Français', abbreviation: 'FR' },
  es: { name: 'Español', abbreviation: 'ES' },
} as const;

export type Locale = keyof typeof locales;
export const localeIds = Object.keys(locales) as Locale[];
export const siteRoutes = ['/', '/works', '/about', '/contact'] as const;
export type SiteRoute = (typeof siteRoutes)[number];

export type Publication = {
  id: 'cn' | 'intl';
  defaultLocale: Locale;
  origin: string | null;
  publishedLocales: readonly Locale[];
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && Object.hasOwn(locales, value);
}

export function localePath(route: SiteRoute, locale: Locale, defaultLocale: Locale) {
  const prefix = locale === defaultLocale ? '' : `/${locale}`;
  return route === '/' ? `${prefix}/` : `${prefix}${route}/`;
}
