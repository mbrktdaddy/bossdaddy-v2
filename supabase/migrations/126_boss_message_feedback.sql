-- ─────────────────────────────────────────────────────────────────────────────
-- 126_boss_message_feedback.sql
-- Thumbs up/down on "The Boss" assistant turns.
--
-- boss_messages is PRIVATE user data (Pattern B). The existing owner-only write
-- policy ("boss_messages_write", for all, user_id = auth.uid()) already governs
-- these UPDATEs — a member can only rate their own turns — so NO new policy is
-- added here. The feedback API uses the RLS-scoped client, so a policy gap fails
-- closed. Admins never touch this via RLS (moderation-only doctrine).
-- ─────────────────────────────────────────────────────────────────────────────

alter table boss_messages
  add column if not exists feedback    text
    check (feedback in ('up', 'down')),
  add column if not exists feedback_at timestamptz;

comment on column boss_messages.feedback is
  'Member rating of an assistant turn: up | down | null (no rating). Only assistant rows are rated.';

-- Analytics query shape: "surface the down-voted turns to review." Partial index
-- keeps it small — the vast majority of rows are never rated (feedback is null).
create index if not exists idx_boss_messages_feedback
  on boss_messages (feedback, created_at desc)
  where feedback is not null;

-- After applying: npm run db:types
