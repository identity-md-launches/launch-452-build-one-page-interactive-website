# Chain Time Machine

A one-page Ethereum explorer: enter a public address and a block number to create a visual snapshot, or compare two blocks to see their exact distance in blocks and time. No wallet, signatures, private keys, backend, or API keys are used.

The finished static website is in **[dist/](dist/)**. The publisher must serve this directory; it does not need to rebuild. [DESIGN.md](DESIGN.md) describes the implemented design. [Validation and screenshots](artifacts/validation.md) record the checks, fixes, and limitations.

## Install and develop

Use Node.js **22.12 or later** and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. The package lock pins the toolchain. No environment file is needed. The normal install creates an ignored `node_modules/`; do not include dependencies or npm caches in the submission.

## Check, rebuild, and preview

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

`typecheck` runs `tsc --noEmit`; `test` runs the 15 data-layer tests. `build` replaces the generated `dist/` export. `preview` serves it, normally on port 4173. Use an HTTP server instead of opening the HTML as a `file:` URL.

The optional browser interaction suite requires Playwright Chromium:

```sh
npx playwright install chromium
npm run preview
# In a second terminal, use the actual preview URL:
npm run test:browser -- http://localhost:4173/
```

`test/browser-checks.mjs` contains 11 interaction groups. It deliberately intercepts RPC requests for repeatable failure, loading, and edge-case checks. It also exercises the actual browser clipboard. Live provider availability must be checked separately. `CTM_CHROMIUM_PATH` can select an already installed compatible Chromium executable; it is optional, not a secret. The worker ran this same test function through the supplied browser tool, rather than the standalone launcher.

## Publish

Upload **the contents of `dist/`**, preserving `assets/` and `fonts/`, to any static HTTPS host, IPFS gateway path, or ENS-hosted site. Serve `index.html` at that directory's root with normal JavaScript, CSS, SVG, and WOFF2 MIME types. No server-side routing or rewrite is required: this is a single page using anchor navigation.

Vite is configured with `base: './'`. The export references `./assets/…`, `./favicon.svg`, and CSS-relative `../fonts/…`, so it works at both `/` and a nested path. HTTPS is needed for the browser Clipboard API outside localhost. If copying is unavailable, the page provides a manual-copy instruction and keeps the full value selectable.

Keep source, `package.json`, `package-lock.json`, configuration, documentation, tests, and **all of `dist/`** in the submission. Include the small validation artifacts if retaining this review. Do not include generated dependency directories, browser downloads, package caches, or vendored package archives. There are no submodules. The explicit path budget for the new **`.gitignore` is 512 bytes**; it only excludes generated dependencies/caches/test output and keeps `dist/` included.

## What the data means

- Addresses must be `0x` followed by 40 hexadecimal characters. Mixed-case checksums are not enforced; ENS names are not resolved. Surrounding whitespace is accepted.
- Blocks are decimal, non-negative safe integers, including 0. Fractions, signs, commas, exponent notation, and unsafe integers are rejected.
- Block timestamps come from Ethereum's [`eth_getBlockByNumber` JSON-RPC method](https://ethereum.org/developers/docs/apis/json-rpc/#eth_getblockbynumber). The browser tries PublicNode, then LlamaRPC, with a six-second limit per attempt. Responses are checked for the requested block, timestamp, hash, and RPC envelope.
- Comparison uses the **absolute difference of the returned timestamps**, including seconds. It never assumes an average block interval. Reversed and identical block numbers work.
- The initial example is explicitly labelled and contains recorded real data for block 20,000,000: **01 Jun 2024, 22:36:47 UTC**. Every submission performs a fresh lookup. Example data is never substituted for a failed lookup.
- Genesis has a header timestamp of zero, displayed as **01 Jan 1970, 00:00:00 UTC**. This represents its stored field, not Ethereum's launch date.
- Address bytes seed the local orbital illustration. Address casing and block choice do not change its geometry. The drawing is decorative; collisions are possible and it is not identity verification, a cryptographic hash, or proof of ownership.
- A snapshot pairs an address with a block. It does not query the address's historic balances, transactions, existence, or contract state.
- Addresses remain in memory in the page. RPC requests contain only block numbers; no account information is sent. Fonts and runtime assets are local. There are no analytics, cookies, or persistent storage.

## Actual validation results

Checked on **2026-09-29**, with Node 22.22.1, TypeScript 5.9.3, Vite 7.1.12, and Chromium through the supplied browser tool.

| Check | Actual result |
| --- | --- |
| Production build | Exit 0; `dist/index.html`, one JS bundle, one CSS file, favicon, two fonts and their licenses |
| Typecheck | Exit 0; no diagnostics |
| Unit/integration tests | 15/15 passed; expected Node experimental MockTimers warning |
| Browser interactions | 11/11 groups passed against the finished export under `/preview/` |
| Live mainnet | PublicNode lookup and comparison succeeded; 20,000,000 → 20,001,000 is 1,000 blocks and 3 hours, 20 minutes, 36 seconds |
| Responsive checks | No horizontal overflow at 320, 390, 768, 1024, or 1440 CSS pixels; screenshots inspected at 320, 390, 768, and 1440 |
| Accessibility automation | Axe 4.10.3: zero violations in initial snapshot, mobile comparison, and validation-error states; artwork-overlay contrast marked incomplete |
| Static assets | Local JS/CSS/favicon/fonts loaded successfully from a nested path; both fonts confirmed loaded |

To honor the assignment's restriction on repository `node_modules/`, the worker installed dependencies and compiled an exact source copy in `/tmp/ctm-build`, using `/tmp/ctm-npm-cache`. Commands were `npm --prefix /tmp/ctm-build run typecheck`, `npm --prefix /tmp/ctm-build run build`, and `npm --prefix /tmp/ctm-build test`. The lockfile and complete export were copied back. Normal contributors can use the root commands above. Temporary toolchains and caches are not deliverables.

Limitations: public RPC services can rate-limit, change CORS policies, or be unavailable; LlamaRPC returned HTTP 525 during direct checks, while PublicNode worked. Offline users can view the initial artwork/example but cannot retrieve new block data. Native Safari/Firefox, physical mobile devices, screen readers, native browser 200% zoom, and pseudo-localized copy were not tested. A 200% root-text resize and RTL smoke check passed. See the consolidated review for exact coverage; the worker's results are not independent certification.

## Attribution

Interface design applies the provided pinned Better Interface guidance by Jakub Krehel (MIT), and the documentation method adapted from Paul Bakaus's Impeccable (Apache-2.0). Source references are in [DESIGN.md](DESIGN.md); their supplied license texts are retained in [artifacts/design-guidance-LICENSE.txt](artifacts/design-guidance-LICENSE.txt). Manrope and IBM Plex Mono are bundled with their SIL Open Font License notices in `public/fonts/` and `dist/fonts/`. The orbital drawing and inline UI icons are generated from project source.
