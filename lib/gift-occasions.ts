/**
 * Master list of gift-guide occasions. Each one becomes a stable URL at
 * /gifts/[slug] that compounds SEO across years — content gets refreshed
 * annually but the URL never changes.
 *
 * `value` matches the occasion column in collections (with underscores).
 * `slug`  is the URL-safe form (with hyphens).
 */

export type Occasion =
  // Major holidays
  | 'fathers_day' | 'mothers_day' | 'christmas' | 'valentines_day'
  | 'new_year' | 'easter' | 'thanksgiving' | 'fourth_of_july'
  | 'halloween' | 'memorial_day'
  // Life milestones
  | 'birthday' | 'graduation' | 'wedding' | 'anniversary'
  | 'baby_shower' | 'new_dad' | 'housewarming' | 'retirement'
  // Brand-themed seasons
  | 'grilling_season' | 'camping_season' | 'workshop'
  | 'back_to_school' | 'summer_kickoff' | 'super_bowl'
  // Budget tiers
  | 'under_25' | 'under_50' | 'under_100' | 'splurge'

export type OccasionGroup = 'holiday' | 'milestone' | 'season' | 'budget'

export interface OccasionConfig {
  value:       Occasion
  slug:        string         // URL-safe form
  label:       string         // display label
  emoji:       string         // visual identifier
  group:       OccasionGroup
  shortBlurb:  string         // 1 sentence for cards / index
  longBlurb:   string         // 2-3 sentences for empty state hero
  metaTitle:   string         // SEO title
  metaDesc:    string         // SEO meta description
}

export const OCCASIONS: OccasionConfig[] = [
  // ── Major Holidays ─────────────────────────────────────────────────────────
  {
    value: 'fathers_day', slug: 'fathers-day', label: "Father's Day", emoji: '👨', group: 'holiday',
    shortBlurb: 'Real-tested gifts for the dad who actually shows up.',
    longBlurb: "Every year I get the same panicked text: 'what should I get dad for Father's Day?' Here's the list — every item personally bought, used, and earned its place. No corporate fluff, just stuff he'll actually pick up again after opening day.",
    metaTitle: "Father's Day Gift Guide — Dad-Tested Picks | Boss Daddy",
    metaDesc: "Honest Father's Day gift ideas for the dad who actually uses his stuff. Every pick personally tested by a real dad — tools, gear, grilling, and beyond.",
  },
  {
    value: 'mothers_day', slug: 'mothers-day', label: "Mother's Day", emoji: '🌷', group: 'holiday',
    shortBlurb: "Practical, thoughtful gifts mom will actually use.",
    longBlurb: "Mother's Day deserves more than another candle and a card. This list focuses on gifts mom will reach for again — practical, beautiful, dad-tested-on-mom-approved.",
    metaTitle: "Mother's Day Gift Guide — Honest Picks | Boss Daddy",
    metaDesc: "Mother's Day gift ideas mom will actually use. Curated by a dad who's seen too many forgotten kitchen gadgets.",
  },
  {
    value: 'christmas', slug: 'christmas', label: 'Christmas', emoji: '🎄', group: 'holiday',
    shortBlurb: "The holiday list — gifts that earn shelf space, not closet exile.",
    longBlurb: 'Christmas gifts that survive past New Year — every item personally tested across multiple seasons. Tools, gear, grilling, and lifestyle picks that earn permanent garage space.',
    metaTitle: "Christmas Gift Guide for Dads — Boss Daddy Picks",
    metaDesc: "Honest Christmas gift ideas for dads, husbands, and the men in your life. Every pick personally tested by a real dad.",
  },
  {
    value: 'valentines_day', slug: 'valentines-day', label: "Valentine's Day", emoji: '❤️', group: 'holiday',
    shortBlurb: 'Beyond chocolate — Valentine\'s gifts with staying power.',
    longBlurb: "Valentine's Day gifts that last longer than a dozen roses. Curated picks for him and her — practical, thoughtful, and honestly tested.",
    metaTitle: "Valentine's Day Gifts — Beyond the Cliché | Boss Daddy",
    metaDesc: "Valentine's Day gift ideas with real staying power. Dad-tested picks for the people who matter most.",
  },
  {
    value: 'new_year', slug: 'new-year', label: 'New Year', emoji: '🎆', group: 'holiday',
    shortBlurb: 'Start the year with gear that earns its place.',
    longBlurb: 'New Year gift ideas — fresh-start picks, resolution-fueled gear, and the stuff that helps the year actually go right.',
    metaTitle: 'New Year Gift Ideas — Boss Daddy Picks',
    metaDesc: 'New Year gifts for the people setting real goals. Dad-tested gear that actually helps.',
  },
  {
    value: 'easter', slug: 'easter', label: 'Easter', emoji: '🐰', group: 'holiday',
    shortBlurb: 'Easter basket gear beyond candy.',
    longBlurb: 'Easter gift ideas — for the basket, for the family, for the whole house. Practical and fun picks that go past chocolate.',
    metaTitle: 'Easter Gift Guide — Boss Daddy Picks',
    metaDesc: 'Easter gift ideas for dads, kids, and the whole family. Honest picks beyond candy.',
  },
  {
    value: 'thanksgiving', slug: 'thanksgiving', label: 'Thanksgiving', emoji: '🦃', group: 'holiday',
    shortBlurb: "Hosting gear and host-gift ideas for the big meal.",
    longBlurb: "Thanksgiving picks — whether you're hosting, attending, or just trying to nail the turkey this year. Cooking gear, host gifts, and dad-tested tools.",
    metaTitle: 'Thanksgiving Gift & Hosting Guide | Boss Daddy',
    metaDesc: "Thanksgiving gift ideas, hosting gear, and host gifts dad-tested for actual use.",
  },
  {
    value: 'fourth_of_july', slug: 'fourth-of-july', label: '4th of July', emoji: '🎆', group: 'holiday',
    shortBlurb: 'Grilling, gathering, and red-white-blue essentials.',
    longBlurb: '4th of July gift ideas — grilling gear, cooler upgrades, party essentials. Tested across multiple summers of backyard cookouts.',
    metaTitle: '4th of July Gift & Gear Guide — Boss Daddy',
    metaDesc: 'Grilling gear, party essentials, and gift ideas for 4th of July. Dad-tested picks.',
  },
  {
    value: 'halloween', slug: 'halloween', label: 'Halloween', emoji: '🎃', group: 'holiday',
    shortBlurb: 'Family-friendly Halloween gear and gifts.',
    longBlurb: "Halloween picks for dads, kids, and family-friendly fun. Decoration gear, costume essentials, and Halloween-season favorites.",
    metaTitle: 'Halloween Gift & Gear Guide — Boss Daddy',
    metaDesc: 'Halloween gift ideas, decoration gear, and family-friendly picks dad-tested.',
  },
  {
    value: 'memorial_day', slug: 'memorial-day', label: 'Memorial Day', emoji: '🇺🇸', group: 'holiday',
    shortBlurb: "Summer kickoff gear — grilling, lawn, and outdoor essentials.",
    longBlurb: 'Memorial Day picks — the unofficial summer kickoff. Grill upgrades, outdoor gear, and the stuff that gets the season started right.',
    metaTitle: 'Memorial Day Gift & Gear Guide — Boss Daddy',
    metaDesc: 'Memorial Day picks for the summer kickoff. Grilling gear, outdoor essentials, dad-tested.',
  },

  // ── Life Milestones ────────────────────────────────────────────────────────
  {
    value: 'birthday', slug: 'birthday', label: 'Birthday', emoji: '🎂', group: 'milestone',
    shortBlurb: 'Birthday gifts that age well — dad, husband, brother, friend.',
    longBlurb: "Birthday gift ideas year-round, organized by what actually gets used. From budget surprises to splurge upgrades.",
    metaTitle: 'Birthday Gift Ideas for Dads — Boss Daddy Picks',
    metaDesc: 'Honest birthday gifts for dads, husbands, and brothers. Every pick personally tested.',
  },
  {
    value: 'graduation', slug: 'graduation', label: 'Graduation', emoji: '🎓', group: 'milestone',
    shortBlurb: 'Practical first-apartment, first-job, life-launch gear.',
    longBlurb: "Graduation gifts that launch the next chapter — apartment essentials, first-job tools, and actually useful gear that survives the move-in.",
    metaTitle: 'Graduation Gift Guide — Practical Picks | Boss Daddy',
    metaDesc: 'Graduation gift ideas for new grads launching their adult life. Apartment, work, and life-skill picks.',
  },
  {
    value: 'wedding', slug: 'wedding', label: 'Wedding', emoji: '💍', group: 'milestone',
    shortBlurb: 'Wedding registry-worthy gifts that earn permanent spots.',
    longBlurb: "Wedding gifts that survive past the honeymoon — registry favorites, kitchen essentials, and home gear that earns shelf space for years.",
    metaTitle: 'Wedding Gift Ideas — Tested by Real Couples | Boss Daddy',
    metaDesc: 'Wedding gift ideas dad-tested for actual home life. Kitchen, home, and lifestyle picks.',
  },
  {
    value: 'anniversary', slug: 'anniversary', label: 'Anniversary', emoji: '💝', group: 'milestone',
    shortBlurb: 'Anniversary gifts that say more than another card.',
    longBlurb: "Anniversary gift ideas with real meaning — paper to diamond, year one to year fifty. Picks that age as well as the marriage.",
    metaTitle: 'Anniversary Gift Ideas — Boss Daddy Picks',
    metaDesc: 'Anniversary gift ideas year by year. Honest picks that mean more than another card.',
  },
  {
    value: 'baby_shower', slug: 'baby-shower', label: 'Baby Shower', emoji: '🍼', group: 'milestone',
    shortBlurb: "Real-talk baby shower gifts new parents will actually use.",
    longBlurb: "Baby shower picks from a real first-time dad. Skip the cute-but-useless stuff — every pick here got pulled out of the box and used in actual life.",
    metaTitle: "Baby Shower Gift Guide — Real Dad-Tested | Boss Daddy",
    metaDesc: "Baby shower gift ideas a new dad actually uses. Skip the cute novelties — these earn their place.",
  },
  {
    value: 'new_dad', slug: 'new-dad', label: 'New Dad', emoji: '👶', group: 'milestone',
    shortBlurb: 'Year-one survival gear from a dad who lived it.',
    longBlurb: "New dad gift ideas from someone in the trenches. The stuff I genuinely wish I had on day one — and the gear I'd buy a hundred times over.",
    metaTitle: 'New Dad Gift Guide — Year-One Survival Gear | Boss Daddy',
    metaDesc: 'New dad gift ideas from a real first-time dad. Honest picks for the year-one journey.',
  },
  {
    value: 'housewarming', slug: 'housewarming', label: 'Housewarming', emoji: '🏠', group: 'milestone',
    shortBlurb: 'First-home essentials beyond the welcome mat.',
    longBlurb: "Housewarming gift ideas for new homeowners — beyond the welcome mat and houseplant. Real tools, kitchen gear, and home essentials.",
    metaTitle: 'Housewarming Gift Guide — Practical Picks | Boss Daddy',
    metaDesc: 'Housewarming gift ideas for new homeowners. Tools, kitchen gear, and home essentials.',
  },
  {
    value: 'retirement', slug: 'retirement', label: 'Retirement', emoji: '🎁', group: 'milestone',
    shortBlurb: "Retirement gifts for the next chapter — hobbies, leisure, time.",
    longBlurb: "Retirement gift ideas — hobby starter gear, leisure upgrades, and the stuff that turns 'finally got time' into 'finally got the gear.'",
    metaTitle: 'Retirement Gift Ideas — Hobby & Leisure Picks | Boss Daddy',
    metaDesc: 'Retirement gift ideas for the next chapter. Hobby gear, leisure picks, and life upgrades.',
  },

  // ── Brand-Themed Seasons ───────────────────────────────────────────────────
  {
    value: 'grilling_season', slug: 'grilling-season', label: 'Grilling Season', emoji: '🔥', group: 'season',
    shortBlurb: 'Grill upgrades, tools, and accessories that earn their place.',
    longBlurb: "Grilling season picks tested across multiple summers. From entry-level upgrades to splurge gear — every item earned its spot at the grill.",
    metaTitle: 'Best Grilling Gear — Dad-Tested Picks | Boss Daddy',
    metaDesc: 'Best grilling gear, BBQ tools, and grill upgrades dad-tested across multiple seasons.',
  },
  {
    value: 'camping_season', slug: 'camping-season', label: 'Camping Season', emoji: '⛺', group: 'season',
    shortBlurb: 'Family camping gear field-tested by a real dad.',
    longBlurb: "Camping gear picks from real family camping trips. Tents, gear, and essentials that survived kids, weather, and weekend chaos.",
    metaTitle: 'Best Camping Gear — Family-Tested Picks | Boss Daddy',
    metaDesc: 'Camping gear dad-tested with real family trips. Tents, sleep systems, and camp essentials.',
  },
  {
    value: 'workshop', slug: 'workshop', label: 'Workshop / DIY', emoji: '🛠️', group: 'season',
    shortBlurb: 'Workshop, garage, and DIY tool picks that earn permanent space.',
    longBlurb: "Workshop and DIY tool picks from a dad who builds and fixes for real. Cordless tools, hand tools, and the workshop upgrades that change how you work.",
    metaTitle: 'Best Workshop Tools & DIY Gear | Boss Daddy',
    metaDesc: 'Workshop, garage, and DIY tool picks dad-tested in real projects. Power tools and accessories.',
  },
  {
    value: 'back_to_school', slug: 'back-to-school', label: 'Back to School', emoji: '🎒', group: 'season',
    shortBlurb: 'Gear for kids, dads, and the chaos of school year start.',
    longBlurb: "Back to school picks — for the kid, the dad's lunch routine, the morning rush. Practical gear from a dad who's lived through too many first weeks.",
    metaTitle: 'Back to School Gear & Gift Guide | Boss Daddy',
    metaDesc: 'Back to school picks for kids, dads, and the morning rush. Real-life-tested gear.',
  },
  {
    value: 'summer_kickoff', slug: 'summer-kickoff', label: 'Summer Kickoff', emoji: '☀️', group: 'season',
    shortBlurb: 'Pool, beach, yard, and summer-mode essentials.',
    longBlurb: "Summer kickoff gear — pool, beach, yard, and outdoor living essentials. The stuff that makes summer actually summer.",
    metaTitle: 'Summer Gear & Gift Guide — Boss Daddy Picks',
    metaDesc: 'Summer essentials — pool, beach, yard, and outdoor living gear. Dad-tested picks.',
  },
  {
    value: 'super_bowl', slug: 'super-bowl', label: 'Super Bowl Sunday', emoji: '🏈', group: 'season',
    shortBlurb: 'Watch-party gear, snack tools, and game-day essentials.',
    longBlurb: "Super Bowl Sunday gear — watch-party essentials, game-day tools, and the stuff that turns the living room into the best seats in the house.",
    metaTitle: 'Super Bowl Watch Party Gear Guide | Boss Daddy',
    metaDesc: 'Super Bowl Sunday picks — TV upgrades, snack gear, and watch-party essentials.',
  },

  // ── Budget Tiers ───────────────────────────────────────────────────────────
  {
    value: 'under_25', slug: 'under-25', label: 'Gifts Under $25', emoji: '💵', group: 'budget',
    shortBlurb: "Real-deal gifts under $25 — no junk, no filler.",
    longBlurb: "Gift ideas under $25 that don't feel like leftovers. Every pick punches above its price — small budget, real quality.",
    metaTitle: 'Best Gifts Under $25 — Dad-Tested | Boss Daddy',
    metaDesc: "Honest gift ideas under $25 that punch above their price. No junk, no filler — real picks.",
  },
  {
    value: 'under_50', slug: 'under-50', label: 'Gifts Under $50', emoji: '💵', group: 'budget',
    shortBlurb: 'Solid mid-range gifts that earn their keep.',
    longBlurb: "Gift ideas under $50 — the sweet spot for thoughtful, useful picks. Tools, gear, and lifestyle items that earn permanent spots.",
    metaTitle: 'Best Gifts Under $50 — Boss Daddy Picks',
    metaDesc: "Honest gift ideas under $50 that actually get used. Mid-range picks dad-tested.",
  },
  {
    value: 'under_100', slug: 'under-100', label: 'Gifts Under $100', emoji: '💵', group: 'budget',
    shortBlurb: 'Premium-feel gifts under $100 — real upgrades, real value.',
    longBlurb: "Gift ideas under $100 — where real upgrades start. Picks that feel premium without crossing into splurge territory.",
    metaTitle: 'Best Gifts Under $100 — Boss Daddy Picks',
    metaDesc: 'Gift ideas under $100 — premium-feel picks dad-tested for real use.',
  },
  {
    value: 'splurge', slug: 'splurge', label: 'Splurge Gifts', emoji: '💎', group: 'budget',
    shortBlurb: "When the gift has to be the gift — premium picks worth it.",
    longBlurb: "Splurge gift ideas for milestones that deserve more. Premium picks, heirloom-quality gear, and the stuff worth the extra spend.",
    metaTitle: 'Premium Splurge Gifts — Boss Daddy Picks',
    metaDesc: "Premium splurge gift ideas for milestones that matter. Heirloom-quality, dad-tested.",
  },
]

/**
 * Returns 6 occasion configs ordered by seasonal relevance.
 * Pass a date for deterministic testing; defaults to today.
 */
export function getSeasonalOccasions(date: Date = new Date()): OccasionConfig[] {
  const month = date.getMonth() + 1 // 1-12

  // Ordered slugs per season — first = most relevant
  let values: Occasion[]
  if (month === 12 || month <= 2) {
    // Winter: Dec–Feb
    values = ['christmas', 'new_year', 'valentines_day', 'super_bowl', 'anniversary', 'birthday']
  } else if (month <= 5) {
    // Spring: Mar–May
    values = ['mothers_day', 'fathers_day', 'graduation', 'easter', 'baby_shower', 'anniversary']
  } else if (month <= 8) {
    // Summer: Jun–Aug
    values = ['fathers_day', 'fourth_of_july', 'grilling_season', 'camping_season', 'summer_kickoff', 'birthday']
  } else {
    // Fall: Sep–Nov
    values = ['back_to_school', 'halloween', 'thanksgiving', 'christmas', 'birthday', 'anniversary']
  }

  return values
    .map((v) => OCCASIONS.find((o) => o.value === v))
    .filter((o): o is OccasionConfig => o !== undefined)
}

export const OCCASION_GROUPS: { id: OccasionGroup; label: string }[] = [
  { id: 'holiday',   label: 'Holidays' },
  { id: 'milestone', label: 'Life Milestones' },
  { id: 'season',    label: 'Seasons & Themes' },
  { id: 'budget',    label: 'By Budget' },
]

export function getOccasion(slug: string): OccasionConfig | null {
  return OCCASIONS.find((o) => o.slug === slug) ?? null
}

export function getOccasionByValue(value: string): OccasionConfig | null {
  return OCCASIONS.find((o) => o.value === value) ?? null
}
