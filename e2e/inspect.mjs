// Ad-hoc DB peek while walking the browser pass.
// Run: node --env-file=.env.local e2e/inspect.mjs <goalId>
import { createClient } from '@supabase/supabase-js'

const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const id = process.argv[2]

const { data: g } = await a.from('goals')
  .select('id,title,status,started_on,target_date,metric_key,config').eq('id', id).maybeSingle()
console.log('GOAL', g)

const { data: s } = await a.from('goal_schedules')
  .select('id,rrule,timezone,local_time,channels,muted').eq('goal_id', id)
console.log('SCHEDULES', s)

const { data: o, error: oe } = await a.from('goal_occurrences')
  .select('id,local_date,due_at,local_time,status,target_value').eq('goal_id', id).order('due_at').limit(6)
console.log('OCCURRENCES', oe ?? o)

const { data: e2, error: ee } = await a.from('goal_entries')
  .select('id,kind,value,logged_at,occurrence_id,logged_by').eq('goal_id', id).order('logged_at')
console.log('ENTRIES', ee ?? e2)

console.log('now utc  ', new Date().toISOString())
console.log('now local', new Date().toString())
