import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const work = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/work' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      order: z.number(),
      kind: z.enum(['residential', 'commercial']),
      typology: z.string(), // "4 BHK", "Villa", "Showroom"
      styles: z.array(z.string()).default([]),
      location: z.string().default('Hyderabad'),
      scope: z.string().default('Interior design and execution'),
      status: z.enum(['completed', 'in-progress']).default('completed'),
      tagline: z.string(),
      summary: z.string(), // card blurb
      facts: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
      challenge: z.array(z.string()).default([]),
      approach: z.array(z.object({ title: z.string(), text: z.string() })).default([]),
      result: z.string(),
      quote: z.object({ text: z.string(), by: z.string() }).optional(),
      cover: image(),
      coverAlt: z.string(),
      gallery: z.array(z.object({ src: image(), alt: z.string() })).default([]),
    }),
});

export const collections = { work };
