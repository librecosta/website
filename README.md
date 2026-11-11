# LibreCosta Website

[简体中文](README.zh-CN.md)

LibreCosta's website uses a static Next.js export. Its first interactive act, **The Expanse**, follows a pale desert valley toward a distant city and its segmented ring. The root page is a basic site placeholder. The independent cube surface lab contains a rendering study.

## Run locally

Use Node.js 24 LTS and the pnpm version in [package.json](package.json).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

- [The Expanse](http://127.0.0.1:3000/lab/expanse) is the main interactive preview. Scroll to explore and scroll back to retrace the journey.
- [Expanse debug view](http://127.0.0.1:3000/lab/expanse?debug=1) exposes camera stops and progress, reduced motion, sky and wind layers, observation anchors, the transform inspector, and audio levels.
- [Cube surface lab](http://127.0.0.1:3000/lab/cube-surface) is a separate material study.

Sound starts after user activation. The original ambient track ships with the site. Optional local wind preparation is described in [the audio notes](docs/research/audio.md).

## Verify and preview

```sh
pnpm check
pnpm preview
```

`pnpm check` runs scene checks, TypeScript, and the production build. The build writes to `out/`. Stop the dev server first or set `PORT` to preview on a different port.

## Project documentation

- [Agent entry point](AGENTS.md), [architecture](.agents/architecture.md), and [collaboration playbook](.agents/playbook.md)
- [Creative vision](docs/creative/vision.md), [story outline](docs/creative/narrative.md), and [Act I direction](docs/creative/act-01-expanse.md)
- [Procedural environment research](docs/research/procedural-environments.md) and [retired Expanse studies](docs/archive/expanse-legacy/README.md)

Operated by Chengdu Yuanan Kaiwu Technology Co., Ltd. [LibreCosta](https://librecosta.com)
