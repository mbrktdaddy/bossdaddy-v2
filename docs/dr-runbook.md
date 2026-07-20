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

## 2. Current backup posture — VERIFY, don't assume

> ⚠️ These values must be confirmed in the Supabase dashboard, not trusted from this doc.
> Fill them in and re-date §0 when you check.

**Verification steps (do this now, before an incident):**

1. Supabase dashboard → Project → **Settings → Database → Backups**.
   - [ ] Plan tier (Free / Pro / Team): `__________`
   - [ ] Daily backup retention (Pro = **7 days** by default): `__________`
   - [ ] **PITR enabled?** (paid add-on) yes / no: `__________`
   - [ ] If PITR on, recovery window (e.g. 7 days) & granularity: `__________`
2. Storage → note which buckets exist and whether they're covered by the project backup vs. need a separate export (see §3.4).

**RPO / RTO targets (state what we accept):**

| | Without PITR (daily backups) | With PITR |
|---|---|---|
| **RPO** (max data loss) | up to ~24h (since last nightly) | seconds–minutes |
| **RTO** (time to restore) | ~15–60 min (spin restore + reconcile) | ~15–60 min |

**Accepted posture (until revisited — see §6):** daily backups, RPO ≈ 24h. The order-reconciliation step (§4) closes the money gap even at a 24h RPO because Stripe/Printful retain the records; the irrecoverable loss is up to 24h of **content and user-generated data**.

---

## 3. Restore procedures

### 3.1 Take an on-demand backup FIRST (whenever possible)
Before restoring, snapshot the current (corrupted) state so a restore can't make things *worse* and you retain forensics:
- Dashboard → Database → Backups → **Backup now**, or
- `supabase db dump --db-url "$SUPABASE_DB_URL" -f pre-restore-$(date).sql` (schema+data).

### 3.2 Scenario A — bad migration / accidental mass delete/update
Most likely incident (see the audit's note on migrations 042/043/106/107 shipping subtly wrong).

- **If PITR is enabled:** restore to the timestamp **immediately before** the bad migration/write. Dashboard → Database → Backups → Point in time → pick the second before the incident.
- **If daily-backups only:** restore the most recent nightly *before* the incident. Accept loss of writes since that backup, then use §4 to rebuild orders.
- After restore: `npm run db:types` (schema may have moved), redeploy if types changed.

### 3.3 Scenario B — full project loss / region outage
- Provision a new Supabase project (same region `iad1`-adjacent to keep latency with Vercel).
- Restore the latest backup into it.
- Update Vercel env: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, anon key, `SUPABASE_DB_URL`.
- Re-point Supabase Auth **Site URL** (`https://www.bossdaddylife.com`) and redirect URLs (§ infra: they get wiped on a new project).
- Redeploy. Then §4.

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

- **PITR (paid add-on) — DEFERRED (2026-07-20).** Accepting daily-backup RPO (~24h). Rationale: the money path is reconcilable from Stripe/Printful regardless of RPO (§4); the only irrecoverable loss is <24h of content/user data, which is low at current volume. **Revisit trigger:** when daily order volume or irreplaceable user-generated data (DMs, family/savings history) grows enough that 24h of loss is unacceptable — then enable PITR for near-zero RPO.
- **TODO — Storage backup:** DM-media + own-photo uploads have no automated export. Decide whether to schedule periodic bucket exports (§3.4).
- **TODO — verify §2 values** in the dashboard and fill them in; re-date §0.
- **TODO — annual fire drill:** restore the latest backup into a throwaway project once a year to confirm this runbook still works and RTO is real.
