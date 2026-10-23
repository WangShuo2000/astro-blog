import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

// A small publisher's mark: a serif T cut into a paper bookmark.
// Keep the letter as a path so rendering never depends on an installed font.
const palettes = {
  light: { background: '#535e44', foreground: '#f6f3ed' },
  dark: { background: '#eae7dd', foreground: '#252724' },
}
const bookmark = 'M12 2H52A6 6 0 0 1 58 8V62L32 54L6 62V8A6 6 0 0 1 12 2Z'
const monogram = 'M14 13H50L51 25H48L45 17H36V41C36 44 38 45 43 45V48H21V45C26 45 28 44 28 41V17H19L16 25H13Z'

function svgFor(theme, adaptive = false) {
  const { background, foreground } = palettes[theme]
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <title>Trouvaille</title>
  ${adaptive ? `<style>@media (prefers-color-scheme: dark) { .bookmark { fill: ${palettes.dark.background}; } .monogram { fill: ${palettes.dark.foreground}; } }</style>` : ''}
  <path class="bookmark" fill="${background}" d="${bookmark}"/>
  <path class="monogram" fill="${foreground}" d="${monogram}"/>
</svg>
`
}

const directory = new URL('../public/favicon/', import.meta.url)
await mkdir(directory, { recursive: true })
await writeFile(new URL('trouvaille.svg', directory), svgFor('light', true))
for (const theme of Object.keys(palettes)) {
  for (const size of [16, 32, 192]) {
    await sharp(Buffer.from(svgFor(theme)), { density: 384 })
      .resize(size, size)
      .png()
      .toFile(fileURLToPath(new URL(`trouvaille-${theme}-${size}.png`, directory)))
  }
}
// iOS masks the square touch icon itself; give it an opaque paper background.
await sharp(Buffer.from(svgFor('light')), { density: 384 })
  .resize(144, 144)
  .extend({ top: 18, bottom: 18, left: 18, right: 18, background: '#f6f3ed' })
  .flatten({ background: '#f6f3ed' })
  .png()
  .toFile(fileURLToPath(new URL('trouvaille-apple-touch.png', directory)))
console.log('Generated Trouvaille SVG, light/dark PNGs, and Apple touch icon.')
