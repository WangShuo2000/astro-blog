# 🍥Trouvaille

A static personal journal built with [Astro 7.4](https://astro.build), MDX, and Pagefind.

Requires Node.js **22.22.0 or newer** and pnpm 9.6.0. Run `nvm use` to use the version recorded in `.nvmrc`. The output remains a static site in `dist/`; no server adapter is required.

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
lang: jp      # Set only if the post's language differs from the site's language in `config.ts`
---
```

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                             | Action                                           |
|:------------------------------------|:-------------------------------------------------|
| `pnpm install --frozen-lockfile` | Installs dependencies                            |
| `pnpm dev`                          | Starts local dev server at `localhost:4321`      |
| `pnpm build`                        | Build your production site to `./dist/`          |
| `pnpm preview`                      | Preview your build locally, before deploying     |
| `pnpm check` | Check Astro and TypeScript diagnostics |
| `pnpm test` | Test Markdown features and source-relative image paths |
| `pnpm test:markdown` | Test math, directives, headings, code, and reading metadata |
| `pnpm verify` | Check generated routes, links, assets, search, RSS, and structured data after building |
| `pnpm build:timings` | Build with Astro’s phase-by-phase performance report |
| `pnpm new-post <filename>`          | Create a new post                                |
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
