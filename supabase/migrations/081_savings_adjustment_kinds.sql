-- Replace the "Log withdrawal" single-direction concept with a versatile
-- "Edit balance" flow that handles both directions:
--
--   adjustment_credit — money in OUTSIDE the daily ritual (gift / bonus /
--                       windfall / correction up / sync up)
--   adjustment_debit  — money out (emergency, transfer elsewhere, sync down).
--                       Semantically equivalent to 'withdrawal' which we
--                       keep for backward compatibility with existing rows.
--
-- Both adjustment kinds are EXCLUDED from the streak walker — they're not
-- part of the daily-yes ritual — but they DO affect the running total.
-- Same posture as 'withdrawal' (which we leave in the enum for old data).

alter table savings_entries
  drop constraint if exists savings_entries_kind_check;

alter table savings_entries
  add constraint savings_entries_kind_check
  check (kind in (
    'contribution',
    'skip',
    'catchup',
    'withdrawal',
    'adjustment_credit',
    'adjustment_debit'
  ));
