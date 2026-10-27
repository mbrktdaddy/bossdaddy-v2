# Operator Plan — 90 days to self-supporting

> Started 2026-10-27 (Mon). Day 90 = 2027-01-25. Reviewed one week at a time; the Monday session pulls the numbers, picks ONE task, and logs it in §5.
> **Rule:** nothing new gets built unless it directly moves one of the four numbers. Measurement plumbing is the only exception, kept to a handful of lines.

## 1. The four numbers

| # | Number | Source | Baseline (fill in) |
|---|---|---|---|
| 1 | Google clicks / wk | Search Console → Performance → Last 7 days | **5 clicks / 28d** (Sep 28–Oct 25), ~970 impressions, 53% of them the brand query. Index: 47 indexed / 89 not (was 58/73 on Aug 4 — falling). 36 'crawled, not indexed', 37 noindex, 4 robots-blocked, 7 redirects. |
| 2 | Amazon clicks / wk | Associates → Reports → Clicks (truth) · Vercel Analytics `affiliate_click` event (per-page, added 2026-10-27) | |
| 3 | Newsletter signups / wk | `newsletter_subscribers` where `confirmed = true`, count + weekly delta | |
| 4 | Merch orders / wk | Printful → Orders · `merch_orders` table | |
| — | Monthly cost | Vercel + Supabase + Resend + Upstash + AI Gateway + Sentry + domain/Cloudflare | |

**Self-supporting** = affiliate + merch margin ≥ monthly cost. **Goal** = $300–500/mo run-rate by day 90.

## 2. Funnel math (assumptions — correct them when the baseline lands)

- Amazon: ~3.5% average commission × ~$50 cart × ~8% click-to-order ≈ **$0.14 per click**. $250/mo of affiliate ≈ 1,800 clicks/mo ≈ 60/day.
- Merch: Printful tee ~$13 landed, sold at $28 ≈ **$12 margin per order**. $150/mo ≈ 13 orders/mo ≈ 3/week.
- Newsletter is the multiplier: a subscriber visits on our schedule, not Google's. Every issue carries one gear pick (lane 1) and one merch line (lane 2).
- **Baseline verdict (2026-10-27):** Google is effectively zero (5 clicks/28d) and the index is shrinking. Affiliate revenue from search is a 6–12 month lane, not a 90-day one. The 90-day number has to come from the newsletter + any audience outside Google + merch pushed to that audience, while indexing gets fixed underneath. Striking-distance queries DO exist (Stihl KMA 135 R review at position 6, 19 impressions; Enfamil Enspire ~28–33; Sorinex, Genie Hourglass, Rogue Y-1 in the 30s–40s) — all product-review queries, so the review pages are what Google will rank first.
- Brand-query leak: "boss daddy" = 514 impressions, 0 clicks, position 9.5 — and it's `/about` that ranks (526 imp), not the homepage (5 imp). Either the homepage isn't indexed or Google prefers /about. Diagnose with URL Inspection.

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
| 1 | Oct 27 – Nov 2 | G: 5/28d · A: ? · N: ? · M: ? | **Indexing triage** — why only 47 of ~130 content pages are indexed and falling; click tracking + newsletter UTM shipped `6e7ec5b` | Search Console exports (crawled-not-indexed, noindex, robots, redirect URL lists), URL-inspect homepage + 2 reviews, sitemap status; Associates / newsletter / merch / cost numbers still owed |

### Week 1 findings (2026-10-27)

- **Sitemap last read by Google: May 8, 2026** (103 discovered then). Everything published since was link-discovered only. Live sitemap today: 200 OK, 190 URLs = 29 reviews · 33 guides · 57 tag pages · 29 gift occasions (28 empty) · 10 shop · 15 category · hubs. → He resubmits in Search Console.
- **The site has 29 public reviews and 33 public guides**, not 72/60 — the rest are drafts/dupes. 47 indexed is most of the real content, not a third of it.
- **37 "noindex" = 35 dead review slugs (now 404, stale June–July crawls) + /search + one tag page.** Not a bug. Some dead slugs are old versions of live reviews (Enfamil ×3, Nuobell ×2, Step2, Ergobaby ×2, Thorne ×2…) → map into `legacy_slugs` for a 301 once the review list arrives.
- **36 "crawled, not indexed" = 20 build-asset URLs (noise) + 7 empty gift shelves (fixed: noindex + out of sitemap) + 6 guides + 3 legacy /articles/ (301 exists).**
- Follow-up: `/reviews/tag/gear-haul` is in the sitemap yet renders noindex — sitemap tag keys vs page count query disagree. 57 tag URLs is crawl bloat; fix when touching the sitemap next.
