import { describe, it, expect } from 'vitest'
import { aiAssistanceLabel } from '@/components/content/AiAssistanceNote'

// The byline is the ONE AI disclosure per page (no per-image captions).
describe('aiAssistanceLabel', () => {
  it('says nothing for a human piece with no AI imagery', () => {
    expect(aiAssistanceLabel('human')).toBeNull()
    expect(aiAssistanceLabel(null)).toBeNull()
    expect(aiAssistanceLabel(undefined, false)).toBeNull()
  })

  it('collapses drafted/assisted to one short phrase', () => {
    expect(aiAssistanceLabel('ai-drafted')).toBe('AI-assisted')
    expect(aiAssistanceLabel('ai-assisted')).toBe('AI-assisted')
  })

  it('adds the illustrations note only when the page has an AI image', () => {
    expect(aiAssistanceLabel('human', true)).toBe('Illustrations AI-generated')
    expect(aiAssistanceLabel('ai-drafted', true)).toBe('AI-assisted · Illustrations AI-generated')
  })
})
