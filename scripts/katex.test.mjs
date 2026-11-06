import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import katexAssets, {
  katexStylesheet,
} from '../src/integrations/katex-assets.mjs'

const buildHook = 'astro:build:done'

test('local math assets contain matching CSS, WOFF2-only fonts, and the license', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'blog-katex-'))
  try {
    await katexAssets().hooks[buildHook]({
      dir: pathToFileURL(`${directory}/`),
    })
    const cssPath = join(directory, katexStylesheet)
    const css = await readFile(cssPath, 'utf8')
    const fonts = [...css.matchAll(/url\(([^)]+)\)/g)].map(match => match[1])
    assert.equal(fonts.length, 20)
    for (const font of fonts) {
      assert.match(font, /^fonts\/KaTeX_[\w-]+\.woff2$/)
      assert.ok(
        (await readFile(new URL(font, pathToFileURL(cssPath)))).length > 0,
      )
    }
    assert.doesNotMatch(css, /https?:|\.ttf|\.woff\b/)
    assert.match(css, /\.katex-display\{overflow-x:auto;overflow-y:hidden;/)
    assert.match(
      css,
      /\.katex-display>\.katex\{width:max-content;min-width:100%\}/,
    )
    const assetDirectory = new URL('.', pathToFileURL(cssPath))
    assert.equal((await readdir(new URL('fonts/', assetDirectory))).length, 20)
    assert.match(
      await readFile(new URL('LICENSE', assetDirectory), 'utf8'),
      /MIT License/,
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('development serves local math assets under the configured base, including HEAD requests', async () => {
  const integration = katexAssets()
  integration.hooks['astro:config:done']({ config: { base: '/journal/' } })
  let middleware
  await integration.hooks['astro:server:setup']({
    server: {
      middlewares: {
        use: handler => {
          middleware = handler
        },
      },
    },
  })
  const headers = {}
  let body
  let ended = false
  let skipped = false
  const response = {
    setHeader: (key, value) => {
      headers[key] = value
    },
    end: content => {
      body = content
      ended = true
    },
  }
  const next = () => {
    skipped = true
  }
  middleware(
    { method: 'GET', url: `/journal${katexStylesheet}?v=test` },
    response,
    next,
  )
  assert.equal(skipped, false)
  assert.equal(ended, true)
  assert.equal(headers['Content-Type'], 'text/css; charset=utf-8')
  assert.equal(headers['Content-Length'], body.length)
  assert.match(body.toString(), /KaTeX_Main/)

  // Astro strips the configured base from url before custom middleware runs.
  ended = false
  middleware(
    {
      method: 'GET',
      url: katexStylesheet,
      originalUrl: `/journal${katexStylesheet}`,
    },
    response,
    next,
  )
  assert.equal(skipped, false)
  assert.equal(ended, true)
  assert.equal(headers['Content-Type'], 'text/css; charset=utf-8')
  assert.match(body.toString(), /KaTeX_Main/)

  const font = new URL(
    body.toString().match(/url\(([^)]+)\)/)[1],
    `http://localhost/journal${katexStylesheet}`,
  ).pathname
  middleware({ method: 'GET', url: font }, response, next)
  assert.equal(headers['Content-Type'], 'font/woff2')
  ended = false
  middleware(
    { method: 'GET', url: font.replace('/journal', ''), originalUrl: font },
    response,
    next,
  )
  assert.equal(ended, true)
  assert.equal(headers['Content-Type'], 'font/woff2')
  assert.ok(body.length > 0)

  middleware(
    { method: 'HEAD', url: `/journal${katexStylesheet}` },
    response,
    next,
  )
  assert.equal(body, undefined)
  assert.ok(headers['Content-Length'] > 0)

  middleware({ method: 'GET', url: katexStylesheet }, response, next)
  assert.equal(skipped, true)
  skipped = false
  middleware(
    { method: 'GET', url: '/journal/katex/missing.css' },
    response,
    next,
  )
  assert.equal(skipped, true)
})
