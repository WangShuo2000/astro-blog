import type { Favicon } from '@/types/config.ts'

export const defaultFavicons: Favicon[] = [
  // Unconditional light icons also serve browsers without media-query support.
  ...([16, 32, 192] as const).map(size => ({
    src: `/favicon/trouvaille-light-${size}.png`,
    sizes: `${size}x${size}`,
    type: 'image/png',
  })),
  ...([16, 32, 192] as const).map(size => ({
    src: `/favicon/trouvaille-dark-${size}.png`,
    theme: 'dark' as const,
    sizes: `${size}x${size}`,
    type: 'image/png',
  })),
  { src: '/favicon/trouvaille.svg', sizes: 'any', type: 'image/svg+xml' },
  { src: '/favicon/trouvaille-apple-touch.png', rel: 'apple-touch-icon', sizes: '180x180' },
]
