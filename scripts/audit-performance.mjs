import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
const toolsRoot = process.env.AUDIT_TOOLS
if (!toolsRoot)
  throw new Error(
    'Set AUDIT_TOOLS to the temporary directory containing lighthouse and chrome-launcher.',
  )
const require = createRequire(
  path.join(path.resolve(toolsRoot), 'package.json'),
)
const lighthousePath = require.resolve('lighthouse')
const { default: lighthouse } = await import(pathToFileURL(lighthousePath).href)
const chromeLauncher = await import(
  pathToFileURL(require.resolve('chrome-launcher')).href
)
const mode = process.argv[5] || 'mobile'
if (!['mobile', 'desktop'].includes(mode))
  throw new Error('Mode must be mobile or desktop.')
const desktopConfig =
  mode === 'desktop'
    ? (
        await import(
          new URL('./config/desktop-config.js', pathToFileURL(lighthousePath))
        )
      ).default
    : undefined
const output = path.resolve(
  process.env.AUDIT_OUTPUT || path.join(os.tmpdir(), 'trouvaille-performance'),
)

const label = process.argv[2]
const port = process.argv[3]
const rounds = Number(process.argv[4] || 3)
if (
  !/^[a-z0-9-]+$/.test(label || '') ||
  !Number.isInteger(Number(port)) ||
  Number(port) < 1 ||
  Number(port) > 65535 ||
  !Number.isInteger(rounds) ||
  rounds < 1 ||
  rounds > 10
)
  throw new Error(
    'Usage: node scripts/audit-performance.mjs <label> <port> [rounds 1..10] [mobile|desktop]',
  )
const routes = [
  ['home', '/'],
  ['article', '/posts/technology/react/react19/'],
  ['archive', '/archive/'],
  ['about', '/about/'],
  ['photography', '/posts/photography/2023-10-1/'],
]
if (process.env.AUDIT_ROUTE) {
  const chosen = routes.filter(([name]) => name === process.env.AUDIT_ROUTE)
  if (!chosen.length) throw new Error('Unknown AUDIT_ROUTE')
  routes.splice(0, routes.length, ...chosen)
}
const chrome = await chromeLauncher.launch({
  chromePath: process.env.CHROME_PATH,
  chromeFlags: [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--disable-extensions',
  ],
})
await fs.mkdir(output, { recursive: true })
const all = []
try {
  for (let round = 1; round <= rounds; round++)
    for (const [name, route] of routes) {
      const result = await lighthouse(
        `http://127.0.0.1:${port}${route}`,
        {
          port: chrome.port,
          output: 'json',
          logLevel: 'error',
          onlyCategories: ['performance'],
          formFactor: mode,
          throttlingMethod: process.env.AUDIT_THROTTLING || 'simulate',
          maxWaitForLoad: 15000,
          blockedUrlPatterns: [
            '*googletagmanager.com/*',
            '*giscus.app/*',
            '*api.github.com/*',
            '*cdn.staticfile.net/*',
          ],
        },
        desktopConfig,
      )
      const lhr = result.lhr
      if (lhr.runtimeError) throw new Error(lhr.runtimeError.message)
      await fs.writeFile(
        `${output}/${label}-environment.json`,
        JSON.stringify(
          {
            node: process.version,
            lighthouse: lhr.lighthouseVersion,
            userAgent: lhr.userAgent,
            mode,
            config: lhr.configSettings,
          },
          null,
          2,
        ),
      )
      await fs.writeFile(
        `${output}/${label}-${name}-${round}.json`,
        JSON.stringify(lhr),
      )
      const row = {
        label,
        name,
        round,
        score: Math.round(lhr.categories.performance.score * 100),
      }
      for (const [key, id] of Object.entries({
        fcp: 'first-contentful-paint',
        lcp: 'largest-contentful-paint',
        cls: 'cumulative-layout-shift',
        tbt: 'total-blocking-time',
        si: 'speed-index',
        bytes: 'total-byte-weight',
      }))
        row[key] = lhr.audits[id]?.numericValue
      all.push(row)
      console.log(JSON.stringify(row))
      await fs.writeFile(
        `${output}/${label}-summary.json`,
        JSON.stringify(all, null, 2),
      )
    }
} finally {
  await chrome.kill()
}
