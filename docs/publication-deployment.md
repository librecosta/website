# Dual-region static publication

Both deployments use the same Next.js static export. CN exports eight pages in Chinese and English. INTL exports 24 pages in six languages. Both include a separate `404.html`. The default locale uses unprefixed paths. Internal navigation and language selection stay on the serving origin. The site switch follows the [regional route matrix](publication-routing.md).

| Region | Default locale | Build | Static directory | Production origin |
| --- | --- | --- | --- | --- |
| INTL · Cloudflare Workers Static Assets | `en` | `pnpm build:intl` | `dist/intl` | `https://librecosta.com` |
| CN · EdgeOne Makers | `zh` | `pnpm build:cn` | `dist/cn` | `https://librecosta.cn` |

## Git and build settings

Connect `librecosta/website` at the repository root. Set the production branch to `master` after release approval. Use `pre-master` for private release-candidate verification and `develop` for engineering. Keep automatic preview deployments disabled until access controls have been verified. The branch progression remains `develop → pre-master → master`.

Pin Node **24.18.0** in both managed builds. Install with `npx --yes pnpm@12.8.1 install --frozen-lockfile` and build with the same pinned pnpm. Makers lists pnpm 6–11 for its bundled installation. Using npm's executable launcher selects pnpm 12.8.1 for both commands and keeps the existing lockfile. This route does not depend on a Corepack shim. [Workers build image](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/) · [Makers build guide](https://pages.edgeone.ai/document/build-guide)

### Cloudflare INTL

1. Use Workers & Pages → Workers → Settings → Builds to connect GitHub when remote testing is approved. The Worker name must match `librecosta-website-intl` in `wrangler.jsonc`. Use the explicit asset configuration to prevent framework autodetection from selecting a Next.js runtime. [GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)
2. Set `NODE_VERSION=24.18.0` and `SKIP_DEPENDENCY_INSTALL=1`. Set Build command to `npx --yes pnpm@12.8.1 install --frozen-lockfile && npx --yes pnpm@12.8.1 build:intl`. After production approval only, set Deploy command to `npx --yes pnpm@12.8.1 check:release intl && npx --yes wrangler@4.164.0 deploy`. [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
3. The assets-only manifest serves folder indexes with a trailing slash and uses the exported 404 page with an HTTP 404 status. Cloudflare supplies MIME types on asset upload and defaults to revalidation with ETags. [HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/) · [Static 404](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/) · [Static response headers](https://developers.cloudflare.com/workers/static-assets/headers/)
4. The manifest disables `workers.dev` and version preview URLs. For a later remote preview, protect its hostname with Cloudflare Access and verify that an unauthenticated request cannot see the HTML. The future production domain is configured under Settings → Domains & Routes → Custom Domain. Use Deployments to roll back to a previous tested version. [Preview access](https://developers.cloudflare.com/workers/previews/custom-domains/) · [Rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)

### EdgeOne Makers CN

1. In the Git import form select the static or custom framework preset and repository root. `edgeone.json` sets Node 24.18.0, the pinned installation and build commands, and `dist/cn`. Inspect the Git build log for both tool versions and the published output directory. When enabling Production, set `PUBLICATION_REQUIRE_RELEASE=1` in that environment to fail the build until the production origin, indexing approval and audio checks pass. [Makers project configuration](https://pages.edgeone.ai/document/edgeone-json) · [Next.js static export](https://pages.edgeone.ai/document/framework-nextjs)
2. Use the exported directory indexes and root `404.html` with native static routing. Leave rewrites and cache overrides empty. Makers documents revalidation for unversioned assets and longer caching for fingerprinted assets. Before accepting the managed preview, check deep links, slash redirects, actual HTTP 404 responses, and MIME types for JS, CSS, fonts, GLB, WASM and both audio formats. [Custom 404](https://edgeone.ai/document/192123212580007936) · [Makers cache policy](https://pages.edgeone.ai/document/configuring-cache)
3. Verify preview URL access from an unauthenticated browser before sending a link. Makers' temporary preview links can behave differently inside and outside mainland China. Use a verified access-protected preview or keep verification local. The future domain is configured under Domain Name Management after connectivity and filing requirements are verified. For rollback, redeploy the last verified Git commit or upload its retained static artifact. [Domain access and filing](https://pages.edgeone.ai/document/domain-overview) · [Manage deploys](https://pages.edgeone.ai/document/manage-deploys)

## Expanse audio and release checks

A Git-only build ships the original music and procedural wind in Opus and MP3. Interface cues are generated in Web Audio. The browser loads audio after user activation. Both builds exclude the workstation's `public/audio/local/`. [Audio sources and regeneration](research/audio.md)

Run `pnpm check:release cn` or `pnpm check:release intl` against the corresponding freshly built artifact. The verifier checks the exported wind bytes against the decoded audio measurements. Regeneration is an offline task. Managed builds use the tracked files and need neither local input nor FFmpeg. Final release approval also requires the managed platform and domain checks below.

## Prepublication verification

```powershell
pnpm check
pnpm build:cn
pnpm build:intl
$env:PORT = '3081'; pnpm preview cn
# Separate terminal
$env:PORT = '3082'; pnpm preview intl
```

The build checks page counts, languages, local HTML references, required runtime assets, and the two platforms' common free-tier ceilings of 20,000 files and 25 MB per file. It rejects unexpected artifact files, including source and private files. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) · [Makers limits](https://pages.edgeone.ai/document/limits-and-quotas)

Repeat the same checks at each protected remote preview. Open a prefixed route with and without the trailing slash, refresh it, and switch languages from the same page. Check an invalid path, language prefix, works address and asset URL for HTTP 404. Confirm GLB/WASM payloads and playable media rather than checking only the status. Check that fixed-name assets revalidate following a new deployment.

| Stage | INTL | CN |
| --- | --- | --- |
| Local static build and Chromium verification | Passed | Passed |
| Managed Git builder | Pending platform integration | Pending platform integration |
| Protected remote preview | Pending access configuration and validation | Pending access configuration and validation |
| Production | HTTPS and indexing approval pending | HTTPS, public-security filing follow-up and indexing approval pending |

During P2, Windows builds and a clean Linux x86-64 container build passed. The Linux run used Node 24.18.0 and pnpm 12.8.1 with the frozen lockfile. Each Git-only export contained 208 files (about 17.8 MB). The largest file was `gopher-atlas.glb` at 1,873,704 bytes. Cloudflare's local emulator served the INTL artifact with canonical directory redirects, correct MIME types and actual 404 responses. Its packaging dry run also passed.

During P2, desktop Chromium loaded the WORLD scene, played the committed music, and verified missing-wind fallback and all eight on-demand WORKS models. Mobile browser emulation covered language switching, refresh, ABOUT motion and CONTACT. The WORKS toolbar cleared the two-row mobile header at 320 and 390 pixels. A separate local Linux build with the then-required encoded wind inputs passed the INTL artifact release check. P5-A replaces that audio input with the tracked procedural wind.

## Search metadata and preview isolation

Each regional build writes candidate Canonical and hreflang targets, robots rules and a sitemap to `dist/seo-review/<region>/`, outside both upload directories. Chinese canonicals belong to CN. English, Japanese, German, French and Spanish canonicals belong to INTL. Each logical page shares its own set of language alternates, and `x-default` points to the corresponding English INTL page. The CN sitemap has four entries and INTL has twenty. [Google localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions)

Both preview artifacts use `noindex, nofollow` and disallow crawling in `robots.txt`. Their title, description, Open Graph and X card metadata are available. Production Canonical, hreflang, JSON-LD and sitemap require approval in `config/publications/indexing.ts`. Keep remote previews access-protected and confirm both target origins over HTTPS before approving production indexing, promoting the release branch or changing DNS.

Both regions also publish `/llms.txt` and `/.well-known/security.txt`. The former describes the site and links to its published pages. The security contact expires 180 days after each regional build. Rebuild and publish before expiration. On each host, check `/.well-known/security.txt` over HTTPS for an HTTP 200 response and UTF-8 `text/plain`. [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116.html)

## P3 verification

The supplied LibreCosta brand kit provides the exact monochrome SVG and 1200×630 OG image. The original charcoal cutout supplies the three ICO sizes, the 96px favicon, the 180px Apple icon and the 512px logo. The 16px favicon uses the brand's white background for contrast in dark browser chrome.

- Both Windows regional builds passed the static verifier. CN exports eight pages, INTL exports 24, and each serves its own 404. Each localized page has its own title, description and sharing metadata.
- Chrome desktop and mobile emulation covered all 32 pages at 1440, 390 and 320 CSS pixels. Tests covered same-origin language navigation, cross-origin routing against the local artifacts, language fallback, keyboard and touch, and real HTTP 404 responses.
- Isolated local builds exercised the approved-indexing branch for all 32 HTML heads and checked both sitemap inventories. P3 kept the indexing gate closed. At that stage clean-checkout wind files were still required for release.

## P5-A verification

- `pnpm check`, `pnpm build:cn` and `pnpm build:intl` passed. Chrome checked the CN filing footer in both languages at 1440, 390 and 320 px. INTL contains no CN filing markup. The GitHub icon opens the website repository and sits to the left of Bilibili.
- Both local exports serve `/robots.txt`, `/llms.txt` and `/.well-known/security.txt` as UTF-8 plain text. Preview robots rules block crawling and `/sitemap.xml` returns HTTP 404. The local Cloudflare emulator returned the same statuses and MIME types. Separate local indexing fixtures verified 4 CN and 20 INTL sitemap entries and all 32 corresponding HTML heads. The committed indexing switch remains off.
- The 58-second wind regenerated with identical SHA-256 values. At decode, Opus measured −23.77 dBFS RMS and −7.12 dBFS peak, and MP3 measured −23.38 dBFS RMS and −7.20 dBFS peak. Chrome played Opus and the forced MP3 fallback without fetching audio before activation. The maximum adjacent-sample step across the Web Audio loop seam was 0.00483 and 0.01054 respectively. Mobile playback was tested in Chrome emulation. Physical iOS playback and subjective listening remain unverified.
- Both `check:release` commands reached the indexing approval gate. Neither required a private wind input. Managed platform integration, HTTPS and indexing approval remain pending. The CN public-security filing placeholder can be replaced once the number is issued.
