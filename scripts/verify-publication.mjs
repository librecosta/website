import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { projectPreviews } from '../src/components/project-previews.ts';
import { cnCompliance } from '../src/site/cn-compliance.ts';
import { homePage, pagePath, sitePages } from '../src/site/locale-contract.ts';
import { baiduVerificationFile, llmsText, securityContact, securityLifetimeMs, securityTextPath } from '../src/site/publication-files.ts';
import { indexingAllowed, pageAlternates, pageSeo, robotsText, sitemapXml, websiteSchema } from '../src/site/seo.ts';
import windReview from './expanse-wind-review.json' with { type: 'json' };

const windFiles = ['expanse-wind.opus', 'expanse-wind.mp3'];
const requiredAssets = [
  'robots.txt', 'llms.txt', securityTextPath,
  'favicon.ico', 'favicon-96.png', 'apple-touch-icon.png',
  'brand/librecosta-mark.svg', 'brand/librecosta-logo-512.png', 'og/librecosta-default.png',
  cnCompliance.publicSecurityIcon.slice(1),
  'expanse/entrance-ruin.glb',
  'audio/warm-atmosphere.opus',
  'audio/warm-atmosphere.mp3',
  ...windFiles.map(file => `audio/${file}`),
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
const errorTemplates = ['4xx/index.html', '5xx/index.html'];
const localOrigin = 'https://publication.invalid';

function isOutputFile(file, pages, indexing, region) {
  if (file === 'sitemap.xml') return indexing;
  if (file === baiduVerificationFile) return region === 'cn';
  if (file === securityTextPath) return true;
  const parts = file.split('/');
  if (parts.some(part => part.startsWith('.'))) return false;
  const extension = extname(file);
  if (parts[0] === '_next') return nextTypes.has(extension);
  if (file.startsWith('audio/local/')) return false;
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

function decodeHtml(value) {
  return value?.replace(/&(amp|quot|lt|gt|#x27|#39);/g, (_, code) =>
    ({ amp: '&', quot: '"', lt: '<', gt: '>', '#x27': "'", '#39': "'" })[code]);
}

function verifyPageSeo(html, path, page, locale, publication, indexing) {
  const head = html.split('</head>')[0];
  const expected = pageSeo(page, locale, publication);
  const meta = new Map([...head.matchAll(/<meta (?:name|property)="([^"]+)" content="([^"]*)"/g)]
    .map(([, name, content]) => [name, decodeHtml(content)]));
  const checks = {
    description: expected.description,
    'og:title': expected.title,
    'og:description': expected.description,
    'og:locale': expected.openGraph.locale,
    'og:image': expected.openGraph.images[0].url,
    'twitter:card': 'summary_large_image',
    'twitter:title': expected.title,
    'twitter:description': expected.description,
    'twitter:image': expected.openGraph.images[0].url,
  };
  if (decodeHtml(head.match(/<title>([^<]*)<\/title>/)?.[1]) !== expected.title ||
    Object.entries(checks).some(([name, content]) => meta.get(name) !== content)) {
    throw new Error(`Incorrect localized metadata in ${path}.`);
  }
  const canonical = [...head.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map(([, href]) => href);
  const languages = [...head.matchAll(/<link rel="alternate" hrefLang="([^"]+)" href="([^"]+)"/gi)]
    .map(([, language, href]) => [language, href]);
  // Exclude replicated script text in the client navigation payloads.
  const schemas = [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)];
  if (!indexing) {
    if (meta.get('robots') !== 'noindex, nofollow' || canonical.length || languages.length || schemas.length ||
      meta.has('og:url')) throw new Error(`Preview exposes production indexing signals in ${path}.`);
    return;
  }
  const alternates = pageAlternates(page, locale);
  if (meta.get('robots')?.includes('noindex') || canonical.length !== 1 || canonical[0] !== alternates.canonical ||
    meta.get('og:url') !== alternates.canonical ||
    languages.length !== Object.keys(alternates.languages).length ||
    languages.some(([language, href]) => alternates.languages[language] !== href) ||
    new Set(languages.map(([language]) => language)).size !== languages.length) {
    throw new Error(`Incorrect canonical or hreflang links in ${path}.`);
  }
  const home = path === pagePath(homePage(publication.id), publication.defaultLocale, publication);
  if (schemas.length !== Number(home) ||
    (home && JSON.stringify(JSON.parse(schemas[0][1])) !== JSON.stringify(websiteSchema(publication)))) {
    throw new Error(`Incorrect structured data in ${path}.`);
  }
}

async function verifyWind(directory) {
  for (const name of windFiles) {
    // A managed build does not need FFmpeg. Match the exact encoded bytes
    // decoded and measured by prepare-audio.py, including the playback seam.
    const review = windReview[name];
    const bytes = await readFile(join(directory, 'audio', name));
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (!review || sha256 !== review.sha256 || review.seconds !== 58 ||
      !(review.rmsDbfs >= -25 && review.rmsDbfs <= -21 && review.peakDbfs <= -3 && review.loopStep >= 0 && review.loopStep <= .025)) {
      throw new Error(`Expanse wind failed the decoded audio review: ${name}`);
    }
  }
}

async function verifyPublicationFiles(directory, publication, routes) {
  if (publication.id === 'cn') {
    const original = await readFile(new URL(`../config/publications/${baiduVerificationFile}`, import.meta.url));
    const exported = await readFile(join(directory, baiduVerificationFile));
    if (!exported.equals(original)) throw new Error('Baidu verification file does not match the original.');
  }

  const llms = await readFile(join(directory, 'llms.txt'), 'utf8');
  const links = [...llms.matchAll(/\]\(([^)]+)\)/g)].map(([, href]) => new URL(href, publication.origin ?? localOrigin));
  const expected = publication.id === 'cn' ? [...routes.keys()]
    : [...routes].filter(([, route]) => route.locale === publication.defaultLocale).map(([path]) => path);
  if (llms !== llmsText(publication) || links.length !== expected.length || new Set(links.map(url => url.pathname)).size !== expected.length ||
    links.some(url => url.origin !== (publication.origin ?? localOrigin) || !expected.includes(url.pathname))) {
    throw new Error('llms.txt does not match the published routes.');
  }

  const security = await readFile(join(directory, securityTextPath), 'utf8');
  const [contact, expires, finalLine, ...extra] = security.split('\n');
  const timestamp = expires?.match(/^Expires: (\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ)$/)?.[1];
  const expiry = Date.parse(timestamp);
  const now = Date.now();
  if (contact !== securityContact || finalLine !== '' || extra.length || !(expiry > now && expiry - now <= securityLifetimeMs) ||
    new Date(expiry).toISOString().replace('.000Z', 'Z') !== timestamp) {
    throw new Error('Invalid or expired security.txt. Build a fresh publication.');
  }
}

function verifyCompliance(html, path, page, publication) {
  const footers = [...html.matchAll(/<footer\b[^>]*\bdata-publication-compliance="([^"]+)"[^>]*>([\s\S]*?)<\/footer>/g)];
  if (publication.id === 'intl') {
    if (footers.length || html.includes(cnCompliance.filing) || html.includes(cnCompliance.publicSecurity) || html.includes(cnCompliance.copyright)) {
      throw new Error(`CN filing data leaked into ${path}.`);
    }
    return;
  }
  const [, mode, footer] = footers[0] ?? [];
  if (footers.length !== 1 || mode !== (page === 'about' ? 'flow' : 'docked') ||
    !footer.includes(cnCompliance.copyright) || !footer.includes(`href="${cnCompliance.filingUrl}">${cnCompliance.filing}</a>`) ||
    html.includes('公安备案待办理')) throw new Error(`Incorrect CN filing information in ${path}.`);
  const securityLinks = [...footer.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
    .filter(([, attributes]) => attributes.includes(`href="${cnCompliance.publicSecurityUrl}"`));
  const [, attributes, contents] = securityLinks[0] ?? [];
  if (securityLinks.length !== 1 || !attributes.includes('target="_blank"') ||
    !attributes.includes('rel="noopener noreferrer"') || !contents.includes(cnCompliance.publicSecurity) ||
    !contents.includes(`src="${cnCompliance.publicSecurityIcon}"`) || !contents.includes('alt=""')) {
    throw new Error(`Incorrect CN public security filing link in ${path}.`);
  }
}

export async function verifyExport(directory, publication) {
  const indexing = indexingAllowed(publication);
  const routes = new Map(publication.publishedLocales.flatMap(locale =>
    sitePages.map(page => [pagePath(page, locale, publication), { page, locale }]),
  ));
  const expectedCount = publication.id === 'cn' ? 8 : 24;
  if (routes.size !== expectedCount) throw new Error(`Expected ${expectedCount} publication pages.`);
  const pages = new Set([...routes.keys()].map(path => `${path.slice(1)}index.html`));
  const allowedPages = new Set([...pages, ...fallbackPages, ...errorTemplates]);
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  const paths = entries.filter(entry => !entry.isDirectory()).map(entry => {
    const file = join(entry.parentPath, entry.name);
    const path = relative(directory, file).replaceAll('\\', '/');
    if (!entry.isFile() || !isOutputFile(path, allowedPages, indexing, publication.id)) throw new Error(`Unexpected exported file: ${path}`);
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
  if ((await readFile(join(directory, 'robots.txt'), 'utf8')) !== robotsText(publication)) {
    throw new Error('Unexpected robots.txt for this publication.');
  }
  if (indexing && (await readFile(join(directory, 'sitemap.xml'), 'utf8')) !== sitemapXml(publication)) {
    throw new Error('Unexpected live sitemap.');
  }
  await verifyPublicationFiles(directory, publication, routes);
  await verifyWind(directory);
  const notFound = await readFile(join(directory, '404.html'), 'utf8');
  if (!/<meta name="robots" content="noindex/.test(notFound)) throw new Error('404 may be indexed.');
  verifyHtml(notFound, '/404.html', routes, files);
  for (const file of errorTemplates) {
    const html = await readFile(join(directory, file), 'utf8');
    if (!/<meta name="robots" content="noindex/.test(html)) throw new Error(`Error template may be indexed: ${file}.`);
    verifyHtml(html, `/${file.replace('index.html', '')}`, routes, files);
  }
  for (const [path, { page, locale }] of routes) {
    const file = `${path.slice(1)}index.html`;
    const html = await readFile(join(directory, file), 'utf8');
    if (html.match(/<html\b[^>]*\blang="([^"]+)"/)?.[1] !== locale) {
      throw new Error(`Wrong language in ${file}.`);
    }
    verifyPageSeo(html, path, page, locale, publication, indexing);
    verifyHtml(html, path, routes, files);
    verifyCompliance(html, path, page, publication);
  }
  return { pages: pages.size, files: files.size, bytes, largest };
}
