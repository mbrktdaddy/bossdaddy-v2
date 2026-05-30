-- Message email notifications (Phase 1: debounced digest; push is Phase 2).
--
-- Adds the per-user opt-out for new-message emails and a per-participant
-- debounce marker the cron uses to avoid re-emailing the same unread thread.
-- Also retires the in-app `new_message` notification rows: messages now live
-- solely in the Messages surface (conversation_participants.last_read_at owns
-- message-unread), matching the convention where DMs get their own home and the
-- notification feed carries non-message activity. The new_message producer is
-- removed in lib/messaging.ts.

-- Per-user toggle. Default ON; users opt out in /account/settings. Covered by
-- the existing profiles self-update RLS policy (a normal, non-protected column).
alter table profiles
  add column if not exists email_new_message boolean not null default true;

-- Per-participant debounce marker: when we last emailed THIS user about unread
-- messages in THIS conversation. Null = never. Written by the cron via the
-- admin client; readable under the existing conv_participants RLS.
alter table conversation_participants
  add column if not exists last_notified_at timestamptz;

-- Retire existing in-app message pings. They duplicated message-unread and are
-- no longer produced; clear them so the notification feed stops listing them.
delete from notifications where type = 'new_message';
