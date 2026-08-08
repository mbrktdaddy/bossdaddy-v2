// The template parser is the seam between a seeded row and a form a dad can
// actually submit. Its job is not to be permissive — it's to DROP any row that
// would render a form the create route then rejects, because that failure mode is
// invisible until someone taps the card and gets bounced with a friendly message
// about a field they can't see.
//
// So these tests are mostly about what it refuses. Each refusal mirrors a CHECK in
// migration 136 and a validation branch in /api/goals/create; if that trio ever
// drifts, one of these fails first.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { __testing } from '@/lib/goals/templates'

const { parseRows } = __testing

/** A minimal valid row: the shape PostgREST hands back for a flat adherence plan. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'meds-every-day',
    label: 'Take your meds, every day',
    blurb: 'One nudge, one tap.',
    identity_suggestion: 'I am a man who takes care of the body his family depends on.',
    identity_short_suggestion: 'Takes Care of It',
    is_sensitive: true,
    guide_slug: null,
    kind: 'adherence',
    title_suggestion: 'Take my meds',
    metric_key: null,
    metric_unit: null,
    direction: null,
    curve: 'none',
    baseline_value: null,
    target_value: null,
    weeks: null,
    step_every_days: null,
    recur_when: 'daily',
    recur_days: [],
    local_time: '08:00:00',
    is_kind_default: false,
    sort_order: 40,
    ...overrides,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('parseRows — the happy path', () => {
  it('maps a row to a form-ready template', () => {
    const [template] = parseRows([row()])

    expect(template.slug).toBe('meds-every-day')
    expect(template.identityStatement).toContain('I am a man who')
    expect(template.identityShort).toBe('Takes Care of It')
    expect(template.isSensitive).toBe(true)
    expect(template.kind).toBe('adherence')
    expect(template.when).toBe('daily')
    expect(template.isKindDefault).toBe(false)
  })

  it('trims Postgres HH:MM:SS down to what a time input accepts', () => {
    expect(parseRows([row({ local_time: '20:30:00' })])[0].time).toBe('20:30')
  })

  it('renders absent numbers as empty strings, not zeroes', () => {
    // '' reads as "not set" in an input. '0' reads as a target of zero, which for
    // a taper is a meaningful and very different answer.
    const [template] = parseRows([row()])
    expect(template.baseline).toBe('')
    expect(template.target).toBe('')
    expect(template.weeks).toBe('')
    expect(template.stepDays).toBe('')
  })

  it('keeps a full taper payload intact', () => {
    const [template] = parseRows([
      row({
        slug: 'quit-smoking-taper',
        kind: 'reduce',
        curve: 'step',
        metric_key: 'cigarettes',
        metric_unit: 'per day',
        direction: 'down',
        baseline_value: 20,
        target_value: 0,
        weeks: 8,
        step_every_days: 7,
        local_time: '20:00:00',
      }),
    ])

    expect(template.curve).toBe('step')
    expect(template.baseline).toBe('20')
    expect(template.target).toBe('0')     // zero survives — it's the whole point
    expect(template.weeks).toBe('8')
    expect(template.stepDays).toBe('7')
    expect(template.direction).toBe('down')
  })

  it('canonicalizes the day tokens and drops junk', () => {
    // Monday-first order regardless of how the array came out of Postgres, so the
    // checkboxes and the RRULE buildRrule() emits can never disagree.
    const [template] = parseRows([
      row({ recur_when: 'days', recur_days: ['FR', 'nope', 'MO', 'WE'] }),
    ])
    expect(template.days).toEqual(['MO', 'WE', 'FR'])
  })

  it('treats a null identity suggestion as "no suggestion", not "undefined"', () => {
    const [template] = parseRows([
      row({ identity_suggestion: null, identity_short_suggestion: null }),
    ])
    expect(template.identityStatement).toBe('')
    expect(template.identityShort).toBe('')
  })
})

describe('parseRows — what it refuses', () => {
  it('drops a stepped curve with no step interval', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const out = parseRows([row({ curve: 'step', baseline_value: 20, target_value: 0, weeks: 8, step_every_days: null })])

    expect(out).toHaveLength(0)
    expect(spy).toHaveBeenCalledOnce()
  })

  it('drops a curved template with no length', () => {
    // The create route needs `weeks` to compute target_date; without it the curve
    // has nothing to interpolate over and the submit bounces.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(parseRows([row({ curve: 'linear', weeks: null })])).toHaveLength(0)
  })

  it('drops recur_when=days with no real day token', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(parseRows([row({ recur_when: 'days', recur_days: [] })])).toHaveLength(0)
    expect(parseRows([row({ recur_when: 'days', recur_days: ['XX'] })])).toHaveLength(0)
  })

  it('drops an unknown kind rather than passing it to the enum on the goals table', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(parseRows([row({ kind: 'savings' })])).toHaveLength(0)
  })

  it('drops an over-long identity suggestion instead of letting the CHECK reject it later', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(parseRows([row({ identity_suggestion: 'x'.repeat(161) })])).toHaveLength(0)
    expect(parseRows([row({ identity_short_suggestion: 'x'.repeat(25) })])).toHaveLength(0)
  })

  it('keeps the good rows when one row in the batch is bad', () => {
    // A shelf missing one plan is recoverable. A shelf that renders nothing
    // because of one bad seed is an outage.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const out = parseRows([
      row({ slug: 'good-one' }),
      row({ slug: 'bad-one', curve: 'step', step_every_days: null, weeks: 8 }),
      row({ slug: 'another-good-one' }),
    ])
    expect(out.map((t) => t.slug)).toEqual(['good-one', 'another-good-one'])
  })

  it('names the offending slug in the log so a bad seed is findable', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    parseRows([row({ slug: 'busted-plan', recur_when: 'days', recur_days: [] })])
    expect(spy.mock.calls[0][0]).toContain('busted-plan')
  })
})
