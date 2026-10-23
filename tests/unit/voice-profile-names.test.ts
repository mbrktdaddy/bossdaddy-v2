import { describe, it, expect } from 'vitest'
import { formatVoiceProfileForPrompt, voiceProfileFactLines, type VoiceProfile } from '@/lib/voiceProfile'

// Operator rule 2026-10-23: family by relationship only — never a name — in
// anything generated for publication. The Boss (private to the member) opts in.
const profile: VoiceProfile = {
  id: 'p', user_id: 'u', updated_at: '2026-01-01',
  family_members: [
    { id: '1', relationship: 'Daughter', name: 'Avery', dob: '2024-01-15', gender: 'female' },
    { id: '2', relationship: 'Wife', name: null, dob: null, gender: null },
  ],
  occupation: null, faith_values: null, region: null, facts: [],
}
const now = new Date('2026-10-23T00:00:00Z')

describe('voiceProfileFactLines', () => {
  it('omits names by default', () => {
    const lines = voiceProfileFactLines(profile, now)
    expect(lines.join('\n')).not.toContain('Avery')
    expect(lines[0]).toMatch(/^- Daughter: \d+ years old$/)
    expect(lines[1]).toBe('- Wife')
  })
  it('includes names only when asked (the Boss)', () => {
    const lines = voiceProfileFactLines(profile, now, { includeNames: true })
    expect(lines[0]).toMatch(/^- Daughter \(Avery\): \d+ years old$/)
  })
})

describe('formatVoiceProfileForPrompt', () => {
  it('never carries a name and states the relationship-only rule', () => {
    const block = formatVoiceProfileForPrompt(profile, now)!
    expect(block).not.toContain('Avery')
    expect(block).toContain('by relationship only')
    expect(block).toContain('never invent personal details')
  })
})
