import { spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPublicationPreview, parsePublication } from '../src/site/publication-config.ts';
import { indexingAllowed, pageAlternates, robotsText, sitemapXml } from '../src/site/seo.ts';
import { pagePath, sitePages } from '../src/site/locale-contract.ts';
import { llmsText, securityText, securityTextPath } from '../src/site/publication-files.ts';
import { verifyExport } from './verify-publication.mjs';

const repo = fileURLToPath(new URL('..', import.meta.url));
const [first, second, ...rest] = process.argv.slice(2);
const check = first === '--check-release';
const edgeone = first === '--edgeone';
const id = check || edgeone ? second : first;
if ((id !== 'cn' && id !== 'intl') || (edgeone && id !== 'cn') || rest.length || (!check && !edgeone && second)) {
  throw new Error('Usage: node scripts/build-publication.mjs [--check-release] <cn|intl> | --edgeone cn');
}

const configuration = join(repo, 'config', 'publications', `${id}.json`);
const publication = parsePublication(JSON.parse(await readFile(configuration, 'utf8')));
if (publication.id !== id) throw new Error(`Publication ${publication.id} does not match ${id}.json.`);

const label = id.toUpperCase();
const dist = edgeone ? join(repo, 'deploy', 'edgeone-cn', 'dist') : join(repo, 'dist');
const destination = join(dist, id);

function reportRelease(required) {
  const blockers = [];
  if (isPublicationPreview(publication)) blockers.push(`default locale ${publication.defaultLocale} has no published content`);
  if (!publication.origin) blockers.push('production origin has not been set');
  if (!indexingAllowed(publication)) blockers.push('production indexing approval is pending');
  if (!blockers.length) {
    console.log(`${label} artifact release checks passed.`);
    return;
  }
  const message = `${label} release blocked: ${blockers.join('; ')}.`;
  if (required) throw new Error(message);
  console.log(message);
}

function buildNext(cwd) {
  const next = join(repo, 'node_modules', 'next', 'dist', 'bin', 'next');
  return new Promise((resolve, reject) => {
    const job = spawn(process.execPath, [next, 'build'], { cwd, stdio: 'inherit' });
    job.on('error', reject);
    job.on('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`Next build failed (${code ?? signal}).`)));
  });
}

if (check) {
  await verifyExport(destination, publication);
  reportRelease(true);
} else {
  const builds = join(repo, '.local', 'publication-builds');
  await mkdir(builds, { recursive: true });
  const project = await mkdtemp(join(builds, `${id}-`));
  try {
    // Each build gets its own source snapshot, generated types, Next cache and export.
    await Promise.all(['src', 'config', 'package.json', 'tsconfig.json', 'next.config.ts'].map(name =>
      cp(join(repo, name), join(project, name), { recursive: true }),
    ));
    const publicRoot = join(repo, 'public');
    await cp(publicRoot, join(project, 'public'), {
      recursive: true,
      filter: source => relative(publicRoot, source) !== join('audio', 'local'),
    });
    await writeFile(join(project, 'config', 'publications', 'active.ts'), `export { default } from './${id}.json';\n`);
    await buildNext(project);
    const output = join(project, 'out');
    await mkdir(join(output, '.well-known'), { recursive: true });
    await Promise.all([
      writeFile(join(output, 'llms.txt'), llmsText(publication)),
      writeFile(join(output, securityTextPath), securityText()),
    ]);
    const sitemap = sitemapXml(publication);
    if (indexingAllowed(publication)) await writeFile(join(output, 'sitemap.xml'), sitemap);
    const { pages, files, bytes, largest } = await verifyExport(output, publication);
    reportRelease(edgeone || process.env.PUBLICATION_REQUIRE_RELEASE === '1');
    await mkdir(dist, { recursive: true });
    await rm(destination, { recursive: true, force: true });
    await rename(output, destination);

    // Keep candidate search URLs outside the directory uploaded by either host.
    const review = join(dist, 'seo-review', id);
    await mkdir(review, { recursive: true });
    const pagesForReview = Object.fromEntries(publication.publishedLocales.flatMap(locale =>
      sitePages.map(page => [pagePath(page, locale, publication), pageAlternates(page, locale)]),
    ));
    await Promise.all([
      writeFile(join(review, 'sitemap.xml'), sitemap),
      writeFile(join(review, 'robots.txt'), robotsText(publication, true)),
      writeFile(join(review, 'pages.json'), JSON.stringify(pagesForReview, null, 2) + '\n'),
    ]);
    console.log(`${label} dist/${id}: ${pages} pages plus error documents, ${files} files, ${bytes} bytes; largest: ${largest.path} (${largest.size} bytes).`);
  } finally {
    await rm(project, { recursive: true, force: true });
  }
}
