# Boss Daddy — Canva Pro Brand Kit Reference

> A copy-paste reference for setting up the Boss Daddy brand kit in Canva Pro.
> Canva doesn't accept a single upload — you'll enter colors, upload logos, and pick fonts manually in the Brand Kit panel. Keep this file open while you do it.
>
> **Where in Canva:** click your team/account icon (top right) → **Brand Kit**

---

## 1. Logos to Upload

Upload these PNGs from `public/images/` (in your project folder):

| File | Purpose | Canva label |
|---|---|---|
| `bd-logo-final.png` | Primary logo (full mark) | **Primary Logo** |
| `bd-logo-icon.png` | Runtime icon — used in every nav, footer, and email | **Icon / App Mark** |
| `bd-favicon.png` | Favicon-tier mark | **Favicon** |

**Local path:** `C:\Users\msb1c\bossdaddy-v2\public\images\`

---

## 2. Brand Colors

Canva Brand Kit lets you organize colors into groups. Set them up exactly like this:

### Group A — Primary Brand (Earthy Orange)

| Name | Hex | Notes |
|---|---|---|
| Boss Orange (Primary) | `#CC5500` | Main brand orange — CTAs, highlights, marquee text |
| Orange Hover | `#D96200` | Hover state, secondary accent |
| Orange Glow | `#E87030` | Light accent on dark backgrounds |
| Orange Deep | `#A34400` | Darker borders, pressed states |
| Orange Earth | `#7D3300` | Deep accent |
| Orange Shadow | `#5C2600` | Background tints |
| Orange Pit | `#3D1A00` | Deepest tint, almost black-orange |

### Group B — Forge Base (Warm Black UI)

| Name | Hex | Notes |
|---|---|---|
| Forge Black | `#0B0B0D` | Page background |
| Forge Surface | `#141418` | Card surfaces |
| Forge Raised | `#1C1C22` | Raised cards / hover |
| Forge Border | `#28282E` | Hairlines, dividers |

### Group C — Text

| Name | Hex | Notes |
|---|---|---|
| Text Bright | `#F5F5F5` | Primary text on dark |
| Text Muted | `#A8A8B0` | Secondary text |
| Text Faint | `#6A6A72` | Tertiary text, captions |

### Group D — Editorial Cream (Second Voice)

| Name | Hex | Notes |
|---|---|---|
| Cream Paper | `#EDE6D3` | Editorial moments, warm headers |
| Cream Muted | `#C9BFA8` | Cream secondary |

### NEVER use

- `#F97316` — vivid Tailwind orange. Looks too loud / generic. Always use `#CC5500` instead.

---

## 3. Brand Fonts

All three fonts are free on **Google Fonts** — they're already available in Canva by default (Canva pulls from Google Fonts).

| Role | Font | Weights to enable in Canva | Used for |
|---|---|---|---|
| **Display / Headings** | **Montserrat** | 800, 900 (Black) | H1, H2, H3, marquee, "BOSS DADDY" wordmark |
| **Body / UI** | **Geist** | 400, 500, 600, 700 | All body copy, buttons, UI labels |
| **Editorial Serif** | **Source Serif 4** | 400, 600 | Long-form quotes, editorial pull-outs, second voice |

**In Canva:** Brand Kit → Brand Fonts → **+ Add a font** → search by name above. Set Montserrat as Heading, Geist as Body, Source Serif 4 as Subheading or Other.

**Type pairing rules:**
- Headings: `Montserrat Black` (900), uppercase, tight letter-spacing
- Body: `Geist Regular` (400) at 16–18px
- Eyebrow labels: `Geist Bold` (700), 11–12px, ALL CAPS, letter-spacing 0.2em, color `#D96200`

---

## 4. Messaging System & Wordmark Usage (v3.4 — locked 2026-07-19)

Full spec + usage lockups: `docs/brand-guide.md` §1.7. Five-level hierarchy — each line has its own job.

| Level | Line | Use in |
|---|---|---|
| **Positioning** | **The Boss Dad Standard** | Hero, logo lockup, major branding, social bios |
| **Primary tagline** | **Dad Like a Boss.** | Campaigns, CTAs, merch, social, article sign-offs |
| **Action line** | **Boss Up.** | Community, emails, challenges, button text |
| **Credibility line** | **Real Dads. Smart Tools. Better Decisions.** | Reviews, guides, product pages, "How We Test", footer |
| **Philosophy** | *(full manifesto — see brand guide §1.7)* | About page, founder story, welcome sequence |

**Merch voice (context-specific, outside the core five):** **Boss Stuff for Boss Dads** — store/product/merch only.

**Homepage hero lockup:**
> The Boss Dad Standard.
>
> Dad Like a Boss.
>
> Real Dads. Smart Tools. Better Decisions.

### Capitalization (v3.4 — Title Case wins)

The five core lines and the merch line are **Title Case with periods** — never all-caps, never cap `BOSS` mid-line (retired: "Dad like a BOSS").

| Form | When to use |
|---|---|
| **`BOSS DADDY`** (all caps) | **Wordmark / logo lockup ONLY** |
| **Boss Daddy** (title case) | Everywhere else — hero H1s, taglines, OG cards, merch, editorial body, dashboards |
| **`BOSS`** (caps, alone) | Rare noun of address — *"Stay locked in, BOSS."* (sparingly, the one exception) |

**Never:** lowercase, camel-case (`BossDaddy`), or "Boss daddy" with mixed casing.

---

## 5. Brand Voice Quick Reference

**Archetype:** Wise Warrior / Protector King — older, wiser brother voice.

**Tone dial:**
- 70% confident, direct, no-fluff
- 20% playfully cynical toward mediocrity
- 10% warm and present (deploy when topic is struggle, loss, fatherhood vulnerability — NEVER edge here)

**Vocabulary — "Stuff":**
- *The good stuff* — recommendations
- *Boss stuff* — merch, curated picks
- *Dad stuff* — categories, editorial framing

**Never say:** "synergy," "leverage" (as a verb in copy), "level up," "game-changer," "must-have," generic hype words.

---

## 6. Image / Asset Style Guide for Canva Designs

When making Canva graphics for the site, social, or merch:

| Asset type | Canvas size | Notes |
|---|---|---|
| Review hero | 1200×675 (16:9) | `object-cover` on site — center subject in upper third |
| Review card thumbnail | 1200×675 | Same as hero |
| OG / social card | 1200×630 | Site auto-generates these but useful for manual social posts |
| Instagram post | 1080×1080 | Square |
| Instagram story | 1080×1920 | Portrait, 9:16 |
| Pinterest pin | 1000×1500 | Portrait, 2:3 |
| Email header | 1200×400 | Wide banner |
| Merch graphic (tee front) | 4500×5400 (300 DPI) | Print-resolution |

**Photo treatment:**
- Slight desaturation — earthy, not punchy
- Subtle grain overlay (3–5% noise)
- Avoid neon / vivid colors
- Real-world dad photos > stock photos every time

---

## 7. Setup Checklist

Work through this in order in Canva:

- [ ] Brand Kit → upload all 3 logos (rename in Canva using the "Canva label" column above)
- [ ] Brand Colors → create the 4 color groups above (A: Primary Brand, B: Forge Base, C: Text, D: Editorial Cream)
- [ ] Brand Fonts → add Montserrat (Heading), Geist (Body), Source Serif 4 (Subheading)
- [ ] Brand Voice → paste in the primary tagline + voice paragraph
- [ ] Create a "Templates" section → save the canvas sizes from §6 as starter templates

---

**Last updated:** 2026-05-07
**Source of truth for design tokens:** `app/globals.css` and `docs/brand-guide.md` — if those change, update this file.
