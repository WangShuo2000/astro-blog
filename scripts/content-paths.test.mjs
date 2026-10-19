import assert from 'node:assert/strict'
import test from 'node:test'
import { getPostAssetBasePath } from '../src/utils/content-paths.ts'

test('index posts retain their source directory after Content Layer removes index from the URL ID', () => {
  assert.equal(
    getPostAssetBasePath({
      id: 'guide',
      filePath: 'src/content/posts/guide/index.md',
    }),
    'content/posts/guide',
  )
})

test('custom URL IDs do not change relative cover-image resolution', () => {
  assert.equal(
    getPostAssetBasePath({
      id: 'custom-url',
      filePath: 'src/content/posts/technology/article.mdx',
    }),
    'content/posts/technology',
  )
})

test('source path separators and root posts are handled consistently', () => {
  assert.equal(
    getPostAssetBasePath({
      id: 'article',
      filePath: 'src\\content\\posts\\article.md',
    }),
    'content/posts',
  )
  assert.equal(
    getPostAssetBasePath({ id: 'technology/article' }),
    'content/posts/technology',
  )
})
