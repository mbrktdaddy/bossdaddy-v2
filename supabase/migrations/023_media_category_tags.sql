-- Add category and tags to media_assets for better organization

alter table media_assets
  add column if not exists category text check (
    category in (
      'bbq-grilling',
      'diy-tools',
      'kids-family',
      'health-fitness',
      'outdoors-adventure',
      'dad-life',
      'family-lifestyle'
    )
  ),
  add column if not exists tags text[] not null default '{}';

create index if not exists idx_media_assets_category on media_assets (category);
create index if not exists idx_media_assets_tags on media_assets using gin (tags);
