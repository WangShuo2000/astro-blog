import assert from 'node:assert/strict'
import test from 'node:test'
import {
  collectCategories,
  getCategoryName,
  getCategorySlug,
} from '../src/utils/category-utils.ts'

test('case variants share one permanent slug and display name', () => {
  assert.deepEqual(collectCategories(['Technology', 'technology', ' Tool ']), [
    { slug: 'technology', name: 'Technology', count: 2 },
    { slug: 'tool', name: 'Tool', count: 1 },
  ])
  assert.equal(getCategorySlug('TECHNOLOGY'), 'technology')
  assert.equal(getCategoryName('technology'), 'Technology')
})

test('missing categories, the legacy sentinel, and the display label agree', () => {
  const categories = ['', ' ', undefined, null, '__uncategorized__', 'Uncategorized']
  assert.deepEqual(collectCategories(categories), [
    { slug: 'uncategorized', name: 'Uncategorized', count: categories.length },
  ])
})

test('category slugs stay single-segment paths and preserve non-Latin names', () => {
  assert.equal(getCategorySlug(' Front / End '), 'front-end')
  assert.equal(getCategorySlug('Ｆｒｏｎｔ End'), 'front-end')
  assert.equal(getCategoryName('front-end'), 'Front End')
  assert.equal(getCategorySlug('摄影'), '摄影')
  assert.equal(getCategoryName('摄影'), '摄影')
  assert.equal(getCategoryName('constructor'), 'Constructor')
})
