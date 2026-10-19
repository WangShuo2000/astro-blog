import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import sanitizeHtml from 'sanitize-html'

const root = path.resolve(process.argv[2] || 'dist')
const baseline = process.argv[3] && path.resolve(process.argv[3])
const walk = dir =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap(entry =>
      entry.isDirectory()
        ? walk(path.join(dir, entry.name))
        : [path.join(dir, entry.name)],
    )
const normalize = text => text.replace(/\s+/g, ' ').trim()
function inspect(file) {
  const elements = []
  const ids = new Set()
  const headings = []
  const articleText = []
  const codeText = []
  sanitizeHtml(fs.readFileSync(file, 'utf8'), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'main',
      'article',
      'header',
      'footer',
      'nav',
      'section',
      'time',
      'title',
      'img',
      'link',
      'meta',
    ]),
    allowedAttributes: false,
    transformTags: {
      '*': (tagName, attribs) => {
        elements.push({ tagName, attribs })
        if (attribs.id) ids.add(attribs.id)
        return { tagName, attribs }
      },
    },
    exclusiveFilter: frame => {
      if (frame.tag === 'pre') codeText.push(normalize(frame.text))
      if (frame.tag === 'h1') headings.push(normalize(frame.text))
      if (frame.attribs.class?.split(' ').includes('custom-md'))
        articleText.push(normalize(frame.text))
      return false
    },
  })
  return { elements, ids, headings, articleText, codeText }
}
const pages = walk(root).filter(file => file.endsWith('.html'))
const index = new Map(
  pages.map(file => [path.relative(root, file), inspect(file)]),
)
const failures = []
for (const [relative, page] of index) {
  assert.ok(page.headings.length, `Missing h1: ${relative}`)
  const pageUrl = new URL(
    `/${relative.replace(/index\.html$/, '')}`,
    'https://build.test',
  )
  for (const { tagName, attribs } of page.elements) {
    if ('data-astro-prefetch' in attribs)
      assert.ok(
        ['', 'hover', 'tap', 'load', 'viewport', 'false'].includes(
          attribs['data-astro-prefetch'],
        ),
        `Invalid prefetch strategy: ${relative}`,
      )
    const refs = [attribs.href, attribs.src, attribs.poster].filter(Boolean)
    if (attribs.srcset)
      refs.push(
        ...attribs.srcset.split(',').map(part => part.trim().split(/\s+/)[0]),
      )
    for (const ref of refs) {
      if (/^(mailto:|tel:|data:|javascript:)/.test(ref)) continue
      const target = new URL(ref, pageUrl)
      if (target.origin !== pageUrl.origin) continue
      const pathname = decodeURIComponent(target.pathname).replace(/^\//, '')
      const candidates = [pathname, path.join(pathname, 'index.html')]
      const destination = candidates.find(
        candidate =>
          fs.existsSync(path.join(root, candidate)) &&
          fs.statSync(path.join(root, candidate)).isFile(),
      )
      if (!destination) failures.push(`${relative}: missing ${ref}`)
      if (target.hash && destination?.endsWith('.html')) {
        const id = decodeURIComponent(target.hash.slice(1))
        if (id && !index.get(destination)?.ids.has(id))
          failures.push(`${relative}: missing fragment ${ref}`)
      }
    }
    if (tagName === 'img')
      assert.ok('alt' in attribs, `Missing image alternative: ${relative}`)
  }
  assert.ok(
    page.ids.has('main-content'),
    `Missing skip-link target: ${relative}`,
  )
}
// Fonts and other CSS assets must also resolve in the static deployment.
for (const file of walk(root).filter(file => /\.(css|html)$/.test(file))) {
  const content = fs.readFileSync(file, 'utf8')
  const styles = file.endsWith('.css')
    ? [content]
    : [...content.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(
        match => match[1],
      )
  for (const css of styles)
    for (const match of css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)) {
      const ref = match[2]
      if (!ref || /^(data:|https?:|var\(|#)/.test(ref)) continue
      const target = new URL(
        ref,
        new URL(`/${path.relative(root, file)}`, 'https://build.test'),
      )
      const local = path.join(
        root,
        decodeURIComponent(target.pathname).replace(/^\//, ''),
      )
      if (!fs.existsSync(local))
        failures.push(
          `${path.relative(root, file)}: missing stylesheet asset ${ref}`,
        )
    }
}
assert.deepEqual(
  [...new Set(failures)],
  [],
  'Broken build links, fragments, or assets',
)
for (const name of [
  'rss.xml',
  'sitemap-index.xml',
  'sitemap-0.xml',
  'robots.txt',
  'pagefind/pagefind.js',
])
  assert.ok(fs.existsSync(path.join(root, name)), `Missing ${name}`)
const rss = fs.readFileSync(path.join(root, 'rss.xml'), 'utf8')
const rssLinks = [...rss.matchAll(/<item>[\s\S]*?<link>(.*?)<\/link>/g)].map(
  match => match[1],
)
const posts = [...index.keys()].filter(file => file.startsWith('posts/'))
assert.equal(
  rssLinks.length,
  posts.length,
  'RSS must include every published article',
)
for (const relative of posts) {
  const html = fs.readFileSync(path.join(root, relative), 'utf8')
  assert.match(
    html,
    /application\/ld\+json/,
    `Missing structured data: ${relative}`,
  )
  assert.match(
    html,
    /data-pagefind-meta=["']?title/,
    `Missing search title: ${relative}`,
  )
}
if (baseline) {
  const oldPaths = walk(baseline)
    .filter(file => file.endsWith('.html'))
    .map(file => path.relative(baseline, file))
    .sort()
  assert.deepEqual(
    [...index.keys()].sort(),
    oldPaths,
    'Public URLs changed during migration',
  )
  for (const relative of oldPaths) {
    const oldPage = inspect(path.join(baseline, relative))
    const current = index.get(relative)
    assert.deepEqual(
      current.headings,
      oldPage.headings,
      `Page headings changed: ${relative}`,
    )
    // The new compiler removes inter-block whitespace; compare content separately
    // from block boundaries, then compare each code sample independently.
    const compact = texts => texts.map(text => text.replace(/\s/g, ''))
    assert.deepEqual(
      compact(current.articleText),
      compact(oldPage.articleText),
      `Article/about content changed: ${relative}`,
    )
    assert.deepEqual(
      current.codeText,
      oldPage.codeText,
      `Code sample content changed: ${relative}`,
    )
  }
  const oldRss = fs.readFileSync(path.join(baseline, 'rss.xml'), 'utf8')
  assert.deepEqual(
    rssLinks,
    [...oldRss.matchAll(/<item>[\s\S]*?<link>(.*?)<\/link>/g)].map(
      match => match[1],
    ),
    'RSS article URLs/order changed',
  )
}
console.log(
  JSON.stringify(
    {
      passed: true,
      htmlPages: pages.length,
      articles: posts.length,
      rssItems: rssLinks.length,
      baselineCompared: Boolean(baseline),
    },
    null,
    2,
  ),
)
