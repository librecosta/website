# LibreCosta Website

This repository contains the LibreCosta site and The Expanse, its first interactive act. The current scene lives at `/lab/expanse`. The root route is a basic site placeholder.

## Find the right context

| Task | Start here |
| --- | --- |
| Setup, preview, and verification | [README](README.md) and [package scripts](package.json) |
| Routes, scene ownership, or integration boundaries | [Architecture](.agents/architecture.md) |
| Change scope, visual review, asset handling, or handoff | [Collaboration playbook](.agents/playbook.md) |
| Creative intent and approved narrative | [World vision](docs/creative/vision.md), [story outline](docs/creative/narrative.md), and [Act I](docs/creative/act-01-expanse.md) |
| GSAP changes | [Repository GSAP skills](.agents/skills/README.md) |
| Retired experiments | [Expanse archive](docs/archive/expanse-legacy/README.md) |

Read the relevant source and configuration for current behavior. Use the creative documents for approved direction and the archive for prior decisions and comparisons.

## Working rules

- Keep the site statically exportable with Next.js App Router, React, TypeScript, Three.js, React Three Fiber, GSAP / ScrollTrigger, and pnpm. Preserve the lockfile. Keep backend, database, CMS, authentication, Astro, and speculative framework work out of scope.
- Preserve native, reversible scroll and a single camera writer in the render loop. Keep reduced motion and readable HTML fallback available. Clean up listeners, animation handles, and GPU resources.
- Follow Monumental Precision and World First, Detail Later. Judge form, scale, composition, and light in a real browser before investing in fine assets. Keep the interface a restrained Silent Instrument and preserve the approved Witness Core narrative.
- Run `pnpm check` for repository verification. Use the browser for interaction and visual changes, and include the relevant evidence in the handoff.
- Preserve user changes and normal Git history. Keep commits, pushes, and deployment within the current request's authorization. Keep `pre-master` and `master` outside the scope of work on `develop`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
