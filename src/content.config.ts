import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { signalSchema, issueSchema, columnSchema } from './lib/schemas.ts';

export const collections = {
  signals: defineCollection({ loader: glob({ pattern: '**/*.json', base: './src/content/signals' }), schema: signalSchema }),
  issues: defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/content/issues' }), schema: issueSchema }),
  columns: defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/content/columns' }), schema: columnSchema }),
};
