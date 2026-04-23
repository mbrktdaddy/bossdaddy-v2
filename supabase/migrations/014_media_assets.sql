-- Media library shared across admins and authors
create table media_assets (
  id          uuid        primary key default gen_random_uuid(),
  url         text        not null,
  bucket      text        not null default 'media',
  filename    text        not null,
  alt_text    text,
  uploaded_by uuid        references profiles(id) on delete set null,
  file_size   integer,
  mime_type   text,
  created_at  timestamptz not null default now()
);

alter table media_assets enable row level security;

-- Admins and authors can view all assets
create policy "authors and admins can view media"
  on media_assets for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('admin', 'author')
    )
  );

-- Admins and authors can upload (uploaded_by must be self)
create policy "authors and admins can upload media"
  on media_assets for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('admin', 'author')
    )
  );

-- Authors can delete their own; admins can delete any
create policy "authors delete own, admins delete any"
  on media_assets for delete
  to authenticated
  using (
    uploaded_by = auth.uid()
    or exists (
      select 1 from profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );
