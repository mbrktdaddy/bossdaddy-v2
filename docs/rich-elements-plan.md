# Rich elements in guides & reviews — plan (2026-10-25)

> Scope: lists, callouts, steps, timelines, tables, charts and video inside the
> article BODY, produced or recommended by generation and editable in the
> workspaces. Companion to `docs/content-pipeline-plan.md` (the staged pipeline
> this builds on). Brand rules that bind every element: `docs/brand-guide.md`
> §2 "Blocks" (no orange fills / black panels inside article bodies), §3 (one
> heading voice), §7.1 (no emoji iconography); CLAUDE.md "Article bodies never
> get a scroll wrapper".

## 0. Where it stood on 2026-10-25

| Surface | State |
|---|---|
| Section output | Plain paragraphs only. `sectionPrompt` said "no bullet lists unless the intent calls for one"; `paragraphsToHtml` wrapped blank-line blocks in `<p>`. Lists effectively never appeared. |
| Structured blocks | TL;DR, key takeaways, FAQs, best for / not for, pros/cons, sub-scores, specs grade, spec comparison, testing timeline — all columns + React components AROUND the body, not inside it. Pros/cons were selected but only emitted as JSON-LD (never shown). |
| Body renderer | `components/content/ArticleBody.tsx` splits HTML into segments (`html` · `figure` · `product` · `collection` · `contentlink`) via `lib/inline-content.ts`. A new element = one marker div + one regex + one component. |
| Editor | Tiptap 3 StarterKit (headings 2–4, lists, blockquote, code) + custom `FigureNode` / `ImageGridNode`. No table, callout, video, embed nodes. Collection embed + cross-link are text tokens swapped for marker divs on save. |
| Sanitizer | `lib/sanitize.ts` — tables, iframes, video stripped; `div` classes limited to `bd-image-grid` / `bd-collection-embed` / `bd-content-link`. |
| Video / charts | None. CSP (`next.config.ts`) has no `frame-src`. No chart library; SVG is hand-rolled (score ring, verdict arc). |
| How-to | `pieceType = 'howto'` only changes prose length + offered blocks. No steps structure, no HowTo JSON-LD. |

## 1. Principles

1. **The model writes prose in a constrained Markdown subset; everything richer is a typed block the author approves.** Never let a model emit arbitrary HTML, iframes or inline styles. Mirrors the image-slot pattern (model proposes → panel → author accepts).
2. **Elements are earned by content, not templates.** A list where the reader performs steps or compares parallel options; a callout where a warning or aside would otherwise break the paragraph; a chart only where real numbers exist (sub-scores, specs, price). Decorative infographics with no data behind them are invented specifics — the critic treats them as such.
3. **Hard Goods inside the body = hairlines and rules, never fills.** Callouts/steps/tables use `border-soft` boxes, an orange LEFT RULE (the blockquote treatment), Montserrat labels; radius 4px; no shadows; no emoji.
4. **Everything survives a refine.** New marker divs register with `preserveBlocksAcrossRefine` (`lib/content/markers.ts`); `htmlToStructuredText` flattens them to text so the model can see them when editing.
5. **Phone authoring never regresses.** Every element is insertable from the Tiptap toolbar by hand, not only via generation.

## 2. Lane 1 — inline formatting the model writes directly — BUILT 2026-10-25

Cheapest, biggest lift: changes every new piece with no schema or editor work.

- `lib/content/html.ts` `paragraphsToHtml` now parses the subset: `- ` / `* ` bullets, `1.` numbered lists, `### ` H3, `> ` pull-quote, `**bold**`, `*italic*` / `_italic_`. Anything else is literal. Legacy whole-doc routes and `replaceSectionProse` (refine) use the same function, so pasted/refined prose gets the same treatment. `htmlToStructuredText` round-trips `<ol>` as `1.` lines (was `- `).
- Outline parts gain `format: 'prose' | 'steps' | 'list'` (`OutlineOutput` + `OutlinePart`, optional on stored runs → `prose`). The outline stage recommends it per part; the author can change it in `OutlineEditor` (a 3-way select). This is the "recommend an element where applicable" hook for lane 1.
- `sectionPrompt` carries a FORMAT block: what the subset is, when a list earns its place (steps the reader performs in order; 3+ parallel options/criteria; a materials/checklist), when it doesn't (narrative, argument, verdict), bold lead-ins for list items, at most one pull-quote per part, never a list in an essay. `format: steps` → "one numbered list is the spine of this part, with a sentence or two around it"; `list` → "one bulleted list…"; `prose` → "paragraphs; a short list only if the intent really calls for one".
- `BOSS_DADDY_SYSTEM` OUTPUT line: "plain prose in light Markdown (lists, bold, ### sub-heads, one pull-quote) — no JSON, no # / ## headings, no code fences".
- Critic rules (`critic/rules.ts`): `list-in-essay` (warn) · `list-heavy` (note: >50 % of a part's lines are list items, or lists in more than half the parts) · `format-missing` (note: part asked for steps/list but none written) · `heading-in-part` (block: a `#`/`##` line — the part would fork the outline).
- CSS (`app/globals.css`): `.bd-editorial` lists — orange square bullets, bold Montserrat counters, `li` spacing; `h3` tightened. All hairline/ink, no fills.
- Review page shows **pros & cons** (`components/reviews/ProsConsCard.tsx`, after Key Takeaways; hairline card, check/x icons in `forest` / `danger-ink`, no tinted wash).
- Second-pass review (same day) fixed: `OutlineEdit` (the author-save schema) lacked `format`, so Zod stripped it on every PUT and every part would have drafted as prose; a lone "2024. That was the year…" line rendered as a one-item numbered list (now 1–2 digit numbers and 2+ items); steps/list parts put the `[[BUY:]]` token in a paragraph, never a list item (inside `<li>` the token resolves to an inline link, never the product card); the refine prompt said "no markdown" and would have flattened lists on a refine; critic `pullquote-count` note.
- Known, left: a numbered list split by a paragraph restarts at 1 (`start` isn't on the sanitizer allow-list); the Tiptap editor surface doesn't carry `.bd-editorial`, so bullets look different while editing than on the page; the orange square `::marker` glyph needs a phone look.
- `PROMPT_VERSION` → `2026-10-25.1`. **Owed:** `npm run content:eval` against the 2026-10-23 baseline (6/6 · 0 block · 7 warn) — target no new warns, lists present in the how-to brief only.

## 3. Lane 2 — proposed elements as typed blocks — callout + steps BUILT 2026-10-25

Same shape as image slots. **Outline stage** recommends `elements: { type, afterHeading, reason }[]` at piece level (max 3, one steps box, none on an essay — `normalizeElementPlans`); the author sees them under "Body elements the planner recommends" in `OutlineEditor` and drops any. **Blocks stage** drafts each kept element FROM the finished prose (`ElementDraftOutput`, one flat shape; `normalizeElement` enforces per-type rules, drops what doesn't hold). **Assembly** (`elementToHtml` → `assembleDraftHtml`) places each after its part's prose ('' = after the intro), before image slots. Stored as marker divs the sanitizer allows (`bd-callout[data-kind][data-title]`, `bd-steps[data-title][data-time]`); globals.css styles them (hairline, orange left rule, Montserrat kicker from `data-title`); public pages render the HTML as-is — no new segment type. Tiptap `CalloutNode` / `StepsNode` (editable content, kicker = title input + kind select + Remove) and toolbar **+ Callout** (wraps the paragraph; toggles off) / **+ Steps** (inserts a 3-item box). `PRESERVED_BLOCK_RE` keeps them across refines (patch refine: end of section; whole-doc refine: under the H2, same as figures). `extractSteps` → **HowTo JSON-LD** on the guide page (first box). `stripEmptyElements` at render; `hasEmptyElements` exists but is NOT yet wired into submit/approve (4 routes still gate on image slots only). The critic sees elements via `blocksText`. Registry = `lib/content/elements.ts`; tests `tests/unit/content-elements.test.ts`.

Second-pass review (same day) fixed: the blocks schema demanded an exact element count, so a model that judged one element unsupported would have failed the whole stage after burning the retries (now `max` only); the Tiptap boxes accepted any block, so a figure or gallery dropped inside would have ended the marker's non-greedy `</div>` match early (content is now paragraphs and lists only); Tiptap wraps list items in `<p>`, which the steps CSS didn't reach; a step title ending in `?` or `!` got a stray period.

**Key facts + timeline BUILT 2026-10-25** on the same spine: `facts` = `div.bd-facts > ul > li(<strong>Label:</strong> value)` (a list with bold labels rather than the `dl` sketched below — the existing list nodes make it editable on the phone with no new Tiptap primitives; CSS lays it out as label/value rows, two columns from `sm`), `timeline` = `div.bd-timeline > ol > li(<strong>When</strong> Moment. body)` (CSS: vertical rail, orange square per moment, the bold "when" as a small uppercase label). One facts and one timeline box per piece (`normalizeElementPlans`), model drafts via `facts[]` / `events[]` on `ElementDraftOutput`, toolbar **+ Facts** / **+ Timeline** seed three rows. Facts guidance everywhere: only numbers the prose or the author facts STATE.

Still to build in this lane: wiring `hasEmptyElements` into the 4 submit/approve routes; a renamed heading at the outline drops the element pointed at it (re-key by part index); the Tiptap `+ Callout` wrap needs a phone look (the kicker input inside a node view).

| Element | Marker | Render | Notes |
|---|---|---|---|
| Callout | `div.bd-callout[data-kind=tip\|warning\|safety\|faith\|note]` + `<p>` | hairline box, orange left rule, Montserrat kicker | never a fill; `safety` and `faith` turn edge OFF (brand-guide §1.6) |
| Steps | `div.bd-steps` + `ol` of `li` (`<strong>` title + body) | numbered stepper, optional time/materials line | drives **HowTo JSON-LD** for `howto` guides |
| Timeline | `div.bd-timeline` + `ol` (`data-when`) | vertical rail, borrow `ReviewTimelineStrip` | "first 12 months", "how it held up" |
| Key facts | `div.bd-facts` + `dl` | two-column label/value, self-scrolling | the sanitizer keeps stripping raw `<table>`; `dl` is the allowed shape |
| Video slot | `div.bd-video[data-provider=youtube][data-id]` + `<p>` caption | lane 3 | model proposes the slot + subject; author pastes the URL |

Work: sanitizer allow-list (`dl dt dd`, the new div classes, `data-kind` / `data-when` / `data-provider` / `data-id`), `lib/inline-content.ts` regexes + union, `ArticleBody` branches, `markers.ts` preservation, `htmlToStructuredText` flattening, Tiptap atom nodes with node views (`FigureNode` is the template) + toolbar buttons, `publish-gate` (no empty element), tests for every regex.

## 4. Lane 3 — video and charts — BUILT 2026-10-25

**Video.** `lib/content/video.ts` (`parseYouTubeUrl` for every URL shape + bare IDs, poster from `i.ytimg.com`, embed on `youtube-nocookie.com`). The outline may plan ONE `video` slot (type in `PLAN_TYPES`, not `ELEMENT_TYPES` — the blocks stage never drafts it; `reason` = the subject). `runToDraftHtml` places an empty marker `div.bd-video[data-provider][data-id=""][data-caption][data-subject]` after the part; the Tiptap `VideoNode` (atom) shows the planned subject and takes a pasted link (validated live) + caption; toolbar **+ Video**. Public page: `lib/inline-content.ts` `video` segment (filled slots only) → `components/content/VideoEmbed` = click-to-load facade (next/image poster + play glyph; iframe only after the tap, `allow` scoped; "Watch on YouTube" link as the no-JS path). CSP: `frame-src https://www.youtube-nocookie.com`, `img-src` += `i.ytimg.com`, `remotePatterns` + `lib/images/remote-hosts.ts` mirror. **Publish gate:** `publishBlocker()` in `lib/content/publish-gate.ts` is now THE gate in all 4 submit/approve routes (image slots, empty video slots, empty element boxes) — closes the lane-2 gap. Render safety net strips empty slots.

**Charts.** `chart` is a drafted element with the facts row shape (`<li><strong>Label:</strong> 12</li>`) plus `data-unit`; `normalizeElement` needs 3+ numeric rows (the gate against decorative infographics; the blocks prompt says every number must appear in the prose). Public page: `chart` segment when every row parses as a number → `components/content/BarChart` = server SVG, single series (dataviz method: no categorical palette needed; thin ink bars on a recessive track; labels/values in text tokens; native `<title>` hover; the stored list stays in the DOM `sr-only` as the table view; chrome-black bars because orange fills stay out of the article lane). A box with a non-numeric row stays HTML and reads as a facts list. Tiptap `ChartNode` (title + unit inputs, rows edited as a list), toolbar **+ Chart**. No chart library.

Second-pass review (same day) fixed: `VideoEmbed` rendered a `<figure>`, and `ImageLightbox` claims every `<figure><img>` in the body — a tap on the poster would have opened the zoom overlay instead of playing (now a `<div>` with a `.bd-video-caption`); the embed URL lacked `playsinline=1`, so iOS Safari would have forced fullscreen. Known: the workspace preview renders an empty video marker as nothing and a chart as its facts list (the facade and SVG are public-page components); the workspace checklist's "No placeholders" advice doesn't yet know about video slots or empty boxes (the server gate does).

Left: the editor toolbar now carries six element buttons — group them under one "Insert" menu once he's seen it on the phone; a renamed heading still drops the element pointed at it; HowTo JSON-LD could carry `video` when a slot is filled.

### Original sketch (kept for the record)

- **Video:** YouTube through `youtube-nocookie.com` behind a click-to-load facade (poster from `i.ytimg.com` via `next/image` remotePatterns, iframe injected on tap). CSP: `frame-src https://www.youtube-nocookie.com`, `img-src` += `i.ytimg.com`. The marker carries only the ID — no iframe ever passes the sanitizer. Self-hosted MP4 (Supabase storage, `<video>`) is the fallback if YouTube is ruled out; it costs bandwidth and loses discovery. Generation can only RECOMMEND a slot.
- **Charts:** server-rendered SVG from JSON — bar (sub-scores / spec comparison), simple line (price history when the radar has it). No chart library. Use the `dataviz` skill's palette rules with the brand tokens. Gate: a chart needs ≥3 real data points the author supplied or the DB holds; never model-invented numbers.
- **Diagrams:** no Mermaid (client-heavy, off-brand). A "decision steps" element (lane 2 Steps with `data-kind=decision`) covers the workflow-diagram ask.

## 5. Order

1. Lane 1 (done) → eval run → his phone walkthrough.
2. Lane 2: callout + steps first (most publisher value, HowTo JSON-LD), then key facts, timeline.
3. Lane 3: video facade; charts only when a data source exists.

## 6. Walkthrough (lane 1, phone)

1. New guide, piece type **How-to**, 3 key points that read as steps → outline shows a `Steps` format on at least one part. Change one part to `Prose`, save.
2. Start writing → the steps part streams as a numbered list with bold lead-ins; the prose part has no list. Preview: orange square bullets / bold counters, no fills.
3. Critic: no `list-heavy` note on a 4-part how-to; write an essay with a list in the intent → `list-in-essay` warn appears.
4. Refine one list section (patch refine) → list survives as a list, numbering intact.
5. Open an approved review → **Pros & cons** card sits under Key Takeaways, hairline only.
