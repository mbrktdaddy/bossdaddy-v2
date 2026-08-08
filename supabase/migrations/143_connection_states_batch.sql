-- ═════════════════════════════════════════════════════════════════════════════
-- 143 — a batch form of connection_state_with, because the TypeScript copy of it
--       could not see half the blocks
--
-- One new function. No schema change, nothing to back-fill.
--
-- THE BUG, found by driving the UI: /api/members/search needs the relationship
-- state for up to ten people at once, so lib/connections.ts grew a
-- connectionStatesFor() that rebuilt the logic in TypeScript over the CALLER'S
-- client. RLS on user_blocks is `using (blocker_id = auth.uid())` — you may read
-- the blocks you created and no others, which is right, because being able to
-- enumerate who blocked you is itself a leak.
--
-- The consequence: A blocks C, C disappears from A's search, and A stays fully
-- visible in C's. Blocking was half a block. connection_state_with() never had
-- this problem — it is security definer, so its own user_blocks lookup sees both
-- directions — but nothing was using it for lists.
--
-- So the batch path becomes SQL too, and the TypeScript reimplementation goes.
-- The comment above it admitted the risk ("kept in step with the SQL by hand")
-- and that turned out to be worth exactly what such comments usually are.
--
-- Returns one row per input id, including 'none' for ids with no relationship, so
-- the caller can map straight over the result without worrying about gaps.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function connection_states_for(_others uuid[])
returns table (other_id uuid, state text)
language sql
security definer
set search_path = public
stable
as $$
  -- Delegates to the single-id function rather than re-deriving anything: the
  -- block precedence and the silent-decline masking are decided in exactly one
  -- place, which is the whole point of this migration.
  select o.id, connection_state_with(o.id)
    from unnest(_others) as o(id)
   where o.id is not null;
$$;

grant execute on function connection_states_for(uuid[]) to authenticated;
