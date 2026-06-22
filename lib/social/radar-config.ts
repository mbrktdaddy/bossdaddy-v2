// X Studio Phase 4 — radar (SENSE layer) source configuration.
//
// Plain constants, NOT a DB table yet (per the plan). Edit here to tune what the
// daily radar hunts. The caps are the BUDGET GUARD's per-run half — they bound
// how much the autonomous cron can spend in a single run (the daily run-count
// cap is the other half, enforced via lib/rate-limit.ts `radar`).

// Boss Daddy content pillars / themes the web_search radar hunts around. Keep
// these aligned with the brand's coverage so surfaced signals are postable.
export const RADAR_TOPICS: string[] = [
  'new baby gear, strollers, car seats, and carriers dads are talking about',
  'father-son activities, weekend projects, and family outdoor trips',
  'fatherhood, dad mental health, marriage, and work-life balance',
  'home workshop, power tools, EDC, and truck/garage gear for dads',
  'budget family travel and camping/hiking gear for dads',
]

// Free Reddit JSON endpoints (no auth needed for public listings).
export const SUBREDDITS: string[] = ['daddit', 'Parenting', 'NewParents', 'predaddit']

// Seeds for Google autocomplete (a free proxy for trending search interest;
// the real Trends API is paid/unofficial — the `trends` source enum is reserved
// for a future integration).
export const TREND_SEEDS: string[] = [
  'best stroller for',
  'dad gear',
  'father son',
  'baby must haves',
  'best gift for dad',
  'toddler activities',
]

export const RADAR_CAPS = {
  // Anthropic web_search uses per run — the single biggest spend lever. Bounds
  // the autonomous cost so the daily cron can't blow the $200 Anthropic cap.
  maxWebSearches: 5,
  // Hard ceiling on rows inserted per run across all sources.
  maxSignalsPerRun: 60,
  // Reddit: top posts per subreddit, over this window.
  redditPerSub: 8,
  redditWindow: 'day' as const,
  // Autocomplete: suggestions kept per seed.
  trendsPerSeed: 6,
}

// Reddit blocks requests without a descriptive User-Agent; identify ourselves.
export const RADAR_USER_AGENT = 'BossDaddyRadar/1.0 (+https://www.bossdaddylife.com)'
