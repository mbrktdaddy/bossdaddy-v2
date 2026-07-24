# Boss Daddy — v3.4 Brand Makeover (tracking doc)

> Started 2026-07-19. The v3.4 makeover began with a new **messaging system** (five-level tagline hierarchy + Title-Case capitalization doctrine) and ripples out to voice, positioning, design, merch, email, and code. This doc tracks what's locked, what's done, and what's open. Authoritative brand spec still lives in `docs/brand-guide.md` — this is the makeover changelog + checklist.
>
> **⚠️ Superseded (v3.5, 2026-07-24):** the Positioning line **"Boss Dads. Built Different."** was **retired** and replaced by **"The Boss Dad Standard."** Entries below still name the old line — they record what v3.4 shipped. For current wording see `docs/brand-guide.md` §1.7 and the project brief.

---

## Locked decisions

- **Messaging system (five levels)** — Positioning *"Boss Dads. Built Different."* · Primary *"Dad Like a Boss."* · Action *"Boss Up."* · Credibility *"Real Dads. Smart Tools. Better Decisions."* · Philosophy/manifesto (below). Merch voice *"Boss Stuff for Boss Dads"* sits outside the core five. Full spec: brand-guide §1.7.
- **Canonical manifesto (exact wording — do not paraphrase):**
  > Boss Daddy isn't just another men's fashion, fitness, or lifestyle brand. It is the gold standard and trusted hub for Boss Dads Built Different — men who believe being a proud and present father isn't a compromise of his strength, but the ultimate expression of it.
- **One manifesto, not two** — the canonical manifesto **replaced** the old homepage "isn't just another review site" Mission Creed. Do not reintroduce the old variant.
- **Capitalization: Title Case wins** — the five core lines + merch line are Title Case with periods; all-caps `BOSS DADDY` is reserved strictly for the wordmark/logo. No mid-line `BOSS` emphasis (retired "Dad like a BOSS").
- **Scope** — "fashion, fitness, or lifestyle" in the manifesto is contrast/positioning framing ONLY, not a commitment to new content pillars.
- **"Boss Dads" = identity term, not an address** — third-person brand/positioning use ✅; second-person greeting to the reader ❌ (still banned).
- **"Built Different" / "Boss Up" are sanctioned** — brand-owned language, exempt from the hype banlist, but display/marketing only (not body-copy filler).

---

## Tier 1 — Contradictions the new system created (DONE 2026-07-19)

- [x] **"Boss Dads" address vs. positioning** — carve-out added to `lib/claude/client.ts:40`, brand-guide §1.6, and `feedback_no_reader_nicknames` memory.
- [x] **Dual manifesto** — canonical manifesto replaces homepage Creed (`home-manifesto-spec.md`); wording corrected everywhere (brand-guide §1.7, brief §2, memory).
- [x] **Sanction "Built Different" / "Boss Up"** — carve-out in brand-guide §1.6 banlist and `client.ts` voice prompt.

## Tier 2 — Sections that should evolve to absorb v3.4 (DONE 2026-07-19)

- [x] **Mission & Essence (brand-guide §1.1/1.2)** — mission rewritten to absorb the manifesto punchline + decision-hub frame; §1.2 renamed "Positioning & Brand Essence" and now leads with "Boss Dads. Built Different." Bonus: removed the "leveraging" banlist violation from the mission + fixed all-caps `BOSS DADDY` per v3.4 caps rule.
- [x] **Review-farm → decision-hub reframe** — brief §1 opening reframed around "Real Dads. Smart Tools. Better Decisions." (decision-hub, not a pile of reviews). Note kept: reviews remain the volume driver; the *frame* changed, not the pillar mix. (Pillar list in brief §3 left as-is — not reordered.)
- [x] **Two voice registers** — brand-guide §1.6 now opens by naming the **declarative** register (brand statements) vs. **brotherly** register (editorial body), with the rule that declarative is display-only.
- [x] **Brand vocabulary** — "Boss Up" entry added to §1.7 alongside "Stuff" (meaning + CTA/merch usage + Title-Case rule).

## Tier 3 — Opportunities the system unlocks

- [x] **SEO / metadata / OG (code)** — DONE 2026-07-19. `components/home/HomeHero.tsx` hero H1 → "Dad Like a Boss." (accent on "Boss."); `app/layout.tsx` title default → "Dad Like a Boss", description now leads "Boss Dads. Built Different." + FTC-safe "zero paid placements", OG alt → "Boss Dads. Built Different."; `app/(public)/page.tsx` ogTitle → "Dad Like a Boss.", description + alt carry "Built Different"; **`OG_TEMPLATE_VERSION` bumped 5 → 6** (flushes cached cards site-wide). Also aligned tagline casing in `lib/claude/client.ts` + `lib/merch/sayings.ts` prompt strings. Grep confirms zero remaining "Dad like a BOSS" in code.
- [x] **Typographic lockup system** — DONE 2026-07-19. brand-guide §3 now has "Messaging lockups & the Title-Case exception": positioning two-line stack, per-line type roles, the rule that messaging lines are the ONE Title-Case exception in the display system, and "never all-caps / never drop the periods."
- [x] **Merch + email** — DONE 2026-07-19. `lib/merch/sayings.ts` prompt now knows the messaging lines as premium merch copy + has the "Boss Dads" positioning-vs-address carve-out; `docs/merch-studio-plan.md` scope note added; brand-guide §1.7 email specifics added (manifesto in welcome sequence, "Boss Up." subjects, "Dad Like a Boss." sign-offs). NOTE: actual `emails/` templates not yet edited — that's part of the broader rollout.
- [x] **Version tracking** — DONE. "v3.4 brand makeover" logged in brief §6 roadmap (Open / in flight).

---

## Related

- Master spec: `docs/brand-guide.md` §1.7 (messaging), §1.6 (voice/banlist)
- Phone-project brief: `docs/boss-daddy-claude-project.md` §2
- Homepage impl spec: `docs/home-manifesto-spec.md`
- Canva export sheet: `docs/canva-brand-kit.md` §4
- Memory: `project_messaging_system_v34`, `feedback_no_reader_nicknames`
