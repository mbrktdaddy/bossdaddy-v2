-- Wishlist: Boss Daddy's testing pipeline + member voting
-- Members vote on "considering" items. Subscribe to get notified when reviewed.

create table if not exists wishlist_items (
  id                    uuid        primary key default gen_random_uuid(),
  slug                  text        unique not null,
  title                 text        not null,
  description           text,
  image_url             text,
  affiliate_url         text,
  store                 text        check (store in (
                                      'amazon','walmart','target','kohls',
                                      'home-depot','lowes','menards','other'
                                    )),
  custom_store_name     text,
  asin                  text,
  status                text        not null default 'considering'
                                    check (status in (
                                      'considering','queued','testing','reviewed','skipped'
                                    )),
  skip_reason           text,
  estimated_review_date date,
  review_id             uuid        references reviews(id) on delete set null,
  priority              integer     not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_wishlist_items_status
  on wishlist_items (status);
create index if not exists idx_wishlist_items_priority
  on wishlist_items (priority desc, created_at desc);

create or replace function set_wishlist_items_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_wishlist_items_updated_at on wishlist_items;
create trigger trg_wishlist_items_updated_at
  before update on wishlist_items
  for each row execute function set_wishlist_items_updated_at();

-- One vote per member per item
create table if not exists wishlist_votes (
  id                uuid        primary key default gen_random_uuid(),
  wishlist_item_id  uuid        not null references wishlist_items(id) on delete cascade,
  user_id           uuid        not null references profiles(id) on delete cascade,
  created_at        timestamptz not null default now(),
  unique (wishlist_item_id, user_id)
);

create index if not exists idx_wishlist_votes_item
  on wishlist_votes (wishlist_item_id);

-- Subscribe to "notify me when reviewed"
create table if not exists wishlist_subscriptions (
  id                uuid        primary key default gen_random_uuid(),
  wishlist_item_id  uuid        not null references wishlist_items(id) on delete cascade,
  user_id           uuid        not null references profiles(id) on delete cascade,
  notified          boolean     not null default false,
  notified_at       timestamptz,
  created_at        timestamptz not null default now(),
  unique (wishlist_item_id, user_id)
);

create index if not exists idx_wishlist_subs_pending
  on wishlist_subscriptions (wishlist_item_id)
  where notified = false;

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table wishlist_items enable row level security;

create policy "public read wishlist items"
  on wishlist_items for select
  to anon, authenticated
  using (true);

create policy "admins manage wishlist items"
  on wishlist_items for all
  to authenticated
  using (is_admin())
  with check (is_admin());

alter table wishlist_votes enable row level security;

create policy "public read wishlist votes"
  on wishlist_votes for select
  to anon, authenticated
  using (true);

create policy "members insert own vote"
  on wishlist_votes for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "members delete own vote"
  on wishlist_votes for delete
  to authenticated
  using (auth.uid() = user_id);

alter table wishlist_subscriptions enable row level security;

create policy "members read own subscriptions"
  on wishlist_subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "admins read all subscriptions"
  on wishlist_subscriptions for select
  to authenticated
  using (is_admin());

create policy "members insert own subscription"
  on wishlist_subscriptions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "members delete own subscription"
  on wishlist_subscriptions for delete
  to authenticated
  using (auth.uid() = user_id);

-- ── RPC: single round-trip for item detail ───────────────────────────────────
-- Returns vote count + whether current user voted + subscribed
create or replace function get_wishlist_item_status(p_item_id uuid)
returns table (
  vote_count        bigint,
  user_has_voted    boolean,
  user_subscribed   boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    (select count(*) from wishlist_votes v where v.wishlist_item_id = p_item_id)::bigint,
    exists(select 1 from wishlist_votes v where v.wishlist_item_id = p_item_id and v.user_id = auth.uid()),
    exists(select 1 from wishlist_subscriptions s where s.wishlist_item_id = p_item_id and s.user_id = auth.uid());
end;
$$;

grant execute on function get_wishlist_item_status(uuid) to anon, authenticated;

-- ── Placeholder seed items ────────────────────────────────────────────────────
insert into wishlist_items (slug, title, description, status, priority) values
  ('placeholder-item-1', 'Coming Soon — Item 1', 'Boss Daddy is testing this soon. Vote to move it up the queue.', 'considering', 30),
  ('placeholder-item-2', 'Coming Soon — Item 2', 'Boss Daddy is testing this soon. Vote to move it up the queue.', 'considering', 20),
  ('placeholder-item-3', 'On the Bench — Item 3', 'Currently being put through its paces.', 'testing', 10)
on conflict (slug) do nothing;
