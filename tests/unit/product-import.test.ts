import { describe, it, expect } from 'vitest'
import {
  detectStore, isAmazonShortLink, stripTracking, jsonLdNodes, parseJsonLdProduct,
  stripSiteSuffix, extractFromHtml, cleanProductName, lookupSources, pageImagesNaming,
  parseShopifyProduct, shopifyProductJsUrl,
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

  it("drops affiliate-network params from a Lowe's share link", () => {
    expect(stripTracking('https://www.lowes.com/pd/DEWALT-Drill/5018269031?irclickid=1Pl&irgwc=1&afsrc=1&cm_mmc=aff-_-c'))
      .toBe('https://www.lowes.com/pd/DEWALT-Drill/5018269031')
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
      imageUrls: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
      description: 'Brushless drill.',
      priceCents: 19900,
      // mig 159: the model number is an identifier, not a spec row.
      modelNumber: '2904-20',
      gtin: null,
      specs: [
        { label: 'Weight', value: '3.2 lbs' },
        { label: 'Voltage', value: '18 V' },
      ],
    })
  })

  it('reads identifiers: a model-like SKU, a GTIN, and a UPC property', () => {
    const brandSite = page(ld({ '@type': 'Product', name: 'Drill', sku: 'DCD801B', gtin12: '036000291452' }))
    expect(parseJsonLdProduct(brandSite)).toMatchObject({ modelNumber: 'DCD801B', gtin: '036000291452' })

    // A retailer's all-digit SKU is their catalog ID, not the maker's model.
    const retailer = page(ld({ '@type': 'Product', name: 'Drill', sku: '1001234567' }))
    expect(parseJsonLdProduct(retailer)?.modelNumber).toBeNull()

    const props = page(ld({
      '@type': 'Product', name: 'Drill',
      additionalProperty: [
        { '@type': 'PropertyValue', name: 'Model Number', value: 'DCD801B' },
        { '@type': 'PropertyValue', name: 'UPC', value: '036000291452' },
        { '@type': 'PropertyValue', name: 'Voltage', value: '20 V' },
      ],
    }))
    expect(parseJsonLdProduct(props)).toMatchObject({
      modelNumber: 'DCD801B', gtin: '036000291452', specs: [{ label: 'Voltage', value: '20 V' }],
    })
  })

  it('drops a GTIN with a bad check digit rather than guess', () => {
    expect(parseJsonLdProduct(page(ld({ '@type': 'Product', name: 'X', gtin13: '4006381333932' })))?.gtin).toBeNull()
  })

  it('trusts a ProductGroup variant\'s identifiers only when it is the only variant', () => {
    const one = page(ld({ '@type': 'ProductGroup', name: 'Jacket', hasVariant: [{ '@type': 'Product', mpn: 'J-100-BLK' }] }))
    expect(parseJsonLdProduct(one)?.modelNumber).toBe('J-100-BLK')
    const many = page(ld({
      '@type': 'ProductGroup', name: 'Jacket',
      hasVariant: [{ '@type': 'Product', mpn: 'J-100-BLK' }, { '@type': 'Product', mpn: 'J-100-RED' }],
    }))
    expect(parseJsonLdProduct(many)?.modelNumber).toBeNull()
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

describe('pageImagesNaming', () => {
  const P = 'https://www.dewalt.com/p/drill'
  const html = '<img src="https://assets.dewalt.com/logo.svg"><img srcset="https://assets.dewalt.com/NAG/PRODUCT/IMAGES/HIRES/WHITEBG/DCD801B_1_1680.webp 1680w">'
    + '<script>{"img":"https://assets.dewalt.com/banner.jpg","alt":"https://assets.dewalt.com/NAG/x/DCD801B_2_1680.webp?v=1&amp;w=2"}</script>'

  it('finds page image URLs that name the model number, in page order', () => {
    expect(pageImagesNaming(html, 'DCD801B', P)).toEqual([
      'https://assets.dewalt.com/NAG/PRODUCT/IMAGES/HIRES/WHITEBG/DCD801B_1_1680.webp',
      'https://assets.dewalt.com/NAG/x/DCD801B_2_1680.webp?v=1&w=2',
    ])
  })

  it("doesn't let size variants of the first shots crowd out later images", () => {
    const sizes = ['400', '800', '1200', '1680']
    const shots = [1, 2, 3].flatMap((n) => sizes.map((s) => `https://assets.dewalt.com/IMAGES/DCD801B_${n}_${s}.webp`))
    const page = shots.map((u) => `<img src="${u}">`).join('') + '<img src="https://assets.dewalt.com/GRAPHICS/DCD801B_EN_GEC1_1680.webp">'
    const out = pageImagesNaming(page, 'DCD801B', P)
    expect(out).toContain('https://assets.dewalt.com/GRAPHICS/DCD801B_EN_GEC1_1680.webp')
    expect(out).toContain('https://assets.dewalt.com/IMAGES/DCD801B_1_1680.webp')
    expect(out).toHaveLength(4)
  })

  it('takes nothing without a (long enough) model number', () => {
    expect(pageImagesNaming(html, null, P)).toEqual([])
    expect(pageImagesNaming(html, 'X1', P)).toEqual([])
  })

  it('unescapes JSON-escaped slashes in inline scripts', () => {
    const scripted = '<script>{"img":"https:\\/\\/assets.dewalt.com\\/IMAGES\\/DCD801B_3_1680.webp"}</script>'
    expect(pageImagesNaming(scripted, 'DCD801B', P)).toEqual(['https://assets.dewalt.com/IMAGES/DCD801B_3_1680.webp'])
  })

  it('resolves protocol-relative and relative attribute URLs against the page', () => {
    const markup = '<img src="//cdn.dewalt.com/DCD801B_a.jpg">'
      + '<img srcset="/media/DCD801B_b_400.png 400w, media/DCD801B_c.webp 2x">'
      + '<img data-src="/media/other.jpg">'
    expect(pageImagesNaming(markup, 'DCD801B', P)).toEqual([
      'https://cdn.dewalt.com/DCD801B_a.jpg',
      'https://www.dewalt.com/media/DCD801B_b_400.png',
      'https://www.dewalt.com/p/media/DCD801B_c.webp',
    ])
  })

  it('matches the model number ignoring punctuation and case', () => {
    const markup = '<img src="https://cdn.example.com/dcd-801_b/front.jpg">'
    expect(pageImagesNaming(markup, 'DCD801B', P)).toEqual(['https://cdn.example.com/dcd-801_b/front.jpg'])
    expect(pageImagesNaming(markup, 'DCD-801-B', P)).toHaveLength(1)
  })

  it('falls back to them after stale structured data in the candidates', () => {
    const page = '<html><head><script type="application/ld+json">'
      + JSON.stringify({ '@type': 'Product', name: 'Drill', mpn: 'DCD801B', image: 'https://assets.dewalt.com/DCD801B_1.jpg' })
      + '</script></head><body><img src="https://assets.dewalt.com/DCD801B_1_1680.webp"></body></html>'
    expect(extractFromHtml(page, 'https://www.dewalt.com/p').imageCandidates).toEqual([
      'https://assets.dewalt.com/DCD801B_1.jpg',
      'https://assets.dewalt.com/DCD801B_1_1680.webp',
    ])
  })
})

describe('parseShopifyProduct', () => {
  const product = (variants: unknown[]) => ({
    title: 'Trail Chair', vendor: 'Campco', images: ['//cdn.shopify.com/s/files/a.jpg', 'https://cdn.shopify.com/s/files/b.jpg'], variants,
  })
  const v1 = { id: 11, sku: 'TC-100X', barcode: '012345678905', price: 12999 }
  const v2 = { id: 22, sku: 'TC-200X', barcode: '', price: 14999 }

  it('reads a single-variant product, making protocol-relative images https', () => {
    expect(parseShopifyProduct(product([v1]), null)).toEqual({
      name: 'Trail Chair', brand: 'Campco',
      imageUrls: ['https://cdn.shopify.com/s/files/a.jpg', 'https://cdn.shopify.com/s/files/b.jpg'],
      modelNumber: 'TC-100X', gtin: '012345678905', priceCents: 12999,
    })
  })

  it('takes identifiers only from the ?variant= one when there are several', () => {
    expect(parseShopifyProduct(product([v1, v2]), '22')).toMatchObject({ modelNumber: 'TC-200X', gtin: null, priceCents: 14999 })
  })

  it('has no identifiers or price for several variants without a variant id', () => {
    expect(parseShopifyProduct(product([v1, v2]), null)).toMatchObject({ name: 'Trail Chair', modelNumber: null, gtin: null, priceCents: null })
    expect(parseShopifyProduct(product([v1, v2]), '99')).toMatchObject({ modelNumber: null, priceCents: null })
  })

  it('returns null for the wrong shape', () => {
    expect(parseShopifyProduct(null, null)).toBeNull()
    expect(parseShopifyProduct({ title: 'x' }, null)).toBeNull()
    expect(parseShopifyProduct({ variants: [] }, null)).toBeNull()
  })
})

describe('shopifyProductJsUrl', () => {
  it('builds the .js URL from the handle on a Shopify page', () => {
    expect(shopifyProductJsUrl('https://shop.example/collections/all/products/trail-chair?variant=22', '<img src="https://cdn.shopify.com/x.jpg">'))
      .toBe('https://shop.example/products/trail-chair.js')
    expect(shopifyProductJsUrl('https://shop.example/products/trail-chair', '<script>Shopify.theme = {}</script>'))
      .toBe('https://shop.example/products/trail-chair.js')
  })

  it('is null without a /products/ path or without Shopify markers', () => {
    expect(shopifyProductJsUrl('https://shop.example/pages/about', 'cdn.shopify.com')).toBeNull()
    expect(shopifyProductJsUrl('https://shop.example/products/trail-chair', '<html></html>')).toBeNull()
  })
})

describe('cleanProductName', () => {
  it.each([
    ['20V MAX* XR® Brushless Cordless 1/2 in. Drill/Driver (Tool Only)', '20V MAX XR Brushless Cordless 1/2 in. Drill/Driver (Tool Only)'],
    ['Weber(R) Spirit™ E-310', 'Weber Spirit E-310'],
    ['YETI Rambler® 20 oz Tumbler', 'YETI Rambler 20 oz Tumbler'],
    ['Drill (Tool Only)*', 'Drill (Tool Only)'],
  ])('%s → %s', (raw, clean) => {
    expect(cleanProductName(raw)).toBe(clean)
  })

  it('leaves real punctuation alone', () => {
    expect(cleanProductName('Leatherman Wave+ - Black (R2 edition)')).toBe('Leatherman Wave+ - Black (R2 edition)')
  })
})

describe('lookupSources', () => {
  it('keeps the cited pages, with what each backs, http(s) only and deduped', () => {
    const out = lookupSources([
      { url: 'https://www.dewalt.com/product/dcd801b', title: 'DCD801B | DEWALT', supports: 'model number, specs' },
      { url: 'https://www.dewalt.com/product/dcd801b', title: 'dupe', supports: null },
      { url: 'javascript:alert(1)', title: 'bad', supports: null },
      { url: 'not a url', title: 'bad', supports: null },
    ], [])
    expect(out).toEqual([{ url: 'https://www.dewalt.com/product/dcd801b', title: 'DCD801B | DEWALT', supports: 'model number, specs' }])
  })

  it("falls back to the search tool's results when the model cites nothing", () => {
    expect(lookupSources([], [{ url: 'https://www.lowes.com/pd/x/5018269031', title: null }]))
      .toEqual([{ url: 'https://www.lowes.com/pd/x/5018269031', title: null, supports: null }])
  })

  it('caps the list at six', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ url: `https://s${i}.example/p`, title: null, supports: null }))
    expect(lookupSources(many, [])).toHaveLength(6)
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

  it('collects decoded, absolutized, deduped image candidates: JSON-LD, og, then twitter', () => {
    const html = page(
      ld({
        '@type': 'Product',
        name: 'Drill',
        image: ['https://cdn.example.com/a.webp?w=1&amp;h=2', '/img/b.jpg'],
      })
      + '<meta property="og:image" content="https://cdn.example.com/a.webp?w=1&amp;h=2">'
      + '<meta property="og:title" content="Drill">'
      + '<meta name="twitter:image" content="https://cdn.example.com/c.png">',
    )
    const out = extractFromHtml(html, 'https://shop.example.com/p/drill')
    expect(out.imageCandidates).toEqual([
      'https://cdn.example.com/a.webp?w=1&h=2',
      'https://shop.example.com/img/b.jpg',
      'https://cdn.example.com/c.png',
    ])
    expect(out.imageUrl).toBe(out.imageCandidates[0])
  })

  it('never returns a non-http image (javascript:, data:)', () => {
    const html = page('<meta property="og:title" content="X"><meta property="og:image" content="javascript:alert(1)">')
    expect(extractFromHtml(html, 'https://x.example/').imageUrl).toBeNull()
  })
})
