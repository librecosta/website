import type { Metadata } from 'next';
import { publicationIndexingEnabled } from '../../config/publications/indexing.ts';
import { siteCopy } from './content.ts';
import { homePage, localeIds, pagePath, sitePages, type Locale, type Publication, type SitePage } from './locale-contract.ts';
import { publications } from './publication-catalog.ts';
import { isPublicationPreview } from './publication-config.ts';

const openGraphLocales: Record<Locale, string> = {
  zh: 'zh_CN', en: 'en_US', ja: 'ja_JP', de: 'de_DE', fr: 'fr_FR', es: 'es_ES',
};

const owner = (locale: Locale) => publications[locale === 'zh' ? 'cn' : 'intl'];

export const brandIcons: Metadata['icons'] = {
  icon: [
    { url: '/favicon.ico', sizes: '16x16 32x32 48x48', type: 'image/x-icon' },
    { url: '/favicon-96.png', sizes: '96x96', type: 'image/png' },
  ],
  apple: { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
};

export function indexingAllowed(publication: Publication) {
  return publicationIndexingEnabled && !isPublicationPreview(publication);
}

function canonicalUrl(page: SitePage, locale: Locale) {
  const preferred = owner(locale);
  if (!preferred.origin || !preferred.publishedLocales.includes(locale)) {
    throw new Error(`Missing canonical publication for ${locale}.`);
  }
  return preferred.origin + pagePath(page, locale, preferred);
}

export function pageAlternates(page: SitePage, locale: Locale) {
  return {
    canonical: canonicalUrl(page, locale),
    languages: {
      ...Object.fromEntries(localeIds.map(language => [language, canonicalUrl(page, language)])),
      'x-default': canonicalUrl(page, 'en'),
    },
  };
}

export function pageSeo(page: SitePage, locale: Locale, publication: Publication): Metadata {
  const copy = siteCopy[locale];
  const { metadata } = copy;
  const titles = { world: copy.world.title, about: metadata.aboutTitle, works: metadata.worksTitle, contact: metadata.contactTitle };
  const descriptions = { world: metadata.world, about: metadata.about, works: metadata.works, contact: copy.contact.intro };
  const title = `${titles[page]} | LibreCosta`;
  const description = descriptions[page];
  const image = `${publication.origin ?? ''}/og/librecosta-default.png`;
  const alternates = indexingAllowed(publication) ? pageAlternates(page, locale) : undefined;
  return {
    title, description, alternates,
    openGraph: {
      type: 'website', siteName: 'LibreCosta', title, description, locale: openGraphLocales[locale],
      url: alternates?.canonical, images: [{ url: image, width: 1200, height: 630, alt: 'LibreCosta' }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image], site: '@LibreCostaHQ' },
  };
}

export function sitemapXml(publication: Publication) {
  const urls = publication.publishedLocales.filter(locale => owner(locale).id === publication.id)
    .flatMap(locale => sitePages.map(page => `  <url><loc>${canonicalUrl(page, locale)}</loc></url>`));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

export function robotsText(publication: Publication, allowIndexing = indexingAllowed(publication)) {
  if (!allowIndexing) return 'User-agent: *\nDisallow: /\n';
  return `User-agent: *\nAllow: /\n\nSitemap: ${publication.origin}/sitemap.xml\n`;
}

export function websiteSchema(publication: Publication) {
  const origin = publication.origin;
  const canonicalOrigin = publications.intl.origin;
  const organization = `${canonicalOrigin}/#organization`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization', '@id': organization, name: 'LibreCosta',
        legalName: siteCopy.en.about.profile.company, alternateName: '远岸开物',
        url: `${canonicalOrigin}/`, email: 'contact@librecosta.com',
        logo: `${canonicalOrigin}/brand/librecosta-logo-512.png`,
      },
      {
        '@type': 'WebSite', '@id': `${origin}/#website`, name: 'LibreCosta',
        url: origin + pagePath(homePage(publication.id), publication.defaultLocale, publication),
        inLanguage: publication.publishedLocales, publisher: { '@id': organization },
      },
    ],
  };
}
