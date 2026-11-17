# Dual-region static publication

Both deployments use the same Next.js static export. CN exports eight pages in Chinese and English. INTL exports 24 pages in six languages. Both include a separate `404.html`. The default locale uses unprefixed paths. Internal navigation and language selection stay on the serving origin. The site switch follows the [regional route matrix](publication-routing.md).

| Region | Default locale | Build | Static directory | Production origin |
| --- | --- | --- | --- | --- |
| INTL · Cloudflare Workers Static Assets | `en` | `pnpm build:intl` | `dist/intl` | `https://librecosta.com` |
| CN · EdgeOne Makers | `zh` | `deploy/edgeone-cn/edgeone.json` | `dist/cn` relative to `deploy/edgeone-cn` | `https://librecosta.cn` |

## Git and build settings

The production branch is `master` in `librecosta/website`. Promote changes through pull requests from `develop` to `pre-master`, then from `pre-master` to `master`. Keep hosted release-candidate previews private.

Pin Node **24.18.0** in both managed builds. Makers lists pnpm 6–11 for its bundled installation. Using npm's executable launcher selects pnpm 12.8.1 and keeps the existing lockfile. [Workers build image](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/) · [Makers build guide](https://pages.edgeone.ai/document/build-guide)

### Cloudflare INTL

1. The GitHub-connected Worker `librecosta-website-intl` automatically builds pushes to `master`. `wrangler.jsonc` points to `dist/intl`, and the build runs from the repository root. [GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)
2. Workers Builds uses `NODE_VERSION=24.18.0` and `SKIP_DEPENDENCY_INSTALL=1`. The build command is `npx --yes pnpm@12.8.1 install --frozen-lockfile && npx --yes pnpm@12.8.1 build:intl`. The deploy command is `npx --yes wrangler@4.164.0 deploy`. The build verifies the export before Wrangler packages it. [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
3. The assets-only manifest serves folder indexes with a trailing slash and uses the exported 404 page with an HTTP 404 status. Cloudflare supplies MIME types on asset upload and defaults to revalidation with ETags. [HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/) · [Static 404](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/) · [Static response headers](https://developers.cloudflare.com/workers/static-assets/headers/)
4. The manifest disables `workers.dev` and version preview URLs. The public origin uses Settings → Domains & Routes → Custom Domain. Use Deployments to roll back to a previous tested version. [Custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) · [Rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)

### EdgeOne Makers CN

In `librecosta-website-cn`, set **Root Directory** to `deploy/edgeone-cn`, retain the **Other** preset, and keep production auto-deploy on the GitHub `master` branch. `deploy/edgeone-cn/edgeone.json` supplies the following values for that root. [Makers build guide](https://pages.edgeone.ai/document/build-guide) · [Makers project configuration](https://pages.edgeone.ai/document/edgeone-json)

| Setting | Value |
| --- | --- |
| Node version | `24.18.0` |
| Install command | `npx --yes pnpm@12.8.1 --dir ../.. install --frozen-lockfile` |
| Build command | `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON ../../scripts/build-publication.mjs --edgeone cn` |
| Output directory | `dist/cn` |

The repository root declares Next.js, so Makers can detect it even with **Other** selected. The OpenNext build hook reads `.next/required-server-files.json` before handling static export. The publisher builds Next.js in a temporary snapshot and hands the host only the verified static export. The Makers root is a separate package with no framework dependencies. It calls the same publisher with mandatory release checks and writes `deploy/edgeone-cn/dist/cn`. The local `pnpm build:cn` and Cloudflare commands keep their original output paths. [OpenNext build hook](https://unpkg.com/@edgeone/opennextjs-pages@0.2.10-beta.1/dist/index.js) · [OpenNext build context](https://unpkg.com/@edgeone/opennextjs-pages@0.2.10-beta.1/dist/build/plugin-context.js)

After saving the root setting, redeploy `master`. In the managed build log, confirm that the build runs from `deploy/edgeone-cn`, that `CN artifact release checks passed` is followed by a successful static upload, and that OpenNext is absent. Use the exported directory indexes and root `404.html` with native static routing. Leave rewrites and cache overrides empty. Verify deep links, slash redirects, HTTP 404 responses and static resource content types on the deployed origin. [Custom 404](https://edgeone.ai/document/192123212580007936) · [Makers cache policy](https://pages.edgeone.ai/document/configuring-cache)

The Makers commands passed in a clean Linux container with Node 24.18.0 and pnpm 12.8.1. Local static serving returned all eight CN routes and the expected 308 and 404 responses. Tencent's published framework detector classified the repository root as `next` and the Makers root as `other`. Confirm plugin selection in the managed build log.

The public origin is configured under Domain Name Management. The CN pages display ICP filing `蜀ICP备2025158691号-3` and the text `公安备案待办理`. For rollback, redeploy the last verified Makers deployment. [Domain access and filing](https://pages.edgeone.ai/document/domain-overview) · [Manage deploys](https://pages.edgeone.ai/document/manage-deploys)

## Expanse audio and release checks

A Git-only build ships the original music and procedural wind in Opus and MP3. Interface cues are generated in Web Audio. The browser loads audio after user activation. Both builds exclude the workstation's `public/audio/local/`. [Audio sources and regeneration](research/audio.md)

Run `pnpm check:release cn` or `pnpm check:release intl` against the corresponding freshly built artifact. The verifier checks the exported wind bytes against the decoded audio measurements. Regeneration is an offline task. Managed builds use the tracked files and need neither local input nor FFmpeg.

## Release verification

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm build:cn
pnpm build:intl
pnpm check:release cn
pnpm check:release intl
$env:PORT = '3081'; pnpm preview cn
# Separate terminal
$env:PORT = '3082'; pnpm preview intl
```

The build checks page counts, languages, local HTML references, required runtime assets, and the two platforms' common free-tier ceilings of 20,000 files and 25 MB per file. It rejects unexpected artifact files, including source and private files. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) · [Makers limits](https://pages.edgeone.ai/document/limits-and-quotas)

For public delivery, check both HTTPS origins, a prefixed route with and without its trailing slash, missing routes and assets for HTTP 404, and GLB, WASM and audio payloads. Check that fixed-name assets revalidate following a new deployment.

The release exports and `check:release` passed for both regions, covering 8 CN and 24 INTL pages. The sitemap counts are 4 and 20 respectively. This verifies the build artifacts; public HTTPS availability is a separate check.

During P2, Windows builds and a clean Linux x86-64 container build passed. The Linux run used Node 24.18.0 and pnpm 12.8.1 with the frozen lockfile. Each Git-only export contained 208 files (about 17.8 MB). The largest file was `gopher-atlas.glb` at 1,873,704 bytes. Cloudflare's local emulator served the INTL artifact with canonical directory redirects, correct MIME types and actual 404 responses. Its packaging dry run also passed.

During P2, desktop Chromium loaded the WORLD scene, played the committed music, and verified missing-wind fallback and all eight on-demand WORKS models. Mobile browser emulation covered language switching, refresh, ABOUT motion and CONTACT. The WORKS toolbar cleared the two-row mobile header at 320 and 390 pixels. A separate local Linux build with the then-required encoded wind inputs passed the INTL artifact release check. P5-A replaces that audio input with the tracked procedural wind.

## Production search metadata

Production indexing is enabled in `config/publications/indexing.ts`. Both exports allow crawling and advertise their production sitemap in `robots.txt`. Canonical and hreflang follow the logical page. Chinese canonicals belong to CN. English, Japanese, German, French and Spanish canonicals belong to INTL. `x-default` points to the corresponding English INTL page. Only the preferred URLs enter each region's sitemap. The home page of each region includes Organization and WebSite JSON-LD. The exported 404, 4xx and 5xx documents retain `noindex`. A separate `dist/seo-review/<region>/` directory records the metadata targets for inspection. [Google localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions)

Keep any directly hosted release-candidate builds behind access controls. The regional build commands above generate the production SEO output even when served on localhost.

Both regions also publish `/llms.txt` and `/.well-known/security.txt`. The former describes the site and links to its published pages. The security contact expires 180 days after each regional build. Rebuild and publish before expiration. On each host, check `/.well-known/security.txt` over HTTPS for an HTTP 200 response and UTF-8 `text/plain`. [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116.html)

## P3 verification

The supplied LibreCosta brand kit provides the exact monochrome SVG and 1200×630 OG image. The original charcoal cutout supplies the three ICO sizes, the 96px favicon, the 180px Apple icon and the 512px logo. The 16px favicon uses the brand's white background for contrast in dark browser chrome.

- Both Windows regional builds passed the static verifier. CN exports eight pages, INTL exports 24, and each serves its own 404. Each localized page has its own title, description and sharing metadata.
- Chrome desktop and mobile emulation covered all 32 pages at 1440, 390 and 320 CSS pixels. Tests covered same-origin language navigation, cross-origin routing against the local artifacts, language fallback, keyboard and touch, and real HTTP 404 responses.
- Isolated local builds exercised the approved-indexing branch for all 32 HTML heads and checked both sitemap inventories. P3 kept the indexing gate closed. At that stage clean-checkout wind files were still required for release.

## P5-A verification

- `pnpm check`, `pnpm build:cn` and `pnpm build:intl` passed. Chrome checked the CN filing footer in both languages at 1440, 390 and 320 px. INTL contains no CN filing markup. The GitHub icon opens the website repository and sits to the left of Bilibili.
- During P5-A, both local exports and the Cloudflare emulator served `/robots.txt`, `/llms.txt` and `/.well-known/security.txt` as UTF-8 plain text. The preview artifacts blocked crawling, and separate local indexing fixtures verified 4 CN and 20 INTL sitemap entries and all 32 corresponding HTML heads.
- The 58-second wind regenerated with identical SHA-256 values. At decode, Opus measured −23.77 dBFS RMS and −7.12 dBFS peak, and MP3 measured −23.38 dBFS RMS and −7.20 dBFS peak. Chrome played Opus and the forced MP3 fallback without fetching audio before activation. The maximum adjacent-sample step across the Web Audio loop seam was 0.00483 and 0.01054 respectively. Mobile playback was tested in Chrome emulation. Physical iOS playback and subjective listening remain unverified.
- At P5-A, the release commands stopped at the then-disabled indexing switch. The procedural wind removed the private audio input requirement.
