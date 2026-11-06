import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

// Resolve through the renderer so styles and fonts always match its KaTeX version.
const require = createRequire(import.meta.url)
const katexRequire = createRequire(require.resolve('rehype-katex'))
const packageUrl = pathToFileURL(katexRequire.resolve('katex/package.json'))
const { version } = katexRequire('katex/package.json')
const assetPath = `katex/${version}/`
export const katexStylesheet = `/${assetPath}katex.min.css`

async function getAssets() {
  const original = await readFile(
    new URL('dist/katex.min.css', packageUrl),
    'utf8',
  )
  const woff2Css = original.replace(/src:([^;}]+)/g, (_, sources) => {
    const woff2 = sources.split(',').find(source => source.includes('.woff2'))
    if (!woff2) throw new Error('KaTeX font is missing its WOFF2 source')
    return `src:${woff2}`
  })
  // Wide equations scroll locally instead of widening the entire page.
  const css = `${woff2Css}
.katex-display{overflow-x:auto;overflow-y:hidden;padding:.25em 0}.katex-display>.katex{width:max-content;min-width:100%}
`
  const assets = new Map([
    [`${assetPath}katex.min.css`, Buffer.from(css)],
    [`${assetPath}LICENSE`, await readFile(new URL('LICENSE', packageUrl))],
  ])
  for (const [, font] of css.matchAll(/url\((fonts\/[^)]+\.woff2)\)/g)) {
    assets.set(
      `${assetPath}${font}`,
      await readFile(new URL(`dist/${font}`, packageUrl)),
    )
  }
  return assets
}

export default function katexAssets() {
  let base = '/'
  return {
    name: 'local-katex-assets',
    hooks: {
      'astro:config:done': ({ config }) => {
        base = `${config.base.replace(/\/$/, '')}/`
      },
      'astro:server:setup': async ({ server }) => {
        const assets = await getAssets()
        server.middlewares.use((request, response, next) => {
          if (!['GET', 'HEAD'].includes(request.method)) return next()
          const pathname = new URL(
            request.originalUrl || request.url,
            'http://localhost',
          ).pathname
          if (!pathname.startsWith(base)) return next()
          const name = pathname.slice(base.length)
          const content = assets.get(name)
          if (!content) return next()
          response.setHeader(
            'Content-Type',
            name.endsWith('.css')
              ? 'text/css; charset=utf-8'
              : name.endsWith('.woff2')
                ? 'font/woff2'
                : 'text/plain; charset=utf-8',
          )
          response.setHeader('Content-Length', content.length)
          response.end(request.method === 'HEAD' ? undefined : content)
        })
      },
      'astro:build:done': async ({ dir }) => {
        for (const [name, content] of await getAssets()) {
          const destination = new URL(name, dir)
          await mkdir(new URL('.', destination), { recursive: true })
          await writeFile(destination, content)
        }
      },
    },
  }
}
