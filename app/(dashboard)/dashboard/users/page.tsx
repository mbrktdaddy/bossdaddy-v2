import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth-cache'
import RoleSelector from './_components/RoleSelector'

export default async function UsersPage() {
  const me = await requireAdmin()
  const supabase = await createClient()

  const { data: users } = await supabase
    .from('profiles')
    .select('id, username, role, created_at')
    .order('created_at', { ascending: false })

  const counts = {
    total:   users?.length ?? 0,
    admin:   users?.filter(u => u.role === 'admin').length ?? 0,
    author:  users?.filter(u => u.role === 'author').length ?? 0,
    member:  users?.filter(u => u.role === 'member').length ?? 0,
  }

  return (
    <div className="p-8 max-w-4xl">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black">User Management</h1>
        <p className="text-gray-500 text-sm mt-1">Manage roles and permissions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total',   value: counts.total,  color: 'text-white' },
          { label: 'Admins',  value: counts.admin,  color: 'text-red-400' },
          { label: 'Authors', value: counts.author, color: 'text-orange-400' },
          { label: 'Members', value: counts.member, color: 'text-gray-400' },
        ].map((s) => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-3 gap-3 mb-8 text-xs">
        {[
          { role: 'admin',  color: 'text-red-400',    bg: 'bg-red-950/30 border-red-900/40',       desc: 'Full access. Moderate content, manage users.' },
          { role: 'author', color: 'text-orange-400', bg: 'bg-orange-950/30 border-orange-900/40', desc: 'Create reviews and articles. Comment and like.' },
          { role: 'member', color: 'text-gray-400',   bg: 'bg-gray-900 border-gray-800',           desc: 'Comment and like. Cannot create content.' },
        ].map(r => (
          <div key={r.role} className={`rounded-xl border px-4 py-3 ${r.bg}`}>
            <p className={`font-bold uppercase tracking-wide mb-1 ${r.color}`}>{r.role}</p>
            <p className="text-gray-500 leading-relaxed">{r.desc}</p>
          </div>
        ))}
      </div>

      {/* Users list */}
      <div className="space-y-2">
        {users?.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-2xl"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                {u.username[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">@{u.username}</p>
                <p className="text-xs text-gray-600">
                  Joined {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>
            <RoleSelector userId={u.id} currentRole={u.role} isSelf={u.id === me.id} />
          </div>
        ))}
      </div>

    </div>
  )
}
