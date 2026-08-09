// iCalendar (RFC 5545) serialization for the goal calendar feed.
//
// Pure and DB-free on purpose: every rule below is a format detail that fails
// silently in a calendar client — the feed imports, shows nothing, and there is no
// error anywhere to read. So it's testable in isolation.
//
// THE FOUR THINGS THAT BREAK A FEED, all handled here:
//
//   1. LINE ENDINGS ARE CRLF. Not \n. §3.1 is explicit, and Outlook in particular
//      rejects LF-only content outright.
//   2. LINES FOLD AT 75 OCTETS — octets, not characters. A long goal title in a
//      SUMMARY silently truncates or corrupts in some clients otherwise. The
//      continuation marker is CRLF followed by a single space.
//   3. TEXT VALUES ESCAPE \ ; , and newlines — and NOT colons. Escaping a colon
//      is a common overcorrection that shows up as a literal backslash in the
//      event title.
//   4. UIDs MUST BE STABLE ACROSS FETCHES. A calendar re-polls this URL for years;
//      a UID that changes per request makes every poll delete and recreate every
//      event, which on a phone means a notification storm. Ours is the schedule's
//      own row id, which is as stable as it gets.
//
// DELIBERATELY ABSENT: VALARM. His push and email reminders already fire (the whole
// sweep exists for that), and a calendar alarm on top would nudge him twice for the
// same dose. This feed is for SEEING the shape of the week, not for being told.
//
// ALSO ABSENT: VTIMEZONE blocks. We emit `DTSTART;TZID=America/Chicago:...` and
// rely on the client resolving the IANA name, which Google, Apple and Outlook all
// do. Shipping full VTIMEZONE definitions means embedding DST rules per zone and
// keeping them current — a real maintenance liability for a compatibility gain we
// don't measurably need. Noted so the omission reads as a decision.

/** One recurring reminder, already resolved to its ICS lines by icsRuleLines(). */
export type CalendarEvent = {
  /** Stable across every fetch. Use the schedule row's id. */
  uid: string
  /** What the event is called in his calendar. */
  summary: string
  description?: string | null
  /** `DTSTART;TZID=…:…` or `DTSTART;VALUE=DATE:…` — as icsRuleLines returns it. */
  dtstartLine: string
  /** `RRULE:…` — exactly as icsRuleLines returns it. */
  rruleLine: string
  /** How long the block appears. Reminders are moments, so keep it short. */
  durationMinutes?: number
  /**
   * All-day chip rather than a block on the grid.
   *
   * WHY THIS IS THE DEFAULT FOR REMINDERS. A daily habit rendered as a timed
   * 15-minute block puts N events into the grid every single day, and with two or
   * three goals a week view becomes unreadable — verified in Google Calendar, and
   * the operator's word for it was "bothersome". An all-day event collapses into
   * the thin strip at the top instead.
   *
   * It's also the more honest model: push and email already carry the exact
   * minute. The calendar's job here is "what am I committed to today", not
   * "reserve 8:00–8:15pm", and a medication reminder was never really an
   * appointment. The time rides in the SUMMARY so nothing is lost.
   */
  allDay?: boolean
}

const CRLF = '\r\n'
const DEFAULT_DURATION_MINUTES = 15

/**
 * The whole feed. `now` is injected so the output is deterministic under test —
 * DTSTAMP is the only field that would otherwise move on every call.
 */
export function buildCalendar(
  events: CalendarEvent[],
  opts: { calendarName: string; domain: string; now?: Date },
): string {
  const stamp = icsStamp(opts.now ?? new Date())

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Boss Daddy//Goals//EN`,
    'CALSCALE:GREGORIAN',
    // PUBLISH marks this as a one-way feed rather than an invitation exchange, so
    // no client offers to RSVP to a man's medication reminder.
    'METHOD:PUBLISH',
    // X- properties, but the ones every major client actually reads for the
    // subscription's display name and poll interval.
    `X-WR-CALNAME:${escapeText(opts.calendarName)}`,
    'X-PUBLISHED-TTL:PT6H',
  ]

  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}@${opts.domain}`,
      `DTSTAMP:${stamp}`,
      event.dtstartLine,
      // RFC 5545 §3.3.6: with a DATE-valued DTSTART the duration must be in days
      // or weeks — a PT15M against an all-day start is invalid and clients
      // disagree about how to recover from it. P1D is the whole day, which is
      // what an all-day chip means.
      event.allDay
        ? 'DURATION:P1D'
        : `DURATION:PT${Math.max(1, Math.round(event.durationMinutes ?? DEFAULT_DURATION_MINUTES))}M`,
      event.rruleLine,
      `SUMMARY:${escapeText(event.summary)}`,
    )
    if (event.description?.trim()) {
      lines.push(`DESCRIPTION:${escapeText(event.description.trim())}`)
    }
    // TRANSPARENT: a reminder shouldn't make him look busy to anyone reading his
    // free/busy, which on a shared work calendar is its own small disclosure.
    lines.push('TRANSP:TRANSPARENT', 'END:VEVENT')
  }

  lines.push('END:VCALENDAR')

  // Fold last, so folding applies to finished property lines rather than to
  // fragments we then concatenate.
  return lines.map(foldLine).join(CRLF) + CRLF
}

/**
 * Escape a TEXT value per §3.3.11.
 *
 * Order matters: backslash first, or the escapes we add get escaped again.
 */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/**
 * Fold one property line to 75 OCTETS per §3.1.
 *
 * Octets, not characters — a title with an em dash or an accented name is
 * multi-byte in UTF-8, and folding by string length puts the break mid-character,
 * which is how a feed ends up with a replacement glyph in the middle of a word.
 * Continuation lines begin with a single space, which the parser strips.
 */
export function foldLine(line: string): string {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line

  const out: string[] = []
  let current = ''
  let currentBytes = 0
  // First line gets 75 octets; continuations get 74, because the leading space
  // counts toward the limit.
  let limit = 75

  // Iterate by code POINT (spread, not index) so surrogate pairs stay whole.
  for (const char of line) {
    const size = encoder.encode(char).length
    if (currentBytes + size > limit) {
      out.push(current)
      current = ''
      currentBytes = 0
      limit = 74
    }
    current += char
    currentBytes += size
  }
  if (current) out.push(current)

  return out.join(`${CRLF} `)
}

/** UTC timestamp form: 20260808T143000Z. */
export function icsStamp(instant: Date): string {
  return `${instant.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`
}
