interface RssPost {
  data: {
    title: string
    published: Date
    description?: string
    lang?: string
  }
}

/** Escape text used inside the HTML that feed readers render. */
export function escapeRssHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** MDX requires compilation, so the feed deliberately uses only frontmatter. */
export function createRssSummaryItem(
  post: RssPost,
  postPath: string,
  site: URL | string,
  defaultLang: string,
) {
  const isChinese = (post.data.lang || defaultLang)
    .toLowerCase()
    .startsWith('zh')
  const readMore = isChinese ? '阅读全文' : 'Read the full article'
  const summary =
    post.data.description?.trim() ||
    (isChinese
      ? `阅读《${post.data.title}》，查看完整文章。`
      : `Read “${post.data.title}” on the blog.`)
  const link = new URL(postPath, site).href
  const escapedSummary = escapeRssHtml(summary)

  return {
    title: post.data.title,
    pubDate: post.data.published,
    // RSS descriptions can contain HTML; the RSS serializer escapes the outer XML.
    description: escapedSummary,
    link,
    content: `<p>${escapedSummary}</p><p><a href="${escapeRssHtml(link)}">${readMore}</a></p>`,
  }
}
