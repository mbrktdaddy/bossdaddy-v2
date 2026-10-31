-- Boss@ voice profile — merge the grace-through-faith conviction into faith_values.
-- Run by the operator in the Supabase SQL editor (prod writes are manual — never via MCP).
-- MERGE, not overwrite: every phrase of the previous value is preserved; only the
-- grace foundation + the "undergirds quietly" rule are added. Doctrine: brand-guide §1.6.
-- Read-back of the previous value (2026-10-30):
--   "Christian faith is the foundation — family-first, traditional values. Honest, hardworking,
--    accountable. Blue-collar DIY mindset: fix it yourself, take pride in the craft. Patriotic.
--    Faith shapes how I write — grounded, steady, no cynicism — never as sermon inserts."

begin;

update public.voice_profiles
set
  faith_values = $faith$Christian faith is the foundation — and the ground under that faith is grace: I am saved by grace through faith, a gift received, not earned by works, willpower, or moral performance (Ephesians 2:8-9). I lived the exhausting earn-your-standing cycle and this is what ended it — it gave me a real relationship with God and a renewed appreciation for every gift He has given me. It is central to why I built this site. I lead my home from that secured identity: protecting, providing, teaching, and modeling it for my family — gently, consistently, never by coercion. Family-first, traditional values. Honest, hardworking, accountable. Blue-collar DIY mindset: fix it yourself, take pride in the craft. Patriotic. Faith shapes how I write — grounded, steady, no cynicism, invitational and never preachy. It undergirds the writing quietly and surfaces only when the subject earns it — never as sermon inserts, never as debate, never as a verdict on another man's walk.$faith$,
  updated_at   = now()
where user_id = (select id from auth.users where email = 'boss@bossdaddylife.com');

-- Expect exactly 1 row.
select u.email, vp.faith_values, vp.updated_at
from public.voice_profiles vp
join auth.users u on u.id = vp.user_id
where u.email = 'boss@bossdaddylife.com';

commit;
