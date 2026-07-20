# Disaster Recovery Runbook — Boss Daddy v2

> **Purpose.** Turn a data-loss incident from an improvised 2am panic into a checklist.
> This documents what backups exist, how to restore, and — the part that actually
> bites us — how to reconcile orders after a restore.
>
> **Owner:** operator (boss@bossdaddylife.com). **Last reviewed:** 2026-07-20.

---

## 0. TL;DR — if data is gone right now

1. **Stop the bleeding.** If a bad migration or runaway process is actively corrupting data, take the site to a safe state first: pause the offending cron / revert the deploy on Vercel (`Deployments → previous → Promote`). Don't restore on top of an active corruptor.
2. **Do NOT run another migration or mass write.** Every write past the incident widens the gap you have to reconcile.
3. **Identify the incident timestamp** (when the bad change landed) — you need it for a point-in-time restore and for order reconciliation.
4. Go to **§3 (restore)**, pick the scenario, then **§4 (reconcile orders)**. Reconciliation is mandatory, not optional — Stripe kept charging customers while the DB was down.

---

## 1. What we're protecting (and what we're not)

| Asset | Store | System of record | Recovery source |
|---|---|---|---|
| Orders, order_items | Supabase Postgres | **Stripe** (payments) + **Printful** (fulfillment) | DB backup + reconcile against Stripe/Printful |
| Reviews / guides / collections (SEO equity) | Supabase Postgres | Supabase (only copy) | DB backup only |
| Users, profiles, DMs, family/savings/kids | Supabase Postgres | Supabase (only copy) | DB backup only |
| DM images, product/merch photos | Supabase Storage buckets | Supabase (only copy) | Storage backup (see §3.4) |
| Auth users / sessions | Supabase Auth | Supabase | included in project backup |

**Key mental model:** money and fulfillment have an *external* source of truth (Stripe, Printful). Content and user data **do not** — the Supabase backup is the only copy, so its retention window is our real exposure.

---

## 2. Current backup posture (Supabase **Free** tier, confirmed 2026-07-20)

> **Free tier provides NO managed backups and NO PITR.** There is no nightly
> backup to restore from and no point-in-time recovery — those are Pro/Team
> features. The dashboard (**Settings → Database → Backups**) shows the feature
> gated behind an upgrade, not a retention setting. Our **only** backup is the
> self-managed dump in §2.1.

**What this means:**
- **Money path is safe regardless** — orders/payments/refunds are rebuildable from Stripe + Printful (§4). Losing the DB does not lose revenue records.
- **Content + user data is the real exposure** — reviews/guides (SEO equity), profiles, DMs, savings/family history exist *only* in Supabase. Without the §2.1 dump, a dropped table or deleted project = **permanent total loss**.
- **Free-tier availability gotcha:** projects **pause after ~7 days of inactivity** (an uptime issue, not data loss — resume from the dashboard).

### 2.1 Our backup mechanism — automated CI dump
`.github/workflows/db-backup.yml` runs a logical dump (roles + schema + data) via the Supabase CLI, gpg-encrypts it (AES-256), and stores it as a **private GitHub artifact** (90-day retention). It lives in GitHub, not Supabase, so it survives even a full project deletion.

- **Schedule:** weekly (Sundays 06:00 UTC) + **manual before any risky migration**: `gh workflow run db-backup.yml`.
- **Required repo secrets:** `SUPABASE_DB_URL` (Settings → Database → Connection string) and `BACKUP_PASSPHRASE` (strong passphrase — store in a password manager; **if lost, backups are unrecoverable**).
- Plaintext never leaves the runner — only the `.gpg` is uploaded.
- Egress cost: ~45 MB/run ≈ ~180 MB/mo, negligible against the 5 GB Free allowance.

**RPO / RTO under this posture:**

| | Value |
|---|---|
| **RPO** (max data loss) | up to **7 days** of content/user data (since last weekly dump) — or less if you dump before migrations. Orders lose nothing (§4). |
| **RTO** (time to restore) | ~15–60 min (new project + `psql` restore + reconcile) |

**Accepted (see §6):** weekly self-managed dumps. The knob to shrink RPO for free is to trigger `gh workflow run db-backup.yml` before every migration — the exact moment loss is most likely.

---

## 3. Restore procedures

> On Free tier every restore comes from the §2.1 encrypted artifact — there is no
> dashboard restore. Get the latest good backup first:
> GitHub → repo → **Actions → DB backup → latest run → Artifacts → download**, then
> ```
> gpg -d bd-backup-<stamp>.tar.gz.gpg > backup.tar.gz && tar -xzf backup.tar.gz
> # yields roles.sql, schema.sql, data.sql
> ```

### 3.1 Snapshot the current (corrupted) state FIRST
Before overwriting anything, capture forensics so a restore can't make things worse:
```
supabase db dump --db-url "$SUPABASE_DB_URL" --data-only --use-copy -f pre-restore-data.sql
```

### 3.2 Scenario A — bad migration / accidental mass delete/update
Most likely incident (see the audit's note on migrations 042/043/106/107 shipping subtly wrong). **No PITR on Free** — you restore from the most recent artifact *before* the incident and accept loss of writes since that dump (shrink this by always dumping pre-migration).

Restore into the **existing** project (careful — this overwrites):
```
psql "$SUPABASE_DB_URL" -f roles.sql      # usually a no-op on a live project; ignore "already exists"
psql "$SUPABASE_DB_URL" -f schema.sql
psql "$SUPABASE_DB_URL" -f data.sql
```
For a *partial* loss (one table), restore selectively from `data.sql` rather than clobbering the whole DB. Then `npm run db:types` if the schema moved, redeploy, and run §4.

### 3.3 Scenario B — full project loss / deletion
- Provision a new Supabase project (region near Vercel `iad1` for latency).
- Restore the artifact into it: `psql "$NEW_DB_URL" -f roles.sql && psql ... schema.sql && psql ... data.sql`.
- Update Vercel env: `NEXT_PUBLIC_SUPABASE_URL`, anon key, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` (and the backup workflow's `SUPABASE_DB_URL` secret).
- Re-point Supabase Auth **Site URL** (`https://www.bossdaddylife.com`) + redirect URLs — these are wiped on a new project (see infra notes).
- Redeploy. Then §4.

> **Restore-drill verified (2026-07-20):** the dump is complete and captures more than the `public` schema. Confirmed contents of a real artifact: all **63 `public` tables** (schema + data) **plus the `auth` schema data** — including **`auth.users`, `auth.identities`, `auth.sessions`, `auth.refresh_tokens`, mfa/sso tables** — and `roles.sql` (the `anon`/`authenticated`/`authenticator` `statement_timeout` settings). So users + their logins DO survive a restore. Notes for restoring:
> - `schema.sql` creates only `public` tables — the `auth`/`storage` schemas are Supabase-managed and auto-provisioned on any Supabase project, so `data.sql`'s `auth.*` `COPY` blocks load into the structure a fresh project already has. **Restore into a Supabase project, not a vanilla Postgres** (vanilla PG has no `auth` schema, so the auth COPY blocks would error).
> - **Same-project overwrite (Scenario A):** `auth.users` etc. already exist, so the `auth.*` COPY blocks will conflict on duplicate keys. For an in-place restore, restore only what was lost rather than replaying the whole `data.sql`, or `truncate` the target tables first.

### 3.4 Scenario C — Storage bucket loss (DM images, product photos)
Storage is **not** always covered by the Postgres backup — confirm in §2. If buckets are lost but DB rows survive, the `attachment_path` / image URLs point at objects that no longer exist (broken images, not data corruption).
- Product/merch photos: re-syncable from Printful for merch (`npm run merch:sync`); own-photo uploads are only in Storage — lost if not separately exported.
- DM images (`dm-media`, private bucket): only copy is Storage. If retention matters, schedule a periodic bucket export (TODO — not currently automated; note in §6).

---

## 4. Post-restore order reconciliation (MANDATORY after any restore that loses writes)

Payments kept flowing while the DB was behind. After restoring to timestamp `T`, any order paid **after `T`** is missing from the DB but real in Stripe. Rebuild them:

1. **List Stripe checkout sessions since `T`:** Stripe dashboard → Payments, or
   `stripe checkout sessions list --created "gte=<unix T>"` (needs Stripe CLI + live key).
2. For each `checkout.session.completed` after `T`, check `orders` for a row with that `stripe_session_id`. Missing → needs rebuild.
3. **Rebuild by replaying the webhook** (cleanest — reuses the idempotent handler in `app/api/webhooks/stripe/route.ts`):
   - Stripe dashboard → Developers → Webhooks → select the endpoint → find the `checkout.session.completed` event → **Resend**.
   - The handler is idempotent (`unique(stripe_session_id)` guard), so resending is safe even for orders that *did* survive.
4. **Verify Printful side:** for rebuilt orders, confirm a Printful order exists (the webhook re-creates it). Cross-check `printful_order_id`; if the customer was already refunded (`charge.refunded`), the refund handler should have cancelled fulfillment — verify no double-ship.
5. **Refunds during the gap:** replay any `charge.refunded` events after `T` the same way (Resend), so refunded orders return to `refunded` and Printful orders are cancelled.
6. Spot-check `confirmation_email_sent_at` — resent webhooks re-send confirmation emails; warn if customers get duplicates (acceptable vs. a missing order).

**Reconciliation is done when:** every Stripe session after `T` has a matching `orders` row, and every Printful order maps to a live (non-refunded) order.

---

## 5. Prevention — cheaper than recovery

- **Before any risky migration** (drops, mass `UPDATE`, RLS changes): take an on-demand backup (§3.1). One click, and it's the difference between Scenario A being trivial vs. lossy.
- Migrations start from `supabase/migrations/_TEMPLATE.sql` and are reviewed against the RLS doctrine (see `CLAUDE.md`).
- The CI migration-replay guard (`check-migrations.yml`) catches replay breakage before prod.
- Sentry alerts (error spike / new issue) surface a corrupting bug fast — the sooner you catch it, the smaller the reconciliation window.

---

## 6. Decision log & open items

- **Stay on Free + self-managed CI dumps — DECIDED (2026-07-20).** At 1 MAU / 45 MB DB / 0 MB storage, paying $25/mo for Pro (daily managed backups) isn't justified yet. The weekly gpg-encrypted GitHub artifact (§2.1) covers the real risk (permanent content/user loss) for free. **Revisit trigger → upgrade to Pro:** when data/traffic grows enough that a 7-day RPO or self-managed restore is too risky, or when Free-tier inactivity-pausing becomes a problem.
- **PITR — N/A on Free**, and deferred even after a Pro upgrade (~$100/mo add-on) until order/UGC volume makes ~7-day RPO unacceptable.
- **Storage bucket export — DEFERRED (2026-07-20), correctly.** File storage is **0 MB** — DM images + own-photo uploads are empty; imagery comes from external sources (Printful CDN / placeholders). Nothing to export. **Revisit trigger:** when File storage climbs above ~0 — then add a bucket sync to the backup job (§3.4).
- **TODO — add the two repo secrets** (`SUPABASE_DB_URL`, `BACKUP_PASSPHRASE`) so the backup workflow can run, then trigger it once (`gh workflow run db-backup.yml`) to confirm it produces an artifact.
- **DONE — first restore drill (2026-07-20):** decrypted the latest artifact, verified it's a complete, well-formed dump (92 tables incl. `auth.*`; real row counts; `auth.users` present — resolves the §3.3 scope question). Not yet exercised: a full *apply* into a scratch Supabase project (proves the SQL executes end-to-end). Optional next-level confidence — run against a throwaway Supabase project when desired; a vanilla Postgres is not a faithful target (missing `auth`/`storage` schemas + Supabase roles/extensions).
