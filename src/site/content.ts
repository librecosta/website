import type { Locale } from './locale-contract';

// Register a locale here once its four pages and shared controls have reviewed copy.
export const reviewedContentLocales: readonly Locale[] = ['zh'];

export type LanguageControlCopy = {
  label: string;
  pending: string;
  navigation: string;
  home: string;
  social: string;
  newTab: string;
};

// P1-B/P1-C can add page-specific content alongside these shared controls.
export const languageControlCopy: Partial<Record<Locale, LanguageControlCopy>> & {
  zh: LanguageControlCopy;
  en: LanguageControlCopy;
} = {
  zh: { label: '页面语言', pending: '未开放', navigation: '站点导航', home: 'LibreCosta 首页',
    social: '社交媒体', newTab: '（在新标签页打开）' },
  en: { label: 'Language', pending: 'Unavailable', navigation: 'Site navigation', home: 'LibreCosta home',
    social: 'Social media', newTab: ' (opens in a new tab)' },
};
