import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { pageSeo } from './seo';
import { isLocale, type Locale, type SitePage } from './locale-contract';
import { publication } from './publication';
import { PublicationPreview } from './PublicationPreview';

type Params = { params: Promise<{ locale: string }> };

export function sitePage(page: SitePage, title: string, render: () => React.ReactNode) {
  function metadata(locale: Locale): Metadata {
    if (!publication.publishedLocales.includes(locale)) return { title: `${title} · Internal Preview | LibreCosta` };
    return pageSeo(page, locale, publication);
  }

  async function localizedLocale({ params }: Params) {
    const { locale } = await params;
    if (!isLocale(locale) || locale === publication.defaultLocale || !publication.publishedLocales.includes(locale)) notFound();
    return locale;
  }

  return {
    Page: () => publication.publishedLocales.includes(publication.defaultLocale)
      ? render() : <PublicationPreview route={page} title={title} />,
    metadata: metadata(publication.defaultLocale),
    LocalizedPage: async (props: Params) => {
      await localizedLocale(props);
      return render();
    },
    localizedMetadata: async (props: Params) => metadata(await localizedLocale(props)),
  };
}
