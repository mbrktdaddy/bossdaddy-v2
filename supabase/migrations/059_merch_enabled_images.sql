alter table merch add column if not exists enabled_images text[] not null default '{}';
