# Boss Daddy — Canva Pro Brand Kit Reference

> A copy-paste reference for setting up the Boss Daddy brand kit in Canva Pro.
> Canva doesn't accept a single upload — you enter colors, upload logos, and pick fonts manually in the Brand Kit panel. Keep this file open while you do it.
>
> **This file is Canva mechanics only.** For brand *doctrine* (voice, messaging, design system) the authority is **`docs/brand-guide.md`**; for exact color/token values the machine truth is **`app/globals.css`**. If those change, update this file — don't let it drift.
>
> **Where in Canva:** click your team/account icon (top right) → **Brand Kit**

---

## 1. Logos to Upload

Upload these PNGs from `public/images/`:

| File | Purpose | Canva label |
|---|---|---|
| `bd-logo-final.png` | Primary logo (full mark) — source asset | **Primary Logo** |
| `bd-logo-icon.png` | The only runtime icon — nav, footer, every layout, emails | **Icon / App Mark** |

**Local path:** `C:\Users\msb1c\bossdaddy-v2\public\images\`

> Favicons are **not** in `public/images/` — they're served via Next's file convention from `app/icon.png` + `app/apple-icon.png`. Don't upload a separate favicon to Canva.

---

## 2. Brand Colors (dark-first — matches `app/globals.css`)

The site is **dark-first everywhere**. Orange is the ONLY accent. **No gold, no per-category rainbow, no cream / peach / brown.** Set up three color groups exactly like this:

### Group A — Brand Orange (Hot, on dark)

| Name | Hex | Notes |
|---|---|---|
| Accent (Primary) | `#E55A1A` | THE brand accent on dark — CTAs, active nav, buttons |
| Accent Hover | `#CC5500` | Core orange — button hover / pressed |
| Link / Eyebrow | `#f48a4a` | Inline links + eyebrow labels on dark (orange-400) |
| Deep tint | `#8a3f0e` | Decorative borders/tints only (orange-800) |
| Deepest tint | `#3d1a00` | Deepest decorative tint (orange-950) |

### Group B — Canvas & Surfaces (dark)

| Name | Hex | Notes |
|---|---|---|
| Canvas / Chrome | `#09090b` | Page background + masthead/footer (flush) |
| Surface | `#18181b` | Cards / panels |
| Raised | `#27272a` | Elevated cards, alt sections |
| Hover | `#3f3f46` | Interactive hover lift |
| Border (soft) | `#27272a` | Card hairlines |
| Border (strong) | `#3f3f46` | Confident edges |

### Group C — Text

| Name | Hex | Notes |
|---|---|---|
| Text Bright | `#f4f4f5` | Primary text on dark |
| Text Muted | `#d4d4d8` | Captions, secondary |
| Text Faint | `#a1a1aa` | Timestamps, decorative (clears WCAG AA on dark) |

### NEVER use

- `#f97316` — vivid Tailwind orange. Too loud/generic. Always `#E55A1A` (Hot) / `#CC5500` (core).
- **Any cream / peach / brown fill** (e.g. the retired `#EDE6D3` "editorial cream"). Warmth lives in the orange accent, not in surfaces.

---

## 3. Brand Fonts

All four are free on **Google Fonts** (Canva pulls from Google Fonts).

| Role | Font | Weights to enable | Used for |
|---|---|---|---|
| **Display / Headings** | **Montserrat** | 800, 900 (Black) | Section headings (`font-black`), hero, `BOSS DADDY` wordmark |
| **Editorial display serif** | **Fraunces** | 500, 600 | Editorial headings — Cover Story, `PageHeader` H1s, guide titles, the Creed (Manifesto v2) |
| **Body / UI** | **Geist** | 400, 500, 600, 700 | All body copy, buttons, UI labels |
| **Editorial body serif** | **Source Serif 4** | 400, 600 | Blockquotes / pull-quotes only |

**In Canva:** Brand Kit → Brand Fonts → **+ Add a font** → search by name. Montserrat = Heading, Geist = Body, Fraunces / Source Serif 4 = Subheading/Other.

**Type pairing rules:**
- Section headings: `Montserrat Black` (900). **Editorial** headings: `Fraunces` 600.
- Body: `Geist Regular` (400) at 16–18px.
- Eyebrow labels: `Geist Bold` (700), 11–12px, ALL CAPS, letter-spacing 0.2em, color `#f48a4a`.
- **Messaging lines** (below) are the one Title-Case exception — never all-caps them.

---

## 4. Messaging System (v3.5) — quick reference

Full spec + usage lockups + capitalization doctrine: **`docs/brand-guide.md` §1.7** (authority). This table is a Canva convenience copy.

| Level | Line | Use in |
|---|---|---|
| **Positioning** | **The Boss Dad Standard** | Hero, logo lockup, major branding, social bios |
| **Primary tagline** | **Dad Like a Boss.** | Campaigns, CTAs, merch, social, article sign-offs |
| **Action line** | **Boss Up.** | Community, emails, challenges, button text |
| **Credibility line** | **Real Dads. Smart Tools. Better Decisions.** | Reviews, guides, product pages, "How We Test", footer |
| **Philosophy** | *(full manifesto — see brand guide §1.7)* | About page, founder story, welcome sequence |
| **Merch voice** | **Boss Stuff for Boss Dads** | Store / product / merch only |

**Homepage hero lockup:**
> The Boss Dad Standard.
>
> Dad Like a Boss.
>
> Real Dads. Smart Tools. Better Decisions.

**Capitalization (Title Case wins):** core + merch lines are Title Case with periods (lowercase articles) — never all-caps, never cap `BOSS` mid-line. `BOSS DADDY` all-caps is **wordmark/logo only**; title-case *Boss Daddy* everywhere else; `BOSS` alone is a rare noun of address ("Stay locked in, BOSS.").

---

## 5. Brand Voice — quick reference

Full voice spec + banlist + edge-off rules: **`docs/brand-guide.md` §1.6** (authority). Snapshot:

**Archetype:** Wise Warrior / Protector King — older, wiser brother voice.

**Tone dial:** ~70% confident/direct/no-fluff · ~20% playfully cynical toward mediocrity · ~10% warm-and-present (struggle, loss, safety, vulnerability — edge OFF here).

**Vocabulary — "Stuff":** *the good stuff* (recommendations) · *boss stuff* (merch/picks) · *dad stuff* (categories).

**Reader address (v3.5):** "Brother," "Friends," "Fellow Dads," "you" are fine. "Boss Dads" is a third-person identity term, never a greeting.

**Never say:** "revolutionary," "synergy," "leverage" (verb), "circle back," "stakeholder," "deep-dive," "ecosystem," sponsored phrasing, soft-parenting tells.

---

## 6. Image / Asset Style Guide for Canva Designs

| Asset type | Canvas size | Notes |
|---|---|---|
| Review hero | 1200×675 (16:9) | `object-cover` on site — center subject in upper third |
| Review card thumbnail | 1200×675 | Same as hero |
| OG / social card | 1200×630 | Site auto-generates these; useful for manual social posts |
| Instagram post | 1080×1080 | Square |
| Instagram story | 1080×1920 | Portrait, 9:16 |
| Pinterest pin | 1000×1500 | Portrait, 2:3 |
| Email header | 1200×400 | Wide banner |
| Merch graphic (tee front) | 4500×5400 (300 DPI) | Print-resolution |

**Photo treatment (modern, not woodsy):**
- Clean, premium-gallery feel (think Vercel / Linear / Apple), not rustic/ornamental.
- Real-world dad photos > stock, every time.
- Dark-first legible — subjects readable on a near-black canvas; frame white-background product shots so they don't glare.
- Avoid neon/vivid colors and heavy grain/vintage filters.

---

## 7. Setup Checklist

- [ ] Brand Kit → upload both logos (rename using the "Canva label" column)
- [ ] Brand Colors → create the 3 groups above (A: Brand Orange, B: Canvas & Surfaces, C: Text)
- [ ] Brand Fonts → add Montserrat (Heading), Geist (Body), Fraunces + Source Serif 4 (Subheading/Other)
- [ ] Brand Voice → paste the primary tagline + voice snapshot
- [ ] Create a "Templates" section → save the canvas sizes from §6 as starter templates

---

**Last updated:** 2026-07-24 (v3.5)
**Source of truth:** doctrine → `docs/brand-guide.md`; exact tokens → `app/globals.css`. If those change, update this file.
