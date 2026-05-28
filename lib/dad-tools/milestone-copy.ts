// Locked headline copy templates for Weekends Until.
//
// Voice pattern (locked 2026-05-26):
//   - Declarative weight for the heaviest moments (Until 18, Next birthday)
//   - Reflective question form for milestones needing emotional space
//     (Starts school, Gets license, Summer, Custom)
//   - Always pair the number with a forward verb call or question
//   - Use the kid's name where available; fall back to "your kid"
//
// See docs/dad-tools-plan.md §4.2 for the locked templates and the
// decision history that produced them. DO NOT edit copy without an
// explicit voice review.

import type { Milestone, Unit } from './calc'

const NO_NAME_FALLBACK = 'your kid'

function whoLower(name: string | null | undefined): string {
  const trimmed = name?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : NO_NAME_FALLBACK
}

function whoUpper(name: string | null | undefined): string {
  const trimmed = name?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : 'Your kid'
}

function unitWord(unit: Unit, N: number): string {
  if (unit === 'weekends') return N === 1 ? 'weekend' : 'weekends'
  return N === 1 ? 'bedtime' : 'bedtimes'
}

export function milestoneHeadline(opts: {
  milestone: Milestone
  N: number
  unit: Unit
  name: string | null
  age: number
  customLabel?: string | null
}): string {
  const { milestone, N, unit, name, age, customLabel } = opts
  const who = whoLower(name)
  const u = unitWord(unit, N)

  switch (milestone) {
    case 'until_18':
      return `${N} ${u}. That’s what you’ve got before ${who} is out of the house. Make them count.`

    case 'next_birthday':
      return `${N} ${u}. Then ${who} turns ${age + 1}. Plan something they’ll remember.`

    case 'starts_school':
      return `${N} ${u}. Then your time with ${who} will be very limited. What should you do before then?`

    case 'gets_license':
      return `${N} ${u}. Then ${who} drives themselves wherever they want. What will you miss most?`

    case 'summer':
      return `${N} ${u}. What plans should you make for this summer with ${who}?`

    case 'custom':
      return `${N} ${u} until ${customLabel?.trim() || 'then'}. What needs to happen before then?`
  }
}

// Copy when the kid has already crossed a backward-looking milestone (already 18,
// already in school, already driving). The result page swaps to a fallback
// milestone (next_birthday usually) and shows this line above the result.
export function milestonePassedHeadline(opts: {
  milestone: Milestone
  name: string | null
}): string {
  const { milestone, name } = opts
  const who = whoUpper(name)

  switch (milestone) {
    case 'until_18':
    case 'starts_school':
    case 'gets_license':
      return `${who} crossed that line already. Here’s what’s left until the next one.`
    case 'next_birthday':
    case 'summer':
    case 'custom':
      // These never go past; fallback should never fire.
      return ''
  }
}

// Edge-case copy for a kid in their first ~month of life.
export function brandNewHeadline(name: string | null): string {
  const who = whoLower(name)
  return `940 weekends ahead with ${who}. Welcome to the deep end.`
}
