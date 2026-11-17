# Dual-region static publication

Both deployments use the same Next.js static export. Each artifact serves 24 pages across six languages, with a separate `404.html`. The default locale uses unprefixed paths and every other locale uses a prefix. Internal navigation and language selection stay on the serving origin.

| Region | Default locale | Build | Static directory | Production origin |
| --- | --- | --- | --- | --- |
| INTL · Cloudflare Workers Static Assets | `en` | `pnpm build:intl` | `dist/intl` | `https://librecosta.com` |
| CN · EdgeOne Makers | `zh` | `pnpm build:cn` | `dist/cn` | Unset in `config/publications/cn.json` |

## Git and build settings

Connect `librecosta/website` at the repository root. Set the production branch to `master` after release approval. Use `pre-master` for private release-candidate verification and `develop` for engineering. Keep automatic preview deployments disabled until access controls have been verified. The branch progression remains `develop → pre-master → master`.

Pin Node **24.18.0** in both managed builds. Install with `npx --yes pnpm@12.8.1 install --frozen-lockfile` and build with the same pinned pnpm. Makers lists pnpm 6–11 for its bundled installation. Using npm's executable launcher selects pnpm 12.8.1 for both commands and keeps the existing lockfile. This route does not depend on a Corepack shim. [Workers build image](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/) · [Makers build guide](https://pages.edgeone.ai/document/build-guide)

### Cloudflare INTL

1. Use Workers & Pages → Workers → Settings → Builds to connect GitHub when remote testing is approved. The Worker name must match `librecosta-website-intl` in `wrangler.jsonc`. Use the explicit asset configuration to prevent framework autodetection from selecting a Next.js runtime. [GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)
2. Set `NODE_VERSION=24.18.0` and `SKIP_DEPENDENCY_INSTALL=1`. Set Build command to `npx --yes pnpm@12.8.1 install --frozen-lockfile && npx --yes pnpm@12.8.1 build:intl`. After production approval only, set Deploy command to `npx --yes pnpm@12.8.1 check:release intl && npx --yes wrangler@4.164.0 deploy`. [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
3. The assets-only manifest serves folder indexes with a trailing slash and uses the exported 404 page with an HTTP 404 status. Cloudflare supplies MIME types on asset upload and defaults to revalidation with ETags. [HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/) · [Static 404](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/) · [Static response headers](https://developers.cloudflare.com/workers/static-assets/headers/)
4. The manifest disables `workers.dev` and version preview URLs. For a later remote preview, protect its hostname with Cloudflare Access and verify that an unauthenticated request cannot see the HTML. The future production domain is configured under Settings → Domains & Routes → Custom Domain. Use Deployments to roll back to a previous tested version. [Preview access](https://developers.cloudflare.com/workers/previews/custom-domains/) · [Rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)

### EdgeOne Makers CN

1. In the Git import form select the static or custom framework preset and repository root. `edgeone.json` sets Node 24.18.0, the pinned installation and build commands, and `dist/cn`. Inspect the Git build log for both tool versions and the published output directory. When enabling Production, set `PUBLICATION_REQUIRE_RELEASE=1` in that environment to fail the build if the origin or approved audio is missing. [Makers project configuration](https://pages.edgeone.ai/document/edgeone-json) · [Next.js static export](https://pages.edgeone.ai/document/framework-nextjs)
2. Use the exported directory indexes and root `404.html` with native static routing. Leave rewrites and cache overrides empty. Makers documents revalidation for unversioned assets and longer caching for fingerprinted assets. Before accepting the managed preview, check deep links, slash redirects, actual HTTP 404 responses, and MIME types for JS, CSS, fonts, GLB, WASM and both audio formats. [Custom 404](https://edgeone.ai/document/192123212580007936) · [Makers cache policy](https://pages.edgeone.ai/document/configuring-cache)
3. Verify preview URL access from an unauthenticated browser before sending a link. Makers' temporary preview links can behave differently inside and outside mainland China. Use a verified access-protected preview or keep verification local. The future domain is configured under Domain Name Management after CN origin and filing requirements are settled. For rollback, redeploy the last verified Git commit or upload its retained static artifact. [Domain access and filing](https://pages.edgeone.ai/document/domain-overview) · [Manage deploys](https://pages.edgeone.ai/document/manage-deploys)

## Expanse audio and release checks

A Git-only build ships the committed music in Opus and MP3. Interface cues are generated in Web Audio. The Mixkit source and locally generated versions are held outside source control, so a clean checkout cannot provide the wind. Both builds exclude the workstation's `public/audio/local/` by default. The page can still play music and interface cues when wind is missing. [Local asset notice](../public/License/mixkit-arctic-winds.txt) · [Mixkit SFX license](https://mixkit.co/license/modal/sfxFree/)

For release, prepare the approved **end-product** loop with `python scripts/prepare-audio.py --wind <local-wav>` using FFmpeg and an authorized local copy, or supply an approved first-party loop with the same circular encoder padding. Set `PUBLICATION_WIND_DIR` to the private directory containing only the two named build inputs, `expanse-wind.opus` and `expanse-wind.mp3`. The regional build copies only those files to their existing public URLs. Keep the WAV and private build inputs out of Git. A CI runner with authorized access can stage the two files and build the artifact for the platform's static upload if the managed Git builders cannot have the approved inputs staged. Until that input is provisioned on the actual release path, both regions are blocked. CN is also blocked on its production origin.

Run `pnpm check:release cn` or `pnpm check:release intl` against the corresponding freshly built artifact. This verifies the static output and the presence and expected format of both wind files. Final release approval also requires the managed platform and domain checks below.

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
| Production | Approved wind input and release approval pending | Approved wind input, CN origin and release approval pending |

Windows builds and a clean Linux x86-64 container build passed. The Linux run used Node 24.18.0 and pnpm 12.8.1 with the frozen lockfile. Each Git-only export contained 208 files (about 17.8 MB). The largest file was `gopher-atlas.glb` at 1,873,704 bytes. Cloudflare's local emulator served the INTL artifact with canonical directory redirects, correct MIME types and actual 404 responses. Its packaging dry run also passed.

Desktop Chromium loaded the WORLD scene, played the committed music, and verified missing-wind fallback and all eight on-demand WORKS models. Mobile browser emulation covered language switching, refresh, ABOUT motion and CONTACT. The WORKS toolbar now clears the two-row mobile header so the return button can be tapped at 320 and 390 pixels. A separate local Linux build using the two existing encoded wind inputs passed the INTL artifact release check. The Git-only artifacts still fail the wind requirement, as intended.

P3 owns the brand and discovery assets, including favicon, OG, Canonical, hreflang and Sitemap. P4 owns protected platform verification, final branch promotion, domain and DNS setup, and public indexing after approval.
