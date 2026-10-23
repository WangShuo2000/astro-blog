export const UNCATEGORIZED_SLUG = 'uncategorized'

// Display names can change independently of the permanent category URLs.
const CATEGORY_NAMES: Record<string, string> = {
  technology: 'Technology',
  tool: 'Tool',
  photography: 'Photography',
  test: 'Test',
  guides: 'Guides',
  examples: 'Examples',
  [UNCATEGORIZED_SLUG]: 'Uncategorized',
}

export function getCategorySlug(category?: string | null): string {
  return (
    (category || '')
      .normalize('NFKC')
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M}]+/gu, '-')
      .replace(/^-+|-+$/g, '') || UNCATEGORIZED_SLUG
  )
}

export function getCategoryName(category?: string | null): string {
  const slug = getCategorySlug(category)
  if (Object.hasOwn(CATEGORY_NAMES, slug)) return CATEGORY_NAMES[slug]
  return slug.replace(
    /(^|-)(\p{L})/gu,
    (_, separator, letter) => `${separator ? ' ' : ''}${letter.toUpperCase()}`,
  )
}

export type Category = {
  slug: string
  name: string
  count: number
}

export function collectCategories(
  categories: Iterable<string | null | undefined>,
): Category[] {
  const counts = new Map<string, number>()
  for (const category of categories) {
    const slug = getCategorySlug(category)
    counts.set(slug, (counts.get(slug) || 0) + 1)
  }
  return Array.from(counts, ([slug, count]) => ({
    slug,
    name: getCategoryName(slug),
    count,
  })).sort((a, b) => a.slug.localeCompare(b.slug))
}
