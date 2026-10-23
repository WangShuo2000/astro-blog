import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('../', import.meta.url))
const cli = join(root, 'node_modules/pagefind/lib/runner/bin.cjs')

test('full-text search finds Chinese and English articles from either page language', { timeout: 20000 }, async () => {
  const site = mkdtempSync(join(tmpdir(), 'blog-search-'))
  const originalWindow = globalThis.window
  const originalDocument = globalThis.document
  const originalFetch = globalThis.fetch

  try {
    // Search terms occur only in body text, so a metadata-only fallback cannot pass.
    const articles = [
      ['chinese', 'zh-CN', '中文示例', '我们通过观察器监听组件状态，并创建自己的脚手架。'],
      ['english', 'en', 'English example', 'The concurrency architecture keeps rendering responsive.'],
    ]
    for (const [slug, language, title, body] of articles) {
      const directory = join(site, 'posts', slug)
      mkdirSync(directory, { recursive: true })
      writeFileSync(join(directory, 'index.html'), `<html lang="${language}"><body><article data-pagefind-body><h1 data-pagefind-meta="title">${title}</h1><p>${body}</p></article></body></html>`)
    }
    // Run the real CLI from the project root so it reads pagefind.yml.
    execFileSync(process.execPath, [cli, '--site', site], { cwd: root, stdio: 'pipe' })
    const bundle = join(site, 'pagefind')
    const entry = JSON.parse(readFileSync(join(bundle, 'pagefind-entry.json'), 'utf8'))
    assert.deepEqual(Object.keys(entry.languages), ['zh'])
    assert.equal(entry.languages.zh.page_count, 2)

    globalThis.window = { location: { origin: 'https://search.test' } }
    globalThis.fetch = async resource => {
      const pathname = new URL(resource, 'https://search.test').pathname
      assert.ok(pathname.startsWith('/pagefind/'), `Unexpected search resource: ${pathname}`)
      return new Response(readFileSync(join(bundle, pathname.slice('/pagefind/'.length))))
    }
    const source = readFileSync(join(bundle, 'pagefind.js'), 'utf8')
    const modulePath = join(bundle, 'pagefind.mjs')
    writeFileSync(modulePath, source)
    for (const language of ['en', 'zh-CN']) {
      globalThis.document = { currentScript: null, querySelector: () => ({ getAttribute: () => language }) }
      const pagefind = await import(`${pathToFileURL(modulePath).href}#${language}`)
      await pagefind.options({ basePath: '/pagefind/' })
      try {
        for (const [query, expected] of [['观察器', '/posts/chinese/'], ['脚手架', '/posts/chinese/'], ['concurrency', '/posts/english/']]) {
          const response = await pagefind.search(query)
          const results = await Promise.all(response.results.map(result => result.data()))
          assert.ok(results.some(result => result.url === expected), `${language} page should find ${query} in ${expected}`)
        }
      } finally {
        await pagefind.destroy()
      }
    }
  } finally {
    globalThis.window = originalWindow
    globalThis.document = originalDocument
    globalThis.fetch = originalFetch
    rmSync(site, { recursive: true, force: true })
  }
})
