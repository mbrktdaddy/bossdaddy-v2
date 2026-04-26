-- v4.5 — Engagement metrics: scroll depth + affiliate click tracking

-- Scroll milestone counters on each content row
alter table reviews
  add column if not exists scroll_25_count  integer not null default 0,
  add column if not exists scroll_50_count  integer not null default 0,
  add column if not exists scroll_75_count  integer not null default 0,
  add column if not exists scroll_100_count integer not null default 0;

alter table articles
  add column if not exists scroll_25_count  integer not null default 0,
  add column if not exists scroll_50_count  integer not null default 0,
  add column if not exists scroll_75_count  integer not null default 0,
  add column if not exists scroll_100_count integer not null default 0;

-- Affiliate click events — fine-grained, one row per click
create table if not exists affiliate_clicks (
  id              uuid        primary key default gen_random_uuid(),
  content_type    text        not null check (content_type in ('article', 'review')),
  content_id      uuid        not null,
  product_slug    text,
  destination_url text        not null,
  clicked_at      timestamptz not null default now()
);

create index if not exists idx_affiliate_clicks_content
  on affiliate_clicks (content_type, content_id, clicked_at desc);
create index if not exists idx_affiliate_clicks_product
  on affiliate_clicks (product_slug, clicked_at desc);
create index if not exists idx_affiliate_clicks_recent
  on affiliate_clicks (clicked_at desc);

-- RLS: only admins can read; inserts happen server-side via admin client
alter table affiliate_clicks enable row level security;

create policy "admins read affiliate clicks"
  on affiliate_clicks for select
  to authenticated
  using (is_admin());

-- Atomic scroll milestone increment RPC. Single function handles both content
-- types and all four milestones, keeps validation server-side.
create or replace function increment_scroll_depth(
  p_content_type text,
  p_content_id   uuid,
  p_milestone    integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_content_type not in ('article', 'review') then
    return;
  end if;
  if p_milestone not in (25, 50, 75, 100) then
    return;
  end if;

  if p_content_type = 'article' then
    if p_milestone = 25 then
      update articles set scroll_25_count  = scroll_25_count  + 1 where id = p_content_id;
    elsif p_milestone = 50 then
      update articles set scroll_50_count  = scroll_50_count  + 1 where id = p_content_id;
    elsif p_milestone = 75 then
      update articles set scroll_75_count  = scroll_75_count  + 1 where id = p_content_id;
    elsif p_milestone = 100 then
      update articles set scroll_100_count = scroll_100_count + 1 where id = p_content_id;
    end if;
  else
    if p_milestone = 25 then
      update reviews set scroll_25_count  = scroll_25_count  + 1 where id = p_content_id;
    elsif p_milestone = 50 then
      update reviews set scroll_50_count  = scroll_50_count  + 1 where id = p_content_id;
    elsif p_milestone = 75 then
      update reviews set scroll_75_count  = scroll_75_count  + 1 where id = p_content_id;
    elsif p_milestone = 100 then
      update reviews set scroll_100_count = scroll_100_count + 1 where id = p_content_id;
    end if;
  end if;
end;
$$;

-- Allow anon + authenticated to call the RPC (writes go through SECURITY DEFINER
-- with a hardcoded UPDATE; no RLS bypass risk).
grant execute on function increment_scroll_depth(text, uuid, integer) to anon, authenticated;
