# 🍥Trouvaille

A static personal journal built with [Astro 7.4](https://astro.build), MDX, and Pagefind.

Development and CI use **Node.js 22.23.3** and **pnpm 9.6.0**. `.nvmrc` and `.node-version` pin Node; `packageManager` pins pnpm, and `.npmrc` rejects incompatible engines and pnpm versions. The output remains a static site in `dist/`; no server adapter is required.

```sh
nvm install
nvm use
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

On this checkout, an isolated official Node runtime is also installed under the ignored `.local-runtime/` directory. `./scripts/pnpm.sh dev` (or `check`, `test`, `build`, `verify`) selects that runtime and the pinned pnpm without replacing the system Node. On a fresh checkout, the same launcher uses the active Node from nvm/fnm and checks its version. The local runtime and Corepack cache are machine-specific and are not committed.

The GitHub Actions validation workflow installs these same versions and runs `check`, `test`, `build`, and `verify` on pushes and pull requests.

Content collections are configured in `src/content.config.ts`. Articles remain in `src/content/posts/`, and the about content remains in `src/content/spec/about.md`. The unified Markdown processor is explicitly retained for the existing directives, math, and metadata plugins. Code fonts are provided locally through Astro’s Fonts API; site typography continues to use the approved system serif stack.

## ⚙️ Frontmatter of Posts

```yaml
---
title: My First Blog Post
published: 2023-09-09
description: This is the first post of my new Astro blog.
image: ./cover.jpg
tags: [Foo, Bar]
category: Front-end
draft: false
lang: en      # Language of the article body: en, zh-CN, ja, etc.
---
```

New articles default to `zh-CN`; use `pnpm new-post example --lang en` for English. Every existing article explicitly declares its language. Legacy tags such as `zh_CN` are normalized, and invalid language tags fail validation. Interface text remains English.

## Feeds, categories, and sharing

- RSS publishes the frontmatter description and a link to the full article. It deliberately does not render MDX source as plain Markdown; images, components, and code remain available on the article page.
- Production RSS also depends on two manually managed Cloudflare rules. See [Cloudflare configuration and RSS troubleshooting](docs/cloudflare.md) for their exact settings, verification commands, and rollback steps.
- Category URLs use stable lowercase slugs such as `/archive/category/technology/`, with separate display names. `Technology` and `technology` resolve to one category. `public/_redirects` preserves the existing mixed-case URLs with HTTP 301 redirects on Cloudflare Pages. Other hosts need equivalent redirect rules; `astro preview` does not apply `_redirects`. The supplied rules assume the current `base: '/'`.
- Every page includes absolute Open Graph and Twitter image URLs. The default is a landscape JPEG generated from `src/assets/images/banner.jpeg`; an article's `image` overrides it. Generated images fit within 1200×630 without enlarging small originals, and the metadata reports their actual size. Local covers resolve relative to the article source file. Public (`/…`) or HTTPS images can also be used; provide a share-ready image for those sources.
- Category, tag, and journal pagination pages have distinct titles and descriptions. Article JSON-LD includes the same language and share image as its page.
- `pagefind.yml` creates one Chinese-segmented full-text index across English and Chinese articles, so either page language can search the whole journal. English terms remain searchable, but English stemming is not applied. See [Pagefind multilingual search](https://pagefind.app/docs/multilingual/).

## 🧞 Commands

The default site icon is a serif **T** bookmark in the journal's olive and paper palette. Its SVG follows the browser's light/dark preference, with 16px, 32px, and 192px PNG fallbacks and a 180px Apple touch icon. Edit the vector paths or palettes in `scripts/generate-favicons.mjs`, then run `pnpm favicon:generate` to regenerate the committed assets. Custom icons can still be supplied through `siteConfig.favicon`.

All commands are run from the root of the project, from a terminal:

| Command                             | Action                                           |
|:------------------------------------|:-------------------------------------------------|
| `pnpm install --frozen-lockfile` | Installs dependencies                            |
| `pnpm dev`                          | Starts local dev server at `localhost:4321`      |
| `pnpm build`                        | Build your production site to `./dist/`          |
| `pnpm preview`                      | Preview your build locally, before deploying     |
| `pnpm check` | Check Astro and TypeScript diagnostics |
| `pnpm test` | Test Markdown, paths, RSS, categories, languages, and real multilingual search |
| `pnpm test:markdown` | Test math, directives, headings, code, and reading metadata |
| `pnpm verify` | Check routes, links, assets, search, RSS summaries, language, share images, category redirects, and structured data after building |
| `pnpm build:timings` | Build with Astro’s phase-by-phase performance report |
| `pnpm new-post <filename>`          | Create a new post                                |
| `pnpm favicon:generate`             | Regenerate the SVG, PNG, and Apple touch icons    |
| `pnpm astro ...`                    | Run CLI commands like `astro add`, `astro check` |
| `pnpm astro --help`                 | Get help using the Astro CLI                     |

## Upgrade verification and performance

After installing dependencies:

```sh
pnpm check
pnpm test
pnpm build
pnpm verify
```

Use
`node scripts/verify-build.mjs dist /absolute/path/to/baseline-dist` to additionally check that published URLs, headings, article text, code samples, and RSS order match a saved build.

For repeatable Lighthouse comparisons, install the audit tools outside the project dependencies, then serve both builds with the same compression and caching behavior:

```sh
npm install --prefix /tmp/trouvaille-audit-tools lighthouse chrome-launcher --no-audit --no-fund
node scripts/serve-audit.mjs /absolute/path/to/baseline-dist 4340
# In another terminal:
node scripts/serve-audit.mjs dist 4341
```

Run the audits sequentially, with the machine otherwise idle:

```sh
AUDIT_TOOLS=/tmp/trouvaille-audit-tools pnpm perf:audit baseline-mobile 4340 3 mobile
AUDIT_TOOLS=/tmp/trouvaille-audit-tools pnpm perf:audit current-mobile 4341 3 mobile
AUDIT_TOOLS=/tmp/trouvaille-audit-tools pnpm perf:audit baseline-desktop 4340 3 desktop
AUDIT_TOOLS=/tmp/trouvaille-audit-tools pnpm perf:audit current-desktop 4341 3 desktop
```

`AUDIT_OUTPUT` selects the output directory (defaults to the OS temporary directory under `trouvaille-performance`); `CHROME_PATH` can select a Chrome executable. The runner uses an isolated headless browser, resets storage between runs and blocks analytics, comments, GitHub API calls and the external KaTeX stylesheet on both builds to isolate application changes. Functional browser checks separately exercise the external integrations without this blocking. These are laboratory comparisons, not field INP or real-user Core Web Vitals measurements.

Compare the two generated summaries with `pnpm perf:compare <baseline-summary.json> <current-summary.json> [comparison.json]`. The gate checks medians from at least three runs, with no score or transferred-byte regression, a timing noise allowance of the larger of 5ms or 0.5%, and a CLS allowance of 0.001.
