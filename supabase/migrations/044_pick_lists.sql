-- Boss Daddy Picks — curated lists (gift guides, best-of collections, etc.)
-- pick_lists holds the list metadata; pick_list_items is the ordered join to reviews.

create table if not exists pick_lists (
  id             uuid         primary key default gen_random_uuid(),
  slug           text         unique not null,
  title          text         not null,
  description    text,                                          -- short blurb for index cards
  intro_html     text,                                          -- longer editorial intro on detail page
  hero_image_url text,
  is_visible     boolean      not null default false,
  published_at   timestamptz,
  created_at     timestamptz  not null default now(),
  updated_at     timestamptz  not null default now()
);

create index if not exists idx_pick_lists_slug       on pick_lists (slug);
create index if not exists idx_pick_lists_visible    on pick_lists (is_visible, published_at desc);

alter table pick_lists enable row level security;

create policy "pick_lists_public_read" on pick_lists
  for select using (is_visible = true);

create policy "pick_lists_admin_write" on pick_lists
  for all to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- ── pick_list_items ─────────────────────────────────────────────────────────

create table if not exists pick_list_items (
  id           uuid        primary key default gen_random_uuid(),
  pick_list_id uuid        not null references pick_lists  on delete cascade,
  review_id    uuid        not null references reviews     on delete cascade,
  position     integer     not null default 0,
  blurb        text,                                        -- optional editorial override per pick
  created_at   timestamptz not null default now(),
  unique (pick_list_id, review_id)
);

create index if not exists idx_pick_list_items_list on pick_list_items (pick_list_id, position);

alter table pick_list_items enable row level security;

create policy "pick_list_items_public_read" on pick_list_items
  for select
  using (exists (select 1 from pick_lists pl where pl.id = pick_list_id and pl.is_visible = true));

create policy "pick_list_items_admin_write" on pick_list_items
  for all to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- ── updated_at trigger ──────────────────────────────────────────────────────

create or replace trigger pick_lists_updated_at
  before update on pick_lists
  for each row execute function touch_updated_at();
