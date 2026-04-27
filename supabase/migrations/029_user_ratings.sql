-- v5.5 — User ratings for product reviews (1–10 scale)
-- Separate from the author's rating. Aggregate is threshold-gated in the UI (min 3 ratings to display).

create table if not exists user_ratings (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references profiles(id) on delete cascade,
  review_id  uuid        not null references reviews(id) on delete cascade,
  rating     smallint    not null check (rating >= 1 and rating <= 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, review_id)
);

create index if not exists idx_user_ratings_review
  on user_ratings (review_id);

alter table user_ratings enable row level security;

create policy "anyone can read ratings"
  on user_ratings for select
  to anon, authenticated
  using (true);

create policy "users insert own ratings"
  on user_ratings for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users update own ratings"
  on user_ratings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "admins manage ratings"
  on user_ratings for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- Single round-trip: aggregate + caller's own rating
create or replace function get_review_rating_summary(p_review_id uuid)
returns table (avg_rating numeric, rating_count bigint, user_rating smallint)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    round(avg(r.rating)::numeric, 1)                                              as avg_rating,
    count(*)::bigint                                                               as rating_count,
    max(case when r.user_id = auth.uid() then r.rating end)::smallint             as user_rating
  from user_ratings r
  where r.review_id = p_review_id;
end;
$$;

grant execute on function get_review_rating_summary(uuid) to anon, authenticated;
