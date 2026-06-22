import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth-cache'
import ModerationActions from '../../users/_components/ModerationActions'
import ReportActions from './_components/ReportActions'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Reports — Admin' }

type ReportStatus = 'open' | 'reviewed' | 'dismissed'
type AccountStatus = 'active' | 'suspended' | 'banned' | 'pending_deletion'

const STATUS_BADGE: Record<ReportStatus, { label: string; cls: string }> = {
  open:      { label: 'Open',      cls: 'bg-warn-bg border-warn-line text-warn-ink' },
  reviewed:  { label: 'Reviewed',  cls: 'bg-success-bg border-success-line text-forest' },
  dismissed: { label: 'Dismissed', cls: 'bg-surface-raised border-strong text-prose-muted' },
}

const STATUS_ORDER: Record<ReportStatus, number> = { open: 0, reviewed: 1, dismissed: 2 }

interface ReportRow {
  id: string
  reporter_id: string
  reported_user_id: string | null
  message_id: string | null
  conversation_id: string | null
  reason: string
  note: string | null
  status: ReportStatus
  created_at: string
}
interface ProfileRow {
  id: string
  username: string
  account_status: AccountStatus | null
  suspended_until: string | null
  moderation_reason: string | null
}
interface MessageRow { id: string; body: string; sender_id: string; created_at: string }

export default async function AdminReportsPage() {
  const me = await requireAdmin()
  // service-role: abuse_reports is admin-only, and messages/conversations are
  // now participant-only (migs 107) — admin reads reported content here via the
  // auditable service-role client, per the moderation-only doctrine.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: rawReports, error } = await admin
    .from('abuse_reports')
    .select('id, reporter_id, reported_user_id, message_id, conversation_id, reason, note, status, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return <div className="p-8"><p className="text-danger-ink text-sm">Failed to load reports: {error.message}</p></div>
  }

  const reports = ((rawReports ?? []) as ReportRow[]).sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      || (a.created_at < b.created_at ? 1 : -1),
  )

  const userIds = Array.from(new Set(
    reports.flatMap((r) => [r.reporter_id, r.reported_user_id]).filter((x): x is string => !!x),
  ))
  const messageIds = Array.from(new Set(reports.map((r) => r.message_id).filter((x): x is string => !!x)))

  const [{ data: profileRows }, { data: messageRows }] = await Promise.all([
    userIds.length
      ? admin.from('profiles').select('id, username, account_status, suspended_until, moderation_reason').in('id', userIds)
      : Promise.resolve({ data: [] }),
    messageIds.length
      ? admin.from('messages').select('id, body, sender_id, created_at').in('id', messageIds)
      : Promise.resolve({ data: [] }),
  ])

  const profileById = new Map<string, ProfileRow>(((profileRows ?? []) as ProfileRow[]).map((p) => [p.id, p]))
  const messageById = new Map<string, MessageRow>(((messageRows ?? []) as MessageRow[]).map((m) => [m.id, m]))

  const openCount = reports.filter((r) => r.status === 'open').length

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-black">Reports</h1>
        <p className="text-prose-faint text-sm mt-1">
          {openCount} open · {reports.length} total
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="bg-surface border border-soft rounded-xl p-12 text-center">
          <p className="text-prose-muted text-lg font-semibold mb-2">No reports.</p>
          <p className="text-prose-faint text-sm">Member reports of abusive content will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((r) => {
            const reporter = profileById.get(r.reporter_id)
            const reported = r.reported_user_id ? profileById.get(r.reported_user_id) : null
            const message = r.message_id ? messageById.get(r.message_id) : null
            const badge = STATUS_BADGE[r.status]
            const date = new Date(r.created_at).toLocaleString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
            })
            return (
              <div
                key={r.id}
                className={`bg-surface border rounded-xl p-5 space-y-4 ${r.status === 'open' ? 'border-warn-line/60' : 'border-soft'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${badge.cls}`}>
                        {badge.label}
                      </span>
                      <span className="text-sm font-bold text-prose">{r.reason}</span>
                    </div>
                    <p className="text-xs text-prose-faint mt-1">{date}</p>
                  </div>
                  <ReportActions reportId={r.id} status={r.status} />
                </div>

                {r.note && (
                  <p className="text-sm text-prose-muted leading-snug border-l-2 border-strong pl-3">
                    {r.note}
                  </p>
                )}

                {/* Reported message content in context (service-role read) */}
                {r.message_id && (
                  <div className="bg-surface-sunken border border-soft rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-widest text-prose-faint font-semibold mb-1">
                      Reported message
                    </p>
                    {message ? (
                      <p className="text-sm text-prose whitespace-pre-wrap break-words">{message.body}</p>
                    ) : (
                      <p className="text-sm text-prose-faint italic">Message deleted.</p>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 flex-wrap text-xs text-prose-faint pt-1 border-t border-soft">
                  <span>
                    Reporter:{' '}
                    <span className="text-prose-muted font-medium">
                      {reporter ? `@${reporter.username}` : 'unknown'}
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span>
                      Reported:{' '}
                      <span className="text-prose-muted font-medium">
                        {reported ? `@${reported.username}` : (r.reported_user_id ? 'deleted user' : 'n/a')}
                      </span>
                    </span>
                    {reported && (
                      <ModerationActions
                        userId={reported.id}
                        username={reported.username}
                        status={(reported.account_status ?? 'active') as AccountStatus}
                        suspendedUntil={reported.suspended_until ?? null}
                        reason={reported.moderation_reason ?? null}
                        isSelf={reported.id === me.id}
                      />
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
