# Light Editorial Canvas — decision, palette, rollout

> **Status:** Phases 1–5 SHIPPED `2372b0d` 2026-10-08. **Light is the default**; `BD_CANVAS=dark` restores the dark page for a side-by-side. The brand-band pass remains.
> **Owner of token values:** `app/globals.css` (this doc explains; the CSS wins).
> **Supersedes:** the "dark-first everywhere" direction in `docs/brand-guide.md` §2 and the Vercel/Linear/Apple reference points. Those docs get rewritten at the flip (Phase 4), not before, because production is still dark.

## 1. The decision and why

The operator's read after the Phase I nav work: *"our site does not look and or feel like most other major sites with comparable content."* The structural review (2026-10-08) found the cause is not polish. The site is built like a software-product landing page and the content is a lifestyle / gear magazine. Five habits every comparable publication shares that the homepage broke:

1. **Poster hero instead of a front page.** 80–88vh manifesto + "Meet the Boss" button; zero content above the fold. Wirecutter, Strategist, Gear Patrol, Fatherly, Men's Health, Uncrate all lead with the lead story + 3–4 secondary stories.
2. **Dark canvas + rounded bordered cards = the SaaS look.** Vercel / Linear / Apple are software companies. Every comparable *publication* runs white or off-white, image-forward, hairline dividers, almost no card borders or pill badges. Dark reads as tech, gaming, developer tooling.
3. **Products never appear as products.** No product grid, no "top picks" board, no price. Gear readers expect the product object (image on neutral, name, price, "best for", score) first.
4. **One module repeated seven times.** The Library ran seven identical lead-plus-rows blocks (~3,500px) and, with 28 guides, the homepage *was* the archive. Major sites show 12–20 items with hierarchy and let category pages carry the rest.
5. **Internal vocabulary.** Cover Story, The Library, Boss Tools, The Creed, Just Dropped, Radar, Bench, Vault, Kits, Stacks. Visitors have to learn a dozen proprietary nouns. Major sites label by what the thing is.

Decision: **light editorial canvas, with the black / orange / white edge kept on purpose** — through contrast and discipline, not through a dark page. Colour rules may change where the light canvas needs it (operator, 2026-10-08).

## 2. Where the edge lives on a white canvas

| Element | Treatment | Why |
|---|---|---|
| Masthead, mobile tab bar, footer | **Near-black chrome** (`data-theme="dark"` zone) | The frame around every page is where the identity reads |
| Homepage hero, in-motion ticker, Creed band, credibility band | **Dark bands** (zones) | One dark punctuation mark per page is classic editorial |
| Page canvas, cards, long-form | **White**, near-black headlines + body | Grey body text is the #1 "SaaS page" tell |
| Orange | **The only accent, used harder and less often**: eyebrows, links, score rings, active states, hairline rules, hover | On white, orange has more contrast to fight, so it reads hotter |
| Primary buttons | **Black fill, white ink, orange on hover** (`cta` tokens) | Orange-on-white buttons shout; black buttons that light up orange cut. In dark zones the `cta` tokens swap back to the hot-orange fill |
| Elevation | Border + raised tier, **no shadows** (unchanged) | Editorial pages separate by hairline, not drop-shadow |

## 3. Palette — the `:root` light tokens (tuned 2026-10-08)

| Token | Value | Note |
|---|---|---|
| `--background` / `--bd-bg` / `--bd-surface` | `#ffffff` | canvas and cards are both white; cards separate by border |
| `--foreground` / `--bd-text` | `#18181b` zinc-900 | headlines + body, near-black (was zinc-700 grey) |
| `--bd-text-muted` | `#52525b` zinc-600 | decks, captions — 7.0:1 |
| `--bd-text-faint` | `#71717a` zinc-500 | timestamps — 4.6:1, AA |
| `--bd-prose-body` | `#18181b` | long-form body (dark zone: `#d4d4d8`, matches the old `prose-invert` body) |
| `--bd-surface-raised` | `#fafafa` zinc-50 | alt sections, elevated cards (was zinc-200 — read as a grey slab) |
| `--bd-surface-hover` / `-sunken` / `--bd-accent-tint` | `#f4f4f5` zinc-100 | one step, neutral — never peach ([[no-peach-accent-tint]]) |
| `--bd-border-faint` / `--bd-border` / `--bd-border-strong` | `#f4f4f5` / `#e4e4e7` / `#a1a1aa` | hairlines; strong = outline buttons, mega-menu edge |
| `--bd-chrome` | `#09090b` | chrome is **always** near-black; zones invert their text tokens too — this value is the safety net for an un-zoned `bg-chrome` |
| `--bd-orange` | `#CC5500` core | fills, rules, score rings |
| `--bd-orange-hover` | `#B85A14` orange-700 | |
| `--bd-orange-text` | `#B85A14` orange-700 | inline links / eyebrows — **4.67:1 on white (AA for 11px bold eyebrows)**; the core `#CC5500` is 4.3:1 and misses |
| `--bd-cta` / `-hover` / `-ink` | `#09090b` / `#CC5500` / `#ffffff` | primary CTA — black, orange on hover. Dark zone: `#E55A1A` / `#CC5500` / `#ffffff` |

Contrast was computed against WCAG relative luminance, not eyeballed. Live tuning may move the greys; it should not move `--bd-orange-text` below AA.

**Prose binding.** `.prose` now takes its colours from the `--bd-*` roles in *both* directions (`--tw-prose-*` and `--tw-prose-invert-*`), so a prose block is light on the page and inverts by itself inside a dark zone. `prose-invert` is a harmless no-op. This is what lets the canvas flip without editing the nine public `prose-invert` call sites.

## 4. How to see it

Light is the default (Phase 4). Plain `npm run dev` shows it. To compare against the dark page:

```powershell
cd C:\Users\msb1c\bossdaddy-v2; $env:BD_CANVAS='dark'; npm run dev
```

Phone (mobile is the source of truth): open the dev server on the LAN address Next prints. Production follows the default; no env var is set there.

What is zoned dark on purpose (carries `data-theme="dark"`): `Header`, `Footer`, `MobileBottomNav`, `StickyMobileCta`, `HomeHero` (section + ticker), `InMotionTicker`, the homepage Creed section, `NotificationFeed`'s select bar, the `(dashboard)` layout, `/account` + `/account/settings` wrappers (pre-existing — revisit in Phase 2: on a light site these two read as odd dark islands).

## 5. Rollout

| Phase | What | State |
|---|---|---|
| **1 — Wire** | Knob (`lib/canvas.ts`, `app/layout.tsx`), tuned `:root`, `cta` tokens + `Button` primary, prose binding, chrome zones | **DONE 2026-10-08** (uncommitted at time of writing) |
| **2 — Tune live** | Operator walkthrough on the light canvas: homepage + chrome first, phone first. Expected adjustments: grey tiers, border-strong, card radius (editorial sites run tighter radii than `rounded-2xl/3xl`), pill badges, the `/account` dark islands | **pass 1 DONE 2026-10-08** — header flush-black at the top of home (was transparent over the now-white canvas), radius scale 8px, border-strong zinc-300, borderless content cards (LeadCard, LibraryGuideCard, ReviewCard, cover story, lead guide, credibility band), eyebrows quiet via `--color-eyebrow` → muted (hero kicker + ticker opt back into orange), "View all" links in ink, image badges = one small square black tag, Latest rail = naked divided list, Boss Tools = soft raised panels, section padding py-8/12. **Pass 2 DONE** (one headline family, `/account` islands, poster hero → slim band). **Still open: the brand band (`HomeHero`) wants a dedicated design pass** — operator flagged it 2026-10-08; the current composition is a placeholder, not the answer |
| **3 — Interior pages** | Fix hand-set dark shades that will look wrong on white: `comparisons/[slug]`, `picks/[slug]`, `stacks/[slug]`, `RadarCard`, `BenchGallery`, `CollectionEmbed`, `GlobalSearch`, `ui/Modal`, `gifts/page` "Coming Soon" chip (`bg-chrome/80`), `OccasionTiles` gradients (image overlays — probably fine), `MerchImageGallery`, `TrustBand`, `HeroCarousel`. Grep: `zinc-9[05]0\|bg-black\|#09090b\|text-white` outside `(dashboard)` | **DONE 2026-10-08** — swept every public surface. Most hits were image scrims, lightbox chrome, and modal backdrops, which are correct on any canvas and were left alone. Fixed: `TrustBand` + `HeroCarousel` (unmounted, now token-safe), the gifts "Live"/"Coming Soon" chips (square tags, legible on the black fill), `ActivityMenu`, `CartIcon`, the Footer install button → role tokens. `ContentRow` drops its sub-line when the headline already contains it |
| **4 — Flip** | `DEFAULT = 'light'` in `lib/canvas.ts`, then remove the env read; delete `data-theme="dark"` from nowhere else (zones stay). Retire `prose-invert` literals on public pages + `scripts/check-prose-invert.mjs` + its prebuild entry (the bug it guards can't happen once headings read `--bd-text`). Re-read `scripts/check-invisible-shadow.mjs`: black shadows *do* render on white — keep the ban (editorial = borders) or drop it, decide then. Rewrite `docs/brand-guide.md` §2 + the Design System section of `CLAUDE.md` + memories `dark-canvas-anti-patterns` / `design-direction-modern`. PWA `theme_color`/`background_color` stay dark (the header borders the status bar) — re-check splash | **DONE 2026-10-08** — `DEFAULT = 'light'` in `lib/canvas.ts` (env read kept as the escape hatch), public `prose-invert` literals + `check-prose-invert.mjs` retired, shadow guard kept as a design rule (header rewritten), review + guide H1 → Montserrat black (one voice), brand-guide §1.7/§2/§3/§4/§5/§6/§8/§10/§12 + `CLAUDE.md` Design System + the Brief rewritten, dark memories retired |
| **5 — Homepage restructure** | **Poster hero RETIRED 2026-10-08** — `HomeHero` is a slim dark brand band (kicker · tagline · subhead · "Meet the Boss" link · ticker); the cover story + Latest list is the first screen. Hero photos stay in `public/images` for `/about`. **One voice** the same day: every heading Montserrat; Fraunces = the Creed only (serif headlines tried and reverted). Remaining, in order: dense header (visible category row, visible search), **lead package** above the fold (featured review large + 3–4 secondary), **top-picks product board** (6–8 products: image, name, price, score, "best for"), Latest 4-up grid with byline + date, Browse-by-category tiles (one row, not seven modules), ONE category spotlight (the lead+rows module, once, on the deepest category), Tools strip (3 tiles), inline newsletter, Testing-now strip, About block (photo + one paragraph + "How we test"), Shop strip, column footer. Plain section labels (Reviews, Guides, Best Of, Tools, Shop), not Cover Story / Library / Creed. The tagline shrinks to a line under the logo or into the about block | **DONE 2026-10-08** — desktop `CategoryBar` under the masthead (lg+, scrolls away), Boss Approved board (`TopPicksBoard`: 8 reviews rated 8+, top picks first, "Paid $X" from `price_paid_cents`, score), Guides = chips + newest guide + ONE spotlight `TopicBlock` on the deepest category (the seven-module Library and the `CredibilityBreak` left the homepage; `/guides` still has the full directory), "Just dropped" removed (the Latest list covers recency), Tools = three equal tiles, newsletter moved mid-page, `BenchStrip` as "On the bench", the Creed became the `AboutBand` (portrait + Creed + Meet the Boss / How I test), Footer gained a Topics column. Plain labels throughout. Still open: the brand band pass; a "best for" line on the board once reviews carry one |

## 6. Rules that change, rules that don't

**Changed already (2026-10-08):** one voice — every heading is Montserrat (black for section/page/detail titles, extrabold for cards/rows); Fraunces is the Creed only. A serif-content-headline pass was rendered the same day and reverted as a mismatch with the heavy brand. Primary CTA is black on light; eyebrows are quiet by default.

**Change (at Phase 4):** "dark-first everywhere"; the Vercel/Linear/Apple touchstones (software products — the comparables are publications); "elevation never shadows" becomes a choice, not a physical constraint; `check-prose-invert` retired.

**Unchanged:** one orange, no washes, no brown, no peach tint, no vivid `#f97316`, no stone, no per-category rainbow, typography-driven hierarchy, role tokens over raw shades, "modern, not woodsy", mobile-first, 44px targets, state never changes geometry.

## 7. Comparables used for the review

Wirecutter, The Strategist, Gear Patrol, Fatherly, Men's Health, Uncrate, Huckberry, Art of Manliness, Everyday Carry. Content volume at decision time: 28 reviews, 28 guides (7 of 10 categories), 4 collections — the structure in §5 is sized to look full at that volume and scale without re-architecting.
