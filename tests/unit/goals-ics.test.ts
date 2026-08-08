// The ICS serializer fails SILENTLY when it's wrong: the feed imports, the
// calendar shows nothing or shows garbage, and there is no error anywhere for
// anybody to read. That's the whole reason these are unit tests rather than a
// "looks fine in Google Calendar" check.

import { describe, it, expect } from 'vitest'
import { buildCalendar, escapeText, foldLine, icsStamp } from '@/lib/goals/ics'

const NOW = new Date('2026-08-08T14:30:00.000Z')

const event = {
  uid: '11111111-1111-4111-8111-111111111111',
  summary: 'Take my meds',
  dtstartLine: 'DTSTART;TZID=America/Chicago:20260808T080000',
  rruleLine: 'RRULE:FREQ=DAILY',
}

function build(events = [event]) {
  return buildCalendar(events, {
    calendarName: 'Boss Daddy — Goals',
    domain: 'bossdaddylife.com',
    now: NOW,
  })
}

describe('buildCalendar', () => {
  it('emits CRLF line endings, never bare LF', () => {
    // §3.1, and Outlook rejects LF-only content outright.
    const out = build()
    expect(out).toContain('\r\n')
    expect(out.replace(/\r\n/g, '')).not.toContain('\n')
  })

  it('opens and closes the calendar and the event', () => {
    const out = build()
    expect(out.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(out.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(out).toContain('BEGIN:VEVENT\r\n')
    expect(out).toContain('END:VEVENT\r\n')
  })

  it('carries the required calendar properties', () => {
    const out = build()
    expect(out).toContain('VERSION:2.0')
    expect(out).toContain('PRODID:-//Boss Daddy//Goals//EN')
    expect(out).toContain('X-WR-CALNAME:Boss Daddy — Goals')
  })

  it('passes the DTSTART and RRULE through untouched', () => {
    // These come from icsRuleLines(), which is already tested against the
    // recurrence engine. Re-deriving or "cleaning" them here is how the calendar
    // and the reminders would drift apart.
    const out = build()
    expect(out).toContain('DTSTART;TZID=America/Chicago:20260808T080000')
    expect(out).toContain('RRULE:FREQ=DAILY')
  })

  it('builds a stable UID from the id it was given', () => {
    // A UID that changed per fetch would make every poll delete and recreate every
    // event — a notification storm on his phone, every few hours, forever.
    expect(build()).toContain(`UID:${event.uid}@bossdaddylife.com`)
    expect(build()).toEqual(build())
  })

  it('marks events transparent so a reminder does not read as busy', () => {
    expect(build()).toContain('TRANSP:TRANSPARENT')
  })

  it('emits no VALARM', () => {
    // Push and email already fire for the same occurrence. A calendar alarm would
    // be the second nudge for one dose.
    expect(build()).not.toContain('VALARM')
  })

  it('defaults to a short duration rather than an all-day block', () => {
    expect(build()).toContain('DURATION:PT15M')
    expect(buildCalendar([{ ...event, durationMinutes: 45 }], {
      calendarName: 'x', domain: 'd', now: NOW,
    })).toContain('DURATION:PT45M')
  })

  it('omits DESCRIPTION when there is nothing to say', () => {
    expect(build()).not.toContain('DESCRIPTION:')
    expect(buildCalendar([{ ...event, description: '  ' }], {
      calendarName: 'x', domain: 'd', now: NOW,
    })).not.toContain('DESCRIPTION:')
  })

  it('renders one VEVENT per schedule', () => {
    const out = build([event, { ...event, uid: 'second-id', summary: 'Lift' }])
    expect(out.match(/BEGIN:VEVENT/g)).toHaveLength(2)
  })

  it('is deterministic for a fixed clock', () => {
    // DTSTAMP is the only moving part, and it's injected — so a poll that returns
    // byte-identical content lets clients skip the diff entirely.
    expect(build()).toBe(build())
    expect(build()).toContain('DTSTAMP:20260808T143000Z')
  })
})

describe('escapeText', () => {
  it('escapes backslash before anything else', () => {
    // Wrong order and the escapes we add get escaped again: a title with a
    // backslash comes out mangled.
    expect(escapeText('a\\b')).toBe('a\\\\b')
  })

  it('escapes semicolons, commas and newlines', () => {
    expect(escapeText('one; two, three')).toBe('one\\; two\\, three')
    expect(escapeText('line\nbreak')).toBe('line\\nbreak')
    expect(escapeText('crlf\r\nbreak')).toBe('crlf\\nbreak')
  })

  it('does NOT escape colons', () => {
    // The common overcorrection — it renders as a literal backslash in the title.
    expect(escapeText('Meds: morning')).toBe('Meds: morning')
  })

  it('survives a real-world goal title', () => {
    const out = escapeText('Quit smoking — 20/day, down to 0')
    expect(out).toBe('Quit smoking — 20/day\\, down to 0')
  })
})

describe('foldLine', () => {
  it('leaves short lines alone', () => {
    expect(foldLine('SUMMARY:short')).toBe('SUMMARY:short')
  })

  it('folds at 75 octets with CRLF + one space', () => {
    const line = `SUMMARY:${'a'.repeat(200)}`
    const folded = foldLine(line)
    expect(folded).toContain('\r\n ')
    for (const segment of folded.split('\r\n')) {
      expect(new TextEncoder().encode(segment).length).toBeLessThanOrEqual(75)
    }
  })

  it('unfolds back to the original', () => {
    // The real invariant: a parser stripping CRLF+space must recover the input
    // exactly. Anything else is silent corruption.
    const line = `SUMMARY:${'x'.repeat(300)}`
    expect(foldLine(line).replace(/\r\n /g, '')).toBe(line)
  })

  it('counts OCTETS, not characters', () => {
    // Em dashes are 3 bytes in UTF-8. Folding by string length would put >75
    // octets on a line and some clients truncate it.
    const line = `SUMMARY:${'—'.repeat(40)}`
    for (const segment of foldLine(line).split('\r\n')) {
      expect(new TextEncoder().encode(segment).length).toBeLessThanOrEqual(75)
    }
  })

  it('never splits a multi-byte character across the fold', () => {
    const line = `SUMMARY:${'é'.repeat(80)}`
    const folded = foldLine(line)
    // A split surrogate or a split UTF-8 sequence shows up as U+FFFD on decode.
    expect(folded).not.toContain('�')
    expect(folded.replace(/\r\n /g, '')).toBe(line)
  })

  it('keeps an emoji whole', () => {
    // Surrogate pairs: iterating by index instead of code point splits these.
    const line = `SUMMARY:${'👍'.repeat(30)}`
    expect(foldLine(line).replace(/\r\n /g, '')).toBe(line)
  })
})

describe('icsStamp', () => {
  it('is the UTC basic format', () => {
    expect(icsStamp(NOW)).toBe('20260808T143000Z')
  })
})
