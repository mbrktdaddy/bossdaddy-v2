import { describe, it, expect, vi, beforeEach } from 'vitest'

// The network layer is mocked: these tests pin the import's BRANCHING — which
// links are fetched, which never are (Amazon pages), and what the form gets.
vi.mock('@/lib/link-preview/fetch', () => ({
  guardedFetch: vi.fn(),
  resolveRedirects: vi.fn(),
}))

import { guardedFetch, resolveRedirects } from '@/lib/link-preview/fetch'
import { importProductFromUrl } from '@/lib/products/import'

const fetchMock = vi.mocked(guardedFetch)
const resolveMock = vi.mocked(resolveRedirects)

const htmlPage = (url: string, html: string) =>
  ({ ok: true as const, data: { url, contentType: 'text/html', body: Buffer.from(html) } })

beforeEach(() => {
  fetchMock.mockReset()
  resolveMock.mockReset()
})

describe('importProductFromUrl — Amazon', () => {
  it('takes the ASIN from the URL and never fetches the Amazon page', async () => {
    const r = await importProductFromUrl('https://www.amazon.com/Some-Thing/dp/B0CM9RSBRX?th=1&ref_=x', 'bossdaddylife-20')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(r).toMatchObject({
      store: 'amazon',
      asin: 'B0CM9RSBRX',
      affiliateUrl: 'https://www.amazon.com/dp/B0CM9RSBRX?tag=bossdaddylife-20',
      nonAffiliateUrl: null,
      sourceUrl: 'https://www.amazon.com/dp/B0CM9RSBRX',
      canLookup: true,
    })
  })

  it('without an associate tag, saves the plain product link instead', async () => {
    const r = await importProductFromUrl('https://www.amazon.com/dp/B0CM9RSBRX', '')
    expect(r.affiliateUrl).toBeNull()
    expect(r.nonAffiliateUrl).toBe('https://www.amazon.com/dp/B0CM9RSBRX')
  })

  it('resolves an a.co share link by its redirects, then stops before Amazon', async () => {
    resolveMock.mockResolvedValue({ ok: true, url: 'https://www.amazon.com/dp/B08CMWHD3B?ref=share' })
    const r = await importProductFromUrl('https://a.co/d/0c2tNRVA', 'tag-20')
    expect(resolveMock).toHaveBeenCalledOnce()
    // The stop condition: arrive at any URL that carries an ASIN.
    const arrived = resolveMock.mock.calls[0][1]
    expect(arrived('https://www.amazon.com/dp/B08CMWHD3B')).toBe(true)
    expect(arrived('https://a.co/d/0c2tNRVA')).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(r).toMatchObject({ store: 'amazon', asin: 'B08CMWHD3B' })
  })

  it('says what to do when a short link will not resolve', async () => {
    resolveMock.mockResolvedValue({ ok: false, reason: 'bad-status' })
    const r = await importProductFromUrl('https://amzn.to/4eKLhpL', 'tag-20')
    expect(r.asin).toBeNull()
    expect(r.notes[0]).toMatch(/paste the full product URL/)
  })

  it('a brand link that redirects to Amazon is treated as Amazon, not read', async () => {
    fetchMock.mockResolvedValue(htmlPage('https://www.amazon.com/dp/B0739KKHWL', '<html><head><title>Amazon</title></head></html>'))
    const r = await importProductFromUrl('https://brand.example/buy', 'tag-20')
    expect(r).toMatchObject({ store: 'amazon', asin: 'B0739KKHWL', name: null })
  })
})

describe('importProductFromUrl — retailer pages', () => {
  it('reads the page, detects the store and saves a clean plain link', async () => {
    const ld = JSON.stringify({ '@type': 'Product', name: 'Weber Genesis E-330', brand: { name: 'Weber' }, offers: { price: 999, priceCurrency: 'USD' } })
    fetchMock.mockResolvedValue(htmlPage(
      'https://www.lowes.com/pd/Weber-GENESIS-E-330/5015427529?utm_source=x',
      `<html><head><script type="application/ld+json">${ld}</script></head></html>`,
    ))
    const r = await importProductFromUrl('https://www.lowes.com/pd/Weber-GENESIS-E-330/5015427529', '')
    expect(r).toMatchObject({
      store: 'lowes',
      name: 'Weber Genesis E-330',
      brand: 'Weber',
      priceCents: 99900,
      affiliateUrl: null,
      nonAffiliateUrl: 'https://www.lowes.com/pd/Weber-GENESIS-E-330/5015427529',
    })
    expect(r.notes.join(' ')).toMatch(/Paste your affiliate link/)
  })

  it('an unknown store keeps its site name for the CTA', async () => {
    fetchMock.mockResolvedValue(htmlPage(
      'https://gorillaplaysets.com/products/wilderness-gym-swing-set',
      '<html><head><meta property="og:title" content="Wilderness Gym"><meta property="og:site_name" content="Gorilla Playsets"></head></html>',
    ))
    const r = await importProductFromUrl('https://gorillaplaysets.com/products/wilderness-gym-swing-set', '')
    expect(r).toMatchObject({ store: 'other', customStoreName: 'Gorilla Playsets', name: 'Wilderness Gym' })
  })

  it('merges a Shopify store\'s product JSON: images after JSON-LD, identifiers where the page has none', async () => {
    const ld = JSON.stringify({ '@type': 'Product', name: 'Trail Chair', image: 'https://shop.example/ld.jpg' })
    const json = JSON.stringify({
      title: 'Trail Chair', vendor: 'Campco', images: ['//cdn.shopify.com/s/a.jpg'],
      variants: [{ id: 22, sku: 'TC-200X', barcode: '012345678905', price: 14999 }],
    })
    fetchMock.mockImplementation(async (u) => String(u).endsWith('.js')
      ? { ok: true as const, data: { url: String(u), contentType: 'application/json', body: Buffer.from(json) } }
      : htmlPage(
        'https://shop.example/products/trail-chair?variant=22',
        `<html><head><script type="application/ld+json">${ld}</script><meta property="og:image" content="https://shop.example/og.jpg"><link href="https://cdn.shopify.com/x.css"></head></html>`,
      ))
    const r = await importProductFromUrl('https://shop.example/products/trail-chair?variant=22', '')
    expect(fetchMock).toHaveBeenCalledWith('https://shop.example/products/trail-chair.js', { maxBytes: 1_000_000, expect: 'json' })
    expect(r.imageCandidates).toEqual(['https://shop.example/ld.jpg', 'https://cdn.shopify.com/s/a.jpg', 'https://shop.example/og.jpg'])
    expect(r).toMatchObject({ brand: 'Campco', modelNumber: 'TC-200X', gtin: '012345678905', priceCents: 14999 })
    expect(r.found).toContain('Shopify product data')
  })

  it('falls back to the page alone when the Shopify JSON fails', async () => {
    fetchMock.mockImplementation(async (u) => String(u).endsWith('.js')
      ? { ok: false as const, reason: 'bad-status' as const }
      : htmlPage(
        'https://shop.example/products/trail-chair',
        '<html><head><meta property="og:title" content="Trail Chair"><link href="https://cdn.shopify.com/x.css"></head></html>',
      ))
    const r = await importProductFromUrl('https://shop.example/products/trail-chair', '')
    expect(r.name).toBe('Trail Chair')
    expect(r.found).not.toContain('Shopify product data')
  })

  it('a blocked retailer page explains itself and offers the web lookup', async () => {
    fetchMock.mockResolvedValue({ ok: false, reason: 'bad-status' })
    const r = await importProductFromUrl('https://www.kohls.com/product/prd-6939775/x.jsp', '')
    expect(r.name).toBeNull()
    expect(r.canLookup).toBe(true)
    expect(r.notes[0]).toMatch(/block automated reads/)
  })

  it('keeps the cleaned link and its store when the page refuses the read', async () => {
    fetchMock.mockResolvedValue({ ok: false, reason: 'bad-status' })
    const r = await importProductFromUrl(
      'https://www.lowes.com/pd/DEWALT-Drill/5018269031?irclickid=1Pl&irgwc=1&afsrc=1&cm_mmc=aff-_-c', '',
    )
    expect(r).toMatchObject({
      store: 'lowes',
      nonAffiliateUrl: 'https://www.lowes.com/pd/DEWALT-Drill/5018269031',
      customStoreName: null,
      canLookup: true,
    })
    expect(r.notes.join(' ')).toMatch(/Saved as a plain link/)
  })

  it('an unknown store keeps its hostname as the store name when the read fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, reason: 'timeout' })
    const r = await importProductFromUrl('https://www.campco.example/p/chair', '')
    expect(r).toMatchObject({ store: 'other', customStoreName: 'campco.example', nonAffiliateUrl: 'https://www.campco.example/p/chair' })
  })

  it('a private-network address is refused with no lookup offered and no link kept', async () => {
    fetchMock.mockResolvedValue({ ok: false, reason: 'blocked' })
    const r = await importProductFromUrl('http://192.168.1.1/admin', '')
    expect(r.canLookup).toBe(false)
    expect(r.nonAffiliateUrl).toBeNull()
  })
})
