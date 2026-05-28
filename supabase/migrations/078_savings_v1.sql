-- Dad Tools v1.2: Savings — micro-savings habit tracker.
--
-- The honest framing: this is a COMMITMENT tracker, not a fintech product.
-- We never custody money. Tapping "Yes" deep-links the user into their own
-- PayPal/Venmo/Cash App. We log the commitment; they move the money.
--
-- Architecture echoes migration 076 (Dad Tools v1) but with a key difference:
-- Savings is authenticated-only. No anonymous_id path. Persistence requires
-- a stable identity (reminders, invites, multi-day streaks).
--
-- Tables (created in dependency order, then all RLS policies added at the
-- end so cross-table references in USING clauses resolve):
--   savings_goals               — one row per goal (owned by a user)
--   savings_goal_participants   — many-to-many; owner + invited spouses
--   savings_goal_invitations    — signed tokens for spouse invites (7d, single-use)
--   savings_entries             — append-only contribution log (per contributor)

-- ════════════════════════════════════════════════════════════════════════════
-- 1. TABLE DEFINITIONS
-- ════════════════════════════════════════════════════════════════════════════

-- ── savings_goals ────────────────────────────────────────────────────────────
-- User-owned (Pattern B) but readable by all participants via the participants
-- join. Cadence and target are both NULLABLE so the tool supports the full
-- 2x2 (cadence/target both, cadence only, target only, free-form).

create table if not exists savings_goals (
  id                  uuid          primary key default gen_random_uuid(),
  owner_id            uuid          not null references profiles(id) on delete cascade,
  kid_profile_id      uuid          references kid_profiles(id) on delete set null,

  name                text          not null,
  description         text,

  cadence             text          check (cadence in ('daily', 'weekly', 'monthly')),
  amount_per_cadence  numeric(10,2) check (amount_per_cadence is null or amount_per_cadence > 0),
  start_date          date          not null default current_date,

  target_amount       numeric(12,2) check (target_amount is null or target_amount > 0),
  target_date         date,

  destination_mode    text          not null default 'per_participant'
                                    check (destination_mode in ('shared', 'per_participant', 'manual')),
  destination_url     text,
  destination_type    text          check (destination_type in ('paypal', 'venmo', 'cashapp', 'zelle', 'manual')),
  destination_label   text,

  reminder_enabled    boolean       not null default true,
  reminder_cadence    text          check (reminder_cadence in ('daily', 'weekly', 'monthly', 'off')),
  reminder_hour_utc   integer       check (reminder_hour_utc between 0 and 23),

  status              text          not null default 'active'
                                    check (status in ('active', 'paused', 'completed', 'archived')),
  completed_at        timestamptz,
  archived_at         timestamptz,

  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now(),

  -- Name has real content
  constraint savings_goals_name_check
    check (length(trim(name)) > 0),

  -- Cadence + amount must both be set or both be null (free-form mode)
  constraint savings_goals_cadence_amount_check
    check (
      (cadence is null and amount_per_cadence is null)
      or (cadence is not null and amount_per_cadence is not null)
    ),

  -- Shared destination requires a URL
  constraint savings_goals_shared_destination_check
    check (destination_mode <> 'shared' or destination_url is not null)
);


-- ── savings_goal_participants ────────────────────────────────────────────────
-- Many-to-many. Owner is auto-inserted on goal creation (Server Action).
-- Each row carries an optional per-participant destination (used when the
-- goal's destination_mode = 'per_participant'; shared mode ignores these).

create table if not exists savings_goal_participants (
  id                 uuid        primary key default gen_random_uuid(),
  goal_id            uuid        not null references savings_goals(id) on delete cascade,
  user_id            uuid        not null references profiles(id) on delete cascade,
  role               text        not null default 'contributor'
                                 check (role in ('owner', 'contributor')),
  destination_url    text,
  destination_type   text        check (destination_type in ('paypal', 'venmo', 'cashapp', 'zelle', 'manual')),
  destination_label  text,
  joined_at          timestamptz not null default now(),
  unique (goal_id, user_id)
);


-- ── savings_goal_invitations ─────────────────────────────────────────────────
-- Signed token rows for spouse/partner invites. Single-use, 7-day expiry.
-- Tokens are generated server-side via crypto.randomBytes; the email column
-- is audit-only (we may or may not actually send mail, depending on how the
-- inviter chooses to share the link).
--
-- No INSERT/UPDATE policy — writes happen via Server Actions only. Mirrors
-- the tool_email_subscriptions pattern in migration 076.

create table if not exists savings_goal_invitations (
  id          uuid        primary key default gen_random_uuid(),
  goal_id     uuid        not null references savings_goals(id) on delete cascade,
  inviter_id  uuid        not null references profiles(id) on delete cascade,
  token       text        not null unique,
  email       text,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  used_by     uuid        references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);


-- ── savings_entries ──────────────────────────────────────────────────────────
-- Append-only contribution log. One row per contribution per contributor;
-- the same contributor may log multiple entries on the same day (overflow
-- contributions count as banked days). Skips, catch-ups, and withdrawals
-- are encoded via the `kind` enum so the streak engine can read intent.

create table if not exists savings_entries (
  id              uuid          primary key default gen_random_uuid(),
  goal_id         uuid          not null references savings_goals(id) on delete cascade,
  contributor_id  uuid          not null references profiles(id) on delete cascade,
  contributed_on  date          not null,
  -- Amount is always stored POSITIVE. Sign is derived from `kind` at read
  -- time: contribution/catchup add to runningTotal; withdrawal subtracts;
  -- skip is 0 regardless of stored amount.
  amount          numeric(10,2) not null default 0 check (amount >= 0),
  kind            text          not null default 'contribution'
                                check (kind in ('contribution', 'skip', 'catchup', 'withdrawal')),
  note            text,
  created_at      timestamptz   not null default now()
);


-- ════════════════════════════════════════════════════════════════════════════
-- 2. INDEXES
-- ════════════════════════════════════════════════════════════════════════════

create index if not exists idx_savings_goals_owner
  on savings_goals (owner_id, status, created_at desc);

create index if not exists idx_savings_goals_kid
  on savings_goals (kid_profile_id)
  where kid_profile_id is not null;

-- Cron lookup: hourly reminder firing
create index if not exists idx_savings_goals_reminder
  on savings_goals (reminder_hour_utc, status)
  where reminder_enabled = true and status = 'active';

create index if not exists idx_savings_goal_participants_user
  on savings_goal_participants (user_id);

create index if not exists idx_savings_invites_goal
  on savings_goal_invitations (goal_id, created_at desc);

create index if not exists idx_savings_invites_inviter
  on savings_goal_invitations (inviter_id, created_at desc);

create index if not exists idx_savings_entries_goal_date
  on savings_entries (goal_id, contributed_on desc);

create index if not exists idx_savings_entries_contributor
  on savings_entries (contributor_id, contributed_on desc);


-- ════════════════════════════════════════════════════════════════════════════
-- 3. TRIGGERS
-- ════════════════════════════════════════════════════════════════════════════

create or replace function set_savings_goals_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_savings_goals_updated_at on savings_goals;
create trigger trg_savings_goals_updated_at
  before update on savings_goals
  for each row execute function set_savings_goals_updated_at();


-- ════════════════════════════════════════════════════════════════════════════
-- 4. ROW LEVEL SECURITY — enable on all tables before creating policies
-- ════════════════════════════════════════════════════════════════════════════

alter table savings_goals               enable row level security;
alter table savings_goal_participants   enable row level security;
alter table savings_goal_invitations    enable row level security;
alter table savings_entries             enable row level security;


-- ════════════════════════════════════════════════════════════════════════════
-- 5. POLICIES — all tables now exist, so cross-references resolve
-- ════════════════════════════════════════════════════════════════════════════

-- ── savings_goals ────────────────────────────────────────────────────────────

-- Owner or any participant can read
create policy "savings_goals participant_read"
  on savings_goals for select
  to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from savings_goal_participants p
      where p.goal_id = savings_goals.id and p.user_id = auth.uid()
    )
    or is_admin()
  );

-- Owner can insert/update/delete
create policy "savings_goals owner_write"
  on savings_goals for all
  to authenticated
  using (owner_id = auth.uid() or is_admin())
  with check (owner_id = auth.uid() or is_admin());


-- ── savings_goal_participants ────────────────────────────────────────────────

-- A participant can read their own row + sibling participant rows on the
-- same goal. Phrased as a single policy: "I am a participant of this goal."
create policy "savings_participants peer_read"
  on savings_goal_participants for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from savings_goal_participants p2
      where p2.goal_id = savings_goal_participants.goal_id and p2.user_id = auth.uid()
    )
    or is_admin()
  );

-- A participant can update their own row (destination changes etc.)
create policy "savings_participants self_update"
  on savings_goal_participants for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Goal owner can manage all participant rows (add, remove, change role)
create policy "savings_participants owner_manage"
  on savings_goal_participants for all
  to authenticated
  using (
    exists (
      select 1 from savings_goals g
      where g.id = savings_goal_participants.goal_id and g.owner_id = auth.uid()
    )
    or is_admin()
  )
  with check (
    exists (
      select 1 from savings_goals g
      where g.id = savings_goal_participants.goal_id and g.owner_id = auth.uid()
    )
    or is_admin()
  );


-- ── savings_goal_invitations ─────────────────────────────────────────────────

-- The goal owner + inviter can list their own invites for the management UI.
-- Token-based public lookup happens via the admin client in Server Actions.
create policy "savings_invites owner_read"
  on savings_goal_invitations for select
  to authenticated
  using (
    inviter_id = auth.uid()
    or exists (
      select 1 from savings_goals g
      where g.id = savings_goal_invitations.goal_id and g.owner_id = auth.uid()
    )
    or is_admin()
  );


-- ── savings_entries ──────────────────────────────────────────────────────────

-- A participant of the goal can read every entry (shared visibility is the
-- whole point of multi-participant goals — attribution + history).
create policy "savings_entries participant_read"
  on savings_entries for select
  to authenticated
  using (
    exists (
      select 1 from savings_goal_participants p
      where p.goal_id = savings_entries.goal_id and p.user_id = auth.uid()
    )
    or is_admin()
  );

-- A contributor can write their OWN entries on goals they participate in.
-- The contributor_id-must-match check pairs with the participant check so a
-- stranger can't insert entries against another user's goal, and a participant
-- can't impersonate another contributor.
create policy "savings_entries self_write"
  on savings_entries for all
  to authenticated
  using (
    contributor_id = auth.uid() or is_admin()
  )
  with check (
    (
      contributor_id = auth.uid()
      and exists (
        select 1 from savings_goal_participants p
        where p.goal_id = savings_entries.goal_id and p.user_id = auth.uid()
      )
    )
    or is_admin()
  );
