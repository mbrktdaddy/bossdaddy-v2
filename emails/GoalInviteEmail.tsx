import * as React from 'react'
import { EmailLayout, EmailButton, footerText, footerLink, DEFAULT_SITE_URL } from './_components/EmailLayout'

interface Props {
  inviterName: string          // "Mark" or "@mark"
  goalTitle:   string
  tierLabel:   string          // "Cheer him on" / "Be his witness" / "Do it with him"
  tierSees:    string          // exactly what this tier can see
  tierBlind:   string          // and what it can't
  acceptUrl:   string
  siteUrl?:    string
}

// Sent when a goal owner puts an email on an invite, or picks someone he already
// talks to. It carries the REAL goal title — an operator decision, taken knowingly:
// the same call was made for the .ics feed, and the reasoning is that a vague
// "someone invited you to something" is worse than useless to the person deciding
// whether to say yes.
//
// WHAT THIS EMAIL IS NOT: it is the ONLY message a partner ever receives about a
// goal. Once they accept, nothing is ever sent to them again — not a missed day,
// not a streak, not a relapse. Migration 137's header is the full reasoning; the
// short version is that a push to a man's wife saying he missed his meds is a
// surveillance product, and this isn't one. The line at the bottom says so out
// loud, because the person reading this is entitled to know what they're agreeing
// to receive before they agree to it.
//
// The tier copy is passed in from lib/goals/participants.ts TIER_COPY rather than
// re-written here, so what the invitee reads in their inbox is word-for-word what
// the owner picked on the share screen.
export function GoalInviteEmail({
  inviterName,
  goalTitle,
  tierLabel,
  tierSees,
  tierBlind,
  acceptUrl,
  siteUrl = DEFAULT_SITE_URL,
}: Props) {
  return (
    <EmailLayout
      siteUrl={siteUrl}
      footer={
        <p style={footerText}>
          Boss Daddy Life · <a href={siteUrl} style={footerLink}>bossdaddylife.com</a>
        </p>
      }
    >
      <p style={{ color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 700, margin: '0 0 8px 0' }}>
        He asked for you
      </p>
      <h1 style={{ color: '#ffffff', fontSize: '24px', fontWeight: 800, margin: '0 0 16px 0', lineHeight: 1.3 }}>
        {inviterName} wants you in his corner.
      </h1>
      <p style={{ color: '#9ca3af', fontSize: '15px', lineHeight: 1.6, margin: '0 0 20px 0' }}>
        He&apos;s working on <strong style={{ color: '#ffffff' }}>{goalTitle}</strong> and
        picked you to keep him honest about it.
      </p>

      <table width='100%' cellPadding={0} cellSpacing={0} style={{ margin: '0 0 24px 0', backgroundColor: '#18181b', borderRadius: '8px', border: '1px solid #27272a' }}>
        <tr>
          <td style={{ padding: '16px 20px' }}>
            <p style={{ color: '#ffffff', fontSize: '14px', fontWeight: 700, margin: '0 0 6px 0' }}>
              {tierLabel}
            </p>
            <p style={{ color: '#9ca3af', fontSize: '13px', lineHeight: 1.6, margin: '0 0 4px 0' }}>
              {tierSees}
            </p>
            <p style={{ color: '#6b7280', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
              {tierBlind}
            </p>
          </td>
        </tr>
      </table>

      <EmailButton href={acceptUrl}>See what he&apos;s asking →</EmailButton>

      <p style={{ color: '#6b7280', fontSize: '12px', margin: '24px 0 0 0', lineHeight: 1.5 }}>
        This is the only email you&apos;ll get about it. Say yes and you can look
        whenever you like, but nothing is ever sent to you about a day he missed —
        and you can step out any time without asking him.
      </p>
      <p style={{ color: '#6b7280', fontSize: '12px', margin: '12px 0 0 0', lineHeight: 1.5 }}>
        Link expires in 7 days. If you don&apos;t know {inviterName}, ignore this —
        the invite quietly expires on its own.
      </p>
    </EmailLayout>
  )
}
