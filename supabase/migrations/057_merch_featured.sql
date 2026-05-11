alter table merch add column if not exists featured boolean not null default false;

create index if not exists idx_merch_featured on merch (featured) where featured = true;
