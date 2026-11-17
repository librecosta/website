import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
import active from './config/publications/active';
import { parsePublication, prefixedLocales } from './src/site/publication-config';

export default function config(phase: string): NextConfig {
  const development = phase === PHASE_DEVELOPMENT_SERVER;
  const publication = parsePublication(active);
  const localized = development || prefixedLocales(publication).length > 0;
  return {
    // Let the dev layout return 404 even when it has no prefixed locales.
    // Production still uses the static export and its route checks.
    output: development ? undefined : 'export',
    trailingSlash: true,
    // Keep the locale branch discoverable during Fast Refresh. The layout
    // rejects unpublished locales, and export skips an empty branch entirely.
    pageExtensions: [
      ...(localized ? [`${publication.id}.localized.tsx`, 'localized.tsx'] : []),
      `${publication.id}.tsx`, 'tsx', 'ts', 'jsx', 'js',
    ],
    experimental: { globalNotFound: true },
    images: { unoptimized: true },
    poweredByHeader: false,
    devIndicators: false,
    reactStrictMode: true,
  };
}
