# Operator Plan — 90 days to self-supporting

> Started 2026-10-27 (Mon). Day 90 = 2027-01-25. Reviewed one week at a time; the Monday session pulls the numbers, picks ONE task, and logs it in §5.
> **Rule:** nothing new gets built unless it directly moves one of the four numbers. Measurement plumbing is the only exception, kept to a handful of lines.

## 1. The four numbers

| # | Number | Source | Baseline (fill in) |
|---|---|---|---|
| 1 | Google clicks / wk | Search Console → Performance → Last 7 days | |
| 2 | Amazon clicks / wk | Associates → Reports → Clicks (truth) · Vercel Analytics `affiliate_click` event (per-page, added 2026-10-27) | |
| 3 | Newsletter signups / wk | `newsletter_subscribers` where `confirmed = true`, count + weekly delta | |
| 4 | Merch orders / wk | Printful → Orders · `merch_orders` table | |
| — | Monthly cost | Vercel + Supabase + Resend + Upstash + AI Gateway + Sentry + domain/Cloudflare | |

**Self-supporting** = affiliate + merch margin ≥ monthly cost. **Goal** = $300–500/mo run-rate by day 90.

## 2. Funnel math (assumptions — correct them when the baseline lands)

- Amazon: ~3.5% average commission × ~$50 cart × ~8% click-to-order ≈ **$0.14 per click**. $250/mo of affiliate ≈ 1,800 clicks/mo ≈ 60/day.
- Merch: Printful tee ~$13 landed, sold at $28 ≈ **$12 margin per order**. $150/mo ≈ 13 orders/mo ≈ 3/week.
- Newsletter is the multiplier: a subscriber visits on our schedule, not Google's. Every issue carries one gear pick (lane 1) and one merch line (lane 2).
- Honest caveat: if Google clicks are under ~1,000/week today, day 90 lands closer to $100–200/mo with the trajectory set, and $300–500 is a month-4-to-6 number. Week one tells us which.

## 3. Division of labor (fixed)

- **His:** product use, verdicts, photos, posting, ordering samples, approvals, applying SQL, committing.
- **Mine:** keyword/trend research, guide drafts + topic picks, Radar entries, merch lines + designs, newsletter issues, social captions, SEO fixes, cost cutting. Edits to reviews for clarity/voice only; never an invented claim or experience.
- **Flag, he decides:** anything touching FTC disclosure, trademark, or a claim/badge line (brand-guide §1.9).

## 4. The three blocks

### Block 1 — Oct 27 → Nov 23: measure, plumb, build the Q4 shelf
- Baseline all four numbers + cost (week 1).
- Affiliate click event + newsletter UTM (done 2026-10-27, uncommitted).
- **Q4 gift guides from existing reviews** — the `/gifts/christmas`, `/gifts/under-25|50|100`, and `/gifts/new-dad` pages are the highest commercial-intent surfaces the site can own and need ~2–3 weeks to index. Picks come from the 72 reviews; no new product use required.
- Search Console striking-distance list (queries ranking 5–20): retitle, tighten intros, add internal links review ↔ guide. One batch per week.
- Merch: audit live designs, pick 2–3 to push, order samples for real photos (his hands).
- Newsletter: fix the "skip on empty week" behaviour so an issue goes out every Tuesday with a gear pick + merch line even when nothing new published (small template change, week 2–3).

### Block 2 — Nov 24 → Dec 21: the holiday push
- Black Friday (Nov 27) + Cyber Monday (Nov 30) issues: best-of-the-reviews deals, gift guides front and centre.
- Printful holiday shipping cutoff (~Dec 10–12 US) becomes the merch deadline issue.
- Social captions for every gift guide (Pinterest + X); he posts.
- Weekly: refresh whichever gift guide is getting impressions but low CTR.

### Block 3 — Dec 22 → Jan 25: reset and trim
- "New year dad" content wired to the tools he already has (savings, weekends-until) as newsletter hooks → signups.
- Post-holiday review: which pages produced Amazon clicks; double down on that category.
- Cost cutting: AI spend per bucket, unused crons/services, plan tiers. Target the lowest bill that keeps the four numbers moving.
- Day-90 read-out: run-rate vs cost, month-4 plan.

## 5. Weekly log

| Week | Dates | Numbers (G / A / N / M) | The one task | Handed to him |
|---|---|---|---|---|
| 1 | Oct 27 – Nov 2 | baseline pending | Christmas gift guide from existing reviews (+ click tracking shipped) | numbers + access list, commit, pick approvals |
