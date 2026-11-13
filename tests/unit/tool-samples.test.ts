import { describe, it, expect } from 'vitest'
import { toolSamples } from '@/lib/dad-tools/samples'
import { amortize, runDime, runRunway } from '@/lib/dad-tools/finance'
import { fmtUsdWhole } from '@/lib/dad-tools/savings'

// The demo state's worked examples are computed with the tools' own math, so
// the showcase can never disagree with the tool it points at.

const TOOLS = [
  '/tools/the-boss', '/tools/weekends-until', '/tools/savings', '/goals',
  '/tools/emergency-runway', '/tools/life-insurance', '/tools/debt-payoff', '/tools/loan-math', '/tools/dad-math',
]

describe('toolSamples', () => {
  const samples = toolSamples(new Date('2026-11-13T12:00:00Z'))

  it('has one example per tool, each with a stated input and a readout', () => {
    for (const href of TOOLS) {
      expect(samples[href], href).toBeDefined()
      expect(samples[href].input.length).toBeGreaterThan(5)
      expect(samples[href].output.length).toBeGreaterThan(2)
    }
  })

  it('the numbers come from the tools\' own math', () => {
    expect(samples['/tools/loan-math'].output).toBe(`${fmtUsdWhole(amortize(32_000, 0.069, 60).monthlyPayment)} a month`)
    expect(samples['/tools/emergency-runway'].output).toBe(`${runRunway(12_000, 4_100).months.toFixed(1)} months`)
    const dime = runDime({ debt: 15_000, annualIncome: 72_000, incomeYears: 10, mortgage: 240_000, education: 100_000, existingCoverage: 100_000, savings: 20_000 })
    expect(dime.gap).toBe(955_000)
    expect(samples['/tools/life-insurance'].output).toMatch(/gap$/)
    expect(samples['/tools/savings'].output).toBe(fmtUsdWhole(13_000))
  })

  it('a seven-year-old has roughly eleven years of weekends until 18', () => {
    const n = Number(samples['/tools/weekends-until'].output.replace(/[^0-9]/g, ''))
    expect(n).toBeGreaterThan(540)
    expect(n).toBeLessThan(600)
  })

  it('the debt plan pays off within a few years with the extra', () => {
    const months = Number(samples['/tools/debt-payoff'].output.replace(/[^0-9]/g, ''))
    expect(months).toBeGreaterThan(12)
    expect(months).toBeLessThan(72)
  })
})
