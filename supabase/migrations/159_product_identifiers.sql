-- ─────────────────────────────────────────────────────────────────────────────
-- 159 — Product identifiers: model number (schema.org `mpn`) + GTIN.
--
-- Until now a model number could only live in `specs` as a "Model" row, which
-- nothing else could use. As columns they feed:
--   • the link import, which prefills both from the page's structured data;
--   • the slug suggestion (`brand-model`, e.g. dewalt-dcd801b);
--   • a duplicate-model warning on save (soft: the API asks, the admin can
--     save anyway — a kit and a tool-only unit can share a model number);
--   • Google's product markup (`mpn` / `gtin` on itemReviewed);
--   • the reader-facing "Model" line on reviews and spec tables.
--
-- No backfill: no product carried a Model / UPC / GTIN spec row when this was
-- written (checked against prod, 2026-10-06).
--
-- Both columns are public facts printed on the box, so they inherit the
-- products table's `to anon, authenticated` read like every other column.
-- ─────────────────────────────────────────────────────────────────────────────

alter table products
  -- The manufacturer's model / part number, as the manufacturer writes it
  -- (DCD801B, 2904-20). Not the retailer's SKU.
  add column if not exists model_number text,
  -- The barcode number: UPC-A (12), EAN-13 (13), GTIN-8 or GTIN-14. Digits
  -- only, stored as given; the check digit is validated in app code.
  add column if not exists gtin text;

comment on column products.model_number is
  'Manufacturer model / part number (schema.org mpn). Not a retailer SKU.';
comment on column products.gtin is
  'Barcode number, digits only: GTIN-8, UPC-A (12), EAN-13 or GTIN-14. Check digit validated in app code.';


-- ─── Invariants ───────────────────────────────────────────────────────────────
-- Trimmed, non-empty, and short enough for a spec-table header.
alter table products drop constraint if exists products_model_number_format;
alter table products add constraint products_model_number_format
  check (
    model_number is null
    or (model_number = btrim(model_number) and char_length(model_number) between 1 and 60)
  );

alter table products drop constraint if exists products_gtin_format;
alter table products add constraint products_gtin_format
  check (gtin is null or gtin ~ '^([0-9]{8}|[0-9]{12,14})$');

-- A GTIN identifies exactly one trade item, so two products sharing one is a
-- duplicate, never a variant. Compared zero-padded to 14 digits, because the
-- 12-digit UPC 012345678905 and the 13-digit EAN 0012345678905 are the same
-- number. (Model numbers get a soft app-level warning instead: see above.)
create unique index if not exists products_gtin_key
  on products (lpad(gtin, 14, '0'))
  where gtin is not null;
