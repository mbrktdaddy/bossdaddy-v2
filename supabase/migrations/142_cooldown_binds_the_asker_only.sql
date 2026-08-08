-- ═════════════════════════════════════════════════════════════════════════════
-- 142 — the decline cooldown binds the person who was refused, not both of them
--
-- One `create or replace function`. No schema change, nothing to back-fill.
--
-- THE BUG, found by driving the UI: migration 140's request_connection() applies
-- the cooldown to the PAIR. So after A asks and C declines, C is locked out of
-- asking A for the same 30 days — even though C is the one who said no.
--
-- That contradicts migration 141, which is explicit that "the decliner sees a
-- clean slate and may reach out themselves" and has connection_state_with()
-- return 'none' to them. The two halves disagreed: C's profile showed a Connect
-- button that raised 'cooldown' every single time it was pressed. Reproduced with
-- the e2e fixture — C's request left no row at all.
--
-- The cooldown exists to stop somebody being asked over and over by a person they
-- already refused. It has nothing to say about that person later changing their
-- own mind, which is a fresh and entirely consensual overture. So: enforce it only
-- when the caller is the one who was declined.
--
-- decline_count is deliberately NOT reset when the roles flip. It's a property of
-- the pair's history, and if these two end up refusing each other in both
-- directions, a longer cooldown is the right answer.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function request_connection(_other uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _me        uuid := auth.uid();
  _a         uuid;
  _b         uuid;
  _existing  user_connections%rowtype;
  _pref      text;
begin
  if _me is null then raise exception 'not authenticated'; end if;
  if _other is null or _other = _me then
    raise exception 'cannot connect with yourself';
  end if;
  if not exists (select 1 from profiles where id = _other) then
    raise exception 'user not found';
  end if;

  -- Blocks win, both directions. The caller-facing copy for this and for a closed
  -- inbox is deliberately identical: telling the sender which one it was is
  -- telling them something about the other person they aren't owed.
  if exists (
    select 1 from user_blocks
    where (blocker_id = _me and blocked_id = _other)
       or (blocker_id = _other and blocked_id = _me)
  ) then
    raise exception 'blocked';
  end if;

  select connection_requests_from into _pref from profiles where id = _other;
  if _pref = 'nobody' then
    raise exception 'not accepting requests';
  end if;

  _a := least(_me, _other);
  _b := greatest(_me, _other);

  select * into _existing from user_connections where user_a = _a and user_b = _b;

  if found then
    if _existing.status = 'accepted' then
      return 'accepted';
    end if;

    if _existing.status = 'pending' then
      -- Simultaneous cross-request: they asked first and we're now asking them,
      -- which is two yeses. Merge rather than erroring at someone who did nothing
      -- wrong (and the primary key forbids a second row anyway).
      if _existing.requester_id <> _me then
        update user_connections
           set status = 'accepted', accepted_at = now(), updated_at = now()
         where user_a = _a and user_b = _b;
        return 'accepted';
      end if;
      return 'pending';   -- already ours; idempotent
    end if;

    -- status = 'declined'.
    --
    -- THE FIX. The cooldown binds only the person who was refused. If the DECLINER
    -- is the one asking now, they've changed their mind about their own decision
    -- and there is nobody to protect from that — let it straight through.
    if _existing.requester_id = _me
       and _existing.declined_at + make_interval(days => connection_cooldown_days(_existing.decline_count)) > now() then
      raise exception 'cooldown';
    end if;

    update user_connections
       set status = 'pending', requester_id = _me, updated_at = now()
     where user_a = _a and user_b = _b;
    return 'pending';
  end if;

  insert into user_connections (user_a, user_b, requester_id)
  values (_a, _b, _me);
  return 'pending';
end;
$$;

grant execute on function request_connection(uuid) to authenticated;
