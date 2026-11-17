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
export const sitePages = ['world', 'works', 'about', 'contact'] as const;
export type SitePage = (typeof sitePages)[number];

export type Publication = {
  id: 'cn' | 'intl';
  defaultLocale: Locale;
  origin: string | null;
  publishedLocales: readonly Locale[];
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && Object.hasOwn(locales, value);
}

const segments = {
  cn: { world: 'world', works: 'works', about: '', contact: 'contact' },
  intl: { world: '', works: 'works', about: 'about', contact: 'contact' },
} satisfies Record<Publication['id'], Record<SitePage, string>>;

export function homePage(region: Publication['id']): SitePage {
  return sitePages.find(page => segments[region][page] === '')!;
}

export function pagePath(page: SitePage, locale: Locale, publication: Pick<Publication, 'id' | 'defaultLocale'>) {
  const parts = [locale === publication.defaultLocale ? '' : locale, segments[publication.id][page]].filter(Boolean);
  return parts.length ? `/${parts.join('/')}/` : '/';
}
