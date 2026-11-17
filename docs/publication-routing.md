# Publication routing

## Region and locale

`config/publications/cn.json` and `intl.json` define the region, default locale, production Origin, and published locales. `src/site/locale-contract.ts` defines the six supported locales and maps the four logical pages to regional paths. The default locale has no prefix. Other published locales add their prefix. Locale is selected by the path and region by the build.

| Region | Locales | ABOUT | WORLD | WORKS | CONTACT |
| --- | --- | --- | --- | --- | --- |
| CN | `zh` | `/` | `/world/` | `/works/` | `/contact/` |
| CN | `en` | `/en/` | `/en/world/` | `/en/works/` | `/en/contact/` |
| INTL | `en` | `/about/` | `/` | `/works/` | `/contact/` |
| INTL | `zh`, `ja`, `de`, `fr`, `es` | `/<locale>/about/` | `/<locale>/` | `/<locale>/works/` | `/<locale>/contact/` |

The language menu shows the languages published in its region and keeps the current page. Its site link keeps the logical page and uses the selected language if the destination supports it. Otherwise it identifies the destination site's default language. The exported 404 uses the build's default language for its initial document and reads a recognized prefix from the requested path once JavaScript runs. The home link then points to that language within the same region. The path always determines the language on valid pages.

## Build and verify

- EdgeOne Makers uses `pnpm build:cn` with `dist/cn/`. Cloudflare uses `pnpm build:intl` with `dist/intl/`.
- `pnpm preview cn` and `pnpm preview intl` serve the region's export locally. The preview server resolves directory indexes and returns the exported 404 page for missing routes. `pnpm dev`, `pnpm build`, and `pnpm check` use the CN configuration by default. The default build continues to write `out/` for `pnpm preview`.
- Regional builds run Next in separate temporary project snapshots. They verify the exact page set, document language, internal asset references and output limits before replacing their own output directory.
- Run `pnpm check:release <cn|intl>` against the completed export. Published pages are indexable, and error documents retain `noindex`. The gate checks the production origin, reviewed default language, indexing configuration and measured wind files. See the [deployment instructions](./publication-deployment.md) for artifact and platform verification.

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
