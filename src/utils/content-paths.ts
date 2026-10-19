import { posix } from 'node:path'

/** Resolve relative cover images from the source file, independently of its URL ID. */
export function getPostAssetBasePath(entry: {
  id: string
  filePath?: string
}): string {
  const source = (
    entry.filePath || `src/content/posts/${entry.id}.md`
  ).replaceAll('\\', '/')
  return posix.dirname(source.replace(/^(?:\.\/)?src\//, ''))
}
