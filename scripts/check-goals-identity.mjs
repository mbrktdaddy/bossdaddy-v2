// Fails the build if identity language can reach a push notification or an email.
//
// THE RULE (migration 136, and the reason this script exists rather than a comment):
// a notification has no conversational context. "Another vote for the man who
// doesn't need cigarettes" landing twenty minutes after a relapse is exactly the
// edge-ON-when-it-should-be-OFF failure brand-guide §1.6 warns about — and
// cessation and medication are the FIRST vertical on the goals spine. So
// notifications carry PROCESS language ("Today's number: 6") and the Boss carries
// identity, because he's the only surface that knows the user just said it was a
// rough day.
//
// Nothing is lost by the split: the notification's job is to earn the tap, and the
// identity moment lands on the far side of it — on the confirmation page, or in
// chat. Both of those are allowed, which is why this checks the OUTBOX SURFACES
// specifically rather than banning the columns everywhere.
//
// WHY A GUARD AND NOT A COMMENT: `identity_statement` is one word away from being
// helpful in a reminder, and the sweep's occurrence query is a natural place for
// someone to add it while making a nudge "warmer". A comment can be read past. A
// failing build cannot — same reasoning as check-og-coverage and
// check-storage-upload-body.

import { readFileSync, globSync } from 'node:fs'

// The surfaces that emit into a channel the user can't opt out of reading cold.
const GUARDED = [
  'lib/goals/sweep.ts',        // materialize → notify → age-out; writes the outbox
  'lib/push.ts',               // web-push send path
  'lib/email.ts',              // Resend send path
  ...globSync('emails/**/*.tsx'),
  ...globSync('app/api/cron/goals-sweep/**/*.ts'),
]

// The columns and the vocabulary. The copy terms matter as much as the column
// names: hand-writing "another vote for the man who…" into a push template breaks
// the rule just as completely as selecting the column would, and that is the more
// likely way it happens.
const FORBIDDEN = [
  { pattern: /identity_statement/i, what: 'the identity_statement column' },
  { pattern: /identity_short/i, what: 'the identity_short column' },
  { pattern: /identityStatement/, what: 'the identity statement' },
  { pattern: /identityShort/, what: 'the short identity label' },
  // loadGoalFacts returns the identity fields, so importing it into a reminder
  // path is one destructuring away from a breach even though it names nothing.
  { pattern: /loadGoalFacts|goals\/facts/, what: 'lib/goals/facts (it carries identity)' },
  { pattern: /\bvote(s)? for\b/i, what: 'identity "vote" language' },
  { pattern: /\banother vote\b/i, what: 'identity "vote" language' },
  { pattern: /who you(’|')?re becoming/i, what: 'identity "becoming" language' },
]

const violations = []

for (const file of GUARDED) {
  let src
  try {
    src = readFileSync(file, 'utf8')
  } catch {
    continue   // an optional surface that doesn't exist yet
  }

  const lines = src.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    // Comments are how the rule gets DOCUMENTED at the call site — the whole
    // point is that someone reads it there. Only live code counts as a breach.
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue

    for (const { pattern, what } of FORBIDDEN) {
      if (pattern.test(line)) violations.push({ file, line: i + 1, what, text: trimmed })
    }
  }
}

if (violations.length) {
  console.error('\n✖ Identity language in a notification surface:\n')
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.what}`)
    console.error(`    ${v.text.slice(0, 120)}`)
  }
  console.error(
    '\n  Push and email carry PROCESS language only ("Today\'s number: 6").' +
      '\n  Identity belongs where there is conversational context: the Boss, or the' +
      '\n  one-tap confirmation page the user is already looking at.' +
      '\n' +
      '\n  A reminder cannot know that the last twenty minutes were a relapse.' +
      '\n  See migration 136 and docs/brand-guide.md §1.6.\n',
  )
  process.exit(1)
}

console.log(
  `✓ Goals identity: ${GUARDED.length} notification surfaces scanned, none carry identity language`,
)
