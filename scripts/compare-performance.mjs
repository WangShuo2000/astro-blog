import assert from 'node:assert/strict'
import fs from 'node:fs'

const [beforeFile, afterFile, outputFile] = process.argv.slice(2)
if (!beforeFile || !afterFile)
  throw new Error(
    'Usage: node scripts/compare-performance.mjs <before-summary.json> <after-summary.json> [output.json]',
  )
const baselineRows = JSON.parse(fs.readFileSync(beforeFile, 'utf8'))
const currentRows = JSON.parse(fs.readFileSync(afterFile, 'utf8'))
const median = values =>
  values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)]
const names = [...new Set(baselineRows.map(row => row.name))].sort()
assert.deepEqual(
  [...new Set(currentRows.map(row => row.name))].sort(),
  names,
  'Audited routes must match',
)
const keys = ['score', 'fcp', 'lcp', 'cls', 'tbt', 'si', 'bytes']
const result = {
  passed: true,
  method:
    'per-route median; timing noise budget max(5ms, 0.5%); no score or payload regression; CLS allowance 0.001',
  pages: [],
}
for (const name of names) {
  const oldRows = baselineRows.filter(row => row.name === name)
  const newRows = currentRows.filter(row => row.name === name)
  assert.ok(
    oldRows.length >= 3 && newRows.length >= 3,
    'At least three measurements are required',
  )
  const oldMetrics = Object.fromEntries(
    keys.map(key => [key, median(oldRows.map(row => row[key]))]),
  )
  const newMetrics = Object.fromEntries(
    keys.map(key => [key, median(newRows.map(row => row[key]))]),
  )
  for (const metric of [
    ...Object.values(oldMetrics),
    ...Object.values(newMetrics),
  ])
    assert.ok(Number.isFinite(metric), 'Every metric must be present')
  const regressions = []
  if (newMetrics.score < oldMetrics.score) regressions.push('performance score')
  if (newMetrics.bytes > oldMetrics.bytes) regressions.push('transferred bytes')
  if (newMetrics.cls > oldMetrics.cls + 0.001) regressions.push('CLS')
  for (const key of ['fcp', 'lcp', 'si', 'tbt'])
    if (
      newMetrics[key] >
      oldMetrics[key] + Math.max(5, oldMetrics[key] * 0.005)
    )
      regressions.push(key)
  result.pages.push({
    name,
    before: oldMetrics,
    after: newMetrics,
    regressions,
  })
  if (regressions.length) result.passed = false
}
if (outputFile)
  fs.writeFileSync(outputFile, `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))
if (!result.passed) process.exitCode = 1
