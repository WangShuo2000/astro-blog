import assert from 'node:assert/strict'
import test from 'node:test'
import { getRssString } from '@astrojs/rss'
import { createRssSummaryItem } from '../src/utils/rss-utils.ts'

const post = {
  data: {
    title: 'A photo journal',
    published: new Date('2026-10-01T00:00:00.000Z'),
    description: 'Photos from a day by the sea.',
    lang: 'en',
  },
  get body() {
    throw new Error('RSS must not read uncompiled Markdown or MDX bodies')
  },
}

test('summary items keep article metadata and never read MDX source', async () => {
  const item = createRssSummaryItem(
    post,
    '/posts/photo-journal/',
    'https://example.com',
    'en',
  )
  assert.equal(item.title, post.data.title)
  assert.equal(item.pubDate, post.data.published)
  assert.equal(item.description, post.data.description)
  assert.equal(item.link, 'https://example.com/posts/photo-journal/')
  assert.equal(
    item.content,
    '<p>Photos from a day by the sea.</p><p><a href="https://example.com/posts/photo-journal/">Read the full article</a></p>',
  )

  const xml = await getRssString({
    title: 'Blog',
    description: 'Notes',
    site: 'https://example.com',
    items: [item],
  })
  assert.match(xml, /<pubDate>Thu, 01 Oct 2026 00:00:00 GMT<\/pubDate>/)
  assert.match(
    xml,
    /<link>https:\/\/example\.com\/posts\/photo-journal\/<\/link>/,
  )
  assert.doesNotMatch(xml, /import |astro:assets|&lt;Image|&lt;script/)
})

test('text and link attributes are escaped before RSS XML serialization', async () => {
  const item = createRssSummaryItem(
    {
      data: {
        ...post.data,
        title: 'A & B <notes>',
        description: 'A & B <script>alert("x")</script> \'quote\'',
      },
    },
    '/blog/posts/example/?first=1&second=2',
    new URL('https://example.com'),
    'en',
  )
  assert.equal(item.title, 'A & B <notes>')
  assert.equal(
    item.description,
    'A &amp; B &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &#39;quote&#39;',
  )
  assert.match(
    item.content,
    /href="https:\/\/example\.com\/blog\/posts\/example\/\?first=1&amp;second=2"/,
  )
  assert.doesNotMatch(item.content, /<script>/)

  const xml = await getRssString({
    title: 'Blog',
    description: 'Notes',
    site: 'https://example.com',
    items: [item],
  })
  assert.match(xml, /<title>A &amp; B &lt;notes&gt;<\/title>/)
  assert.match(xml, /<description>A &amp;amp; B &amp;lt;script&amp;gt;/)
  assert.match(
    xml,
    /<link>https:\/\/example\.com\/blog\/posts\/example\/\?first=1&amp;second=2<\/link>/,
  )
})

test('missing or blank descriptions use readable fallbacks without reading the body', () => {
  for (const description of [undefined, '', '  \n  ']) {
    const item = createRssSummaryItem(
      {
        data: { ...post.data, description },
        get body() {
          return post.body
        },
      },
      '/posts/photo-journal/',
      'https://example.com',
      'en',
    )
    assert.equal(item.description, 'Read “A photo journal” on the blog.')
  }
})

test('Chinese articles and missing article languages use the appropriate read-more text', () => {
  for (const lang of ['zh-CN', 'zh_TW', '']) {
    const item = createRssSummaryItem(
      { data: { ...post.data, title: '旅行札记', description: '', lang } },
      '/blog/posts/journal/',
      'https://example.com',
      'zh_CN',
    )
    assert.equal(item.description, '阅读《旅行札记》，查看完整文章。')
    assert.match(item.content, />阅读全文<\/a>/)
    assert.equal(item.link, 'https://example.com/blog/posts/journal/')
  }
})
