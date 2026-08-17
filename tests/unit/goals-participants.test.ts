// Sharing a goal is the highest-consequence surface on the spine: the data behind
// it is medication and cessation logs, and the doctrine (migration 137) is that a
// partner can look and nothing more.
//
// Most of that doctrine is enforced in SQL — the tier views, the two DELETE
// policies, the sensitive-cap trigger — so what's testable here is the pure logic
// plus the copy contract, which is load-bearing in its own way: TIER_COPY is what
// the invitee reads before consenting, and if it ever promised less than the tier
// actually grants, consent stops being informed.

import { describe, it, expect } from 'vitest'
import {
  invitationState, invitationNamesPerson, isShareTier, TIERS, TIER_COPY,
} from '@/lib/goals/participants'

const NOW = new Date('2026-08-10T12:00:00Z')
const FUTURE = '2026-08-17T12:00:00Z'
const PAST = '2026-08-03T12:00:00Z'

function invite(over: Partial<Parameters<typeof invitationState>[0]> = {}) {
  return {
    acceptedAt: null,
    declinedAt: null,
    revokedAt: null,
    expiresAt: FUTURE,
    ...over,
  }
}

describe('invitationState', () => {
  it('is pending while unused and unexpired', () => {
    expect(invitationState(invite(), NOW)).toBe('pending')
  })

  it('is expired once the clock passes it', () => {
    expect(invitationState(invite({ expiresAt: PAST }), NOW)).toBe('expired')
  })

  it('reports each outcome', () => {
    expect(invitationState(invite({ acceptedAt: PAST }), NOW)).toBe('accepted')
    expect(invitationState(invite({ declinedAt: PAST }), NOW)).toBe('declined')
    expect(invitationState(invite({ revokedAt: PAST }), NOW)).toBe('revoked')
  })

  it('lets an outcome beat the clock', () => {
    // The case that matters: he was turned down, and the invite later expired.
    // Reading that as "expired" would tell him nobody ever answered.
    expect(invitationState(invite({ declinedAt: PAST, expiresAt: PAST }), NOW)).toBe('declined')
    expect(invitationState(invite({ revokedAt: PAST, expiresAt: PAST }), NOW)).toBe('revoked')
    expect(invitationState(invite({ acceptedAt: PAST, expiresAt: PAST }), NOW)).toBe('accepted')
  })

  it('treats the expiry instant itself as still good', () => {
    expect(invitationState(invite({ expiresAt: NOW.toISOString() }), NOW)).toBe('pending')
  })
})

describe('isShareTier', () => {
  it('accepts the three real tiers and nothing else', () => {
    for (const tier of TIERS) expect(isShareTier(tier)).toBe(true)
    // A form post is the only caller, so junk is the expected input.
    expect(isShareTier('owner')).toBe(false)        // savings' role name, not ours
    expect(isShareTier('contributor')).toBe(false)  // ditto
    expect(isShareTier('admin')).toBe(false)
    expect(isShareTier('')).toBe(false)
    expect(isShareTier(undefined)).toBe(false)
    expect(isShareTier(3)).toBe(false)
  })
})

describe('TIER_COPY — the consent contract', () => {
  it('describes every tier, both what they see and what they do not', () => {
    for (const tier of TIERS) {
      expect(TIER_COPY[tier].label.length).toBeGreaterThan(0)
      expect(TIER_COPY[tier].sees.length).toBeGreaterThan(0)
      expect(TIER_COPY[tier].blind.length).toBeGreaterThan(0)
    }
  })

  it('promises cheer and witness no numbers', () => {
    // The views enforce this; the copy has to match, or someone consents to one
    // thing and gets another.
    expect(TIER_COPY.cheer.blind).toMatch(/number/i)
    expect(TIER_COPY.witness.blind).toMatch(/number/i)
  })

  it('does not claim cheer sees the day-by-day', () => {
    expect(TIER_COPY.cheer.sees).not.toMatch(/each day|day-by-day|every day/i)
  })

  it('is explicit that teammate sees everything', () => {
    // The one tier where the honest answer is "all of it" — no soft-pedalling.
    expect(TIER_COPY.teammate.sees).toMatch(/whole|every/i)
  })
})

// Whether an invitation NAMES the person accepting it is the one thing standing
// between "his wife can finally accept the link he emailed her" and "anyone
// holding a forwarded link gets a relationship". It decides whether accept may
// create the connection, so every branch is asserted here rather than left to the
// route.
describe('invitationNamesPerson — may this accept create a connection', () => {
  const HER = 'user-her'
  const HIM = 'user-him'

  it('names her when the invite carries her verified user id', () => {
    expect(invitationNamesPerson(
      { inviteeUserId: HER, inviteeEmail: null },
      { userId: HER },
    )).toBe(true)
  })

  it('refuses someone else holding an id-addressed invite', () => {
    expect(invitationNamesPerson(
      { inviteeUserId: HER, inviteeEmail: null },
      { userId: HIM, verifiedEmail: 'him@example.com' },
    )).toBe(false)
  })

  // The id is the stronger claim, so it decides alone. A stale address on the same
  // row must not be able to vouch for a different person.
  it('lets the id decide even when an address on the row would match', () => {
    expect(invitationNamesPerson(
      { inviteeUserId: HER, inviteeEmail: 'him@example.com' },
      { userId: HIM, verifiedEmail: 'him@example.com' },
    )).toBe(false)
  })

  // THE PATH THAT MATTERS. She had no account when he typed her address, so there
  // was never a user id to store — matching on ids alone would never fire for the
  // person the feature exists to bring in.
  it('names her when her confirmed address matches the one he typed', () => {
    expect(invitationNamesPerson(
      { inviteeUserId: null, inviteeEmail: 'her@example.com' },
      { userId: HER, verifiedEmail: 'her@example.com' },
    )).toBe(true)
  })

  it('ignores casing and surrounding whitespace on both sides', () => {
    expect(invitationNamesPerson(
      { inviteeUserId: null, inviteeEmail: '  Her@Example.COM ' },
      { userId: HER, verifiedEmail: 'her@example.com' },
    )).toBe(true)
  })

  // An unconfirmed address is a claim, not proof: the route passes null for it.
  it('refuses when the accepter has no verified address', () => {
    expect(invitationNamesPerson(
      { inviteeUserId: null, inviteeEmail: 'her@example.com' },
      { userId: HER, verifiedEmail: null },
    )).toBe(false)
    expect(invitationNamesPerson(
      { inviteeUserId: null, inviteeEmail: 'her@example.com' },
      { userId: HER },
    )).toBe(false)
  })

  it('refuses a different address', () => {
    expect(invitationNamesPerson(
      { inviteeUserId: null, inviteeEmail: 'her@example.com' },
      { userId: HIM, verifiedEmail: 'him@example.com' },
    )).toBe(false)
  })

  // A BARE LINK IS ADDRESSED TO NOBODY, and must stay that way: accepting one
  // creates participation (the token is the whole addressing, deliberately) but
  // must never mint a connection, which would add DM access on top.
  it('names nobody for a bare link invite', () => {
    expect(invitationNamesPerson(
      { inviteeUserId: null, inviteeEmail: null },
      { userId: HER, verifiedEmail: 'her@example.com' },
    )).toBe(false)
  })

  // Two empties are not a match. Without this, a row with no address and a user
  // with no address would agree on nothing and pass.
  it('does not treat two blank addresses as agreement', () => {
    expect(invitationNamesPerson(
      { inviteeUserId: null, inviteeEmail: '' },
      { userId: HER, verifiedEmail: '' },
    )).toBe(false)
    expect(invitationNamesPerson(
      { inviteeUserId: null, inviteeEmail: '   ' },
      { userId: HER, verifiedEmail: '   ' },
    )).toBe(false)
  })
})
