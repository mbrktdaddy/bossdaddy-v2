import { describe, it, expect } from 'vitest'
import {
  EDITORIAL,
  EDITORIAL_STRICT,
  SOCIAL_FLEXIBLE,
  buildSafetyRules,
  resolveToggles,
  peopleFromLegacy,
} from '@/lib/images/safety'
import {
  CROP_NOTE_MARKER,
  HOUSE_STYLE,
  HOUSE_STYLE_MARKER,
  applyCropNote,
  ILLUSTRATION_STYLE,
  ILLUSTRATION_STYLE_MARKER,
  REFERENCE_NOTE,
  applyHouseStyle,
  applyIllustrationStyle,
  applyLook,
  applyReferenceNote,
  cropNote,
  referenceNote,
} from '@/lib/images/style'
import { ILLUSTRATION_RULE, doctrineBlock } from '@/lib/images/doctrine'
import { judgeQa, avoidanceClause, quotedText, type QaReport } from '@/lib/images/qa'

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

describe('illustration look', () => {
  it('style text is applied once and applyLook picks by look', () => {
    expect(applyIllustrationStyle('A porch at dusk.')).toBe(`A porch at dusk.

${ILLUSTRATION_STYLE}`)
    expect(applyIllustrationStyle(applyIllustrationStyle('A porch.'))).toBe(applyIllustrationStyle('A porch.'))
    expect(applyLook('A porch.', 'illustration')).toContain(ILLUSTRATION_STYLE_MARKER)
    expect(applyLook('A porch.', 'illustration')).not.toContain(HOUSE_STYLE_MARKER)
    expect(applyLook('A porch.', 'photo')).toBe(applyHouseStyle('A porch.'))
  })

  it('the reference note and the editorial safety clause follow the look', () => {
    expect(referenceNote('photo')).toBe(REFERENCE_NOTE)
    expect(referenceNote('illustration')).toContain('finished illustration')
    expect(applyReferenceNote('x', 'illustration')).toContain('cleaner line, flatter fills')
    expect(buildSafetyRules(EDITORIAL, 'illustration')).toContain('An editorial illustration of a real-world scene')
    expect(buildSafetyRules(EDITORIAL)).toBe(buildSafetyRules(EDITORIAL, 'photo'))
    expect(buildSafetyRules(EDITORIAL)).toContain('A candid editorial scene')
  })

  it('doctrineBlock adds the illustration rule only for that look', () => {
    expect(doctrineBlock({ people: 'anonymous', allowText: false, look: 'illustration' })).toContain(ILLUSTRATION_RULE)
    expect(doctrineBlock({ people: 'anonymous', allowText: false })).not.toContain(ILLUSTRATION_RULE)
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

describe('crop note', () => {
  const aspects = ['16:10', '4:5'] as const

  it('both aspects produce a Composition clause that names the crop', () => {
    for (const aspect of aspects) {
      const note = cropNote(aspect)
      expect(note.startsWith(CROP_NOTE_MARKER)).toBe(true)
      expect(note).toContain(`centre-cropped to ${aspect}`)
      expect(note).toContain('keep the subject in the central band')
      expect(note.endsWith('nothing that matters near the top or bottom edges.')).toBe(true)
    }
  })

  it('only the 4:5 note mentions the taller portrait it is cropped from', () => {
    expect(cropNote('4:5')).toContain('from a taller portrait')
    expect(cropNote('16:10')).not.toContain('taller portrait')
    expect(cropNote('16:10')).toContain('breathing room on every side')
  })

  it('is appended once and never twice', () => {
    for (const aspect of aspects) {
      const once = applyCropNote('  A bench by a window  ', aspect)
      expect(once.startsWith('A bench by a window\n\n')).toBe(true)
      expect(once.endsWith(cropNote(aspect))).toBe(true)
      expect(applyCropNote(once, aspect)).toBe(once)
      expect(once.split(CROP_NOTE_MARKER)).toHaveLength(2)
    }
  })

  it('leaves a prompt that already has a Composition clause alone', () => {
    const authored = 'A bench by a window. Composition: low angle, bench on the left third.'
    expect(applyCropNote(authored, '16:10')).toBe(authored)
  })

  it('lands after the house style, the order the generator builds an editorial prompt in', () => {
    const styled = applyHouseStyle('A bench by a window')
    const full = applyCropNote(styled, '16:10')
    expect(full.startsWith(styled)).toBe(true)
    expect(full.indexOf(HOUSE_STYLE_MARKER)).toBeLessThan(full.indexOf(CROP_NOTE_MARKER))
  })
})

const clean: QaReport = {
  altText: 'A wooden bench with a folded blanket by a window.',
  text: false, logos: false, faces: false, identifiableChild: false,
  artifacts: false, rendered: false, matchesSubject: true, textSeen: '', publishable: 4, notes: '',
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

  it('an illustration look swaps the rendered warning wording; a photo look is unchanged', () => {
    expect(judgeQa({ ...clean, rendered: true }, EDITORIAL, { look: 'illustration' })).toEqual({
      verdict: 'warn',
      reasons: ['looks like clip art or a 3D render, not a drawn illustration'],
    })
    expect(judgeQa({ ...clean, rendered: true }, EDITORIAL, { look: 'photo' }).reasons).toEqual([
      'looks rendered or staged, not a candid photograph',
    ])
    expect(judgeQa({ ...clean, rendered: true }, SOCIAL_FLEXIBLE, { look: 'illustration' }).verdict).toBe('pass')
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

describe('judgeQa text read-back', () => {
  const opts = { expectedText: 'Boss Up' }

  it('passes when the text reads as expected, ignoring case and punctuation', () => {
    const j = judgeQa({ ...clean, text: true, textSeen: 'BOSS UP.' }, SOCIAL_FLEXIBLE, opts)
    expect(j).toEqual({ verdict: 'pass', reasons: [] })
  })

  it('fails when the text reads differently', () => {
    const j = judgeQa({ ...clean, text: true, textSeen: 'Boss Up Dad' }, SOCIAL_FLEXIBLE, opts)
    expect(j.verdict).toBe('fail')
    expect(j.reasons).toEqual(['text reads "Boss Up Dad" instead of "Boss Up"'])
  })

  it('fails when no text was rendered', () => {
    const j = judgeQa({ ...clean, text: false }, SOCIAL_FLEXIBLE, opts)
    expect(j.verdict).toBe('fail')
    expect(j.reasons).toEqual(['expected text "Boss Up" is missing'])
  })

  it('noText lanes keep the existing rule; the read-back does not fire', () => {
    const j = judgeQa({ ...clean, text: true, textSeen: 'Boss Up Dad' }, EDITORIAL, opts)
    expect(j.reasons).toEqual(['rendered text is visible'])
    expect(judgeQa(clean, EDITORIAL, opts)).toEqual({ verdict: 'pass', reasons: [] })
  })

  it('text allowed with no expected text: any text passes', () => {
    expect(judgeQa({ ...clean, text: true, textSeen: 'OPEN' }, SOCIAL_FLEXIBLE).verdict).toBe('pass')
  })
})

describe('judgeQa publishable score', () => {
  it('a score under 3 warns', () => {
    expect(judgeQa({ ...clean, publishable: 2 }, EDITORIAL)).toEqual({
      verdict: 'warn',
      reasons: ['weak as a photograph (publishable 2/5)'],
    })
  })

  it('a 3 passes', () => {
    expect(judgeQa({ ...clean, publishable: 3 }, EDITORIAL)).toEqual({ verdict: 'pass', reasons: [] })
  })

  it('a fail still lists the weak-score warning after the fails', () => {
    const j = judgeQa({ ...clean, text: true, publishable: 1 }, EDITORIAL)
    expect(j.verdict).toBe('fail')
    expect(j.reasons).toEqual(['rendered text is visible', 'weak as a photograph (publishable 1/5)'])
  })
})

describe('quotedText', () => {
  it('reads straight double quotes', () => {
    expect(quotedText('A hand-painted sign that says "Boss Up" on a barn')).toBe('Boss Up')
  })

  it('reads curly double quotes', () => {
    expect(quotedText('A mug printed with “Dad Mode” in block letters')).toBe('Dad Mode')
  })

  it('reads curly single quotes', () => {
    expect(quotedText('A chalkboard reading ‘Open Late’')).toBe('Open Late')
  })

  it('ignores apostrophes', () => {
    expect(quotedText("A bench at a kid's eye level")).toBeNull()
  })

  it('skips a long quote in favour of a later short one', () => {
    const long = '"one two three four five six seven eight nine"'
    expect(quotedText(`A banner with ${long} and a tag that says "Ship It"`)).toBe('Ship It')
  })

  it('returns null for a quote over 60 characters', () => {
    expect(quotedText(`A sign: "${'a'.repeat(70)}"`)).toBeNull()
  })

  it('returns null for an empty prompt', () => {
    expect(quotedText('')).toBeNull()
  })
})
