# Publication routing

## Region and locale

`config/publications/cn.json` and `intl.json` define the region, default locale, production Origin, and published locales. `src/site/locale-contract.ts` defines the supported locales (`zh`, `en`, `ja`, `de`, `fr`, `es`), the four public routes, and the same-origin path builder. The default locale uses `/`, `/works/`, `/about/`, and `/contact/`. Other published locales add their prefix. Locale is selected by the path. Region is selected by the build.

| Region | Default | Enabled routes | Release gate |
| --- | --- | --- | --- |
| CN | `zh` | Chinese at the root paths and English under `/en/` | Production Origin pending. |
| INTL | `en` | English at the root paths and Chinese under `/zh/` | Origin and default language checks pass. |

The language menu shows all six native language names. Chinese and English are selectable. Japanese, German, French, and Spanish have no emitted routes. There is no automatic locale redirect.

## Build and verify

- EdgeOne Makers will use `pnpm build:cn` with `dist/cn/`. Cloudflare will use `pnpm build:intl` with `dist/intl/`.
- `pnpm preview cn` and `pnpm preview intl` serve the region's export locally. The preview server resolves directory indexes and returns the exported 404 page for missing routes. `pnpm dev`, `pnpm build`, and `pnpm check` use the CN configuration by default. The default build continues to write `out/` for `pnpm preview`.
- Regional builds run Next in separate temporary project snapshots. They verify the exact page set, document language, and preview robots metadata before replacing only their own output directory. The source configuration and default build cache stay in place.
- `pnpm check:release <cn|intl>` exits nonzero while the production Origin or the reviewed default language is missing. An engineering export can still build for QA. Use the release check before publishing either region.

The `(default)` and `[locale]` route branches share the same page renderers and root providers. `generateStaticParams()` enumerates published non-default locales. The prefixed branch is registered only when that list has entries because this Next version requires a nonempty static parameter set for an exported dynamic route. Navigation within a locale preserves the root audio provider. Switching locales crosses root layouts and starts a new document and opt-in audio session.

## Locale content

`SitePageContent` entries in `src/site/pages/` select the metadata and renderer for each locale. Both locales use the same experience components. English Localization Copy V1 is applied to the following surfaces.

| Surface | Content |
| --- | --- |
| WORLD | Expanse narrative and transcript, observation captions, instructions, controls, accessibility labels, and scene fallback |
| WORKS | Project dossier types, descriptions, status, image alternatives, link labels, and carousel and island controls |
| ABOUT | Opening, Studio, Collections, Practice, Closing, section navigation, and accessibility labels |
| CONTACT | Message and control labels, with the existing contact destinations |
| Shared UI | Language menu strings, navigation and social labels, dossiers, and audio control labels |

Register additional locales in `src/site/content.ts` and the publication files after their four pages and shared copy are reviewed. Site-wide SEO and cross-region alternate metadata will be addressed separately.

The language menu adapts the TuneShape Dropdown Menu Motion tracks. [MIT license](../public/License/tuneshape-dropdown.txt)
