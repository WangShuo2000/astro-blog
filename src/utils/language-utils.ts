/** Normalize language tags, including the underscore form used by older posts. */
export function normalizeLanguageTag(language: string): string {
  const normalized = Intl.getCanonicalLocales(
    language.trim().replaceAll('_', '-'),
  )[0]

  if (!normalized) {
    throw new RangeError('A language tag is required, such as zh-CN or en.')
  }

  return normalized
}
