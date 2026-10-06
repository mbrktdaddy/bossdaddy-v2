import { describe, it, expect } from 'vitest'
import {
  detectStore, isAmazonShortLink, stripTracking, jsonLdNodes, parseJsonLdProduct,
  stripSiteSuffix, extractFromHtml,
} from '@/lib/products/import'

const ld = (obj: unknown) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`
const page = (head: string, body = '') => `<html><head>${head}</head><body>${body}</body></html>`

describe('detectStore', () => {
  it.each([
    ['www.homedepot.com', 'home-depot'],
    ['www.amazon.com', 'amazon'],
    ['smile.amazon.co.uk', 'amazon'],
    ['www.samsclub.com', 'sams-club'],
    ['www.dickssportinggoods.com', 'dicks'],
    ['www.yeti.com', 'other'],
    ['notwalmart.com.evil.io', 'other'],
  ])('%s → %s', (host, store) => {
    expect(detectStore(host)).toBe(store)
  })

  it('recognises Amazon short links, which need the full URL instead', () => {
    expect(isAmazonShortLink('amzn.to')).toBe(true)
    expect(isAmazonShortLink('a.co')).toBe(true)
    expect(isAmazonShortLink('www.amazon.com')).toBe(false)
  })
})

describe('stripTracking', () => {
  it('drops campaign params and the hash, keeps the product params', () => {
    expect(stripTracking('https://shop.example.com/p/123?utm_source=x&gclid=y&color=red#reviews'))
      .toBe('https://shop.example.com/p/123?color=red')
  })
})

describe('parseJsonLdProduct', () => {
  it('reads a plain Product with brand object, image list, offer and properties', () => {
    const html = page(ld({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Milwaukee M18 FUEL Drill &amp; Driver',
      brand: { '@type': 'Brand', name: 'Milwaukee' },
      image: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
      description: '<p>Brushless   drill.</p>',
      mpn: '2904-20',
      weight: { '@type': 'QuantitativeValue', value: 3.2, unitText: 'lbs' },
      offers: { '@type': 'Offer', price: '199.00', priceCurrency: 'USD' },
      additionalProperty: [{ '@type': 'PropertyValue', name: 'Voltage', value: '18 V' }],
    }))
    expect(parseJsonLdProduct(html)).toEqual({
      name: 'Milwaukee M18 FUEL Drill & Driver',
      brand: 'Milwaukee',
      imageUrl: 'https://cdn.example.com/a.jpg',
      description: 'Brushless drill.',
      priceCents: 19900,
      specs: [
        { label: 'Model', value: '2904-20' },
        { label: 'Weight', value: '3.2 lbs' },
        { label: 'Voltage', value: '18 V' },
      ],
    })
  })

  it('finds the Product inside @graph and skips a malformed block', () => {
    const html = page(
      '<script type="application/ld+json">{ "broken": true, }</script>'
      + ld({ '@graph': [{ '@type': 'WebPage' }, { '@type': ['Product'], name: 'Cooler', brand: 'YETI' }] }),
    )
    expect(jsonLdNodes(html)).toHaveLength(3)
    expect(parseJsonLdProduct(html)).toMatchObject({ name: 'Cooler', brand: 'YETI' })
  })

  it('takes the price from a ProductGroup variant and ignores non-USD offers', () => {
    const group = page(ld({
      '@type': 'ProductGroup', name: 'Jacket',
      hasVariant: [{ '@type': 'Product', offers: [{ price: 50, priceCurrency: 'EUR' }, { lowPrice: 89.5, priceCurrency: 'USD' }] }],
    }))
    expect(parseJsonLdProduct(group)?.priceCents).toBe(8950)
  })

  it('no Product node, no result', () => {
    expect(parseJsonLdProduct(page(ld({ '@type': 'Organization', name: 'Acme' })))).toBeNull()
  })
})

describe('stripSiteSuffix', () => {
  it('drops a retailer suffix but keeps a real dash in a product name', () => {
    expect(stripSiteSuffix('Weber Kettle 22 in. | The Home Depot', 'The Home Depot')).toBe('Weber Kettle 22 in.')
    expect(stripSiteSuffix('Ozark Trail Cooler - Walmart.com', null)).toBe('Ozark Trail Cooler')
    expect(stripSiteSuffix('Leatherman Wave+ - Black', null)).toBe('Leatherman Wave+ - Black')
  })
})

describe('extractFromHtml — OpenGraph fallback', () => {
  it('uses og tags when there is no JSON-LD, and resolves a relative image', () => {
    const html = page(
      '<meta property="og:title" content="Trail Chair | Camp Co">'
      + '<meta property="og:site_name" content="Camp Co">'
      + '<meta property="og:image" content="/img/chair.jpg">'
      + '<meta property="og:description" content="A light chair.">'
      + '<meta property="product:price:amount" content="64.99">'
      + '<meta property="product:price:currency" content="USD">',
    )
    const out = extractFromHtml(html, 'https://campco.example/p/chair')
    expect(out).toMatchObject({
      name: 'Trail Chair',
      imageUrl: 'https://campco.example/img/chair.jpg',
      retailerDescription: 'A light chair.',
      priceCents: 6499,
      specs: [],
    })
    expect(out.found).toEqual(['name', 'image', 'price', 'retailer description (reference)'])
  })

  it('never returns a non-http image (javascript:, data:)', () => {
    const html = page('<meta property="og:title" content="X"><meta property="og:image" content="javascript:alert(1)">')
    expect(extractFromHtml(html, 'https://x.example/').imageUrl).toBeNull()
  })
})
