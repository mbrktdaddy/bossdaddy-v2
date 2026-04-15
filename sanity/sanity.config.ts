import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import review from './schemas/review'
import product from './schemas/product'

export default defineConfig({
  name: 'bossdaddy-v2',
  title: 'Boss Daddy v2',
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production',
  plugins: [structureTool(), visionTool()],
  schema: {
    types: [review, product],
  },
})
