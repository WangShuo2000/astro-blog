/** Serialize data for inline script elements without allowing HTML termination. */
export function serializeJson(value: unknown): string {
  const serialized = JSON.stringify(value)
  if (serialized === undefined) throw new TypeError('A JSON value is required')
  return serialized.replaceAll('<', '\\u003c')
}
