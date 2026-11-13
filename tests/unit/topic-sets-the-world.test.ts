import { describe, it, expect } from 'vitest'
import { BOSS_DADDY_SYSTEM } from '@/lib/claude/client'
import { OutlineEdit, OutlineOutput, buildOutline, outlinePrompt, type OutlineModelOutput } from '@/lib/content/pipeline/outline'
import { sectionPrompt } from '@/lib/content/pipeline/section'
import { CRITIC_CODES, criticPrompt } from '@/lib/content/pipeline/critic/model'
import { imagesPrompt, validateImagePlan } from '@/lib/content/pipeline/images'
import type { Brief, Outline, RunState } from '@/lib/content/pipeline/types'
import {
  ANONYMOUS_PHRASES,
  IMAGE_SHOTS,
  SETTING_FAMILIES,
  SETTING_GUIDE,
  SHOT_GUIDE,
  TOPIC_WORLD_RULE,
  WEATHER_BY_SEASON,
  atmosphereLine,
  doctrineBlock,
  peopleRule,
  pickAtmosphere,
  textRule,
} from '@/lib/images/doctrine'
import { EDITORIAL, SOCIAL_FLEXIBLE, buildSafetyRules, defaultPeopleForLook } from '@/lib/images/safety'
import { HOUSE_STYLE } from '@/lib/images/style'
import { judgeQa, type QaReport } from '@/lib/images/qa'

// 2026-11-13 — the topic sets the register (prose) and the world (pictures).
// The reader is a man who is a father; the piece is about its topic. These
// tests pin the decision at every layer: the system prompt, the outline, the
// sections, the critic, the image doctrine, the house style, the safety
// clauses, vision QA and the planner. Doctrine: brand-guide §1.6 + §2 "Images".

const review: Brief = { contentType: 'review', productName: 'Battery Daddy', category: 'garage', keyFeatures: [], specs: [], competitors: [], imageSlots: 'auto', ratingHint: 7 }
const guide = (pieceType: 'essay' | 'howto' | 'guide', inquiryMode: boolean, category = 'table-duty'): Brief =>
  ({ contentType: 'guide', topic: 'Does multiculturalism work?', category, pieceType, keyPoints: [], productSlugs: [], imageSlots: 'auto', inquiryMode })

const blocks = { tldr: false, keyTakeaways: false, faqs: false, bestFor: false, notFor: false, prosCons: false }

const outline = (over: Partial<Outline> = {}): Outline => ({
  title: 'Does Multiculturalism Work?', titleOptions: [], excerpt: 'e', imageCount: 2, related: [], duplicateWarning: null,
  blocks: { ...blocks, subScores: false },
  parts: [
    { kind: 'intro', heading: '', intent: 'open', notes: [], targetWords: 60, productToken: null },
    { kind: 'body', heading: 'What the studies measure', intent: 'read the research', notes: [], targetWords: 250, productToken: null },
    { kind: 'closing', heading: 'Wrapping Up', intent: 'land it', notes: [], targetWords: 120, productToken: null },
  ],
  ...over,
})

const run = (brief: Brief, over: Partial<RunState> = {}): RunState => ({
  id: 'r', userId: 'u', contentType: brief.contentType, status: 'images', brief,
  outline: outline(),
  sections: [{ text: 'Intro.', generationId: null }, { text: 'Body.', generationId: null }, { text: 'Close.', generationId: null }],
  blocks: null, critic: null, images: null, contentId: null, costUsd: 0, error: null, promptVersion: 'v', createdAt: '', updatedAt: '',
  ...over,
})

describe('the topic sets the register — prose', () => {
  it('the system prompt carries the register doctrine and no longer frames every piece at the family table', () => {
    expect(BOSS_DADDY_SYSTEM).toContain('THE TOPIC SETS THE REGISTER')
    expect(BOSS_DADDY_SYSTEM).toContain('fishing guide is a fishing guide')
    expect(BOSS_DADDY_SYSTEM).not.toContain('Every piece answers one question')
    expect(BOSS_DADDY_SYSTEM).toContain('Real-Conditions Proof')
    expect(BOSS_DADDY_SYSTEM).not.toContain('Family Proof')
  })

  it('the outline decides the register before the parts; the edit schema keeps it and tolerates its absence', () => {
    const keys = Object.keys(OutlineOutput.shape)
    expect(keys.indexOf('register')).toBeGreaterThan(-1)
    expect(keys.indexOf('register')).toBeLessThan(keys.indexOf('parts'))
    const edit = { title: 'T', excerpt: 'E', parts: outline().parts, blocks: { ...blocks, subScores: false }, imageCount: 0 }
    expect(OutlineEdit.safeParse({ ...edit, register: 'All river, no nursery.' }).success).toBe(true)
    expect(OutlineEdit.safeParse(edit).success).toBe(true)
  })

  it('buildOutline keeps the register, trimmed', () => {
    const model: OutlineModelOutput = {
      titleOptions: ['A', 'B'], register: '  A river piece: all water. ', excerpt: 'e', imageCount: 1, elements: [], blocks,
      parts: [
        { kind: 'intro', heading: '', intent: 'open', notes: [], targetWords: 60, format: 'prose' },
        { kind: 'body', heading: 'H', intent: 'i', notes: [], targetWords: 200, format: 'prose' },
        { kind: 'closing', heading: 'C', intent: 'c', notes: [], targetWords: 100, format: 'prose' },
      ],
    }
    expect(buildOutline(model, guide('guide', false, 'outdoors-adventure'), []).register).toBe('A river piece: all water.')
  })

  it('outlinePrompt asks for the register first and stops saying dad-focused', () => {
    const p = outlinePrompt(guide('guide', false, 'outdoors-adventure'), [])
    expect(p).toContain('decide "register" first')
    expect(p).not.toContain('dad-focused')
    expect(p).toContain('Headings come from the subject')
  })

  it('sectionPrompt carries the register into every part with the subject-terms rule', () => {
    const r = run(guide('guide', false, 'outdoors-adventure'), { outline: outline({ register: 'A river piece: all water, the kids never appear.' }) })
    const p = sectionPrompt(r, 1)
    expect(p).toContain('Register (set at the outline): A river piece: all water, the kids never appear.')
    expect(p).toContain("on the subject's own terms")
    expect(p).not.toContain('first-person dad')
    expect(sectionPrompt(run(review), 1)).toContain('a tool, not the frame')
  })

  it('the critic sees the register and owns a forced-angle code', () => {
    expect(CRITIC_CODES).toContain('forced-angle')
    const p = criticPrompt(run(guide('guide', true), { outline: outline({ register: 'Research first; family stakes in the closing.' }) }), null)
    expect(p).toContain('Register (the outline')
    expect(p).toContain('"forced-angle"')
  })
})

describe('the topic sets the world — doctrine, style, safety, QA', () => {
  const clean: QaReport = {
    altText: 'A street.', text: false, logos: false, faces: false, identifiableChild: false, likeness: false,
    artifacts: false, rendered: false, matchesSubject: true, textSeen: '', publishable: 4, notes: '',
  }

  it('the house style is the camera, not a palette: no warm grade, no clutter; the light follows the hour', () => {
    expect(HOUSE_STYLE).not.toMatch(/earthy|clutter|warm colour|warm accent/)
    expect(HOUSE_STYLE).toMatch(/hour and weather/)
    expect(HOUSE_STYLE).toMatch(/35mm/)
  })

  it('the doctrine leads with the topic-world rule, names the stand-in trap and the settings', () => {
    const d = doctrineBlock({ people: 'anonymous', allowText: false })
    expect(d.indexOf(TOPIC_WORLD_RULE)).toBeGreaterThan(0)
    expect(d.indexOf(TOPIC_WORLD_RULE)).toBeLessThan(d.indexOf('Never ask for:'))
    expect(d).toContain('blanked-out stand-in')
    expect(d).toContain('Settings (name one per picture)')
    expect(d).toContain('nothing defaults to autumn and dusk')
    expect(d).not.toContain('boots on a porch step')
  })

  it('anonymous is not absent; drawn faces are allowed in the illustration look; a likeness never', () => {
    expect(peopleRule('anonymous')).toContain('Anonymous is not absent')
    expect(peopleRule('allowed', 'illustration')).toContain('Drawn figures may have faces')
    expect(peopleRule('allowed')).toContain('never a recognisable or famous person')
    expect(defaultPeopleForLook('illustration')).toBe('allowed')
    expect(defaultPeopleForLook('photo')).toBe('anonymous')
    expect(buildSafetyRules(SOCIAL_FLEXIBLE)).toContain('NEVER a recognisable real person')
    expect(judgeQa({ ...clean, likeness: true }, SOCIAL_FLEXIBLE)).toMatchObject({ verdict: 'fail', reasons: ['a real person or public figure is depicted'] })
    expect(judgeQa({ ...clean, likeness: true }, EDITORIAL).verdict).toBe('fail')
    expect(judgeQa({ ...clean, faces: true }, { ...EDITORIAL, people: 'allowed' }).verdict).toBe('pass')
  })

  it('no text means no READABLE text — a blurred storefront is allowed', () => {
    expect(textRule(false)).toContain('No text of any kind the viewer could read')
    expect(buildSafetyRules(EDITORIAL)).toContain('NO text that can be read')
  })

  it('the anonymous bank, the shot list and the settings reach past the house', () => {
    expect(ANONYMOUS_PHRASES.join(' ')).toMatch(/crowd/)
    expect(ANONYMOUS_PHRASES.join(' ')).not.toMatch(/porch/)
    expect(IMAGE_SHOTS).toEqual(['wide', 'medium', 'detail', 'overhead', 'pov', 'low', 'through', 'aerial'])
    for (const s of IMAGE_SHOTS) expect(SHOT_GUIDE[s]).toBeTruthy()
    for (const s of SETTING_FAMILIES) expect(SETTING_GUIDE[s]).toBeTruthy()
    expect(SETTING_FAMILIES).toContain('institution')
  })

  it('pickAtmosphere is deterministic under a fixed rng and keeps the weather in season', () => {
    const a = pickAtmosphere(() => 0)
    expect(a).toEqual({ season: 'spring', hour: 'first light', weather: WEATHER_BY_SEASON.spring[0] })
    const b = pickAtmosphere(() => 0.999)
    expect(b.season).toBe('winter')
    expect(WEATHER_BY_SEASON.winter).toContain(b.weather)
    expect(atmosphereLine(a)).toContain('spring, first light')
    expect(atmosphereLine(a)).toContain('Never default to autumn and dusk')
  })
})

describe('the topic sets the world — the planner', () => {
  const atmosphere = { season: 'winter' as const, hour: 'hard noon', weather: 'snow on the ground' }

  it('decides the world first, gets the atmosphere, and leads with the topic-world rule', () => {
    const p = imagesPrompt(run(guide('guide', true)), { atmosphere })
    expect(p).toContain('Decide "world" before anything else')
    expect(p).toContain('winter, hard noon, snow on the ground')
    expect(p).toContain(TOPIC_WORLD_RULE)
    expect(p).toContain('that is the reader, not the setting')
  })

  it('an inquiry piece plans illustrations with drawn faces; a personal essay outside the pillars stays a photograph with anonymous people', () => {
    const inquiry = imagesPrompt(run(guide('guide', true)), { atmosphere })
    expect(inquiry).toContain('drawn figures may carry simple faces')
    expect(inquiry).toContain('Drawn figures may have faces')
    const essay = imagesPrompt(run(guide('essay', false, 'home-lifestyle')), { atmosphere })
    expect(essay).toContain('People appear only anonymously')
    expect(essay).not.toContain('drawn figures may carry simple faces')
    expect(essay).toContain('never a stock metaphor')
  })

  it('draws a random atmosphere when none is given', () => {
    expect(imagesPrompt(run(review))).toMatch(/use this season, hour and weather: (spring|summer|autumn|winter), /)
  })

  it('validateImagePlan keeps the world, keeps a through hero, never a detail, and gives a low shot the tall frame', () => {
    const parts = outline().parts
    const plan = validateImagePlan({
      world: ' A mid-sized city: a market street, a school gate. ', heroPrompt: 'h', heroShot: 'through',
      inline: [{ afterHeading: 'What the studies measure', prompt: 'p', shot: 'low', altText: 'a', caption: 'c' }],
    }, parts, 2)
    expect(plan.world).toBe('A mid-sized city: a market street, a school gate.')
    expect(plan.heroShot).toBe('through')
    expect(plan.inline[0]).toMatchObject({ shot: 'low', aspect: '4:5' })
    expect(validateImagePlan({ heroPrompt: 'h', heroShot: 'detail', inline: [] }, parts, 0).heroShot).toBe('medium')
    expect(validateImagePlan({ heroPrompt: 'h', inline: [] }, parts, 0)).not.toHaveProperty('world')
  })
})
