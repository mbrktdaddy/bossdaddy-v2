-- ─────────────────────────────────────────────────────────────────────────────
-- 092_ai_jobs — async job records for long-running AI calls (specs-grade first).
--
-- WHY: web-grounded specs grading runs 1-3 min. Holding the client request open
-- that long is fragile (overloads, timeouts, the Vercel maxDuration wall, no
-- recovery if the tab blips). Instead the endpoint creates a job row, runs the
-- work in the background (Next.js `after()`), and the client polls this table.
--
-- User-owned data: the owner (or admin) reads their own jobs. WRITES happen
-- server-side only via the service-role client (job creation + the background
-- task), so there is intentionally NO user write policy.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists ai_jobs (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users on delete cascade,
  kind        text        not null,                 -- 'specs_grade' (more kinds later)
  status      text        not null default 'pending'
                            check (status in ('pending', 'running', 'done', 'error')),
  input       jsonb       not null default '{}'::jsonb,
  result      jsonb,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Poll/list shape: a user's jobs, newest first.
create index if not exists idx_ai_jobs_user on ai_jobs (user_id, created_at desc);
-- Supports a future cleanup cron ("delete done/error jobs older than N days").
create index if not exists idx_ai_jobs_status_created on ai_jobs (status, created_at);

alter table ai_jobs enable row level security;

-- Owner (or admin) can read their own jobs — that's all the client poll needs.
create policy "ai_jobs_read"
  on ai_jobs for select
  to authenticated
  using (user_id = auth.uid() or is_admin());

-- No insert/update/delete policy on purpose: only the service-role client
-- (server-side) creates jobs and writes their results.
