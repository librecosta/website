import { spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPublicationPreview, parsePublication } from '../src/site/publication-config.ts';
import { verifyExport, windFiles } from './verify-publication.mjs';

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

const label = id.toUpperCase();
const dist = join(repo, 'dist');
const destination = join(dist, id);

function reportRelease(windAvailable, required) {
  const blockers = [];
  if (isPublicationPreview(publication)) blockers.push(`default locale ${publication.defaultLocale} has no published content`);
  if (!publication.origin) blockers.push('production origin has not been set');
  if (!windAvailable) blockers.push('approved Expanse wind files are missing');
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
  const { windAvailable } = await verifyExport(destination, publication);
  reportRelease(windAvailable, true);
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
    const windDirectory = process.env.PUBLICATION_WIND_DIR;
    if (windDirectory) {
      const target = join(project, 'public', 'audio', 'local');
      await mkdir(target, { recursive: true });
      for (const file of windFiles) {
        const input = resolve(windDirectory, file);
        await cp(input, join(target, file));
      }
    }
    await writeFile(join(project, 'config', 'publications', 'active.ts'), `export { default } from './${id}.json';\n`);
    await buildNext(project);
    const output = join(project, 'out');
    const { pages, files, bytes, largest, windAvailable } = await verifyExport(output, publication);
    reportRelease(windAvailable, process.env.PUBLICATION_REQUIRE_RELEASE === '1');
    await mkdir(dist, { recursive: true });
    await rm(destination, { recursive: true, force: true });
    await rename(output, destination);
    console.log(`${label} dist/${id}: ${pages} pages + 404, ${files} files, ${bytes} bytes; largest: ${largest.path} (${largest.size} bytes).`);
  } finally {
    await rm(project, { recursive: true, force: true });
  }
}
