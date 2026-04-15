import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'review',
  title: 'Review',
  type: 'document',
  fields: [
    defineField({ name: 'supabaseId', title: 'Supabase ID', type: 'string', readOnly: true }),
    defineField({ name: 'slug', title: 'Slug', type: 'slug', options: { source: 'title' } }),
    defineField({ name: 'title', title: 'Title', type: 'string', validation: (R) => R.required() }),
    defineField({ name: 'productName', title: 'Product Name', type: 'string' }),
    defineField({ name: 'rating', title: 'Rating (1-5)', type: 'number', validation: (R) => R.min(1).max(5) }),
    defineField({
      name: 'content',
      title: 'Content',
      type: 'array',
      of: [{ type: 'block' }],
    }),
    defineField({ name: 'hasAffiliateLinks', title: 'Has Affiliate Links', type: 'boolean' }),
    defineField({ name: 'publishedAt', title: 'Published At', type: 'datetime' }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'productName' },
  },
})
