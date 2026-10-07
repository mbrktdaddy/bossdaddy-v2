import { describe, it, expect } from 'vitest'
import {
  cleanModelNumber, modelKey, normalizeGtin, modelFromSku, identifierKind,
  splitIdentifierSpecs, productSlugSource, productIdentifiersJsonLd,
} from '@/lib/products/identifiers'
import { slugifyTitle } from '@/lib/slug'

describe('normalizeGtin', () => {
  it.each([
    ['036000291452', '036000291452'],          // UPC-A
    ['0 36000 29145 2', '036000291452'],       // as printed under the barcode
    ['4006381333931', '4006381333931'],        // EAN-13
    ['96385074', '96385074'],                  // GTIN-8
    ['00012345600012', '00012345600012'],      // GTIN-14
  ])('%s → %s', (raw, digits) => {
    expect(normalizeGtin(raw)).toBe(digits)
  })

  it.each([
    ['036000291453', 'wrong check digit'],
    ['03600029145', '11 digits'],
    ['DCD801B', 'not digits'],
    ['', 'empty'],
  ])('rejects %s (%s)', (raw) => {
    expect(normalizeGtin(raw)).toBeNull()
  })
})

describe('model numbers', () => {
  it('cleans whitespace and refuses empty or oversized values', () => {
    expect(cleanModelNumber('  DCD801B ')).toBe('DCD801B')
    expect(cleanModelNumber('M18  FUEL\t2904-20')).toBe('M18 FUEL 2904-20')
    expect(cleanModelNumber('   ')).toBeNull()
    expect(cleanModelNumber('x'.repeat(61))).toBeNull()
  })

  it('compares case- and punctuation-insensitively', () => {
    expect(modelKey('DCD-801B')).toBe(modelKey('dcd801b'))
    expect(modelKey('DCD 801B')).toBe(modelKey('DCD801B'))
    expect(modelKey('DCD801B')).not.toBe(modelKey('DCD800B'))
  })

  it('takes a SKU as the model only when it reads like one (letters and digits)', () => {
    expect(modelFromSku('DCD801B')).toBe('DCD801B')   // a brand's own page
    expect(modelFromSku('1001234567')).toBeNull()     // a retailer's catalog ID
    expect(modelFromSku('BLACK')).toBeNull()
  })
})

describe('identifier spec rows', () => {
  it.each([
    ['Model', 'model'], ['Model Number', 'model'], ['model #', 'model'], ['Model No.', 'model'],
    ['MPN', 'model'], ['Manufacturer Part Number', 'model'],
    ['UPC', 'gtin'], ['UPC Code', 'gtin'], ['EAN-13', 'gtin'], ['GTIN', 'gtin'], ['Barcode', 'gtin'],
    ['Model Year', null], ['Voltage', null], ['Fitment', null],
  ])('%s → %s', (label, kind) => {
    expect(identifierKind(label)).toBe(kind)
  })

  it('moves usable identifier rows out of the specs and keeps the rest', () => {
    const out = splitIdentifierSpecs([
      { label: 'Model Number', value: 'DCD801B' },
      { label: 'Voltage', value: '20 V' },
      { label: 'UPC', value: '036000291452' },
    ])
    expect(out).toEqual({ modelNumber: 'DCD801B', gtin: '036000291452', specs: [{ label: 'Voltage', value: '20 V' }] })
  })

  it('leaves a malformed UPC in the specs where the admin can see it', () => {
    const out = splitIdentifierSpecs([{ label: 'UPC', value: 'N/A' }])
    expect(out).toEqual({ modelNumber: null, gtin: null, specs: [{ label: 'UPC', value: 'N/A' }] })
  })
})

describe('productSlugSource', () => {
  const name = '20V MAX* XR® Brushless Cordless 1/2-in Drill/Driver (Tool Only)'

  it('is brand + model when both are known', () => {
    expect(slugifyTitle(productSlugSource({ name, brand: 'DEWALT', modelNumber: 'DCD801B' }))).toBe('dewalt-dcd801b')
  })

  it('falls back to the name without a brand or a model', () => {
    expect(productSlugSource({ name, brand: 'DEWALT', modelNumber: null })).toBe(name)
    expect(productSlugSource({ name, brand: null, modelNumber: 'DCD801B' })).toBe(name)
  })
})

describe('productIdentifiersJsonLd', () => {
  it('emits only the identifiers that are set', () => {
    expect(productIdentifiersJsonLd({ model_number: 'DCD801B', gtin: '885911475112' })).toEqual({ mpn: 'DCD801B', gtin: '885911475112' })
    expect(productIdentifiersJsonLd({ model_number: 'DCD801B', gtin: null })).toEqual({ mpn: 'DCD801B' })
    expect(productIdentifiersJsonLd(null)).toEqual({})
  })
})
