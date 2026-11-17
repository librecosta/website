import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { siteCopy } from './content';
import { isLocale, type Locale, type SiteRoute } from './locale-contract';
import { publication } from './publication';
import { PublicationPreview } from './PublicationPreview';

type Params = { params: Promise<{ locale: string }> };

export function sitePage(route: SiteRoute, title: string, render: () => React.ReactNode) {
  function metadata(locale: Locale): Metadata {
    if (!publication.publishedLocales.includes(locale)) return { title: `${title} · Internal Preview | LibreCosta` };
    const copy = siteCopy[locale].metadata;
    switch (route) {
      case '/': return { description: copy.world };
      case '/about': return { title: `${copy.aboutTitle} | LibreCosta`, description: copy.about };
      case '/works': return { title: `${copy.worksTitle} | LibreCosta`, description: copy.works };
      case '/contact': return { title: `${copy.contactTitle} | LibreCosta` };
    }
  }

  async function localizedLocale({ params }: Params) {
    const { locale } = await params;
    if (!isLocale(locale) || locale === publication.defaultLocale || !publication.publishedLocales.includes(locale)) notFound();
    return locale;
  }

  return {
    Page: () => publication.publishedLocales.includes(publication.defaultLocale)
      ? render() : <PublicationPreview route={route} title={title} />,
    metadata: metadata(publication.defaultLocale),
    LocalizedPage: async (props: Params) => {
      await localizedLocale(props);
      return render();
    },
    localizedMetadata: async (props: Params) => metadata(await localizedLocale(props)),
  };
}
