import type { NextConfig } from 'next';
import active from './config/publications/active';
import { parsePublication, prefixedLocales } from './src/site/publication-config';

const config: NextConfig = {
  output: 'export',
  trailingSlash: true,
  // The static exporter requires a nonempty generateStaticParams for every
  // dynamic route. Register the prefixed branch only when it has routes.
  pageExtensions: prefixedLocales(parsePublication(active)).length
    ? ['localized.tsx', 'tsx', 'ts', 'jsx', 'js']
    : ['tsx', 'ts', 'jsx', 'js'],
  experimental: { globalNotFound: true },
  images: { unoptimized: true },
  poweredByHeader: false,
  devIndicators: false,
  reactStrictMode: true,
};
export default config;
