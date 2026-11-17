import { homePage, locales, pagePath, sitePages, type Locale, type Publication } from './locale-contract.ts';
import { pageSeo } from './seo.ts';

export const securityTextPath = '.well-known/security.txt';
export const securityContact = 'Contact: mailto:contact@librecosta.com';
export const securityLifetimeMs = 180 * 24 * 60 * 60 * 1000;

export function securityText() {
  const expires = new Date(Date.now() + securityLifetimeMs).toISOString().replace(/\.\d{3}Z$/, 'Z');
  return `${securityContact}\nExpires: ${expires}\n`;
}

export function llmsText(publication: Publication) {
  const china = publication.id === 'cn';
  const home = homePage(publication.id);
  const pages = [home, ...sitePages.filter(page => page !== home)];
  const main = publication.defaultLocale;
  const otherLanguages = publication.publishedLocales.filter(locale => locale !== main);
  const list = (locale: Locale, descriptions = false) => pages.map(page => {
    const { title, description } = pageSeo(page, locale, publication);
    const url = (publication.origin ?? '') + pagePath(page, locale, publication);
    return `- [${String(title).replace(' | LibreCosta', '')}](${url})${descriptions ? `: ${description}` : ''}`;
  });

  const details = china
    ? ['## 中文', ...list(main, true), ...otherLanguages.flatMap(locale => ['', `## ${locales[locale].name}`, ...list(locale)])]
    : ['## Pages', ...list(main, true), '', `Also available in ${otherLanguages.map(locale => locales[locale].name).join(', ')}.`];

  return ['# LibreCosta', '', china
    ? '> 远岸开物为社群、创作者与开发者制作软件和开源工具，也探索网页图形与交互体验。'
    : '> LibreCosta builds software and open-source tools for communities, creators, and developers, and explores web graphics and interactive experiences.',
  '', ...details, ''].join('\n');
}
