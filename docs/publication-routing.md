# Publication routing

## Region and locale

`config/publications/cn.json` and `intl.json` define the region, default locale, production Origin, and published locales. `src/site/locale-contract.ts` defines the supported locales (`zh`, `en`, `ja`, `de`, `fr`, `es`), the four public routes, and the same-origin path builder. The default locale uses `/`, `/works/`, `/about/`, and `/contact/`. Other published locales add their prefix. Locale is selected by the path. Region is selected by the build.

| Region | Default | Enabled routes |
| --- | --- | --- |
| CN | `zh` | Chinese at the root paths, others under `/en/`, `/ja/`, `/de/`, `/fr/`, `/es/` |
| INTL | `en` | English at the root paths, others under `/zh/`, `/ja/`, `/de/`, `/fr/`, `/es/` |

The language menu shows six selectable native language names and keeps the current page and region. The exported 404 uses the build's default language for its initial document and reads a recognized prefix from the requested path once JavaScript runs. The home link then points to that language within the same region. The path always determines the language on valid pages.

## Build and verify

- EdgeOne Makers will use `pnpm build:cn` with `dist/cn/`. Cloudflare will use `pnpm build:intl` with `dist/intl/`.
- `pnpm preview cn` and `pnpm preview intl` serve the region's export locally. The preview server resolves directory indexes and returns the exported 404 page for missing routes. `pnpm dev`, `pnpm build`, and `pnpm check` use the CN configuration by default. The default build continues to write `out/` for `pnpm preview`.
- Regional builds run Next in separate temporary project snapshots. They verify the exact page set, document language, internal asset references and output limits before replacing their own output directory.
- Run `pnpm check:release <cn|intl>` against the completed export. The gate checks the production origin, reviewed default language and approved wind files. See the [deployment instructions](./publication-deployment.md) for artifact and platform verification.

The `(default)` and `[locale]` route branches share the same page renderers and root providers. `generateStaticParams()` enumerates published non-default locales. The prefixed branch is registered only when that list has entries because this Next version requires a nonempty static parameter set for an exported dynamic route. Navigation within a locale preserves the root audio provider. Switching locales crosses root layouts and starts a new document and opt-in audio session.

## Locale content

Each file in `src/site/copy/` satisfies the shared `SiteCopy` type. Site pages choose the locale's copy and metadata while using the same experience components. Project, observation, chapter, and principle keys tie copy to the existing render order. Publication configuration checks the enabled translations for blank strings before exporting.

| Surface | Content |
| --- | --- |
| WORLD | Expanse narrative and transcript, observation captions, instructions, controls, accessibility labels, and scene fallback |
| WORKS | Project dossier types, descriptions, status, image alternatives, link labels, and carousel and island controls |
| ABOUT | Opening, Studio, Collections, Practice, Closing, section navigation, and accessibility labels |
| CONTACT | Message and control labels, with the existing contact destinations |
| Shared UI | Language menu strings, navigation and social labels, dossiers, and audio control labels |

See the [P1-C terminology and verification record](./localization-review.md).

The language menu adapts the TuneShape Dropdown Menu Motion tracks. [MIT license](../public/License/tuneshape-dropdown.txt)
