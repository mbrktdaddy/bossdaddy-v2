'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  admin:  { label: 'Admin',  color: 'text-danger-ink' },
  author: { label: 'Author', color: 'text-accent-text-soft' },
  member: { label: 'Member', color: 'text-prose-muted' },
}

interface Props {
  userId: string
  currentRole: string
  isSelf: boolean
}

export default function RoleSelector({ userId, currentRole, isSelf }: Props) {
  const router = useRouter()
  const [role, setRole] = useState(currentRole)
  const [loading, setLoading] = useState(false)

  async function handleChange(newRole: string) {
    if (newRole === role) return
    setLoading(true)
    const res = await fetch('/api/admin/users/role', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: newRole }),
    })
    if (res.ok) {
      setRole(newRole)
      router.refresh()
    }
    setLoading(false)
  }

  const cfg = ROLE_CONFIG[role] ?? ROLE_CONFIG.member

  if (isSelf) {
    return (
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface-raised border border-strong ${cfg.color}`}>
          {cfg.label}
        </span>
        <span className="text-xs text-prose-faint">You</span>
      </div>
    )
  }

  return (
    <select
      value={role}
      onChange={e => handleChange(e.target.value)}
      disabled={loading}
      className={`px-3 py-1.5 rounded-lg bg-surface-raised border border-strong text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-accent-hover disabled:opacity-50 cursor-pointer transition-colors ${cfg.color}`}
    >
      <option value="member">Member</option>
      <option value="author">Author</option>
      <option value="admin">Admin</option>
    </select>
  )
}
