import { posix } from 'node:path'
import { getImage } from 'astro:assets'
import defaultImage from '../assets/images/banner.jpeg'
import { url } from './url-utils'

export interface SocialImage {
  src: string
  alt: string
  width?: number
  height?: number
  type?: string
}

const images = import.meta.glob<ImageMetadata>(
  '/src/**/*.{avif,gif,jpeg,jpg,png,svg,webp}',
  { import: 'default' },
)

/** Share cards use a real JPEG; source-relative covers follow the article file. */
export async function getSocialImage(
  source = '',
  basePath = '',
  alt = 'City skyline at night — Trouvaille',
): Promise<SocialImage> {
  if (/^https?:\/\//.test(source)) {
    return { src: source, alt }
  }
  if (source.startsWith('/')) return { src: url(source), alt }
  let image = defaultImage
  if (source) {
    const key = posix.join('/src', basePath, source)
    const load = images[key]
    if (!load) throw new Error(`Social image not found: ${key}`)
    image = await load()
  }
  // Astro avoids upscaling, so request a crop that fits inside the source image.
  const scale = Math.min(1, image.width / 1200, image.height / 630)
  const width = Math.max(1, Math.floor(1200 * scale))
  const height = Math.max(1, Math.floor(630 * scale))
  const result = await getImage({
    src: image,
    width,
    height,
    layout: 'none',
    fit: 'cover',
    format: 'jpeg',
    quality: 85,
  })
  return { src: result.src, alt, width, height, type: 'image/jpeg' }
}
