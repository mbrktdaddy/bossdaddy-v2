-- Restructure voice_profiles family DOBs into a flexible family_members array.
--
-- The original schema (migration 019) had three hardcoded DOB columns —
-- self_dob, wife_dob, daughter_dob — which assumed a fixed family shape.
-- Real families don't fit three slots (stepkids, fiancé's children, multiple
-- kids, in-laws), so we replace them with a JSONB array of structured
-- entries: [{ id, relationship, name?, dob, gender? }].
--
-- Existing rows are migrated into the new shape before the old columns are
-- dropped, so no data is lost.

alter table voice_profiles
  add column if not exists family_members jsonb not null default '[]'::jsonb;

update voice_profiles
set family_members =
  (case when self_dob is not null
    then jsonb_build_array(jsonb_build_object(
      'id',           gen_random_uuid()::text,
      'relationship', 'Self',
      'name',         null,
      'dob',          self_dob::text,
      'gender',       null
    ))
    else '[]'::jsonb end)
  ||
  (case when wife_dob is not null
    then jsonb_build_array(jsonb_build_object(
      'id',           gen_random_uuid()::text,
      'relationship', 'Wife',
      'name',         null,
      'dob',          wife_dob::text,
      'gender',       'female'
    ))
    else '[]'::jsonb end)
  ||
  (case when daughter_dob is not null
    then jsonb_build_array(jsonb_build_object(
      'id',           gen_random_uuid()::text,
      'relationship', 'Daughter',
      'name',         null,
      'dob',          daughter_dob::text,
      'gender',       'female'
    ))
    else '[]'::jsonb end)
where self_dob is not null or wife_dob is not null or daughter_dob is not null;

alter table voice_profiles drop column self_dob;
alter table voice_profiles drop column wife_dob;
alter table voice_profiles drop column daughter_dob;
