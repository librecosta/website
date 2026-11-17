import { spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localePath, siteRoutes } from '../src/site/locale-contract.ts';
import { isPublicationPreview, parsePublication, prefixedLocales } from '../src/site/publication-config.ts';

const repo = fileURLToPath(new URL('..', import.meta.url));
const [first, second, ...rest] = process.argv.slice(2);
const check = first === '--check-release';
const id = check ? second : first;
if ((id !== 'cn' && id !== 'intl') || rest.length || (!check && second)) {
  throw new Error('Usage: node scripts/build-publication.mjs [--check-release] <cn|intl>');
}

const configuration = join(repo, 'config', 'publications', `${id}.json`);
const publication = parsePublication(JSON.parse(await readFile(configuration, 'utf8')));
if (publication.id !== id) throw new Error(`Publication ${publication.id} does not match ${id}.json.`);

const preview = isPublicationPreview(publication);
const blockers = [];
if (preview) blockers.push(`default locale ${publication.defaultLocale} has no published content`);
if (!publication.origin) blockers.push('production origin has not been set');
const label = id.toUpperCase();
const releaseStatus = blockers.length ? `${label} release blocked: ${blockers.join('; ')}.` : `${label} release ready.`;

async function verifyExport(directory) {
  const expected = new Set(['404.html', '404/index.html', '_not-found/index.html']);
  for (const locale of [publication.defaultLocale, ...prefixedLocales(publication)]) {
    for (const route of siteRoutes) {
      const file = `${localePath(route, locale, publication.defaultLocale).slice(1)}index.html`;
      expected.add(file);
      const html = await readFile(join(directory, file), 'utf8');
      if (!new RegExp(`<html\\b[^>]*\\blang="${locale}"`).test(html)) throw new Error(`Wrong language in ${file}.`);
      if (preview && !/<meta name="robots" content="noindex, nofollow"/.test(html)) {
        throw new Error(`Internal preview may be indexed: ${file}.`);
      }
    }
  }
  for (const file of await readdir(directory, { recursive: true })) {
    const normalized = file.replaceAll('\\', '/');
    if (normalized.endsWith('.html') && !expected.has(normalized)) throw new Error(`Unexpected exported page: ${file}.`);
  }
  await readFile(join(directory, '404.html'));
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
  console.log(releaseStatus);
  process.exitCode = blockers.length ? 1 : 0;
} else {
  console.log(releaseStatus);
  const builds = join(repo, '.local', 'publication-builds');
  await mkdir(builds, { recursive: true });
  const project = await mkdtemp(join(builds, `${id}-`));
  try {
    // Each build gets its own source snapshot, generated types, Next cache and export.
    await Promise.all(['src', 'public', 'config', 'package.json', 'tsconfig.json', 'next.config.ts'].map(name =>
      cp(join(repo, name), join(project, name), { recursive: true }),
    ));
    await writeFile(join(project, 'config', 'publications', 'active.ts'), `export { default } from './${id}.json';\n`);
    await buildNext(project);
    const output = join(project, 'out');
    await verifyExport(output);
    const dist = join(repo, 'dist');
    await mkdir(dist, { recursive: true });
    const destination = join(dist, id);
    await rm(destination, { recursive: true, force: true });
    await rename(output, destination);
    console.log(`${label} static export verified at dist/${id}/`);
  } finally {
    await rm(project, { recursive: true, force: true });
  }
}
