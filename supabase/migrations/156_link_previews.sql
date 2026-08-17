-- ═════════════════════════════════════════════════════════════════════════════
-- 156 — link previews: a global, URL-keyed cache of third-party page metadata.
--
-- WHAT THIS IS FOR. A member pastes a link into a DM; the thread shows a card
-- with the page's title, description and thumbnail. The whole reason it needs a
-- table is that the fetch must NOT happen in anybody's browser — see the doctrine
-- below, which is the point of the feature and not an implementation detail.
--
-- ── THE RULE THE ARCHITECTURE EXISTS TO ENFORCE ──────────────────────────────
-- Rendering `<img src="{their og:image}">` would make the RECIPIENT'S browser
-- fetch a URL the SENDER chose. That hands the sender a read receipt — when the
-- thread was opened — plus the recipient's IP address and user agent, from a
-- server the sender controls. It is a tracking pixel with extra steps, and it is
-- the single most common way home-rolled link previews leak.
--
-- So: OUR SERVER fetches the page, OUR SERVER fetches the thumbnail, and the
-- thumbnail is re-encoded and stored here. No member device ever contacts the
-- third party. That is the same shape Slack and Discord use, and the reason both
-- proxy preview images through their own domains.
--
-- ── WHY THERE ARE NO RLS POLICIES AT ALL ─────────────────────────────────────
-- This is not user-owned data, so Pattern B's `user_id = auth.uid()` doesn't
-- apply — but `to authenticated using (true)` would be worse than it looks: it
-- would let any member SELECT the whole table and read every URL anybody on the
-- site has ever shared in a private message. The metadata is public; the fact
-- that a Boss Daddy member sent it is not.
--
-- RLS is therefore enabled with NO policies, which denies every web role
-- outright. Reads happen through the service-role client in server code that has
-- already established WHICH conversation the reader belongs to, so a member only
-- ever receives previews for links in their own threads. Writes are service-role
-- only for the same reason: the row is the product of a hardened server fetch
-- (lib/link-preview/), and a client-writable cache would be a way to put
-- attacker-chosen text and images under someone else's link.
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists link_previews (
  id            uuid        primary key default gen_random_uuid(),

  -- The normalized URL — the cache key. UNIQUE, so ten members sharing one link
  -- is one outbound fetch, which matters both for our cost and for not being an
  -- amplifier pointed at somebody else's site.
  url           text        not null unique,

  -- 'failed' is CACHED DELIBERATELY. Without it, a link that times out or is
  -- blocked gets re-fetched on every single thread open, forever — the failure
  -- case becoming the expensive one. `fetched_at` is what lets a retry happen
  -- later without making it happen constantly.
  status        text        not null check (status in ('ok', 'failed')),

  title         text,
  description   text,
  site_name     text,

  -- Storage path of the RE-ENCODED thumbnail (never a third-party URL — that
  -- would defeat the entire point above). Lives in the existing private
  -- dm-media bucket under a link-previews/ prefix.
  image_path    text,
  image_width   integer,
  image_height  integer,

  -- Internal only. Never rendered: it can contain a hostname or an error from
  -- someone else's server, and neither belongs in a member's UI.
  error         text,

  fetched_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

comment on table link_previews is
  'URL-keyed cache of third-party page metadata for DM link previews. RLS enabled with NO policies on purpose: service-role reads only, because `using (true)` would let any member enumerate every URL shared in every private message. Thumbnails are re-encoded and stored by us — never hotlinked, or the recipient''s browser would fetch a sender-chosen URL. See lib/link-preview/.';

-- The staleness sweep ("what is old enough to refetch") is the only query shape
-- that isn't a point lookup by url, and url already has a unique index.
create index if not exists idx_link_previews_fetched
  on link_previews (fetched_at);

alter table link_previews enable row level security;

-- No policies. See the header — this is deliberate, not an omission. A future
-- migration that adds `to authenticated using (true)` here re-opens the
-- enumeration hole described above.
