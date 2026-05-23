import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth-cache'
import RoleSelector from './_components/RoleSelector'
import ModerationActions from './_components/ModerationActions'

type AccountStatus = 'active' | 'suspended' | 'banned' | 'pending_deletion'

export default async function UsersPage() {
  const me = await requireAdmin()
  const supabase = await createClient()

  const { data: users } = await supabase
    .from('profiles')
    .select('id, username, role, created_at, account_status, suspended_until, moderation_reason')
    .order('created_at', { ascending: false })

  const counts = {
    total:   users?.length ?? 0,
    admin:   users?.filter(u => u.role === 'admin').length ?? 0,
    author:  users?.filter(u => u.role === 'author').length ?? 0,
    member:  users?.filter(u => u.role === 'member').length ?? 0,
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black">User Management</h1>
        <p className="text-prose-faint text-sm mt-1">Manage roles and permissions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {[
          { label: 'Total',   value: counts.total,  color: 'text-prose' },
          { label: 'Admins',  value: counts.admin,  color: 'text-red-600' },
          { label: 'Authors', value: counts.author, color: 'text-accent-text-soft' },
          { label: 'Members', value: counts.member, color: 'text-prose-muted' },
        ].map((s) => (
          <div key={s.label} className="bg-surface border border-soft rounded-xl px-5 py-4">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-prose-faint mt-1 uppercase tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-3 gap-3 mb-8 text-xs">
        {[
          { role: 'admin',  color: 'text-red-600',    bg: 'bg-red-50 border-red-200',       desc: 'Full access. Moderate content, manage users.' },
          { role: 'author', color: 'text-accent-text-soft', bg: 'bg-accent-tint border-accent-border/40', desc: 'Create reviews and articles. Comment and like.' },
          { role: 'member', color: 'text-prose-muted',   bg: 'bg-surface border-soft',           desc: 'Comment and like. Cannot create content.' },
        ].map(r => (
          <div key={r.role} className={`rounded-xl border px-4 py-3 ${r.bg}`}>
            <p className={`font-bold uppercase tracking-wide mb-1 ${r.color}`}>{r.role}</p>
            <p className="text-prose-faint leading-relaxed">{r.desc}</p>
          </div>
        ))}
      </div>

      {/* Users list */}
      <div className="space-y-2">
        {users?.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between p-4 bg-surface border border-soft rounded-xl"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center text-sm font-bold text-white shrink-0">
                {u.username[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">@{u.username}</p>
                <p className="text-xs text-prose-faint">
                  Joined {new Date(u.created_at ?? '').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ModerationActions
                userId={u.id}
                username={u.username}
                status={(u.account_status ?? 'active') as AccountStatus}
                suspendedUntil={u.suspended_until ?? null}
                reason={u.moderation_reason ?? null}
                isSelf={u.id === me.id}
              />
              <RoleSelector userId={u.id} currentRole={u.role} isSelf={u.id === me.id} />
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
