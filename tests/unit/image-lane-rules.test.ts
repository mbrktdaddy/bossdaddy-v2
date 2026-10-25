import { describe, it, expect } from 'vitest'
import {
  EDITORIAL,
  EDITORIAL_STRICT,
  SOCIAL_FLEXIBLE,
  buildSafetyRules,
  resolveToggles,
  peopleFromLegacy,
} from '@/lib/images/safety'
import { HOUSE_STYLE, HOUSE_STYLE_MARKER, applyHouseStyle } from '@/lib/images/style'
import { judgeQa, avoidanceClause, type QaReport } from '@/lib/images/qa'

// The allowance model per lane (plan §6, brand guide §2 "Images"): what the
// prompt rules say, how the house style is applied, and how vision QA judges
// a result against the same toggles.

describe('lane presets + resolveToggles', () => {
  it('editorial = no text, people anonymous, brands pinned; social = text + people allowed', () => {
    expect(EDITORIAL).toEqual({ noBrands: true, noText: true, people: 'anonymous', editorialOnly: true })
    expect(EDITORIAL_STRICT.people).toBe('none')
    expect(SOCIAL_FLEXIBLE).toEqual({ noBrands: true, noText: false, people: 'allowed', editorialOnly: false })
  })

  it('noBrands cannot be relaxed; undefined overrides keep the baseline', () => {
    const t = resolveToggles(SOCIAL_FLEXIBLE, { noBrands: false, noText: undefined, people: undefined })
    expect(t.noBrands).toBe(true)
    expect(t.noText).toBe(false)
    expect(t.people).toBe('allowed')
  })

  it('explicit overrides apply; a bad people value is ignored', () => {
    expect(resolveToggles(EDITORIAL, { people: 'allowed', noText: false })).toMatchObject({ people: 'allowed', noText: false })
    expect(resolveToggles(EDITORIAL, { people: 'faces' as never })).toMatchObject({ people: 'anonymous' })
  })

  it('maps the legacy no_people boolean', () => {
    expect(peopleFromLegacy(true, 'allowed')).toBe('none')
    expect(peopleFromLegacy(false, 'anonymous')).toBe('allowed')
    expect(peopleFromLegacy(undefined, 'anonymous')).toBe('anonymous')
  })
})

describe('buildSafetyRules', () => {
  it('editorial: brands, text, anonymous people, children, editorial scene', () => {
    const r = buildSafetyRules(EDITORIAL)
    expect(r).toMatch(/^Strict rules: /)
    expect(r).toContain('NO brand names')
    expect(r).toContain('NO text')
    expect(r).toContain('ONLY anonymously')
    expect(r).toContain('NEVER a visible face')
    expect(r).toContain('child in the frame must be unidentifiable')
    expect(r).toContain('candid editorial scene')
  })

  it('none: forbids people entirely and skips the children clause', () => {
    const r = buildSafetyRules(EDITORIAL_STRICT)
    expect(r).toContain('NO people, no hands')
    expect(r).not.toContain('anonymously')
    expect(r).not.toContain('child')
  })

  it('social: brands + children only (text and people allowed)', () => {
    const r = buildSafetyRules(SOCIAL_FLEXIBLE)
    expect(r).toContain('NO brand names')
    expect(r).toContain('child in the frame must be unidentifiable')
    expect(r).not.toContain('NO text')
    expect(r).not.toContain('NO people')
    expect(r).not.toContain('anonymously')
    expect(r).not.toContain('editorial scene')
  })
})

describe('house style', () => {
  it('is appended once and never twice', () => {
    const once = applyHouseStyle('  A dad tying a toddler\'s shoe  ')
    expect(once.startsWith('A dad tying a toddler\'s shoe\n\n')).toBe(true)
    expect(once.endsWith(HOUSE_STYLE)).toBe(true)
    expect(applyHouseStyle(once)).toBe(once)
    expect(once.split(HOUSE_STYLE_MARKER)).toHaveLength(2)
  })

  it('describes the photographer, not the subject', () => {
    expect(HOUSE_STYLE).toMatch(/documentary editorial photography/i)
    expect(HOUSE_STYLE).toMatch(/35mm/)
    expect(HOUSE_STYLE).toMatch(/Not a studio product shot/)
  })
})

const clean: QaReport = {
  altText: 'A wooden bench with a folded blanket by a window.',
  text: false, logos: false, faces: false, identifiableChild: false,
  artifacts: false, rendered: false, matchesSubject: true, notes: '',
}

describe('judgeQa', () => {
  it('passes a clean report', () => {
    expect(judgeQa(clean, EDITORIAL)).toEqual({ verdict: 'pass', reasons: [] })
  })

  it('fails on a logo in every lane, and on an identifiable child in every lane', () => {
    expect(judgeQa({ ...clean, logos: true }, SOCIAL_FLEXIBLE).verdict).toBe('fail')
    expect(judgeQa({ ...clean, identifiableChild: true }, SOCIAL_FLEXIBLE).verdict).toBe('fail')
  })

  it('text fails only where text is blocked', () => {
    expect(judgeQa({ ...clean, text: true }, EDITORIAL).verdict).toBe('fail')
    expect(judgeQa({ ...clean, text: true }, SOCIAL_FLEXIBLE).verdict).toBe('pass')
  })

  it('a face fails under none/anonymous and passes under allowed', () => {
    expect(judgeQa({ ...clean, faces: true }, EDITORIAL)).toMatchObject({ verdict: 'fail', reasons: ['a face is visible'] })
    expect(judgeQa({ ...clean, faces: true }, EDITORIAL_STRICT).reasons).toEqual(['a person is visible'])
    expect(judgeQa({ ...clean, faces: true }, { ...EDITORIAL, people: 'allowed' }).verdict).toBe('pass')
  })

  it('artifacts, a rendered look (editorial only) and a subject miss are warnings', () => {
    expect(judgeQa({ ...clean, artifacts: true }, EDITORIAL).verdict).toBe('warn')
    expect(judgeQa({ ...clean, rendered: true }, EDITORIAL).verdict).toBe('warn')
    expect(judgeQa({ ...clean, rendered: true }, SOCIAL_FLEXIBLE).verdict).toBe('pass')
    expect(judgeQa({ ...clean, matchesSubject: false }, EDITORIAL).verdict).toBe('warn')
  })

  it('a fail carries its warnings too, worst first', () => {
    const j = judgeQa({ ...clean, text: true, artifacts: true }, EDITORIAL)
    expect(j.verdict).toBe('fail')
    expect(j.reasons).toEqual(['rendered text is visible', 'generation artifacts (hands, warped objects)'])
  })

  it('avoidanceClause folds the reasons into one instruction', () => {
    expect(avoidanceClause([])).toBe('')
    expect(avoidanceClause(['a face is visible', 'rendered text is visible'])).toBe(
      'The previous attempt was rejected because: a face is visible; rendered text is visible. Avoid all of that.',
    )
  })
})
