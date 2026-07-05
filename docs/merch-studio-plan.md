# Merch Studio — AI-Assisted Merch Creation Plan

> **Status:** Phase 0 + 1 SHIPPED (committed `bc4537e`, pushed). Phase 2 (render engine) BUILT 2026-07-05. Next up: Phase 3 (Printful write layer). See §9 build log.
> **Goal:** An admin workspace that takes a merch idea from Claude-generated copy → brand-locked print-ready design → published Printful product → live in the shop, with the operator as editor at every gate.
> **Scope decisions (locked 2026-07-05):**
> - **Automation depth:** Full push to Printful (generate print files + create Printful product via API as a draft; existing `merch:sync` brings it live). Not fully autonomous — a human "confirm publish" gate stays.
> - **Design types (v1):** (a) text sayings/memes, (b) logo / brand-name-only lockups. **No AI image generation in v1** — decorative graphics and text-over-AI-graphic are deferred.
> - **Editorial control:** Claude *proposes* sayings/idioms; the operator approves/edits/rejects each one. Sayings are never auto-selected into a design or published without review.

---

## 1. Why build this (necessity)

Canva already works for one-off designs. This tool is justified by **consistency + speed at volume**:
- Brand-locked templates guarantee every product uses the right fonts, the Hot orange (`#E55A1A` / core `#CC5500`), and correct logo placement — no drift.
- Claude spins up dozens of on-brand sayings in seconds (its strongest asset here).
- Skips the manual Printful-dashboard product build (currently the only way products get created).

If merch stays a handful of occasional items, Canva is fine. If the goal is a **catalog** of branded text merch, the tool pays off fast.

## 2. Reality checks that shaped the plan

1. **The Printful integration is one-directional today.** Products are built by hand in the Printful dashboard, then `npm run merch:sync` (`scripts/sync-printful.mjs`) pulls them into `merch` / `merch_variants`. `lib/printful.ts` only *reads* products (list + detail) and *pushes* orders/shipping. There is **no** product-creation or file-upload wrapper. "End-to-end to live" requires net-new Printful write methods.
2. **AI image generation is the minor part for this use case.** The designs are mostly text (sayings) + logo lockups. `gpt-image-1/1.5` (the only image gen present, `lib/images/openai.ts`) is unreliable at rendering exact text — which is exactly why the OG system composites text with Satori instead of asking a model to draw it. So v1 needs **no image gen at all**: Claude for copy + deterministic typography templates for layout.
3. **Text-on-image is already solved once.** `app/api/og/route.tsx` renders styled text over images with Satori (`next/og` `ImageResponse`) + `sharp`. That is the reusable render engine — the only gap is that it loads no brand fonts (Arial-only) and outputs web-res, not print-res.

## 3. Reusable building blocks (inventory)

| Need | Reuse |
|---|---|
| Text-on-image compositing | `app/api/og/route.tsx` — Satori + sharp (register brand fonts, render at print-res) |
| Structured Claude output | `lib/claude/structured.ts` (`createStructured` / `extractToolInput`) + `BOSS_DADDY_SYSTEM` in `lib/claude/client.ts` |
| Generation workspace pattern | X Studio (`app/(dashboard)/dashboard/social/`) + `GuideCreateWizard` step machine + `components/workspace/*` panels |
| Image storage | Supabase buckets via `createAdminClient`; `media_assets` table; `/api/media` |
| Crop / re-feed image | `components/ui/ImageCropper.tsx`, `lib/images/derive-crop.ts` `fetchAssetAsFile` |
| Merch data + admin + shop + checkout + fulfillment | **All existing** — `merch`/`merch_variants` (mig 053), admin UI (`dashboard/admin/merch/*`), Stripe + Printful order flow. Downstream is untouched. |
| Printful client (orders/read) | `lib/printful.ts` |

## 4. Data model (new)

New migration (start from `supabase/migrations/_TEMPLATE.sql`). **Admin-only table** — this is admin-authored content, not private user data, so `is_admin()` is the correct gate (read `to authenticated using (is_admin())`, write `is_admin()`).

**`merch_designs`**
- `id uuid pk`
- `title text`
- `design_type text check in ('saying','logo_lockup')`
- `content jsonb` — for sayings: the approved text + optional subline; for lockups: which logo/wordmark + arrangement
- `template_key text` — which brand template
- `template_config jsonb` — color variant (light/dark garment), alignment, etc.
- `status text check in ('draft','approved','published')` — mirrors the review state-machine ethos
- `print_file_url text` — the generated high-DPI PNG (Supabase bucket)
- `preview_url text` — web-res preview
- `product_types text[]` — e.g. `{tee, hat, mug}`
- `printful_sync_product_id bigint` — null until published; links to the `merch` row via existing sync
- `merch_id uuid` — set after `merch:sync` lands the row (nullable)
- `ip_flag text` — guardrail note if a saying looked trademark/copyright-risky
- `notes text`, timestamps

Optional **`merch_saying_ideas`** (or fold into `merch_designs` as `status='draft'` candidates): Claude-proposed sayings awaiting editorial approval — theme, text, ip_flag, decision (`pending|approved|rejected`).

New Supabase bucket: `merch-designs` (print files + previews). Print files are large PNGs — do **not** route through the WebP-normalizing `/api/media` path (WebP is not a valid Printful print format).

## 5. Phased build

### Phase 0 — Foundations
- **Register brand fonts for the renderer.** Add static font files (Montserrat, Source Serif) and pass them via Satori's `fonts:` option. Prerequisite — the current OG route is Arial-only.
- **Pin Printful catalog targets + print specs.** Choose initial blank product IDs (tee, hat, mug); record each placement's required dimensions/DPI (Printful recommends ~150 DPI at the print area, transparent PNG). Confirm `PRINTFUL_API_KEY` has **store-write** scope.

### Phase 1 — Saying generation (Claude, editorial gate)
- `POST /api/merch/sayings` → `createStructured` proposes N on-brand sayings/idioms in Boss Daddy voice from a theme prompt.
- **IP guardrail:** prompt Claude to avoid trademarked/copyrighted phrases and flag anything borderline (`ip_flag`). Real legal risk on merch.
- UI: theme → generate → approve / edit / reject each (localStorage draft persistence like the wizards). Approved sayings become design candidates. **This is the structural editorial control.**

### Phase 2 — Template renderer (design engine)
- `app/api/merch/render/route.tsx` — Satori + sharp, brand fonts, **transparent background**, emits both a web preview and a **print-ready high-DPI PNG** at the correct dimensions per placement.
- 3–4 brand-locked templates: big-statement saying, stacked saying, logo lockup, wordmark + saying. Each with light/dark-garment color variants.
- Live preview panel in the Studio. Optional: Printful **Mockup Generator API** for realistic shop imagery.
- Satori constraints to remember: every multi-child node must be `display:flex`; fonts must be pre-registered.

### Phase 3 — Printful write layer (the missing piece)
Extend `lib/printful.ts` with:
- Catalog lookup — `GET /products`, `GET /products/{id}` (to resolve `printful_variant_id`s).
- `POST /files` — upload the print file (from its bucket URL).
- `POST /store/products` — create a **sync product** with `sync_variants[]` mapping each variant → uploaded file → retail price. Create as unconfirmed/draft.
- Optional: `POST /mockup-generator/create-task/{id}` for mockups.

Then `POST /api/merch/publish` → uploads file → creates the Printful draft product → stores `printful_sync_product_id` on `merch_designs`.

### Phase 4 — Bring it live
- Run `merch:sync` (or trigger programmatically) → product lands in `merch` + `merch_variants` → set `merch_id` back on the design.
- Existing admin merch curation flips `coming_soon → available`, sets `featured`, `category`, `enabled_images`.
- A final **"confirm publish"** click keeps the operator in control end-to-end.

## 6. Env / infra

- `PRINTFUL_API_KEY` (exists) — **verify store-write scope** before Phase 3.
- `PRINTFUL_WEBHOOK_SECRET` (exists) — fulfillment already wired.
- No new AI-provider env (gpt-image dropped from v1). `ANTHROPIC_API_KEY` already present.
- New bucket `merch-designs`.

## 7. Deferred (not v1)

- AI decorative graphics (`gpt-image`) and text-over-AI-graphic designs.
- Trend/radar-driven auto-suggestion of sayings (would ride the X Studio radar pattern).
- Fully autonomous publish (explicitly rejected — quality + IP risk).
- Variant-level per-color print files, all-over-print, embroidery-specific files.

## 8. Suggested session breakdown

- **Session A:** Phase 0 + Phase 1 (fonts + saying generator) — highest leverage, lowest risk, immediately beats Canva for copy.
- **Session B:** Phase 2 (renderer + templates).
- **Session C:** Phase 3 (Printful write layer) + Phase 4 (go-live) + E2E test with one real product.

## 9. Build log

### Phase 0 + 1 — BUILT 2026-07-05 (not committed)

Files added/changed:
- `supabase/migrations/116_merch_designs.sql` — admin-only `merch_designs` table (Pattern C). **NOT applied yet.**
- `lib/merch/sayings.ts` — `generateMerchSayings({theme,count})`; dedicated short-form merch voice + IP guardrail (`ip_risk` none/low/review); Sonnet, temp 1.0, structured tool call.
- `lib/merch/designs-store.ts` — schema-agnostic CRUD for `merch_designs` (client cast because table isn't in generated types until `db:types` runs; safe to keep after).
- `lib/merch/printful-catalog.ts` — **Phase 0 groundwork**: pinned blank list (tee/hat/mug) + print-spec placeholders. `catalogProductId`s are **null / VERIFY** against live Printful catalog before Phase 3.
- `lib/rate-limit.ts` — added `merch-sayings` limiter (20/hr).
- `app/api/merch/sayings/route.ts` — POST, admin-gated, rate-limited → generate.
- `app/api/merch/designs/route.ts` — GET list + POST save-approved.
- `app/api/merch/designs/[id]/route.ts` — PATCH + DELETE.
- `app/(dashboard)/dashboard/admin/merch/studio/page.tsx` + `_components/MerchStudio.tsx` — the workspace (theme → generate → approve/edit/dismiss → approved list w/ delete). Fails soft if migration 116 isn't applied.
- `app/(dashboard)/dashboard/admin/merch/page.tsx` — added "Studio" link.

`tsc --noEmit` + `eslint` both clean.

**Manual steps before this works end-to-end:**
1. Apply migration 116 (`supabase db push` or paste into SQL editor).
2. `npm run db:types` to regenerate types (the `designs-store` cast then becomes redundant but harmless).
3. Commit.
4. ~~(Phase 3 prep) Verify `PRINTFUL_API_KEY` has **store-write** scope.~~ **DONE 2026-07-05** — new scoped token "Boss Daddy Life — Production" created (single store; manage: orders, store products, store files, store webhooks; expires **May 9, 2028** — rotate before then). Updated in `.env.local` + Vercel; redeployed.

**Deferred from Phase 0:** brand-font registration for the renderer — no consumer until Phase 2's render route exists, so folded into Session B rather than built blind here.

### Phase 2 — BUILT 2026-07-05

The design engine: approved sayings now render to brand-locked, print-ready transparent PNGs, previewable in the Studio.

Files added/changed:
- `lib/merch/fonts/Montserrat-Black.ttf` + `Montserrat-SemiBold.ttf` — brand display font (Satori needs raw TTFs; next/font woff2 cache is unusable).
- `lib/merch/fonts.ts` — cached loaders for the fonts + `bd-logo-icon.png` as a data URI.
- `lib/merch/templates.tsx` — 4 brand-locked templates (`statement`, `stacked`, `wordmark`, `logo`) × 2 colorways (`dark` = on dark garments / `light` = on light garments). Font-size auto-fits to line length. All Satori-legal (flex-only, Montserrat 900/600).
- `app/api/merch/render/route.tsx` — Satori/`next-og` render route. Params `template/text/subline/colorway/blank/mode`. Print mode = transparent PNG at Printful placement dimensions; preview mode = scaled copy on a mock garment color. Admin-gated, `no-store`.
- `next.config.ts` — `outputFileTracingIncludes` for `/api/merch/render` so the fonts + logo bundle into the Vercel function.
- `lib/merch/designs-store.ts` + `app/api/merch/designs/[id]/route.ts` — PATCH now persists `template_key` + `template_config` (colorway/blank) so Phase 3 can regenerate the exact chosen print file.
- `MerchStudio.tsx` — approved designs now render a live preview card: template/product/colorway pickers, live preview `<img>`, "Download print file" (print-res transparent PNG), selection persisted.

**Verified:** standalone Satori render with the brand fonts → valid PNG, `channels=4 hasAlpha=true` (transparent). `tsc` + `eslint` clean.

**Known limits / follow-ups:**
- Template `catalogProductId`s + exact print dimensions in `printful-catalog.ts` are still placeholders — **VERIFY against live Printful catalog in Phase 3.**
- Logo PNG is single-color; on the `light` colorway it may not contrast perfectly. Fine for v1; revisit if needed.
- Print files are generated on-demand (download); Phase 3 will persist the chosen one to a `merch-designs` bucket + `print_file_url` before uploading to Printful.
- No Mockup Generator yet (optional).
