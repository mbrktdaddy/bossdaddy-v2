import { describe, it, expect, vi, beforeEach } from 'vitest'

// The research call is mocked: these tests pin what the lookup does with the
// model's answer — cleanup, identifiers, sources — not the model itself.
vi.mock('@/lib/ai/research', () => ({ aiResearch: vi.fn() }))

import { aiResearch } from '@/lib/ai/research'
import { buildLookupPrompt, hasLookupInput, lookupProductFacts } from '@/lib/products/import'

const researchMock = vi.mocked(aiResearch)

const answer = (object: Record<string, unknown>, sources: { title: string | null; url: string }[] = []) =>
  ({ object, model: 'anthropic/claude-sonnet-5', sources }) as Awaited<ReturnType<typeof aiResearch>>

beforeEach(() => researchMock.mockReset())

describe('lookupProductFacts', () => {
  it('cleans the name, validates identifiers and returns the cited sources', async () => {
    researchMock.mockResolvedValue(answer({
      found: true,
      name: '20V MAX* XR® Brushless Cordless 1/2 in. Drill/Driver (Tool Only)',
      brand: 'DEWALT',
      summary: 'A cordless drill.',
      model_number: 'DCD801B',
      gtin: '885911922319',
      specs: [{ label: 'Voltage', value: '20V Max' }],
      price_usd: 199.07,
      sources: [{ url: 'https://www.dewalt.com/product/dcd801b', title: 'DCD801B', supports: 'model number, specs' }],
    }))
    const r = await lookupProductFacts({ url: 'https://www.lowes.com/pd/x/5018269031', asin: null })
    expect(r).toMatchObject({
      found: true,
      name: '20V MAX XR Brushless Cordless 1/2 in. Drill/Driver (Tool Only)',
      modelNumber: 'DCD801B',
      gtin: '885911922319',
      priceCents: 19907,
      sources: [{ url: 'https://www.dewalt.com/product/dcd801b', title: 'DCD801B', supports: 'model number, specs' }],
    })
  })

  it("drops a GTIN that fails its check digit, and falls back to the search tool's sources", async () => {
    researchMock.mockResolvedValue(answer(
      { found: true, name: 'Drill', brand: null, summary: null, model_number: null, gtin: '885911922318', specs: [], price_usd: null, sources: [] },
      [{ title: 'Lowe’s listing', url: 'https://www.lowes.com/pd/x/5018269031' }],
    ))
    const r = await lookupProductFacts({ url: 'https://www.lowes.com/pd/x/5018269031', asin: null })
    expect(r.gtin).toBeNull()
    expect(r.sources).toEqual([{ url: 'https://www.lowes.com/pd/x/5018269031', title: 'Lowe’s listing', supports: null }])
  })

  it('asks for plain (fast) search, with no SDK retries', async () => {
    researchMock.mockResolvedValue(answer({ found: false, name: null, brand: null, summary: null, model_number: null, gtin: null, specs: [], price_usd: null, sources: [] }))
    const r = await lookupProductFacts({ url: 'https://www.lowes.com/pd/x/5018269031', asin: null })
    expect(r).toMatchObject({ found: false, sources: [] })
    expect(researchMock.mock.calls[0][0]).toMatchObject({
      search: { dynamicFiltering: false, maxUses: 2 },
      maxRetries: 0,
      retryOnTransient: false,
    })
  })
})

describe('buildLookupPrompt', () => {
  it("puts the admin's typed facts first, as ground truth, then the link", () => {
    const prompt = buildLookupPrompt({
      url: 'https://www.lowes.com/pd/x/5018269031', asin: null,
      modelNumber: ' DCD801B ', brand: 'DEWALT', gtin: '', name: '',
    })
    expect(prompt).toContain('Known facts from the admin')
    expect(prompt).toContain('- Model number: DCD801B')
    expect(prompt).toContain('- Brand: DEWALT')
    expect(prompt).not.toContain('GTIN')
    expect(prompt.indexOf('Model number')).toBeLessThan(prompt.indexOf('Product link'))
    expect(prompt).not.toContain('No model number was given')
  })

  it('works from a model number alone, with no link', () => {
    const prompt = buildLookupPrompt({ url: null, asin: null, modelNumber: 'DCD801B' })
    expect(prompt).toContain('- Model number: DCD801B')
    expect(prompt).not.toContain('Product link')
  })

  it('tells the model to confirm the exact model when it only has a link', () => {
    expect(buildLookupPrompt({ url: 'https://www.lowes.com/pd/x/1', asin: null })).toContain('No model number was given')
  })
})

describe('hasLookupInput', () => {
  it('needs a link, a model number, a GTIN or a name; a brand alone finds nothing', () => {
    expect(hasLookupInput({ url: null, asin: null, modelNumber: 'DCD801B' })).toBe(true)
    expect(hasLookupInput({ url: 'https://x.example/p', asin: null })).toBe(true)
    expect(hasLookupInput({ url: null, asin: null, brand: 'DEWALT' })).toBe(false)
    expect(hasLookupInput({ url: null, asin: null, modelNumber: '  ' })).toBe(false)
  })
})
