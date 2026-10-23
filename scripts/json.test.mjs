import assert from 'node:assert/strict'
import test from 'node:test'
import { serializeJson } from '../src/utils/json-utils.ts'

test('inline JSON cannot close its script element and preserves the original data', () => {
  const data = {
    title: 'How </script><script>alert("example")</script> works',
    description: '<!-- HTML, 中文, quotes " and a backslash \\ -->',
    values: ['<img src="example">', null, true, 42],
  }
  const serialized = serializeJson(data)
  assert.ok(!serialized.includes('<'))
  assert.ok(serialized.includes('\\u003c/script>'))
  assert.deepEqual(JSON.parse(serialized), data)
})
