-- Migration 105 — Family members: extend kid_profiles beyond children
--
-- The tools area is pivoting from "your kids" to "your family." kid_profiles
-- becomes the home for any family member — child, partner, or other — so the
-- per-person hub plus the Presence/Savings/Weekends tools can attach to a
-- spouse too. Per the naming doctrine we KEEP the table name kid_profiles
-- (internal names are stable forever); only the UI label becomes "Family."
--
--   - member_type distinguishes child (the default — every existing row is a
--     kid) from partner / other. Child-only tools (Dad Math, Weekends-Until-18)
--     gate on this at the application layer.
--   - birthdate becomes nullable: a partner/other has no "age until 18."
--     Children still require one — that's enforced in the Server Action, not
--     the DB, so the column can hold adults with no birthdate later. (The app
--     keeps requiring birthdate for all members until the form is type-aware.)

alter table kid_profiles
  add column if not exists member_type text not null default 'child'
    check (member_type in ('child', 'partner', 'other'));

alter table kid_profiles
  alter column birthdate drop not null;
