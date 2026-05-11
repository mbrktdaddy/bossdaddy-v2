-- printful_variant_id is the base catalog variant (e.g. "Snapback Hat, Black").
-- Multiple sync products can legitimately share the same base catalog variant
-- (e.g. two hat designs using the same hat style). Only printful_sync_variant_id
-- needs to be unique. Drop the over-restrictive index.
drop index if exists idx_merch_variants_printful_variant;
