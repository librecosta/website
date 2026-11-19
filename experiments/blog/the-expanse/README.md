# The Expanse evidence

[Contract](CONTRACT.md) · [Source evidence](EVIDENCE.md) · [Figure index](FIGURES.md) · [Run report](REPORT.md)

Run from the repository root with the installed pnpm dependencies, Node 24, Chrome with WebGL 2, and Python with NumPy, Matplotlib and Pillow. This run used Node 24.22.1, Playwright 1.64.1, NumPy 2.2.6, Matplotlib 3.10.9 and Pillow 12.3.0.

```powershell
pnpm install --frozen-lockfile
python -m pip install numpy==2.2.6 matplotlib==3.10.9 pillow==12.3.0
$expanse = 'experiments/blog/the-expanse'
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON "$expanse/scripts/numeric.mjs" local-01
node "$expanse/scripts/browser.mjs" local-01
python "$expanse/scripts/figures.py" local-01
```

The launcher searches pnpm's installed Playwright packages. If Playwright is absent, install `playwright@1.64.1` in a separate local directory and set `PLAYWRIGHT_MODULE` to its absolute `index.mjs` path. Chrome Stable is the default executable. `CHROME_EXECUTABLE` overrides it and `EXPANSE_EVIDENCE_PORT` replaces preview port 3097. Record any GPU backend override through `CHROME_ANGLE`. A software renderer may be useful for visual diagnosis, with a separate performance record.

Pass one or more figure IDs after the batch name to rerun selected work. Examples below each produce a standalone figure.

```powershell
# F03 uses Chrome screenshots and writes its own source metadata.
node "$expanse/scripts/browser.mjs" isolated-ripples F03
python "$expanse/scripts/figures.py" isolated-ripples F03

# F05 combines the browser capture with an independent call to the same solver.
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON "$expanse/scripts/numeric.mjs" isolated-sand F05
node "$expanse/scripts/browser.mjs" isolated-sand F05
python "$expanse/scripts/figures.py" isolated-sand F05
```

`snapshot.mjs` copies the site into `.local/expanse-evidence/site-*` and checks each source anchor before adding the probe. The temporary export is served locally using the repository preview server. Browser capture reads the actual WebGL drawing buffer, with `preserveDrawingBuffer` enabled only for stills. Numeric runs import the live production TypeScript. Rerun with a new batch name when the Git SHA or capture fixture changes. Temporary site copies may be removed after a run.

```text
outputs/
  e1/
    raw/           Canvas PNGs, phase metadata, arrays, frame samples
    figures/       full-size plates for this run
    manifest.json  revision, parameters, reproduction commands and hashes
    report.json    measurements, limits and capture status per figure
  publish/         latest successful plates and index.jpg
```

The batch directory is authoritative. Each successful plate updates its copy in `publish/`, so use the batch manifest to select a consistent set after partial runs. Session files and the preview index are ignored by Git. Use [FIGURES.md](FIGURES.md) for figure-specific commands and raw inputs. Use the exact measured source revision listed in [REPORT.md](REPORT.md) when comparing results across machines. The experiment-only delivery commit leaves that production source unchanged.
