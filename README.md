# LibreCosta Website

[简体中文](README.zh-CN.md)

LibreCosta's website uses a static Next.js export. The international home page presents **The Expanse**, its first interactive act, which follows a pale desert valley toward a distant city and its segmented ring.

## Run locally

Use Node.js 24 LTS and the pnpm version in [package.json](package.json).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

- [The Expanse](http://127.0.0.1:3000/world/) is WORLD in the default CN development build. ABOUT is the home page. Scroll to explore and scroll back to retrace the journey.
- With `pnpm dev`, the [Expanse debug view](http://127.0.0.1:3000/world/?debug=1) exposes camera stops and progress, reduced motion, sky and wind layers, observation anchors, the transform inspector, and audio levels.

Sound starts after user activation. The original ambient music and procedural wind ship with the site. See [the audio notes](docs/research/audio.md) for generation and verification.

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

Run `pnpm preview cn` or `pnpm preview intl` to serve the corresponding export. Run `pnpm check:release cn` or `pnpm check:release intl` after building and before publishing. CN includes Chinese and English. INTL includes all six languages. See the [publication contract](docs/publication-routing.md) and [deployment settings and release prerequisites](docs/publication-deployment.md).

## Project documentation

- [Agent entry point](AGENTS.md), [architecture](.agents/architecture.md), and [collaboration playbook](.agents/playbook.md)
- [Creative vision](docs/creative/vision.md), [story outline](docs/creative/narrative.md), and [Act I direction](docs/creative/act-01-expanse.md)
- [Procedural environment research](docs/research/procedural-environments.md) and [retired Expanse studies](docs/archive/expanse-legacy/README.md)

Operated by Chengdu Yuanan Kaiwu Technology Co., Ltd. [LibreCosta](https://librecosta.com)
