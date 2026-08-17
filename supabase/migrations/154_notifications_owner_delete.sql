-- Owner-delete on the in-app notification feed.
--
-- Migration 082 shipped select + update (read_at / action_state) and no delete,
-- so until now a notification could only ever be marked read — the feed grew
-- forever with nothing a user could do about it. Pattern B, owner-only, no
-- is_admin(): this is private user data and admin is moderation-only (mig 107).
--
-- ── THE ONE GUARD ───────────────────────────────────────────────────────────
-- A pending ACTIONABLE notification is the only surface that can answer itself.
-- A `connection_request` has no requests page anywhere else in the app — accept
-- and decline live on the notification row (app/api/notifications/[id]/action),
-- and decline is what stamps declined_at so the cooldown has something to
-- measure (mig 140, rule 4). Deleting one would therefore strip the only accept
-- path and leave the connection row pending forever with nothing pointing at it.
--
-- So the row becomes deletable the moment it has been ANSWERED: accept or
-- decline sets action_state, and from then on it clears like anything else.
-- Nothing is permanently undeletable; the guard only orders the two steps.
--
-- Enforced in the POLICY, not in the route, because the UI is the thing that
-- drifts. `coalesce(action_state, 'pending')` matters: createNotification()
-- writes action_state = 'pending' for actionable rows, but a null on an
-- action_required row means unanswered too and must not become a hole.
--
-- ⚠️ An RLS-blocked DELETE removes 0 rows and reports NO error. The bulk route
--    therefore returns the ids Postgres actually deleted (`.select('id')`) and
--    reconciles the client against that, rather than assuming the request
--    succeeded — see app/api/notifications/bulk/route.ts.

drop policy if exists "notifications_self_delete" on notifications;

create policy "notifications_self_delete"
  on notifications for delete
  to authenticated
  using (
    user_id = auth.uid()
    and not (action_required and coalesce(action_state, 'pending') = 'pending')
  );
