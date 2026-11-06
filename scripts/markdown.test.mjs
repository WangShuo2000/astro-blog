import assert from 'node:assert/strict'
import test from 'node:test'
import config from '../astro.config.mjs'

const markdown = await config.markdown.processor.createRenderer({})

test('heading IDs, custom heading links and reading metadata survive migration', async () => {
  const result = await markdown.render(
    '# A useful note\n\nA short introduction.\n\n## Details\n\nMore words here.',
  )
  assert.equal(result.metadata.headings[0].slug, 'a-useful-note')
  assert.equal(result.metadata.headings[1].slug, 'details')
  assert.match(result.code, /class="anchor"/)
  assert.ok(result.metadata.frontmatter.minutes >= 1)
  assert.ok(result.metadata.frontmatter.words > 0)
  assert.equal(result.metadata.frontmatter.excerpt, 'A short introduction.')
})

test('inline and display math render through KaTeX', async () => {
  const result = await markdown.render(
    'Inline $x^2$ formula.\n\n$$\nE = mc^2\n$$',
  )
  assert.match(result.code, /class="katex"/)
  assert.match(result.code, /katex-display/)
  assert.equal(result.metadata.frontmatter.hasMath, true)
})

test('math fences render as formulas and request the local math stylesheet', async () => {
  const result = await markdown.render('```math\nx^2 + y^2 = z^2\n```')
  assert.match(result.code, /class="katex"/)
  assert.match(result.code, /katex-display/)
  assert.equal(result.metadata.frontmatter.hasMath, true)
})

test('math metadata distinguishes formulas from plain text and code samples', async () => {
  for (const source of ['Inline $x^2$ formula.', '$$\nE = mc^2\n$$']) {
    const result = await markdown.render(source)
    assert.equal(result.metadata.frontmatter.hasMath, true)
  }
  for (const source of [
    'An ordinary paragraph.',
    '`$x^2$`',
    '```tex\n$x^2$\n```',
    'Escaped \\$x^2\\$',
  ]) {
    const result = await markdown.render(source)
    assert.equal(result.metadata.frontmatter.hasMath, false)
  }
})

test('all five directive admonitions retain their rendered components', async () => {
  const kinds = ['tip', 'note', 'important', 'caution', 'warning']
  const result = await markdown.render(
    kinds.map(kind => `:::${kind}\nA ${kind} message.\n:::`).join('\n\n'),
  )
  for (const kind of kinds) assert.ok(result.code.includes(`bdm-${kind}`))
})

test('GitHub-style alerts are converted to admonitions', async () => {
  const result = await markdown.render('> [!NOTE]\n> Keep this information.')
  assert.match(result.code, /bdm-note/)
})

test('repository directive keeps the real GitHub link', async () => {
  const result = await markdown.render(
    '::github{repo="WangShuo2000/astro-blog"}',
  )
  assert.match(result.code, /class="card-github/)
  assert.ok(result.code.includes('https://github.com/WangShuo2000/astro-blog'))
})

test('tables and syntax-highlighted code remain available', async () => {
  const result = await markdown.render(
    '| Name | Value |\n| --- | --- |\n| Astro | 7 |\n\n```js\nconst value = 1\n```',
  )
  assert.match(result.code, /<table>/)
  assert.match(result.code, /<pre[^>]*class="astro-code/)
  assert.match(result.code, /value/)
})
