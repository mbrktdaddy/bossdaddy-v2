-- Strip is_admin() from PRIVATE USER-OWNED data — moderation-only admin doctrine.
--
-- Follow-up to migration 106 (which fixed the savings_* tables). Same problem,
-- wider blast radius: many private user tables baked `or is_admin()` into their
-- RLS policies, giving the admin account silent read/write of every user's
-- private data (family records, DMs, AI chat history, notifications, voice
-- lexicon, etc.). Doctrine: is_admin() belongs ONLY on public-content tables
-- and admin-only/moderation tables — NEVER on private user-owned data.
--
-- All legitimate admin/cron/support access to these tables already goes through
-- the service-role admin client (createAdminClient), which bypasses RLS and is
-- auditable. Removing the in-policy override therefore breaks nothing real.
--
-- DELIBERATELY NOT TOUCHED:
--   * orders / order_items — transactional commerce records the merchant must
--     read for fulfillment/refunds/support. Tighten later once the admin order
--     UI is confirmed to use service-role only.
--   * profiles (profiles_admin_write) — admin role/account_status moderation
--     must run through the authenticated admin session (service-role writes to
--     those columns are blocked by triggers). Load-bearing — keep.
--   * Public-content tables (reviews, guides, products, collections, tags,
--     merch, site_settings) and admin-only tables (content_revisions,
--     abuse_reports, gear_candidates, boss_research_*, affiliate_clicks,
--     comments) — is_admin() is correct there.
--
-- Sibling policies WITHOUT is_admin() (e.g. *_self_update, *_insert) are left
-- untouched; this migration only drops + recreates the policies that carried
-- the admin override.

-- ════════════════════════════════════════════════════════════════════════════
-- kid_profiles — family member records (names, birthdates, photos)
-- ════════════════════════════════════════════════════════════════════════════
drop policy if exists "kid_profiles owner read"   on kid_profiles;
drop policy if exists "kid_profiles owner insert" on kid_profiles;
drop policy if exists "kid_profiles owner update" on kid_profiles;
drop policy if exists "kid_profiles owner delete" on kid_profiles;

create policy "kid_profiles owner read"   on kid_profiles for select to authenticated using (user_id = auth.uid());
create policy "kid_profiles owner insert" on kid_profiles for insert to authenticated with check (user_id = auth.uid());
create policy "kid_profiles owner update" on kid_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "kid_profiles owner delete" on kid_profiles for delete to authenticated using (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════════
-- tool_intent_events — per-user tool-usage signals
-- ════════════════════════════════════════════════════════════════════════════
drop policy if exists "tool_intent_events owner read" on tool_intent_events;
create policy "tool_intent_events owner read" on tool_intent_events for select to authenticated using (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════════
-- tool_email_subscriptions — personal email opt-ins
-- ════════════════════════════════════════════════════════════════════════════
drop policy if exists "tool_email_subs owner read"   on tool_email_subscriptions;
drop policy if exists "tool_email_subs owner delete" on tool_email_subscriptions;
create policy "tool_email_subs owner read"   on tool_email_subscriptions for select to authenticated using (user_id = auth.uid());
create policy "tool_email_subs owner delete" on tool_email_subscriptions for delete to authenticated using (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════════
-- notifications — personal in-app notification feed
-- ════════════════════════════════════════════════════════════════════════════
drop policy if exists "notifications_read" on notifications;
create policy "notifications_read" on notifications for select to authenticated using (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════════
-- conversations / conversation_participants / messages — direct messages
-- ════════════════════════════════════════════════════════════════════════════
drop policy if exists "conversations_read" on conversations;
create policy "conversations_read" on conversations for select to authenticated using (is_conversation_participant(id));

drop policy if exists "conv_participants_read" on conversation_participants;
create policy "conv_participants_read" on conversation_participants for select to authenticated using (is_conversation_participant(conversation_id));

drop policy if exists "messages_read" on messages;
create policy "messages_read" on messages for select to authenticated using (is_conversation_participant(conversation_id));

-- ════════════════════════════════════════════════════════════════════════════
-- user_blocks — block relationships
-- ════════════════════════════════════════════════════════════════════════════
drop policy if exists "user_blocks_owner" on user_blocks;
create policy "user_blocks_owner" on user_blocks for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════════
-- voice_phrases / voice_edits — personal writing-style data
-- ════════════════════════════════════════════════════════════════════════════
drop policy if exists "voice_phrases_read"  on voice_phrases;
drop policy if exists "voice_phrases_write" on voice_phrases;
create policy "voice_phrases_read"  on voice_phrases for select to authenticated using (user_id = auth.uid());
create policy "voice_phrases_write" on voice_phrases for all    to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "voice_edits_read"  on voice_edits;
drop policy if exists "voice_edits_write" on voice_edits;
create policy "voice_edits_read"  on voice_edits for select to authenticated using (user_id = auth.uid());
create policy "voice_edits_write" on voice_edits for all    to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════════
-- ai_jobs — per-user async AI job records
-- ════════════════════════════════════════════════════════════════════════════
drop policy if exists "ai_jobs_read" on ai_jobs;
create policy "ai_jobs_read" on ai_jobs for select to authenticated using (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════════
-- boss_conversations / boss_messages — "The Boss" AI concierge chat history
-- (most sensitive: finances, family, personal struggles)
-- ════════════════════════════════════════════════════════════════════════════
drop policy if exists "boss_conversations_read"  on boss_conversations;
drop policy if exists "boss_conversations_write" on boss_conversations;
create policy "boss_conversations_read"  on boss_conversations for select to authenticated using (user_id = auth.uid());
create policy "boss_conversations_write" on boss_conversations for all    to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "boss_messages_read"  on boss_messages;
drop policy if exists "boss_messages_write" on boss_messages;
create policy "boss_messages_read"  on boss_messages for select to authenticated using (user_id = auth.uid());
create policy "boss_messages_write" on boss_messages for all    to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════════
-- social_posts / hashtag_presets — per-user social drafting workspace
-- ════════════════════════════════════════════════════════════════════════════
drop policy if exists "social_posts_read"  on social_posts;
drop policy if exists "social_posts_write" on social_posts;
create policy "social_posts_read"  on social_posts for select to authenticated using (user_id = auth.uid());
create policy "social_posts_write" on social_posts for all    to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "hashtag_presets_read"  on hashtag_presets;
drop policy if exists "hashtag_presets_write" on hashtag_presets;
create policy "hashtag_presets_read"  on hashtag_presets for select to authenticated using (user_id = auth.uid());
create policy "hashtag_presets_write" on hashtag_presets for all    to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════════
-- Standalone admin override policies — just drop (base user/public policies
-- already grant the legitimate access; admin moderation uses service role)
-- ════════════════════════════════════════════════════════════════════════════
drop policy if exists "admins read all subscriptions" on wishlist_subscriptions;
drop policy if exists "admins manage ratings"         on user_ratings;
drop policy if exists "likes_admin"                   on likes;
