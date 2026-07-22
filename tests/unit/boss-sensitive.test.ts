import { describe, it, expect } from 'vitest'
import { isSensitive } from '@/lib/boss/agent'

// SCOPE (crisis-only router): isSensitive now force-routes ONLY crisis / self-harm
// to the careful Claude lane — the one irreversible-stakes case that warrants a
// forced model switch (and the provider-agnostic safety floor). Legal / medical /
// financial no longer route here on purpose: the prompt's "point to a pro" block
// handles them on the everyday lane, so they read as NOT sensitive to the router.
describe('isSensitive (crisis-only router, safe-default-up)', () => {
  it('matches crisis / self-harm inflections (word-boundary / stem)', () => {
    // 'hurt myself' — stem catches the -ing form the old literal missed.
    expect(isSensitive('I keep thinking about hurting myself')).toBe(true)
    expect(isSensitive('I want to hurt myself')).toBe(true)
    // suicid stem catches every inflection.
    expect(isSensitive('I feel suicidal')).toBe(true)
    expect(isSensitive('thoughts of suicide')).toBe(true)
    // other crisis stems.
    expect(isSensitive('I keep thinking about ending it all')).toBe(true)
    expect(isSensitive('I want to end my life')).toBe(true)
    expect(isSensitive('what if I overdosed')).toBe(true)
    expect(isSensitive('is this self-harm')).toBe(true)
    expect(isSensitive('am I self harming')).toBe(true)
  })

  it('does NOT route legal / medical / financial — the prompt handles those', () => {
    // These are real deflect lanes, but they need the PROMPT (general info + name a
    // pro), not a model switch. Any capable model handles them on the everyday lane.
    expect(isSensitive('what dosage of tylenol')).toBe(false) // medical
    expect(isSensitive('reading the symptoms online')).toBe(false) // medical
    expect(isSensitive('what should I be investing in')).toBe(false) // financial
    expect(isSensitive('should I buy this stock')).toBe(false) // financial
    expect(isSensitive('do I owe taxes on this')).toBe(false) // tax
    expect(isSensitive('going through a divorce')).toBe(false) // legal
    expect(isSensitive('my custody hearing is next week')).toBe(false) // legal
    expect(isSensitive('I need an attorney')).toBe(false) // legal
    expect(isSensitive('can I sue him')).toBe(false) // legal
  })

  it('leaves ordinary dad questions on the fast lane', () => {
    expect(isSensitive('is 988 the crisis line')).toBe(false) // bare number is not a trigger
    expect(isSensitive('best stroller under $300')).toBe(false)
    expect(isSensitive('how do I fix a squeaky hinge')).toBe(false)
    expect(isSensitive('plan a saturday with a 3 year old')).toBe(false)
    expect(isSensitive('write a birthday toast for my dad')).toBe(false)
  })
})
