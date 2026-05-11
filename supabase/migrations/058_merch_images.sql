alter table merch add column if not exists images text[] not null default '{}';
