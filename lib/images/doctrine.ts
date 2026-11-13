// The photo-editor doctrine shared by every model that WRITES an image prompt:
// the pipeline `images` stage (lib/content/pipeline/images.ts) and the
// prompt-assist route (app/api/images/prompt). It says what a prompt is for,
// what it must contain, and what no AI image on this site may be asked to show.
//
// The first rule is the one that keeps the site from looking like one room
// photographed forty times: THE TOPIC SETS THE WORLD. The reader is a man who
// is a father; the picture is of the topic. The 2026-11 sameness finding — a
// research piece on multiculturalism illustrated with an empty kitchen table at
// dusk and a blank globe on a desk — traced to three things this file used to
// do: domestic examples the models copied (a porch, a kitchen table, boots on a
// step), a people rule that emptied every scene ("as if someone just stepped
// away"), and not a word about where a setting comes from when the prose names
// none. Now the world is decided first, from the subject; the home appears when
// the piece is set there; every picture names its setting so a piece cannot
// live in one room; and the season, hour and weather are suggested per run
// (`pickAtmosphere`) so the site stops defaulting to autumn at dusk.
//
// Lighting, lens and palette are NOT here — that is lib/images/style.ts, applied
// in code at generation time so the whole site reads as one photographer. The
// safety clauses the image model receives are lib/images/safety.ts; this file
// is the upstream rule set that keeps the prompt writers from asking for
// things those clauses will reject (the 2026-10 data: every text failure was a
// prompt that asked for a screen).
//
// Client-safe: plain strings and pure functions only.

import type { PeoplePolicy } from './safety'
import type { ImageLook } from './style'

/** What a slot needs. The first three are AI pictures; `owned` is a thing only a real capture can show. */
export const IMAGE_NEEDS = ['scene', 'detail', 'hands', 'owned'] as const
export type ImageNeed = (typeof IMAGE_NEEDS)[number]

/** The shot vocabulary a photo editor assigns across one piece — vantage is half of variety. */
export const IMAGE_SHOTS = ['wide', 'medium', 'detail', 'overhead', 'pov', 'low', 'through', 'aerial'] as const
export type ImageShot = (typeof IMAGE_SHOTS)[number]

/** Body-figure aspects. Heroes are always 16:10 and are not chosen here. */
export const FIGURE_ASPECTS = ['3:2', '1:1', '4:5'] as const
export type FigureAspect = (typeof FIGURE_ASPECTS)[number]

/**
 * Where a picture is set. The planner names one per picture, and the variety
 * rule forbids a piece from living in one of them — the mechanism behind
 * "no two pictures in the same room".
 */
export const SETTING_FAMILIES = [
  'home', 'yard', 'garage-shop', 'street', 'market-shop', 'institution',
  'jobsite', 'field-arena', 'road', 'nature', 'water', 'transit',
] as const
export type SettingFamily = (typeof SETTING_FAMILIES)[number]

export const PROMPT_CHARS = { min: 400, max: 700 } as const

export function isImageNeed(v: unknown): v is ImageNeed {
  return typeof v === 'string' && (IMAGE_NEEDS as readonly string[]).includes(v)
}
export function isImageShot(v: unknown): v is ImageShot {
  return typeof v === 'string' && (IMAGE_SHOTS as readonly string[]).includes(v)
}
export function isFigureAspect(v: unknown): v is FigureAspect {
  return typeof v === 'string' && (FIGURE_ASPECTS as readonly string[]).includes(v)
}
export function isSettingFamily(v: unknown): v is SettingFamily {
  return typeof v === 'string' && (SETTING_FAMILIES as readonly string[]).includes(v)
}

/** THE rule. Everything else in this file serves it. */
export const TOPIC_WORLD_RULE =
  "THE TOPIC SETS THE WORLD. The reader is a man who is a father; the picture is of the topic. Decide the piece's visual world first — the real places, objects and people where this subject is actually seen — and plan every picture inside it. " +
  'A piece about a river is shot on the river; about a truck, on the road and in the driveway; about research, policy, money or culture, in the public places where the subject lives: a street market, a school gate, a courthouse step, a factory floor, a stadium, a border road, a library, a hospital corridor. ' +
  'A kitchen, a porch, a garage or a nursery appears when the piece is set there, not because the site is for dads; children and family appear when the piece is about them. Never retreat to a generic home interior because the topic is abstract: find the real place where the idea is visible.'

/** The blank-globe trap: a sanitised stand-in for an unrenderable reads as exactly what it is. */
export const STAND_IN_RULE =
  "When the obvious subject is on the never-ask-for list, do not render a blanked-out stand-in (a globe with no borders, a dark screen, a sign with nothing on it, a blank document): pick a different real scene from the topic's world, or make the placement owned."

export const CLICHE_RULE =
  'Never a stock metaphor — a lone empty chair, a globe, a compass, chess pieces, a lightbulb, scales, puzzle pieces, a signpost, a fork in the road, a sapling in cupped hands — and never a staged emotion.'

/**
 * Things an AI image on this site is never asked to show. A subject that needs
 * one of these is an `owned` need: the author captures it. Screens are the
 * big one — a login page, a settings menu, a dashboard readout cannot exist
 * without text, so the no-text rule and the prompt fight and the slot fails.
 */
export const UNRENDERABLES: readonly string[] = [
  'a phone, tablet, laptop, TV or dashboard SCREEN with anything showing on it',
  'an app, a website, a menu, a form, a sign-in page, a map or a globe with borders on it',
  'a document, receipt, label, chart, diagram, logo, or any sign the viewer is meant to read',
  'a specific make or model of anything, a brand, packaging',
  'a named landmark that has to be recognisable (a specific bridge, monument, stadium or skyline) — an unnamed street, river, courthouse, ballpark or city is fine',
  "a real person, a public figure, or anyone's likeness",
]

/**
 * How people may appear without a face. The planner picks from this bank, never
 * invents a face. Anonymous is not absent: half of these put people IN the frame.
 */
export const ANONYMOUS_PHRASES: readonly string[] = [
  'hands at work, cropped at the wrists or forearms',
  'a figure from behind, walking away or facing the task',
  'over the shoulder, the face out of frame',
  'a profile lost in shadow or turned to the window',
  'a crowd or a line of people at a distance, faces too small to read',
  'figures in motion blur, or seen through glass, rain, steam or a fence',
  'a silhouette against a sky, a doorway, a floodlit field or a lit garage',
  'a child from behind, or from the shoulders down',
]

export const SHOT_GUIDE: Readonly<Record<ImageShot, string>> = {
  wide: 'the whole place; the subject small; the street, shoreline, hall, yard or road tells the story',
  medium: 'a figure or object at conversational distance with the place still visible',
  detail: 'one object or texture filling the frame, the background a soft blur',
  overhead: 'straight down onto a surface — a workbench, a tailgate, a market stall, a dock, a counter',
  pov: "first person: the viewer's own hands, boots or steering wheel at the bottom edge of the frame",
  low: "from the ground looking up — a kid's height, a dog's height, the base of a machine or a tree",
  through: 'framed through something — a doorway, a windshield, a chain-link fence, a window, a gap in a crowd',
  aerial: 'from well above — a rooftop, a bridge, a drone: a block, a jobsite, a river bend, a ballfield; at most one per piece',
}

export const ASPECT_GUIDE: Readonly<Record<FigureAspect, string>> = {
  '3:2': 'wide, medium, through and aerial scenes',
  '1:1': 'overhead and detail shots; a square reads large on a phone',
  '4:5': 'a tall subject, hands at work, a doorway, a standing figure, a low shot; the biggest image a phone can show',
}

export const SETTING_GUIDE: Readonly<Record<SettingFamily, string>> = {
  home: 'inside a house — a kitchen, a living room, a nursery, a hallway at night',
  yard: 'a back yard, a porch, a driveway, a deck, a fire pit',
  'garage-shop': 'a garage, a workshop, a shed, a workbench, a tool wall',
  street: 'a city or small-town street, a sidewalk, a plaza, a crosswalk, a block of storefronts',
  'market-shop': 'a market, a hardware-store aisle, a diner counter, a barbershop, a bar',
  institution: 'a school gate, a church, a courthouse step, a hospital corridor, a library, an office floor, a town hall',
  jobsite: 'a construction site, a factory floor, a loading dock, a farm, a warehouse',
  'field-arena': 'a ballfield, a stadium, a gym, a track, a rink, a pool deck',
  road: 'a highway, a back road, a truck cab, a gas station, a parking lot',
  nature: 'woods, a trail, a ridge, a desert, an open field, a campsite',
  water: 'a river, a lake, a dock, a beach, a boat',
  transit: 'an airport, a train platform, a bus, a border crossing, a ferry',
}

/** The five-clause prompt shape every AI prompt follows. */
export const PROMPT_STRUCTURE =
  `Write each AI prompt as ONE paragraph of ${PROMPT_CHARS.min}–${PROMPT_CHARS.max} characters made of five labelled clauses: ` +
  'SUBJECT — what fills the frame, in concrete nouns; a generic, unbranded version of a category object (a cooler, a stroller, a drill) is welcome. ' +
  "SETTING — a real place from the topic's world (say what kind: a street, a river bank, a courthouse step, a workshop), the season, the hour, the weather, and two or three details of that place taken from the piece. " +
  'MOMENT — what is happening and what just happened; people as the people rule allows — a public place is full of them. ' +
  'FOCAL — the one thing that is sharp and nearest the viewer. ' +
  "EXCLUDE — what must not appear: always readable text, logos, brands and any real person's likeness; faces when the people rule excludes them; plus whatever this setting would tempt (a screen on the dash, a label on the jar, a readable storefront sign). " +
  'Never write lighting, lens, film stock, colour grading or style words — the house style supplies those.'

export const HERO_COMPOSITION_RULE =
  "The hero is generated at 3:2 and cropped to 16:10: keep the subject in the central band with breathing room on every side, and put nothing that matters near the top or bottom edges. The hero is the widest view of the piece's world — wide, medium, through or aerial, or an overhead when the subject is a surface — never a detail."

export const VARIETY_RULE =
  'Across one piece no two pictures share a setting or a shot type when it can be helped, and at most one is set at home unless the piece is about the home. If there are two or more inline images, at least one is a detail, overhead, hands or low shot. The season stays consistent within a piece unless the prose moves it; the hour and the weather may change from picture to picture.'

export const ATMOSPHERE_RULE =
  'Season, hour and weather belong to the piece: take them from the prose when it says; otherwise choose what serves the subject — hard noon sun, flat overcast, cold first light, rain, snow, night under streetlights are all house. Across the site every hour and every season appears; nothing defaults to autumn and dusk.'

export const ESSAY_RULE =
  "For an essay or discussion piece the picture carries the idea through a real place or object from the topic's world — a courthouse step at opening time, a factory gate at shift change, a market crowd, a road at night, an empty bleacher after the game — not a kitchen table standing in for every idea. " +
  CLICHE_RULE

export const OWNED_RULE =
  'A need that depends on an unrenderable is `owned`: leave the prompt empty and write `ask` as one concrete line telling the author exactly what to capture, in the second person, naming the thing ' +
  '("Screenshot of the OnStar sign-in screen with your account details hidden", "Your photo of the latch on the cooler lid"). Owned slots count toward the image count.'

export const ILLUSTRATION_RULE =
  'These pictures are rendered as editorial illustrations, not photographs: write each subject as a drawable idea — one object, place or figure with a clear silhouette, few elements, a single focal point — and never photographic detail (textures, bokeh, lens, light quality). Drawn figures may carry simple faces where the people rule allows.'

// ── Atmosphere ───────────────────────────────────────────────────────────────
// A season, an hour and a weather, suggested per run for when the prose is
// silent. Left to itself the planning model picks autumn at dusk nearly every
// time — the moody default — and the site reads as one afternoon. The draw is
// random per run (a test passes a fixed `random`); the prose and the subject
// both outrank it.

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const
export type Season = (typeof SEASONS)[number]

export const HOURS: readonly string[] = [
  'first light', 'mid-morning', 'hard noon', 'mid-afternoon', 'golden hour', 'blue hour after sunset', 'night under streetlights or work lights',
]

export const WEATHER_BY_SEASON: Readonly<Record<Season, readonly string[]>> = {
  spring: ['clear and bright', 'light rain', 'wind', 'bright overcast', 'wet ground after a storm'],
  summer: ['clear and hot', 'heat haze', 'a thunderstorm building', 'bright overcast', 'just after rain'],
  autumn: ['clear and crisp', 'heavy grey overcast', 'light rain', 'fog or mist', 'wind'],
  winter: ['clear and cold', 'heavy grey overcast', 'snow on the ground', 'sleet', 'fog'],
}

export interface Atmosphere {
  season: Season
  hour: string
  weather: string
}

export function pickAtmosphere(random: () => number = Math.random): Atmosphere {
  const pick = <T>(list: readonly T[]): T => list[Math.min(list.length - 1, Math.max(0, Math.floor(random() * list.length)))]
  const season = pick(SEASONS)
  return { season, hour: pick(HOURS), weather: pick(WEATHER_BY_SEASON[season]) }
}

/** The suggestion as prompt text: the prose wins, then the subject, then this. */
export function atmosphereLine(a: Atmosphere): string {
  return `When the prose does not fix them, use this season, hour and weather: ${a.season}, ${a.hour}, ${a.weather}. The prose wins where it says otherwise; the subject wins where the suggestion makes no sense for it (no snow on a summer-grilling piece). Never default to autumn and dusk because nothing decided it.`
}

// ── People and text, as prompt text ──────────────────────────────────────────

/** The people rule as prompt text, by policy and look. */
export function peopleRule(policy: PeoplePolicy, look: ImageLook = 'photo'): string {
  if (policy === 'none') return 'No people at all: no hands, no figures, no body parts.'
  if (policy === 'allowed') {
    return look === 'illustration'
      ? "Drawn figures may have faces: simple, generic, unposed, mid-task — never a likeness of a real or public person, never a child as the subject, and a face is never the picture's subject."
      : 'People may appear with faces: ordinary, unposed, mid-task, not looking at the camera — never a recognisable or famous person, never an identifiable child; one or two people doing something over a posed group.'
  }
  return (
    `People appear only anonymously — pick from: ${ANONYMOUS_PHRASES.join('; ')}. Never describe a face. Never an identifiable child. ` +
    'Anonymous is not absent: a public place is full of people, seen at a distance, from behind or in motion; never empty a scene to avoid a face, and never stage "someone just stepped away".'
  )
}

/** The text rule as prompt text. */
export function textRule(allowText: boolean): string {
  if (!allowText) {
    return 'No text of any kind the viewer could read: no lettering, numbers, signage, labels or watermarks. The signs, spines, labels and screens a real place would have are blurred, turned away, distant or too small to read — never a word the viewer could make out.'
  }
  return 'If text is wanted, put the exact words in double quotes, at most four words, plain English, on one surface only; nothing else in frame carries lettering.'
}

/**
 * The full rule block a prompt-writing model receives. One source for the
 * planner and the assist so they never disagree about what is allowed.
 */
export function doctrineBlock(opts: { people: PeoplePolicy; allowText: boolean; look?: ImageLook }): string {
  const look = opts.look ?? 'photo'
  return [
    'RULES FOR EVERY IMAGE:',
    `- ${TOPIC_WORLD_RULE}`,
    `- Never ask for: ${UNRENDERABLES.join('; ')}.`,
    `- ${STAND_IN_RULE}`,
    `- ${OWNED_RULE}`,
    `- ${peopleRule(opts.people, look)}`,
    `- ${textRule(opts.allowText)}`,
    '- No logos, brands, packaging or a specific make or model; a generic unbranded category object is fine and often the right subject.',
    `- ${PROMPT_STRUCTURE}`,
    `- Settings (name one per picture): ${SETTING_FAMILIES.map((s) => `${s} = ${SETTING_GUIDE[s]}`).join('; ')}.`,
    `- Shot types: ${IMAGE_SHOTS.map((s) => `${s} = ${SHOT_GUIDE[s]}`).join('; ')}.`,
    `- Aspect (inline figures only; phone readers first): ${FIGURE_ASPECTS.map((a) => `${a} for ${ASPECT_GUIDE[a]}`).join('; ')}.`,
    `- ${VARIETY_RULE}`,
    `- ${ATMOSPHERE_RULE}`,
    `- ${HERO_COMPOSITION_RULE}`,
    `- ${ESSAY_RULE}`,
    ...(look === 'illustration' ? [`- ${ILLUSTRATION_RULE}`] : []),
    '- altText is what a reader would see described, under 120 characters, no "Image of". caption is one editorial sentence under the image that adds something the alt does not, under 100 characters.',
  ].join('\n')
}
