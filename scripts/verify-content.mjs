import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseFrontmatter } from '@astrojs/markdown-remark'
import sanitizeHtml from 'sanitize-html'
import sharp from 'sharp'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const walk = dir =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap(entry =>
      entry.isDirectory()
        ? walk(path.join(dir, entry.name))
        : [path.join(dir, entry.name)],
    )

// The parser handles minified HTML, quoted/unquoted attributes, XML entities,
// and script text. Its output is inspected only and is never rendered.
function inspect(source, xmlMode = false) {
  const elements = []
  const items = []
  let item
  sanitizeHtml(source, {
    allowedTags: false,
    allowedAttributes: false,
    allowVulnerableTags: true,
    parser: { xmlMode, lowerCaseTags: !xmlMode },
    transformTags: {
      '*': (tagName, attribs) => {
        if (xmlMode && tagName === 'item') item = {}
        return { tagName, attribs }
      },
    },
    exclusiveFilter: frame => {
      elements.push({ tag: frame.tag, attrs: frame.attribs, text: frame.text })
      if (item && frame.tag === 'item') {
        items.push(item)
        item = undefined
      } else if (item) {
        item[frame.tag] = frame.text
      }
      return false
    },
  })
  return { elements, items }
}

function absoluteUrl(value, label) {
  assert.ok(value, `Missing ${label}`)
  const url = new URL(value)
  assert.ok(
    ['http:', 'https:'].includes(url.protocol),
    `Invalid ${label}: ${value}`,
  )
  return url
}

function validLanguage(value, label) {
  assert.ok(value, `Missing language: ${label}`)
  assert.equal(
    Intl.getCanonicalLocales(value)[0],
    value,
    `Invalid language: ${label}`,
  )
  return value
}

export async function verifyContentBuild(outputRoot = 'dist') {
  const root = path.resolve(outputRoot)
  const htmlFiles = walk(root).filter(file => file.endsWith('.html'))
  const pages = htmlFiles.map(file => {
    const { elements } = inspect(fs.readFileSync(file, 'utf8'))
    const meta = key =>
      elements.find(
        element =>
          element.tag === 'meta' &&
          (element.attrs.property || element.attrs.name) === key,
      )?.attrs.content
    const canonical = absoluteUrl(
      elements.find(
        element => element.tag === 'link' && element.attrs.rel === 'canonical',
      )?.attrs.href,
      `canonical in ${path.relative(root, file)}`,
    )
    return { file, elements, meta, canonical }
  })
  const homepage = pages.find(
    page => page.file === path.join(root, 'index.html'),
  )
  assert.ok(homepage, 'Missing homepage')
  const base = homepage.canonical.pathname
  const localFile = url => {
    assert.equal(
      url.origin,
      homepage.canonical.origin,
      `Unexpected local origin: ${url}`,
    )
    assert.ok(
      url.pathname.startsWith(base),
      `URL is outside deployment base: ${url}`,
    )
    const relative = decodeURIComponent(url.pathname.slice(base.length))
    const target = path.resolve(root, relative)
    assert.ok(
      target === root || target.startsWith(`${root}${path.sep}`),
      `Invalid local path: ${url}`,
    )
    return [target, path.join(target, 'index.html')].find(
      candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
    )
  }

  const posts = new Map()
  const imageDimensions = new Map()
  let categoryPages = 0
  for (const page of pages) {
    const label = path.relative(root, page.file)
    assert.equal(
      localFile(page.canonical),
      page.file,
      `Canonical points at another page: ${label}`,
    )
    const image = absoluteUrl(page.meta('og:image'), `og:image in ${label}`)
    assert.equal(
      page.meta('twitter:image'),
      image.href,
      `Share images differ: ${label}`,
    )
    if (image.origin === homepage.canonical.origin) {
      const imageFile = localFile(image)
      assert.ok(imageFile, `Missing local share image: ${image}`)
      const width = page.meta('og:image:width')
      const height = page.meta('og:image:height')
      if (width || height) {
        if (!imageDimensions.has(imageFile))
          imageDimensions.set(imageFile, await sharp(imageFile).metadata())
        const dimensions = imageDimensions.get(imageFile)
        if (width)
          assert.equal(
            Number(width),
            dimensions.width,
            `Share image width mismatch: ${label}`,
          )
        if (height)
          assert.equal(
            Number(height),
            dimensions.height,
            `Share image height mismatch: ${label}`,
          )
      }
    }

    if (label.startsWith(`archive${path.sep}category${path.sep}`)) {
      categoryPages++
      const categoryPath = decodeURIComponent(page.canonical.pathname)
      assert.equal(
        categoryPath,
        categoryPath.toLowerCase(),
        `Category canonical must be lowercase: ${label}`,
      )
    }
    if (!label.startsWith(`posts${path.sep}`)) continue

    const language = validLanguage(
      page.elements.find(element => element.tag === 'html')?.attrs.lang,
      label,
    )
    const jsonLd = page.elements
      .filter(
        element =>
          element.tag === 'script' &&
          element.attrs.type === 'application/ld+json',
      )
      .flatMap(element => {
        const parsed = JSON.parse(element.text)
        return Array.isArray(parsed) ? parsed : parsed['@graph'] || [parsed]
      })
      .find(value => value['@type'] === 'BlogPosting')
    assert.ok(jsonLd, `Missing BlogPosting structured data: ${label}`)
    assert.equal(
      jsonLd.inLanguage,
      language,
      `HTML/JSON-LD language mismatch: ${label}`,
    )
    assert.equal(
      jsonLd.mainEntityOfPage,
      page.canonical.href,
      `JSON-LD canonical mismatch: ${label}`,
    )
    assert.ok(
      !posts.has(page.canonical.href),
      `Duplicate article URL: ${label}`,
    )
    posts.set(page.canonical.href, { ...page, jsonLd, language })
  }

  const published = walk(path.join(projectRoot, 'src/content/posts'))
    .filter(file => /\.mdx?$/.test(file))
    .map(file => ({
      file,
      data: parseFrontmatter(fs.readFileSync(file, 'utf8')).frontmatter,
    }))
    .filter(post => post.data.draft !== true)
  for (const post of published)
    validLanguage(post.data.lang, path.relative(projectRoot, post.file))
  assert.equal(
    posts.size,
    published.length,
    'Built articles must match published source count',
  )
  assert.deepEqual(
    [...posts.values()]
      .map(post => `${post.jsonLd.headline}\n${post.language}`)
      .sort(),
    published.map(post => `${post.data.title}\n${post.data.lang}`).sort(),
    'Built article titles/languages must match published sources',
  )

  const feed = inspect(
    fs.readFileSync(path.join(root, 'rss.xml'), 'utf8'),
    true,
  )
  const feedLanguage = feed.elements.find(
    element => element.tag === 'language',
  )?.text
  assert.equal(
    feedLanguage,
    homepage.elements.find(element => element.tag === 'html')?.attrs.lang,
    'Feed must use the site language',
  )
  assert.equal(
    feed.items.length,
    posts.size,
    'RSS must contain every published article exactly once',
  )
  assert.deepEqual(
    feed.items.map(item => item.link).sort(),
    [...posts.keys()].sort(),
    'RSS links must match published canonical URLs',
  )
  for (const item of feed.items) {
    const post = posts.get(item.link)
    assert.equal(
      item.title,
      post.jsonLd.headline,
      `RSS title mismatch: ${item.link}`,
    )
    assert.equal(
      new Date(item.pubDate).toISOString().slice(0, 10),
      post.jsonLd.datePublished,
      `RSS publication date mismatch: ${item.link}`,
    )
    assert.ok(item.description?.trim(), `Missing RSS summary: ${item.link}`)
    assert.ok(
      item['content:encoded']?.trim(),
      `Missing RSS content: ${item.link}`,
    )
    const content = inspect(item['content:encoded'])
    assert.ok(
      content.elements.some(
        element => element.tag === 'a' && element.attrs.href === item.link,
      ),
      `Missing RSS full-article link: ${item.link}`,
    )
    for (const element of content.elements) {
      assert.ok(
        ['p', 'a'].includes(element.tag),
        `Unexpected markup in RSS summary: ${item.link} (${element.tag})`,
      )
      assert.doesNotMatch(
        element.text,
        /(?:^|\n)\s*import\s+.+(?:from\s+['"]|['"])|<\/?Image(?:\s|>)/,
        `Uncompiled MDX in RSS: ${item.link}`,
      )
    }
  }

  const redirects = fs
    .readFileSync(path.join(root, '_redirects'), 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split(/\s+/))
    .filter(([from]) => from.includes('/archive/category/'))
  assert.ok(redirects.length, 'Missing legacy category redirects')
  for (const [from, to, status] of redirects) {
    assert.equal(status, '301', `Category redirect must be permanent: ${from}`)
    assert.equal(
      to,
      to.toLowerCase(),
      `Category redirect target must be lowercase: ${from}`,
    )
    const destination = absoluteUrl(
      new URL(to, homepage.canonical).href,
      `redirect target for ${from}`,
    )
    const destinationPage = pages.find(
      page => page.file === localFile(destination),
    )
    assert.ok(
      destinationPage,
      `Missing category redirect target: ${from} → ${to}`,
    )
    assert.equal(
      destinationPage.canonical.href,
      destination.href,
      `Category redirect must target a canonical page: ${from}`,
    )
  }
  return {
    contentVerified: true,
    articles: posts.size,
    rssItems: feed.items.length,
    categoryPages,
    categoryRedirects: redirects.length,
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  console.log(JSON.stringify(await verifyContentBuild(process.argv[2]), null, 2))
