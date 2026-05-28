-- Dad Math persistence — extends kid_profiles with the four inputs Dad Math
-- uses to project college savings to age 18. One row per kid, edited from
-- the Dad Math tool with kid context. Inherits kid_profiles RLS (user owns
-- the row, or anonymous_id matches the cookie).
--
-- Defaults match lib/dad-tools/dad-math.ts:
--   money_balance       = 0          → DEFAULT_BALANCE
--   money_monthly       = 0          → DEFAULT_MONTHLY
--   money_target        = 94000      → DEFAULT_TARGET_BY_18
--   money_return_rate   = 0.06       → DEFAULT_RETURN_RATE
--
-- These are inputs (not derived state). The runtime calc happens on every
-- read in lib/dad-tools/dad-math.ts.

alter table kid_profiles
  add column if not exists money_balance     numeric(12,2) not null default 0,
  add column if not exists money_monthly     numeric(10,2) not null default 0,
  add column if not exists money_target      numeric(12,2) not null default 94000,
  add column if not exists money_return_rate numeric(5,4)  not null default 0.06;

-- Constraints — refuse nonsense inputs at the DB layer. App-layer Zod also
-- guards these, but defense-in-depth keeps the table consistent if a future
-- migration script or admin tool writes directly.
alter table kid_profiles
  add constraint kid_profiles_money_balance_nonneg     check (money_balance     >= 0),
  add constraint kid_profiles_money_monthly_nonneg     check (money_monthly     >= 0),
  add constraint kid_profiles_money_target_nonneg      check (money_target      >= 0),
  add constraint kid_profiles_money_return_rate_range  check (money_return_rate >= 0 and money_return_rate <= 0.30);
