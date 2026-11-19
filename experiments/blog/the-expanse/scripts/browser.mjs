import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import os from 'node:os';
import { next, root, workspace, snapshot } from './snapshot.mjs';

const [batch, ...requested] = process.argv.slice(2);
assert(/^[\w-]+$/.test(batch ?? '') && batch !== 'publish', 'Usage: node scripts/browser.mjs <batch> [F02 F03 ...]');
const output = join(workspace, 'outputs', batch);
const settings = JSON.parse(await readFile(join(workspace, 'fixtures/capture.json'), 'utf8'));
const phases = {
  F02: [['final', {}], ['mesh', { mode: 'wire' }]],
  F03: [['smooth', { mode: 'smooth' }], ['broad', { mode: 'broad' }], ['fine', { mode: 'fine' }], ['complete', {}]],
  F04: [['filtered', {}], ['unfiltered', { mode: 'no-aa' }]],
  F05: [['transport', { wind: 'transport' }], ['density', { wind: 'concentration' }]],
  F07: [['veil-off', { wind: 'transport', mode: 'no-veil' }], ['veil-on', { wind: 'transport' }]],
  F08: ['background', 'main', 'secondary', 'color'].map(sky => [sky, { sky }]),
  F09: [['mix-off', { mode: 'no-aerial' }], ['mix-on', {}]],
  F10: [],
};
const ids = requested.length ? requested : Object.keys(phases);
for (const id of ids) assert(Object.hasOwn(phases, id), `${id} is not a browser experiment`);

const modulePath = process.env.PLAYWRIGHT_MODULE ?? join(root, 'node_modules', '.pnpm',
  (await readdir(join(root, 'node_modules', '.pnpm'))).find(name => /^playwright@/.test(name)) ?? 'playwright',
  'node_modules', 'playwright', 'index.mjs');
const { chromium } = await import(pathToFileURL(modulePath).href);
execFileSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
  fileURLToPath(new URL('./numeric.mjs', import.meta.url)), batch, '--metadata'], { stdio: 'inherit' });
const site = await snapshot(output);
const save = (name, value) => writeFile(join(output, 'raw', `${name}.json`), JSON.stringify(value, null, 2) + '\n');
execFileSync(process.execPath, [next, 'build'], { cwd: site, stdio: 'inherit', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } });
const port = process.env.EXPANSE_EVIDENCE_PORT ?? '3097';
const server = spawn(process.execPath, [join(root, 'scripts/serve.mjs')], {
  cwd: site, env: { ...process.env, PORT: port }, stdio: ['ignore', 'pipe', 'inherit'],
});
let browser;
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Preview failed to start')), 8000);
    server.once('error', reject);
    server.once('exit', code => reject(new Error(`Preview exited ${code}`)));
    server.stdout.once('data', () => { clearTimeout(timeout); resolve(); });
  });
  const launch = { channel: 'chrome', args: ['--enable-webgl'] };
  if (process.env.CHROME_EXECUTABLE) {
    delete launch.channel;
    launch.executablePath = process.env.CHROME_EXECUTABLE;
  }
  if (process.env.CHROME_ANGLE) launch.args.push(`--use-angle=${process.env.CHROME_ANGLE}`);
  browser = await chromium.launch(launch);
  const machine = { os: os.version(), architecture: os.arch(), cpu: os.cpus()[0].model,
    browser: browser.version(), launch, node: process.version, headless: true };
  const previousMachine = await readFile(join(output, 'raw', 'browser.json'), 'utf8')
    .then(JSON.parse).catch(error => {
      if (error.code !== 'ENOENT') throw error;
      return null;
    });
  if (previousMachine) assert.deepEqual(machine, previousMachine, 'Browser or machine changed. Capture into a new batch.');
  await save('browser', machine);
  const results = await readFile(join(output, 'raw', 'browser-status.json'), 'utf8')
    .then(JSON.parse).catch(error => {
      if (error.code !== 'ENOENT') throw error;
      return {};
    });
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  for (const id of ids) {
    try {
      if (id === 'F10') await performanceRuns();
      else await capture(id);
      results[id] = { status: 'captured', commit };
    } catch (error) {
      results[id] = { status: 'blocked', reason: String(error) };
      console.error(id, error);
    }
    await save('browser-status', results);
  }
  if (ids.some(id => results[id].status !== 'captured')) process.exitCode = 1;
} finally {
  try { await browser?.close(); } finally { server.kill(); }
}

async function open(context, id, extra) {
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  const query = new URLSearchParams({ e1: id, position: String(settings.positions[id]),
    time: String(settings.fixedSeconds), ...extra });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/world/?${query}`);
  try {
    await page.waitForFunction(() => document.querySelector('main[data-ready="true"] canvas[data-camera]'));
  } catch (error) {
    throw new Error(`${error.message}; page errors: ${errors.join('; ')}`);
  }
  return { page, query: Object.fromEntries(query), errors };
}

function contextOptions(preset) {
  const { width, height, ...options } = settings[preset];
  return { viewport: { width, height }, ...options, reducedMotion: 'no-preference' };
}

async function capture(id) {
  const context = await browser.newContext(contextOptions('desktop'));
  const dir = join(output, 'raw', id);
  await mkdir(dir, { recursive: true });
  let reference;
  try {
    for (const [name, extra] of phases[id]) {
      const { page, query, errors } = await open(context, id, extra);
      await page.waitForFunction(() => {
        const canvas = document.querySelector('main canvas[data-camera]');
        return Number(canvas?.dataset.frames) >= 8 && canvas?.dataset.cityTime;
      });
      const capture = await page.evaluate(() => {
        const canvas = document.querySelector('main canvas[data-camera]');
        return { data: { ...canvas.dataset }, dimensions: [canvas.width, canvas.height], dpr: devicePixelRatio,
          png: canvas.toDataURL('image/png'), sand: window.expanseEvidence.sand?.() };
      });
      const { png, sand, ...meta } = capture;
      assert.equal(capture.data.quality, 'desktop');
      assert.deepEqual(capture.dimensions, [settings.desktop.width, settings.desktop.height]);
      assert.equal(Number(capture.data.cityTime), settings.fixedSeconds);
      if (sand) assert.equal(sand.time, settings.fixedSeconds);
      assert.deepEqual(errors, []);
      const match = ['camera', 'rotation', 'fov', 'progress', 'terrain'].map(key => meta.data[key]);
      if (reference) assert.deepEqual(match, reference, `${id}/${name} has a different camera or terrain`);
      reference = match;
      await writeFile(join(dir, `${name}.png`), Buffer.from(png.split(',')[1], 'base64'));
      await writeFile(join(dir, `${name}.json`), JSON.stringify({ query, ...meta, sand, errors }, null, 2) + '\n');
      await page.close();
      console.log(id, name, meta.data.renderer);
    }
  } finally {
    await context.close();
  }
}

async function performanceRuns() {
  const raw = [];
  const dataset = page => page.evaluate(() => ({ ...document.querySelector('main canvas[data-camera]').dataset }));
  for (const preset of ['desktop', 'mobile']) {
    for (let round = 1; round <= settings.rounds; round++) {
      const context = await browser.newContext(contextOptions(preset));
      try {
        const { page, query, errors } = await open(context, 'F10', { wind: 'transport' });
        await page.waitForFunction(quality => document.querySelector('main canvas[data-camera]')?.dataset.quality === quality, preset);
        const start = Number((await dataset(page)).frames);
        await page.waitForFunction(target => Number(document.querySelector('main canvas[data-camera]')?.dataset.frames) >= target,
          start + settings.warmupFrames);
        await page.evaluate(limit => { window.expanseEvidence.trace = { limit, samples: [], disjoint: 0, support: false, drawingBuffer: [] }; }, settings.sampleFrames);
        await page.waitForFunction(count => window.expanseEvidence.trace.samples.length === count, settings.sampleFrames);
        // Keep normal frames submitting while the query results drain.
        const end = Number((await dataset(page)).frames);
        await page.waitForFunction(target => Number(document.querySelector('main canvas[data-camera]')?.dataset.frames) >= target, end + 12);
        const trace = await page.evaluate(() => window.expanseEvidence.trace);
        assert.equal(trace.samples.length, settings.sampleFrames);
        assert.deepEqual(errors, []);
        assert(trace.samples.every((row, i, rows) => row.calls > 0 && row.triangles > 0 && (!i || row.frameAt > rows[i - 1].frameAt)), 'Incomplete frame sample');
        raw.push({ preset, round, query, context: contextOptions(preset), render: await dataset(page), trace, errors });
        await save('F10-frames', raw);
        console.log('F10', preset, round, 'GPU query', trace.support, 'samples', trace.samples.length);
      } finally {
        await context.close();
      }
    }
  }
}
