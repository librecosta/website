import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, type Locale, type SiteRoute } from './locale-contract';
import { publication } from './publication';
import { PublicationPreview } from './PublicationPreview';

type Params = { params: Promise<{ locale: string }> };

// A page can supply reviewed content per locale without changing its route entries.
export type SitePageContent = {
  metadata: Metadata;
  render: () => React.ReactNode;
};

export function sitePage(route: SiteRoute, title: string, content: Partial<Record<Locale, SitePageContent>>) {
  function forLocale(locale: Locale): SitePageContent {
    if (publication.publishedLocales.includes(locale)) {
      const page = content[locale];
      if (!page) throw new Error(`Missing reviewed content for ${locale} ${route}.`);
      return page;
    }
    return {
      metadata: { title: `${title} · Internal Preview | LibreCosta` },
      render: () => <PublicationPreview route={route} title={title} />,
    };
  }

  async function getLocalizedContent({ params }: Params) {
    const { locale } = await params;
    if (!isLocale(locale) || locale === publication.defaultLocale || !publication.publishedLocales.includes(locale)) notFound();
    return forLocale(locale);
  }

  return {
    Page: () => forLocale(publication.defaultLocale).render(),
    metadata: forLocale(publication.defaultLocale).metadata,
    LocalizedPage: async (props: Params) => (await getLocalizedContent(props)).render(),
    localizedMetadata: async (props: Params) => (await getLocalizedContent(props)).metadata,
  };
}
