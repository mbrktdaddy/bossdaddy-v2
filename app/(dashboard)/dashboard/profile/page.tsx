import { redirect } from 'next/navigation'

// Retired: personal profile + account now live at /account/settings for EVERY
// role (members, authors, admins) — the dashboard is workspace-only. This
// route stays as a redirect so old links/bookmarks land in the right place.
// (The author "Public Author Profile" editor moved into /account/settings; the
// Voice Profile tool stays in the dashboard at /dashboard/profile/voice.)
export default function DashboardProfileRedirect() {
  redirect('/account/settings')
}
