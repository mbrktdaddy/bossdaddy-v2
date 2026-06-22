# X Studio — Social Content Intelligence System (Plan)

> Status: **PLANNING** (no code written). Decisions locked through architecture; Phase 1 ready to build.
> Created 2026-06-22. Builds on the existing social tooling (`/dashboard/social`, `social_posts`, `/api/claude/social-copy`, `SocialPostsPanel`, voice profile + lexicon system).

## Goal

Turn the existing social *drafting* tool into a **closed-loop content intelligence system** for X.com (posts, threads, and native long-form **Articles** which accept HTML): it senses trends, ranks what's worth saying, generates it in the Boss Daddy voice, measures results, and feeds that back into the next decision.

## The loop

```
SENSE → DECIDE → GENERATE → LEARN → (back to SENSE)
radar     score/rank    voice draft    metrics in
```

```
  ┌─ Layer 1: SENSE ──────┐   ┌─ Layer 2: DECIDE ─────┐
  │ Trend & search radar  │ → │ Strategy engine        │
  │ Reddit / Trends /     │   │ score vs pillars +     │
  │ Claude web_search     │   │ catalog → ranked       │
  │                       │   │ Opportunity Queue      │
  └───────────────────────┘   └────────────┬───────────┘
            ▲                               ▼
  ┌─ Layer 4: LEARN ──────┐   ┌─ Layer 3: GENERATE ───┐
  │ metrics → what won →  │ ← │ repurpose/thread/      │
  │ feed scoring+few-shot │   │ article, your voice    │
  └───────────────────────┘   └────────────────────────┘
```

## Locked decisions

- **Posting:** manual now (draft → copy/paste / export), **API-ready architecture**. All publishing routes through a `Publisher` seam (`ManualPublisher` now, `XApiPublisher` stub later). X API write access is ~$100/mo Basic tier — deferred until volume justifies it.
- **Access:** single-user (admin only). **Hard `is_admin()` gate** on `/dashboard/social/*` routes + `/api/social-*` + `/api/claude/repurpose`. Allowlist seam for "limited access later" is deferred — a small contained change when needed.
- **Data ownership:** all tables stay **owner-scoped Pattern B** (`user_id = auth.uid()`, NO `is_admin()` in RLS). This handles N=1 trivially AND future-proofs limited access (each future author gets their own private workspace). RLS = data ownership; route guard = feature access — two separate concerns.
- **Autonomy:** **human-in-the-loop**. Radar senses + ranks + pre-drafts on approval; nothing reaches X without review. Preserves brand-voice veto (edge-off rules).
- **Radar sources:** Claude `web_search` (core, already wired) + **Reddit** (free API: r/daddit, r/Parenting, r/NewParents) + **Google Trends/autocomplete** (free-ish). Deferred: YouTube Data API, Amazon PA-API movers (awaits creds), X API trends ($100+/mo). Skip enterprise social-listening (Brandwatch/Sprout) — overkill for solo.
- **Threads = first-class** (`social_thread_groups` parent table), not group-id-smear.
- **Articles = `social_articles`** (own table, long-form HTML), not `x_articles`. Platform-as-`text` philosophy; the X-specific part is the serializer, not storage.
- **Metrics = per-tweet/article append-only time-series** (`social_metrics`); thread totals = aggregate of members; "latest" via `DISTINCT ON`.
- **No `kind` enum** on `social_posts`; thread membership inferred from `thread_group_id IS NULL`.

## Existing assets to reuse (do not rebuild)

- Claude client + cached `BOSS_DADDY_SYSTEM`: `lib/claude/client.ts` (+ `HAIKU_MODEL` for cheap calls)
- Voice system: `lib/voiceProfile.ts` + `lib/voiceLexicon.ts` (auto phrase injection, family aging, edge-off contexts)
- Platform rules: `lib/social-platforms.ts` (char limits, hashtag styles, threading)
- Workspace panel architecture: `app/(dashboard)/dashboard/reviews/[id]/_components/` (TiptapEditor, AIRefinePanel, SEOPanel, VersionHistoryPanel — all transfer to the Article workspace)
- Existing social hub: `app/(dashboard)/dashboard/social/` + `components/workspace/SocialPostsPanel.tsx`
- OG cards: `lib/og.ts` (great X post images)
- Rate limiting: `lib/rate-limit.ts` (reuse for radar budget guard)
- Generation endpoint to extend: `app/api/claude/social-copy/route.ts`

## RLS note (verified)

Mig 107 already stripped `is_admin()` from `social_posts` + `hashtag_presets` — live DB is already Pattern B owner-only. The 054/055 migration files show pre-cleanup history only. `ALTER TABLE … ADD COLUMN` does not touch policies.

---

## Phase 1 — Data model + access gate (DO THIS FIRST)

**Migration 109** (from `supabase/migrations/_TEMPLATE.sql` Pattern B). All new tables owner-scoped, RLS enabled, no `is_admin()`.

### `social_posts` — ALTER (no RLS change)
- `+ thread_group_id uuid` references `social_thread_groups(id)` on delete cascade, nullable (null = standalone post)
- `+ thread_position int`
- `+ external_id text`
- `+ external_url text`
- `+ posted_via text not null default 'manual' check (posted_via in ('manual','x_api'))`
- Index: `(thread_group_id, thread_position)` for thread assembly.

### `social_thread_groups` — NEW (thread as one object)
- `id, user_id, title, status text default 'draft' check (status in ('draft','ready','posted'))`
- `source_type ('review'|'guide'|'original'|'opportunity'), source_id uuid, source_title text`
- `posted_at, created_at, updated_at`
- Index: `(user_id, created_at desc)`

### `social_articles` — NEW (long-form HTML)
- `id, user_id, title, body_html text, cover_image_url text`
- `source_type, source_id, source_title`
- `status (draft|ready|posted), dropped_tags jsonb` (serializer warnings)
- `external_id, external_url, posted_via, posted_at, created_at, updated_at`
- Index: `(user_id, created_at desc)`

### `social_signals` — NEW (raw radar finds, append-only)
- `id, user_id, source text check (source in ('web_search','reddit','trends','autocomplete')), topic text, url text, raw_score numeric, payload jsonb, captured_at, created_at`
- Index: `(user_id, captured_at desc)`

### `social_opportunities` — NEW (scored, actionable; the Opportunity Queue)
- `id, user_id, title, suggested_format ('post'|'thread'|'article'), suggested_source_type, suggested_source_id`
- `score numeric, rationale text`
- `status text default 'new' check (status in ('new','drafted','dismissed','done'))`
- `generated_post_id uuid, generated_article_id uuid, generated_thread_group_id uuid`
- `created_at, updated_at`
- Index: `(user_id, status, score desc)`

### `social_metrics` — NEW (per-tweet/article time-series)
- `id, user_id, post_id uuid references social_posts, article_id uuid references social_articles`
- `check ((post_id is not null) <> (article_id is not null))` — exactly one set
- `impressions, likes, reposts, replies, link_clicks` (all int default 0)
- `captured_at, created_at`
- Index: `(user_id, captured_at desc)`

### Access gate (app code, not migration)
- `is_admin()` check on `/dashboard/social/*` routes + `/api/social-*` + `/api/claude/repurpose`. RLS stays as defense-in-depth.

### Post-migration
- `npm run db:types`

---

## Later phases (dependency-ordered)

- **Phase 2 — Gen:** X-safe HTML serializer `lib/x/serialize.ts` (whitelist X's tag subset, return `dropped[]`) + `lib/x/preview.tsx`. Critical: X strips unsupported tags silently.
- **Phase 3 — Gen:** Repurpose pipeline `/api/claude/repurpose` — source → `{article, thread, posts}` structured output, voice-injected, respects 10/hr rate limit + edge-off rules. UI: "Repurpose to X" on published reviews/guides (extend `GenerateDrawer.tsx`).
- **Phase 4 — SENSE:** Radar cron (Vercel cron, daily) → web_search + Reddit + Trends/autocomplete → `social_signals`. **Budget guard** (daily run cap + `lib/rate-limit.ts`, respects Anthropic $200 cap) — non-negotiable. Source config in `lib/social/radar-config.ts` (constants, not a table yet).
- **Phase 5 — DECIDE:** Scoring engine (signals × Boss Daddy pillars × existing catalog × recency) → ranked Opportunity Queue UI. "Surface + draft on approve" wires queue → Phase 3.
- **Phase 6 — Gen:** X Article workspace `/dashboard/social/articles/[id]` — Tiptap + reuse AIRefine/SEO/VersionHistory panels + new `XSerializerPanel` + "Copy X-ready HTML" + "Paste live URL" (ManualPublisher).
- **Phase 7 — Gen:** Thread builder (group via `thread_group_id`, auto-split at 280, `1/n`) + AI hook generator (`HAIKU_MODEL`, 5 first-line variants) + CTA endings.
- **Phase 8 — LEARN:** Metric entry → "what's working" → feed winning hooks/topics into Phase 5 scoring + Phase 3 few-shot. Closes the loop.

## Budget posture

The Phase 4 cron is the only thing that spends money autonomously — hard daily cap, respects the $200 Anthropic ceiling. Everything else is on-demand.
