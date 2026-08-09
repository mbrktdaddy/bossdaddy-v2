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
//
// ─── TWO RULES THIS FILE LEARNED THE HARD WAY ────────────────────────────────
//
// 1. ONE WORD, ONE FEATURE. The doctrine above keeps internal names stable and
//    lets display names move freely — but it says nothing about two features
//    claiming the SAME display word, which is how savings and the goals spine
//    both ended up calling themselves "goals". A profile card then showed "Set
//    one up" and "Start a goal" side by side, leading to different products.
//    Before reusing a noun another block already owns, disambiguate one of them.
//
// 2. UP IS NOT BACK. A link to a fixed parent is an UP link: it says "this page
//    lives inside that section", it is the same every time, and it is correct
//    when someone arrives cold from a push notification, a bookmark, or an
//    emailed invite — which is most of how this app gets opened.
//
//    "Back" is chronological and belongs to the browser and the OS gesture. A
//    hardcoded link labelled "← Back to goals" makes a promise about HISTORY and
//    breaks it for everyone who didn't come from there. Naming the DESTINATION
//    instead — "← Savings" — is the same link, the same target, and cannot lie
//    however the visitor arrived.
//
//    So: label up-links with where they GO, never with "Back to". And don't fake
//    real back-navigation by threading `?from=` through URLs — it pollutes every
//    link, breaks on refresh and share, and duplicates what the device already
//    does correctly.

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

  // PWA install — the "add to home screen" badge surfaced sitewide
  // (footer, header, homepage band) and the dedicated /install landing.
  // Display label is centralized so "Get the App" can change in one edit;
  // the internal concept (PWA install) stays stable.
  app: {
    short:   'Get the App',
    full:    'Get the Boss Daddy App',
    tagline: 'Add Boss Daddy to your home screen — one tap back to reviews, gear, and tools. No app store, no bloat.',
  },

  // Dad Tools v1 — Beta surface at /tools/*. See docs/dad-tools-plan.md.
  //
  // Internal vocab is locked: container = "[Kid]'s Log", unit = "moment",
  // verb = "capture". This vocab is load-bearing across UI, emails, and
  // share copy. Do not drift.
  // goals / goal_schedules / goal_occurrences tables → /goals route.
  //
  // NAMING IS NOT SETTLED — "Goals" is the neutral default, not a decision. The
  // Member-to-member connections. The internal names — the `user_connections`
  // table, the `/account/connections` route — are permanent; this block is the
  // only place the wording changes.
  //
  // ⚠️ CALLED "CONTACTS", NOT "YOUR CORNER", AND THE DISTINCTION IS LOAD-BEARING.
  // A connection means "we can message each other and I could ask you". It is not
  // the same set as the people in your corner, which is who actually accepted a
  // share on one of your goals — that's derived from goal_participants and lives
  // in YourCornerSection. Labelling the flat list "Your Corner" (which is what
  // shipped first) put a gear-chat acquaintance under the same heading as the
  // wife witnessing a taper, and made the phrase mean nothing.
  contacts: {
    short:       'Contacts',
    full:        'Contacts',
    pageTitle:   'Contacts — Boss Daddy',
    h1:          'Who you can reach',
    tagline:     'Connecting is what lets two of you message each other and share a goal. Either of you can end it whenever you like, and nobody gets told.',
    eyebrow:     'Contacts',
    emptyBody:   'Nobody yet.',
    /** The DERIVED set — people participating in your goals. Never the list. */
    cornerLabel: 'In your corner',
  },

  // internal names (`goals`, the route segment, the `kind` values) are permanent;
  // every display string below is free to change here without a migration. If
  // this becomes "The Grind" or "Duty" or anything else, this block is the only
  // place it changes.
  goals: {
    short:           'Goals',
    full:            'Goals',
    pageTitle:       'Goals — Boss Daddy',
    metaDescription: 'Set a target, get a nudge, log it in one tap. Tapers, habits, programs — whatever you\'re actually working on.',
    spokeRole:       'Track',
    spokeBlurb:      'Quit something, start something, stick to something. Set the target, get the nudge, log it in one tap.',
    eyebrow:         'What you\'re working on',
    h1:              'The stuff you said you\'d do.',
    tagline:         'Set the target, pick when you want the nudge, log it in one tap. No guilt trips.',
    emptyHeading:    'Nothing on the board yet.',
    emptyBody:       'A goal is a target plus a schedule — quitting a habit, taking your vitamins, hitting the gym three times a week.',
    logCta:          'Log it',
    // Names what it MAKES. "Set one up" reads fine under an empty state but is
    // unresolvable next to savings' CTA in the one card that shows both.
    newCta:          'New goal',
    // The profile section that lists BOTH kinds of goal — the spine's and
    // savings'. Deliberately not "Goals": a dad has one mental category here.
    workingOnHeading: 'What you\'re working on',
    newHeading:      'What are we working on?',
    newBody:         'Pick a plan to start from. Every detail is yours to change.',
    // The escape hatch under the shelf of concrete plans — the five generic
    // shapes live behind it (goal_templates.is_kind_default).
    newOtherCta:     'Something else',
    newOtherBody:    'Start from a shape instead of a plan.',
    // Identity. Prefilled from the template, never a blank box, always skippable.
    identityLegend:  'Who does this make you?',
    identityHint:    'Present tense, and about the man — not the habit. Every day you log is a vote for it. Leave it blank if it feels early.',
    identityShortLabel: 'Short version',
    identityShortHint:  'What shows up next to this goal in a list.',
    votingFor:       'Voting for',
    // Accountability partners (mig 137). "In your corner" rather than "Shared
    // with me" — the point is who's got your back, not a permissions list.
    sharedEyebrow:   'Someone asked you',
    // ⚠️ THIS PAGE IS THE OTHER DIRECTION. /goals/shared lists goals OTHER PEOPLE
    // shared with you — you are in THEIR corner, not the reverse. It read "In your
    // corner", which describes the opposite relationship and collided with the two
    // places that legitimately use that phrase: the participant list on
    // /goals/[id]/share, and the derived section on /account. The eyebrow above
    // ("Someone asked you") was already saying the right thing.
    sharedHeading:   'You\'re in their corner',
    sharedEmpty:     'Nobody has shared a goal with you yet. When someone does, it shows up here — and you\'ll never get pinged about it.',
    // NAMES THE ACTION, not the state. This read "Who can see this", which is an
    // accurate description of the page and the wrong thing to put on a button:
    // someone who wants to bring their wife in doesn't scan for a privacy audit.
    // The sober framing the old wording carried hasn't gone anywhere — it moved to
    // the dek and the per-tier copy on the page itself, where it's read at the
    // moment it matters rather than used as a label.
    shareCta:        'Share this goal',
    /** Icon-button / tight-space form of the same action. */
    shareShort:      'Share',
    // /today — the "what do I do right now" screen, and the PWA's real home.
    todayTitle:         'Today — Boss Daddy',
    todayEyebrow:       'Today',
    todayHeading:       'Here\'s your day.',
    todayClearHeading:  'You\'re square.',
    todayClearBody:     'Nothing open right now. Anything later today is below.',
    todayNothing:       'Nothing scheduled right now. Either you\'re done or there\'s nothing on the board yet.',
    // Start date. Today or later only — see the note in /goals/new.
    startLegend:     'When does it start?',
    startHint:       'Today, or pick the day you\'re starting. Nothing gets scheduled before then.',
    // Display names for the `kind` discriminator. DB values never change.
    kinds: {
      reduce:    'Cutting back',
      adherence: 'Daily habit',
      program:   'Program',
      metric:    'Tracking',
      custom:    'Reminder',
    } as Record<string, string>,
  },

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
      loggedInBody:     'Where you are right now, with your family.',
      manageKidsCta:    'Manage your family →',
      addFirstKidCta:   'Add your first family member →',
    },

    // The Boss — member AI concierge. Grounded gear/guide answers + general
    // dad-life help. Internal name locked as `theBoss` / route `the-boss`.
    theBoss: {
      short:           'The Boss',
      full:            'The Boss',
      pageTitle:       'Ask the Boss — Boss Daddy',
      metaDescription: 'Ask the Boss for tested gear picks, straight answers, and dad-life help — grounded in real, hands-on reviews.',
      spokeRole:       'Ask',
      spokeBlurb:      'Tested gear picks, straight answers, and dad-life help — grounded in real reviews. Just ask the Boss.',
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
      // Page-level copy.
      //
      // ⚠️ SAVINGS DOES NOT CALL ITSELF "GOALS" ANY MORE. It got the word first
      // and owned it throughout this block — "Your goals", "Start a goal", "Back
      // to goals" — and then the goals SPINE shipped and took the same word for a
      // different feature. The result on /account was two CTAs in one card
      // labelled "Set one up" and "Start a goal", pointing at different products,
      // and a "Back to goals" link that correctly landed on savings and looked
      // broken. Internal names (`savings`, /tools/savings) are permanent; this
      // block is where the collision gets resolved. Keep "savings" in the words.
      hubEyebrow:      'Savings',
      indexEmptyTitle: 'No savings goals yet.',
      indexEmptyBody:  '$2 a day is easier than $94k all at once. Start one.',
      newCta:          'Start a savings goal',
      newCtaArrow:     'Start a savings goal →',
      /** Destination-named up-link. Never "Back to …" — see the doctrine below. */
      upLink:          '← Savings',
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

    // Family dashboard section (internally kid_profiles; "Family" in the UI)
    kids: {
      section:      'Family',
      addCta:       'Add a family member',
      editCta:      'Edit',
      deleteCta:    'Remove',
      noNameFallback: 'your family member',
      empty:        'No family yet. Add someone to start tracking moments and milestones.',
      // child/partner/other → display labels. Source of truth for relationship copy.
      memberType:   { child: 'Child', partner: 'Partner', other: 'Other' } as Record<'child' | 'partner' | 'other', string>,
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
