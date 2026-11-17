import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { isLocale } from '@/site/locale-contract';
import { publication } from '@/site/publication';
import { prefixedLocales } from '@/site/publication-config';
import { SiteLayout, siteMetadata } from '@/site/SiteLayout';

const enabledLocales = prefixedLocales(publication);
type Params = Promise<{ locale: string }>;

export const dynamicParams = false;

export function generateStaticParams() {
  return enabledLocales.map(locale => ({ locale }));
}

async function routeLocale(params: Params) {
  const { locale } = await params;
  if (!isLocale(locale) || !enabledLocales.includes(locale)) notFound();
  return locale;
}

export async function generateMetadata({ params }: { params: Params }) {
  return siteMetadata(await routeLocale(params));
}

export default async function LocalizedLayout({ children, params }: { children: ReactNode; params: Params }) {
  return <SiteLayout locale={await routeLocale(params)}>{children}</SiteLayout>;
}
