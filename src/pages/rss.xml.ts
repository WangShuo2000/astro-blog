import { siteConfig } from '@/config'
import rss from '@astrojs/rss'
import { getSortedPosts } from '@utils/content-utils'
import { normalizeLanguageTag } from '@utils/language-utils'
import { createRssSummaryItem, escapeRssHtml } from '@utils/rss-utils'
import { getPostUrlBySlug } from '@utils/url-utils'
import type { APIContext } from 'astro'

export async function GET(context: APIContext) {
  const blog = await getSortedPosts()
  const site = context.site ?? 'https://trouvaille-blog.com'

  return rss({
    title: siteConfig.title,
    description: siteConfig.subtitle || 'No description',
    site,
    items: blog.map(post =>
      createRssSummaryItem(
        post,
        getPostUrlBySlug(post.id),
        site,
        siteConfig.lang,
      ),
    ),
    customData: `<language>${escapeRssHtml(normalizeLanguageTag(siteConfig.lang))}</language>`,
  })
}
