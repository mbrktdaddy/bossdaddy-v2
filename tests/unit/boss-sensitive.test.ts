import { describe, it, expect } from 'vitest'
import { isSensitive } from '@/lib/boss/agent'

describe('isSensitive (gap G — word-boundary / stem, safe-default-up)', () => {
  it('matches the inflections the old substring list missed', () => {
    // 'hurt myself' (old literal) missed the -ing form.
    expect(isSensitive('I keep thinking about hurting myself')).toBe(true)
    expect(isSensitive('I want to hurt myself')).toBe(true)
    // stems catch every inflection.
    expect(isSensitive('I feel suicidal')).toBe(true)
    expect(isSensitive('thoughts of suicide')).toBe(true)
    expect(isSensitive('what should I be investing in')).toBe(true)
    expect(isSensitive('going through a divorce')).toBe(true)
    expect(isSensitive('my custody hearing is next week')).toBe(true)
  })

  it('catches single words the old space-padded list missed', () => {
    // ' sue ' (space-padded) missed these positions.
    expect(isSensitive('can I sue him')).toBe(true)
    expect(isSensitive('should I sue.')).toBe(true)
    expect(isSensitive('thinking about suing my landlord')).toBe(true)
  })

  it('covers each of the four deflect lanes', () => {
    expect(isSensitive('what dosage of tylenol')).toBe(true) // medical
    expect(isSensitive('is 988 the crisis line')).toBe(false) // number alone is not a trigger
    expect(isSensitive('should I buy this stock')).toBe(true) // financial
    expect(isSensitive('do I owe taxes on this')).toBe(true) // tax
    expect(isSensitive('I need an attorney')).toBe(true) // legal
    expect(isSensitive('reading the symptoms online')).toBe(true) // medical
  })

  it('leaves ordinary dad questions on the fast lane', () => {
    expect(isSensitive('best stroller under $300')).toBe(false)
    expect(isSensitive('how do I fix a squeaky hinge')).toBe(false)
    expect(isSensitive('plan a saturday with a 3 year old')).toBe(false)
    expect(isSensitive('write a birthday toast for my dad')).toBe(false)
  })
})
