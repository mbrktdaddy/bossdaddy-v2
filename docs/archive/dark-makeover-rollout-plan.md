# Dark-First Brand Makeover — Rollout Plan

> Status: **SHIPPED / HISTORICAL** — the dark-first makeover is live site-wide. Archived rollout record. Current design authority: `docs/brand-guide.md` §2–12 + `app/globals.css`.
> Companion memory: `project_dark_makeover.md`.

## Goal
Pivot Boss Daddy from a light editorial-affiliate look to a **dark-first, masculine, modern-tech identity** — "the everyday command center for dads" — without a rewrite, leaning on the existing role-token system.

## Scope
- **In:** every web surface — public pages, reviews, guides, listings, tools, dashboard, auth, forms.
- **Out:** email templates stay LIGHT (dark-mode email rendering is unreliable). Print styles already force light (`@media print` in `globals.css`) — leave as-is.

## Locked decisions (from sandbox)
- **Hero:** Photo (real DIY-dad workshop shot) + **Hot accent** `#E55A1A`. Desktop image `hero-workshop.webp` (subject right, text left); mobile `hero-workshop-mobile.webp` (subject low, copy SPLIT: title top / subhead + side-by-side CTAs bottom).
- **Reading surface:** `<ArticleSurface>` wrapper — **panel < lg (1024px), canvas at lg+**. Single source of truth so the policy is a one-line revert.
- **Body type:** Sans, ~18px, line-height ~1.78. Serif kept for **blockquotes only**.
- **Product images on dark:** framed (border + padded surface) to tame white-bg glare.
- **FTC disclosure:** stays `muted`, never `faint`.
- **Copy:** all titles, taglines, subheadings KEPT as-is. This rollout changes treatment + structure, not words.

---

## Phase 0 — Leak audit (DONE)
Role-token discipline held. Surfaces/borders/body-text are essentially clean (≤6 raw hits). Net-new breakage concentrates in three buckets:

| Bucket | Pattern | Hits / files | Severity | Fix |
|---|---|---|---|---|
| ① Invisible shadows | `shadow-black/*`, `shadow-zinc-900` | 71 / 51 | Low (depth loss, not breakage) | Global elevation decision (border/ring/dark-shadow token) |
| ② Dark "islands" | `bg-drama` | 11 / 9 | Structural | Re-differentiate 9 chrome components |
| ③ Raw status colors | `bg-*-50/100`, `text-*-600/700/800` | 88 + 139 | Mostly already-dark | Route through chip tokens; ~80% in workspace/admin/auth already render dark today |
| + White frames | `bg-white` | 8 / 7 | Low | Folds into framed-image rule |

`text-black`, `to/from/via-white`, light borders, hardcoded light surfaces: **0–1 hits.** Clean.

---

## Phase 1 — Token flip (the switch)
- [ ] Branch `dark-makeover`.
- [ ] Apply `data-theme="dark"` at the **root layout** (`app/layout.tsx` on `<html>` or the top body wrapper). Light becomes opt-in.
- [ ] Verify email templates do NOT inherit the attribute (they render in their own pipeline — confirm).
- [ ] Set accent to **Hot** `#E55A1A`: update the dark-zone `--bd-orange` / `--bd-orange-hover` / `--bd-orange-text` in `globals.css`. (Confirm against CLAUDE.md "no vivid orange" rule — Hot is still our burnt scale, not Tailwind's `#f97316`; update the rule's note if needed.)
- [ ] First full-site smoke pass — expect chrome (②) and shadows (①) to look off; everything else should be close.

## Phase 2 — Chrome re-differentiation (the dissolved "dark islands")
The `--color-drama` islands no longer contrast once the page is dark. Re-differentiate via elevation + hairline, not a darker shade.
- [ ] **Global elevation decision** (kills bucket ①): adopt a dark-canvas elevation convention — cards/surfaces separate via `border-soft` (+ `hover:border-accent`) and/or a defined raised surface, NOT black shadows. Apply broadly; retire `shadow-black/*` on dark.
- [ ] Components to rework: `Header`, `Footer`, `TrustBand`, `MobileBottomNav`, `StickyMobileCta`, `InMotionTicker`, `VaultCard`, plus the homepage + `install` page uses.
  - Header/Footer: sit on canvas, separate with a hairline + subtle elevation; logo + nav already token-driven.
  - **TrustBand: was the single *dark* moment — re-cast as the single *accent/elevated* moment** (orange top-rule or most-raised band) so it still punctuates the page.

## Phase 3 — Homepage layout + order (see detailed section below)
- [ ] Rebuild hero as the Photo hero (desktop + mobile split, Hot accent).
- [ ] Restructure top-of-page per the layout recommendation below.
- [ ] Convert homepage cards from shadow- to border-based elevation.

## Phase 4 — Content pages (reviews, guides)
- [ ] Build `<ArticleSurface>` wrapper (panel < lg / canvas ≥ lg) — single source of truth; route every review/guide body through it.
- [ ] Switch `.bd-editorial` body to **sans**; **decouple** font-family from link + blockquote styling in `globals.css` so sans body keeps orange inline links and the serif pull-quote.
- [ ] Body ~18px / line-height ~1.78.
- [ ] Framed product-image rule (border + padded surface) for white-bg shots; verify spec-comparison tables, ScoreBlock, BossApprovedBadge, Buy CTA, FTC disclosure on dark.

## Phase 5 — Sweep remaining public surfaces
- [ ] Net-new public status colors (homepage bench chips `text-green/blue/amber-600`, ticker, stray cards) → chip token system (`danger/success/warn/info` → `-bg/-line/-ink`).
- [ ] `bg-white` image frames on public components (`BenchGallery`, `ProductCtaCard`) → framed-image rule.
- [ ] Listings (reviews/guides/gear/vault/category), gifts, comparisons, about, install, search.

## Phase 6 — Already-dark surfaces + QA
- [x] Dashboard / workspace / tools / account / auth already render dark — verified clean after the root flip (token-driven; no double-application).
- [x] Text selection + native `color-scheme: dark` (scrollbars/form controls) defined in `globals.css`. (Focus rings already use `ring-copper`/`focus-visible`.)
- [x] Delete `/brand-lab` (+ `/reading`, `/masthead`) sandbox. (Hero webp images are in use by HomeHero — kept.)
- [x] Update `docs/brand-guide.md` §2 + `§1.8` and the project `CLAUDE.md` Design System section to dark-first + Hot accent + chrome/surface-hover tokens. `globals.css` header comment updated earlier.
- [ ] **User**: WCAG AA contrast eyeball on the live deploy (token tiers: `prose`/`prose-muted` pass AA on dark; `faint` reserved for decorative/large only).
- [ ] **User**: device test on Galaxy (OLED halation, mobile hero, panel reading surface, FAB + bottom-nav Ask slot).

## Risks & rollback
- **Rollback is cheap:** the whole flip is the root `data-theme` attribute + the accent values. Reverting = remove the attribute. The `<ArticleSurface>` policy is one line.
- **Biggest unknown:** the already-dark scopes (Phase 6) interacting with a now-dark root — test early.
- **Don't churn copy or section order beyond the recommendation below** — the user likes the current titles/taglines/subheads.

---

# Homepage layout & order — how the hero + dark + identity shift change things

**Principle:** the copy is good and the section sequence is mostly well-judged. The Photo hero and dark theme force a few *structural* changes (mostly at the top), not a reorder of the whole page.

## Current order
1. **Brand Hero** — manifesto H1 + subhead + "Who is Boss Daddy?" + PipelineCounter + **The Index** (3 doors: Reviews / Guides / Tools).
2. **Featured Review** (left) + **On the Bench** (right).
3. **Just Dropped** (recent reviews, elevated band).
4. **Free Tools** — Ask the Boss + Weekends Until + Savings.
5. **From the Library** (guides).
6. **Top Picks** (ranked list).
7. **Trust Band** (was the single dark moment).
8. **From the Vault** (collections, elevated band).
9. **Get the App** (install).
10. **Email Capture.**

## The one real problem the Photo hero creates: a double-hero
Today the page opens with a *typographic* brand hero, then a *second* big visual moment (Featured Review with a large image + score). With the new **Photo hero** (full-bleed image + manifesto), you'd have **two heavy image moments stacked back-to-back**, competing for attention.

### Recommended adjustment (minimal, high-impact)
**Split the hero into two beats:**
1. **Photo hero** — its own immersive, full-bleed section. Manifesto + CTAs over the workshop image. *Nothing else in it* (keep it clean).
2. **Wayfinding strip** (new, lightweight) — pull **The Index (3 doors)** + **PipelineCounter** OUT of the old hero into a slim band directly below. This is the handoff: *emotion (hero) → orientation (where do I go + live proof).* The orange top-rule on the doors pops beautifully on dark.

Then **Featured Review + Bench** follows at #3 as before — but now it's separated from the hero by the wayfinding strip (a visual breather), and we render the **Featured image framed/contained** (not full-bleed) so it reads as "editorial card," distinct from the hero's full-bleed treatment. That resolves the double-hero.

### Everything from #3 down stays in order
Reviews proof (Featured, Just Dropped) → Tools → Guides → Top Picks → Trust → Vault → conversion (App, Email) is a sound funnel. The user likes it; **no reorder below the fold.**

### Optional, identity-driven (flag, don't force)
The brand is tilting "everyday tool." If you want to surface that earlier *without* overstating it, add a single slim **"Ask the Boss"** line into the wayfinding strip (one sentence + link), while keeping the full **Free Tools** section at #4. Humble, but it signals the tool identity above the fold. Leave out if it feels like too much, too soon.

## The three doors (wayfinding strip)
Keep **3 doors, same order (Reviews → Guides → Tools), same taglines.** Changes:
- **Add a live count to each door** — turns the strip into a stat-backed index (alive, substantive, on-brand for the tool/command-center identity, reads heavier on dark):
  - Honest Reviews · *N tested* — Field-tested gear, bought with my own money.
  - Practical Guides · *N published* — No-fluff how-tos for real situations.
  - Boss Tools · *N free* — Weekends Until, Savings & more.
  - Reviews count already queried (`reviewCount`); add a guides count; tools is a static number.
- **Naming consistency:** door says "Boss Tools" but section below is "Free Tools" — unify on **"Boss Tools"** ("N free" carries the value); drop the redundant "— free" from the blurb.
- **Verbs stay varied** (Browse / Read / Try) — action-specific beats generic.
- **Dark visual:** keep orange top-rule + hairline dividers + orange icon squares; add subtle `hover:bg-surface` lift per door.
- **No 4th door** for The Boss/AI — would overstate tools before they're built out; The Boss lives in the Free Tools section + the optional strip teaser.

## Per-section dark treatment (copy unchanged)
- **Section rhythm:** alternate canvas `#09090b` ↔ raised `#18181b`/zinc-900 bands (replaces the old white ↔ zinc-200 alternation). Keep the `border-b border-soft` separators. Just Dropped + Vault remain the elevated bands.
- **Cards** (DroppedCard, VaultCard, Free Tools cards, Top Picks rows): border-based elevation (`border-soft` + `hover:border-accent`), not shadows — shadows vanish on dark (bucket ①).
- **Images become focal "windows of light"** on dark — premium gallery feel. Editorial scene photos shine; product thumbnails get the framed treatment so white-bg shots don't glare.
- **The Index doors:** orange top-rule + hairline dividers already read great on black — keep; add a subtle `hover:bg-surface`.
- **Trust Band:** redesign as the single *accent/elevated* punctuation (see Phase 2) since it's no longer "the dark one."
- **Hero CTAs:** "Explore Boss Daddy" (primary) can anchor-scroll to the wayfinding strip or route to `/reviews`; "Who is Boss Daddy?" → `/about` (as today).

## Net
- **Top of page:** Photo hero → **new wayfinding strip (doors + pipeline)** → Featured + Bench. (The only structural change.)
- **Rest of page:** same order, dark treatment, border-based cards, framed images.
- **Copy:** untouched.
