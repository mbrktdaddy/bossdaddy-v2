-- Per-user "delete conversation" (delete-for-me).
--
-- Hides a thread from the deleter's list WITHOUT destroying the other
-- participant's history. The conversation reappears for the deleter if a newer
-- message arrives (standard messaging behavior). No new RLS needed — the
-- existing `conv_participants_self_update` policy (user_id = auth.uid()) already
-- lets a user update their own participant row.

alter table conversation_participants
  add column if not exists deleted_at timestamptz;
