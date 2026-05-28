// Display labels for canonical internal entities.
//
// Internal names (DB tables, route segments, status values, variable names)
// stay stable forever. Display labels live here so a rename — like
// "Wishlist" → "Bench" or "Articles" → "Guides" — changes in one place
// instead of leaking across nav, footer, emails, page titles, dashboards.
//
// Add a label here when:
//   - The display name differs from the internal name (wishlist_items → "Bench")
//   - Phrasing varies between contexts ("Bench" vs "On the Bench")
//   - The same label appears in 5+ places
//
// Do NOT add labels for body copy, article text, or one-off page strings.
// Do NOT centralize the brand name "Boss Daddy" — it's stable.

export const LABELS = {
  // wishlist_items table → /bench public route
  //
  // Reader-clarification copy: every surface that names the Bench out of
  // context (footer, ticker, BenchStrip, hover titles) should use one of
  // these taglines so the metaphor teaches itself.
  bench: {
    short:        'Bench',
    full:         'On the Bench',
    addCta:       'Add to Bench',
    // Long form — for /bench dek and hover tooltips. One sentence.
    tagline:      'Products lined up for testing — vote on what gets reviewed next.',
    // Invitation-style — for BenchStrip subhead on /reviews + /gear.
    shortTagline: 'Check out the upcoming items on our bench list',
  },

  // products table → /gear public route. Key was historically `stuff` (an
  // earlier display name); renamed for code clarity. DB table stays `products`.
  gear: {
    short: 'Gear',
    full: 'Boss Daddy Approved Gear',
  },

  // collections table → /picks public route
  picks: {
    short: 'Picks',
    full: 'Boss Daddy Picks',
  },

  // guides table (formerly articles) → /guides
  guides: {
    singular: 'Guide',
    plural: 'Guides',
  },

  // reviews table → /reviews
  reviews: {
    singular: 'Review',
    plural: 'Reviews',
  },

  // gift_guides → /gifts
  gifts: {
    short: 'Gifts',
    full: 'Gift Guides',
  },

  // comparison-type collections → /comparisons
  comparisons: {
    short: 'Comparisons',
    full: 'Head-to-Head Comparisons',
    singular: 'Comparison',
  },

  // stack-type collections → /stacks
  stacks: {
    short: 'Stacks',
    full: 'Boss Daddy Stacks',
    singular: 'Stack',
  },

  // Umbrella for all collection types — the brand surface that unifies
  // /picks, /comparisons, /stacks, /gifts under one discoverable home.
  // Same pattern as the Bench: a canonical tagline that teaches the
  // metaphor wherever the noun "Vault" lands cold (homepage strip, nav).
  vault: {
    short:   'Vault',
    full:    'The Vault',
    tagline: 'Curated picks, comparisons, and stacks — beyond a single review.',
  },

  // Dad Tools v1 — Beta surface at /tools/*. See docs/dad-tools-plan.md.
  //
  // Internal vocab is locked: container = "[Kid]'s Log", unit = "moment",
  // verb = "capture". This vocab is load-bearing across UI, emails, and
  // share copy. Do not drift.
  tools: {
    short: 'Tools',
    full:  'Boss Daddy Tools',
    beta:  'Boss Daddy Tools (Beta)',

    // Hub at /tools — the front door + personalized dad dashboard.
    // Three spokes: TIME (Weekends Until), MONEY (Dad Math), PRESENCE.
    // Two reads: anonymous gets voice intro, logged-in gets personalized state.
    hub: {
      pageTitle:        'Tools — Boss Daddy',
      metaDescription:  'Free tools built for real dads. Plug in a birthdate, get a number that means something.',
      eyebrow:          'Free tools for dads',
      heroTitle:        'Tools I built for me.',
      heroTitleSecond:  'You can use them too.',
      heroBody:         'No PR samples. No app downloads. No sign-up walls. Plug in a birthdate, get a number that means something. Capture the ones that count.',
      loggedInGreeting: 'Welcome back, Boss.',
      loggedInBody:     'Where you are right now, with each kid.',
      manageKidsCta:    'Manage your kids →',
      addFirstKidCta:   'Add your first kid →',
    },

    weekendsUntil: {
      short:           'Weekends Until',
      full:            'Weekends Until',
      pageTitle:       'Weekends Until — Boss Daddy',
      metaDescription: 'How many weekends do you have left? Find out, then make them count.',
      spokeRole:       'Time',
      spokeBlurb:      'How many weekends do you have left with your kid? Pick a milestone. Get a number. Then make them count.',
    },

    dadMath: {
      short:           'Dad Math',
      full:            'Dad Math',
      pageTitle:       'Dad Math — Boss Daddy',
      metaDescription: 'College savings math, told straight. Are you on track, or behind?',
      spokeRole:       'Money',
      spokeBlurb:      'The honest calculator. Are you funding your kid’s future, or just thinking you are?',
      // Page header copy
      h1:              'The honest college math.',
      tagline:         'Are you funding your kid’s future, or just thinking you are?',
      // Form labels
      form: {
        balance:        'Current balance',
        balanceHelp:    'What’s saved today — 529, UTMA, brokerage, savings.',
        monthly:        'Monthly contribution',
        monthlyHelp:    'Across all accounts. Be honest.',
        target:         'Target by 18',
        targetHelp:     'Default is ~$94k — average 4-year in-state public total. Adjust to your reality.',
        returnRate:     'Assumed annual return',
        returnRateHelp: 'Default 6% — historical blended equity/bond mix. Lower it if you’re conservative.',
      },
      // Result labels
      result: {
        projectedLabel:   'Projected at 18',
        targetLabel:      'Target',
        gapLabel:         'Gap',
        surplusLabel:     'Surplus',
        catchUpLabel:     'To hit target',
        yearsLabel:       'Years to grow',
        catchUpSuffix:    '/mo',
      },
      // Required legal note. Compliance: estimate, not advice.
      disclosure:       'Estimate, not financial advice. Returns are not guaranteed. Talk to a fiduciary before making real changes.',
    },

    presence: {
      short:           'Presence',
      full:            'Presence',
      spokeRole:       'Presence',
      spokeBlurb:      'Last moment captured. Catch yourself before you drift.',
    },

    // Savings — micro-savings habit tracker (Dad Tools v1.2). Commitment
    // tracker, not a money mover: tapping "Yes" deep-links into the user's
    // own PayPal/Venmo/Cash App. Internal name is locked as `savings`; the
    // display label is centralized here so a rename is one edit.
    savings: {
      short:           'Savings',
      full:            'Savings',
      pageTitle:       'Savings — Boss Daddy',
      metaDescription: 'Daily and weekly micro-savings habits with one-tap commitment. Real reminders, real accountability.',
      spokeRole:       'Money',
      spokeBlurb:      'Small commitments, daily. Tap "yes," send the dollars, watch them stack.',
      // Page-level copy
      hubEyebrow:      'Your goals',
      indexEmptyTitle: 'No savings goals yet.',
      indexEmptyBody:  '$2 a day is easier than $94k all at once. Start a goal.',
      newCta:          'Start a goal',
      newCtaArrow:     'Start a goal →',
      // Hero/section copy
      h1:              'Small habits, real progress.',
      tagline:         'Set a tiny daily commitment. Tap "yes" each day. Watch the dollars stack.',
      // Cadence + destination labels
      cadences: {
        daily:   'Daily',
        weekly:  'Weekly',
        monthly: 'Monthly',
      },
      // Detail-page stat labels
      result: {
        savedLabel:         'Saved',
        contributedLabel:   'Contributed',
        withdrawnLabel:     'Withdrawn',
        streakLabel:        'Streak',
        bankedLabel:        'Banked',
        aheadByLabel:       'Ahead by',
        behindByLabel:      'Behind by',
        targetLabel:        'Target',
        projectedLabel:     'Projected at target',
        lastContribLabel:   'Last activity',
      },
      // Contribution action labels
      action: {
        yes:                'Yes — log',
        custom:             'Custom amount',
        skip:               'Skip today',
        catchUp:            'Catch up',
        adjust:             'Edit balance',
        contributionAdded:  'Logged.',
      },
      // Catch-up panel
      catchUp: {
        eyebrow:       'Catch-up plan',
        title:         'Get back on track',
        descTemplate:  'Add an extra {extra} per {cadenceUnit} for {units} {cadenceUnits} to catch up by {date}.',
      },
      // Required note on the page footer
      disclosure: 'You move the money. We track the commitment.',
    },

    // Milestone enum — internal keys stable; display labels free to change.
    // Order here is the default tab order in the milestone selector.
    milestones: {
      until_18:       'Until 18',
      next_birthday:  'Next birthday',
      starts_school:  'Starts school',
      gets_license:   'Gets license',
      summer:         'Summer',
      custom:         'Custom date',
    },

    // Unit toggle. weekends + bedtimes in v1 (per locked decision).
    units: {
      weekends: 'Weekends',
      bedtimes: 'Bedtimes',
    },

    // The Log vocabulary — load-bearing. Use the logTitle() helper in
    // components to build the "{name}'s Log" string consistently.
    log: {
      containerSuffix:   '’s Log',
      containerFallback: 'Your Log',
      unitLabel:         'moment',
      unitLabelPlural:   'moments',
      verbLabel:         'capture',
      captureCta:        'Capture a moment',
      captureWeekendCta: 'Capture this weekend',
      emptyState:        'Log is empty. Start with something small.',
      confirmation:      'Captured.',
    },

    // My Kids dashboard section
    kids: {
      section:      'My Kids',
      addCta:       'Add a kid',
      editCta:      'Edit',
      deleteCta:    'Remove',
      noNameFallback: 'your kid',
      empty:        'No kids yet. Add one to start tracking weekends and moments.',
    },

    // Email opt-ins. Two cadences:
    //   - yearlyCheckin: one email a year on the kid's birthday window with
    //     the updated Weekends Until number.
    //   - weeklyCheckin: a quiet Sunday-evening nudge to capture one moment
    //     from the past week. Internal DB enum / cron path remain
    //     'sunday_moments' per the naming doctrine; this is the public name.
    emails: {
      yearlyCheckin: {
        optInCta:    'Get a yearly check-in',
        optInHelp:   'One email a year, on the same date. Updated number, nothing else.',
        confirmed:   'You’ll hear from us a year from now.',
      },
      weeklyCheckin: {
        optInCta:    'Get a weekly check-in',
        optInHelp:   'One quiet email Sunday evening. Recap the week with one captured moment. Easy to turn off.',
        confirmed:   'See you Sunday.',
      },
    },
  },
} as const

// "{name}'s Log" / "Your Log" — used by KidCard, MyKidsSection, and the
// kid profile page. Centralized so the apostrophe + fallback handling
// stays consistent everywhere the Log header appears.
export function logTitle(name: string | null | undefined): string {
  const trimmed = name?.trim()
  if (trimmed) return `${trimmed}${LABELS.tools.log.containerSuffix}`
  return LABELS.tools.log.containerFallback
}
