import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'
import { normalizeLanguageTag } from './utils/language-utils'

const postsCollection = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    published: z.coerce.date(),
    draft: z.boolean().optional().default(false),
    description: z.string().optional().default(''),
    image: z.string().optional().default(''),
    tags: z.array(z.string()).optional().default([]),
    category: z.string().optional().default(''),
    lang: z
      .string()
      .default('zh-CN')
      .transform((language, context) => {
        try {
          return normalizeLanguageTag(language)
        } catch {
          context.addIssue({
            code: 'custom',
            message: 'Use a valid language tag, such as zh-CN or en.',
          })
          return z.NEVER
        }
      }),

    /* For internal use */
    prevTitle: z.string().default(''),
    prevSlug: z.string().default(''),
    nextTitle: z.string().default(''),
    nextSlug: z.string().default(''),
  }),
})
export const collections = {
  posts: postsCollection,
  spec: defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/spec' }),
  }),
}
