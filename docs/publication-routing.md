# Publication routing

## Region and locale

`config/publications/cn.json` and `intl.json` define the region, default locale, production Origin, and published locales. `src/site/locale-contract.ts` defines the supported locales (`zh`, `en`, `ja`, `de`, `fr`, `es`), the four public routes, and the same-origin path builder. The default locale uses `/`, `/works/`, `/about/`, and `/contact/`. Other published locales add their prefix. Locale is selected by the path. Region is selected by the build.

| Region | Default | P1-A routes | Release gate |
| --- | --- | --- | --- |
| CN | `zh` | Four Chinese pages at the root paths | Chinese content ready. Production Origin pending. |
| INTL | `en` | Four English internal shells at the root paths and four Chinese pages under `/zh/` | English content pending. All pages carry `noindex, nofollow`. |

The language menu shows all six native language names. Only reviewed, published languages are selectable. English in the INTL shells identifies the engineering preview and is unavailable as a language switch destination. Japanese, German, French, and Spanish have no emitted routes. There is no automatic locale redirect.

## Build and verify

- EdgeOne Makers will use `pnpm build:cn` with `dist/cn/`. Cloudflare will use `pnpm build:intl` with `dist/intl/`.
- `pnpm preview cn` and `pnpm preview intl` serve the region's export locally. The preview server resolves directory indexes and returns the exported 404 page for missing routes. `pnpm dev`, `pnpm build`, and `pnpm check` use the CN configuration by default. The default build continues to write `out/` for `pnpm preview`.
- Regional builds run Next in separate temporary project snapshots. They verify the exact page set, document language, and preview robots metadata before replacing only their own output directory. The source configuration and default build cache stay in place.
- `pnpm check:release <cn|intl>` exits nonzero while the production Origin or the reviewed default language is missing. An engineering export can still build for QA. Use the release check before publishing either region.

The `(default)` and `[locale]` route branches share the same page renderers and root providers. `generateStaticParams()` enumerates published non-default locales. The prefixed branch is registered only when that list has entries because this Next version requires a nonempty static parameter set for an exported dynamic route. Navigation within a locale preserves the root audio provider. Switching locales crosses root layouts and starts a new document and opt-in audio session.

## Content to connect in P1-B

Add reviewed `en` entries via `SitePageContent` in `src/site/pages/`. Each entry supplies the metadata and the render function for one of the four experiences. Move the required copy into typed locale content as the page is adapted, keeping the current Chinese composition and wording.

| Surface | Content |
| --- | --- |
| WORLD | Expanse narrative and transcript, observation captions, instructions, controls, accessibility labels, and scene fallback |
| WORKS | Project dossier types, descriptions, status, image alternatives, link labels, and carousel and island controls |
| ABOUT | Opening, Studio, Collections, Practice, Closing, section navigation, and accessibility labels |
| CONTACT | Message and control labels, with the existing contact destinations |
| Shared UI | Language menu strings, navigation and social labels, dossiers, and audio control labels |

When all four pages and the shared copy are reviewed, register `en` in `src/site/content.ts` and both publication files. The same routing contract applies to `ja`, `de`, `fr`, and `es` after their respective reviews. Site-wide SEO and cross-region alternate metadata will be addressed separately.

The language menu adapts the TuneShape Dropdown Menu Motion tracks. [MIT license](../public/License/tuneshape-dropdown.txt)
