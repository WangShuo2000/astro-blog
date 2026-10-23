import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { normalizeLanguageTag } from '../src/utils/language-utils.ts'

const newPostScript = fileURLToPath(new URL('./new-post.js', import.meta.url))

test('language tags support legacy separators, script variants, and other languages', () => {
  assert.equal(normalizeLanguageTag('zh_CN'), 'zh-CN')
  assert.equal(normalizeLanguageTag(' zh_hant_tw '), 'zh-Hant-TW')
  assert.equal(normalizeLanguageTag('en'), 'en')
  assert.equal(normalizeLanguageTag('pt-br'), 'pt-BR')
  assert.throws(() => normalizeLanguageTag(''), RangeError)
  assert.throws(() => normalizeLanguageTag('not a language'), RangeError)
})

test('all posts explicitly declare a canonical language tag', () => {
  const root = fileURLToPath(new URL('../src/content/posts/', import.meta.url))
  const files = readdirSync(root, { recursive: true }).filter(file => /\.mdx?$/.test(file))
  assert.ok(files.length > 0)
  for (const file of files) {
    const frontmatter = readFileSync(join(root, file), 'utf8').split('---', 3)[1]
    const language = frontmatter.match(/^lang:[ \t]*(['"]?)([^'"\r\n]+)\1[ \t]*$/m)?.[2].trim()
    assert.ok(language, `${file} must declare lang`)
    assert.equal(language, normalizeLanguageTag(language), `${file} must use a canonical language tag`)
  }
})

test('new posts default to Chinese, allow a language override, and reject invalid tags', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'blog-language-'))
  const posts = join(cwd, 'src/content/posts')
  mkdirSync(posts, { recursive: true })
  // Preserve Node flags when tests are run with explicit TypeScript support.
  const nodeArgs = process.execArgv.filter(arg => arg !== '--test')
  try {
    execFileSync(process.execPath, [...nodeArgs, newPostScript, 'chinese'], { cwd })
    assert.match(readFileSync(join(posts, 'chinese.md'), 'utf8'), /^lang: 'zh-CN'$/m)

    execFileSync(process.execPath, [...nodeArgs, newPostScript, 'english.mdx', '--lang', 'en'], { cwd })
    assert.match(readFileSync(join(posts, 'english.mdx'), 'utf8'), /^lang: 'en'$/m)

    execFileSync(process.execPath, [...nodeArgs, newPostScript, 'traditional', '--lang=zh_TW'], { cwd })
    assert.match(readFileSync(join(posts, 'traditional.md'), 'utf8'), /^lang: 'zh-TW'$/m)

    const result = spawnSync(process.execPath, [...nodeArgs, newPostScript, 'invalid', '--lang', 'not a language'], { cwd, encoding: 'utf8' })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Error:/)
    assert.deepEqual(readdirSync(posts).sort(), ['chinese.md', 'english.mdx', 'traditional.md'])
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})
