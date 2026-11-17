import { open, readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { projectPreviews } from '../src/components/project-previews.ts';
import { localeIds, localePath, siteRoutes } from '../src/site/locale-contract.ts';
import { isPublicationPreview, prefixedLocales } from '../src/site/publication-config.ts';

export const windFiles = ['expanse-wind.opus', 'expanse-wind.mp3'];
const windAssets = windFiles.map(file => `audio/local/${file}`);
const requiredAssets = [
  'expanse/entrance-ruin.glb',
  'audio/warm-atmosphere.opus',
  'audio/warm-atmosphere.mp3',
  'works/draco/draco_decoder.wasm',
  'works/draco/draco_wasm_wrapper.js',
  'about/closing/works-world.webp',
  'about/closing/librecosta-github.webp',
  ...Object.values(projectPreviews).map(({ src }) => src.slice(1)),
  ...['gofurry', 'tool4furry', 'uptime', 'harvest', 'liquid-glass', 'wavefield', 'sofaraway', 'gopher-atlas']
    .map(slug => `works/islands/${slug}.glb`),
  ...['gofurry', 'tool4furry', 'librecosta-uptime', 'harvest', 'liquid-glass', 'wavefield', 'sofaraway', 'gopheratlas']
    .map(slug => `works/previews/${slug}.webp`),
];

const publicDirs = new Set(['about', 'audio', 'expanse', 'License', 'works']);
const publicTypes = new Set(['.glb', '.jpg', '.jpeg', '.mp3', '.opus', '.png', '.svg', '.webp', '.woff2']);
const nextTypes = new Set(['.css', '.js', '.wasm', '.woff2']);
const fallbackPages = ['404.html', '404/index.html', '_not-found/index.html'];
const localOrigin = 'https://publication.invalid';

function isOutputFile(file, pages) {
  const parts = file.split('/');
  if (parts.some(part => part.startsWith('.'))) return false;
  const extension = extname(file);
  if (parts[0] === '_next') return nextTypes.has(extension);
  if (file.startsWith('audio/local/')) return windAssets.includes(file);
  if (publicDirs.has(parts[0]) && publicTypes.has(extension)) return true;
  if (requiredAssets.includes(file)) return true;
  if (pages.has(file)) return true;
  if (extension !== '.txt') return false;
  if (parts.length === 2 && (parts[0] === 'License' ||
    (publicDirs.has(parts[0]) && /(?:notice|license|attribution|^OFL-)/i.test(parts[1])))) return true;
  // The App Router exports client-navigation payloads next to its HTML pages.
  const segment = parts.findIndex(part => part.startsWith('__next.'));
  if (segment >= 0) return pages.has([...parts.slice(0, segment), 'index.html'].join('/'));
  return parts.at(-1) === 'index.txt' && pages.has([...parts.slice(0, -1), 'index.html'].join('/'));
}

function verifyHtml(html, path, urls, files) {
  for (const [, tag, attributes] of html.matchAll(/<(a|img|script|link|source)\b([^>]+)>/gi)) {
    const attribute = /\s(?:src|href)="([^"]+)"/g;
    for (const [, reference] of attributes.matchAll(attribute)) {
      if (reference.startsWith('#')) continue;
      const url = new URL(reference.replaceAll('&amp;', '&'), localOrigin + path);
      if (url.origin !== localOrigin) continue;
      if (tag === 'a' && urls.has(url.pathname)) continue;
      if (!files.has(decodeURIComponent(url.pathname.slice(1)))) {
        throw new Error(`Broken local ${tag} reference in ${path}: ${reference}`);
      }
    }
  }
}

async function verifyWind(directory, files) {
  const present = windAssets.filter(file => files.has(file));
  if (!present.length) return false;
  if (present.length !== windAssets.length) throw new Error('Expanse wind needs both Opus and MP3.');
  for (const name of present) {
    const file = await open(join(directory, name), 'r');
    try {
      const header = Buffer.alloc(64);
      await file.read(header);
      const valid = name.endsWith('.opus')
        ? header.toString('ascii', 0, 4) === 'OggS' && header.includes('OpusHead')
        : header.toString('ascii', 0, 3) === 'ID3' || (header[0] === 0xff && (header[1] & 0xe0) === 0xe0);
      if (!valid) throw new Error(`Invalid wind audio: ${name}`);
    } finally {
      await file.close();
    }
  }
  return true;
}

export async function verifyExport(directory, publication) {
  const localeList = [publication.defaultLocale, ...prefixedLocales(publication)];
  if (localeList.length !== localeIds.length) throw new Error('Expected all six publication locales.');
  const routes = new Map(localeList.flatMap(locale =>
    siteRoutes.map(route => [localePath(route, locale, publication.defaultLocale), locale]),
  ));
  const pages = new Set([...routes.keys()].map(path => `${path.slice(1)}index.html`));
  const allowedPages = new Set([...pages, ...fallbackPages]);
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  const paths = entries.filter(entry => !entry.isDirectory()).map(entry => {
    const file = join(entry.parentPath, entry.name);
    const path = relative(directory, file).replaceAll('\\', '/');
    if (!entry.isFile() || !isOutputFile(path, allowedPages)) throw new Error(`Unexpected exported file: ${path}`);
    return { path, file };
  });
  // Cloudflare Free allows 20,000 files and 25 MiB each. Makers also lists 20,000
  // files and a 25 MB individual limit, so use the lower common size ceiling.
  if (paths.length > 20_000) throw new Error('Static export exceeds 20,000 files.');
  const inventory = await Promise.all(paths.map(async ({ path, file }) => ({ path, size: (await stat(file)).size })));
  const files = new Set(inventory.map(({ path }) => path));
  let largest = { path: '', size: 0 };
  let bytes = 0;
  for (const entry of inventory) {
    if (!entry.size || entry.size > 25_000_000) throw new Error(`Invalid asset size: ${entry.path} (${entry.size} bytes).`);
    if (entry.size > largest.size) largest = entry;
    bytes += entry.size;
  }
  for (const file of ['404.html', ...requiredAssets]) {
    if (!files.has(file)) throw new Error(`Missing exported asset: ${file}`);
  }
  if (![...files].some(file => file.startsWith('_next/') && file.endsWith('.woff2'))) {
    throw new Error('Missing Next.js font assets.');
  }
  const notFound = await readFile(join(directory, '404.html'), 'utf8');
  verifyHtml(notFound, '/404.html', routes, files);
  for (const [path, locale] of routes) {
    const page = `${path.slice(1)}index.html`;
    const html = await readFile(join(directory, page), 'utf8');
    if (html.match(/<html\b[^>]*\blang="([^"]+)"/)?.[1] !== locale) {
      throw new Error(`Wrong language in ${page}.`);
    }
    if (isPublicationPreview(publication) && !/<meta name="robots" content="noindex, nofollow"/.test(html)) {
      throw new Error(`Internal preview may be indexed: ${page}.`);
    }
    verifyHtml(html, path, routes, files);
  }
  return { pages: pages.size, files: files.size, bytes, largest, windAvailable: await verifyWind(directory, files) };
}
