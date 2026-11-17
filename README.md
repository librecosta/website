# LibreCosta Website

[简体中文](README.zh-CN.md)

LibreCosta's website uses a static Next.js export. The home page presents **The Expanse**, its first interactive act, which follows a pale desert valley toward a distant city and its segmented ring.

## Run locally

Use Node.js 24 LTS and the pnpm version in [package.json](package.json).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

- [The Expanse](http://127.0.0.1:3000/) is the home page. Scroll to explore and scroll back to retrace the journey.
- With `pnpm dev`, the [Expanse debug view](http://127.0.0.1:3000/?debug=1) exposes camera stops and progress, reduced motion, sky and wind layers, observation anchors, the transform inspector, and audio levels.

Sound starts after user activation. The original ambient track ships with the site. Optional local wind preparation is described in [the audio notes](docs/research/audio.md).

## Verify and preview

```sh
pnpm check
pnpm preview
```

`pnpm check` runs scene checks, TypeScript, and the production build. The build writes to `out/`. Stop the dev server first or set `PORT` to preview on a different port.

## Regional static builds

| Publication | Build | Output | Planned host |
| --- | --- | --- | --- |
| CN | `pnpm build:cn` | `dist/cn/` | EdgeOne Makers |
| INTL | `pnpm build:intl` | `dist/intl/` | Cloudflare |

Run `pnpm preview cn` or `pnpm preview intl` to serve the corresponding export. Run `pnpm check:release cn` or `pnpm check:release intl` before publishing. CN has reviewed Chinese content and awaits its production origin. INTL is an internal, non-indexable export until English content is reviewed. See the [publication contract](docs/publication-routing.md).

## Project documentation

- [Agent entry point](AGENTS.md), [architecture](.agents/architecture.md), and [collaboration playbook](.agents/playbook.md)
- [Creative vision](docs/creative/vision.md), [story outline](docs/creative/narrative.md), and [Act I direction](docs/creative/act-01-expanse.md)
- [Procedural environment research](docs/research/procedural-environments.md) and [retired Expanse studies](docs/archive/expanse-legacy/README.md)

Operated by Chengdu Yuanan Kaiwu Technology Co., Ltd. [LibreCosta](https://librecosta.com)
