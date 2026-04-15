import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'product',
  title: 'Product',
  type: 'document',
  fields: [
    defineField({ name: 'name', title: 'Product Name', type: 'string', validation: (R) => R.required() }),
    defineField({ name: 'brand', title: 'Brand', type: 'string' }),
    defineField({ name: 'category', title: 'Category', type: 'string' }),
    defineField({ name: 'affiliateUrl', title: 'Affiliate URL', type: 'url' }),
    defineField({ name: 'amazonAsin', title: 'Amazon ASIN', type: 'string' }),
    defineField({ name: 'image', title: 'Product Image', type: 'image', options: { hotspot: true } }),
  ],
  preview: {
    select: { title: 'name', subtitle: 'brand' },
  },
})
