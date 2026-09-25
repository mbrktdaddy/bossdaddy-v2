import * as React from 'react'

// The one email shell: dark canvas, 560px card, logo header, body, footer.
// Every template in emails/ renders inside <EmailLayout> and uses <EmailButton>
// for its CTA — so the brand frame changes in one place.
//
// Plain HTML tables + inline styles, no @react-email/components — that
// dependency isn't installed and importing it makes the render fail silently
// at send time (see feedback_resend_from_email_gotcha).

export const EMAIL_COLORS = {
  canvas:  '#0a0a0a',
  card:    '#111111',
  header:  '#111114',
  footer:  '#0d0d0d',
  line:    '#222226',
  orange:  '#CC5500',
  heading: '#ffffff',
  text:    '#9ca3af',
  faint:   '#6b7280',
  fainter: '#4b5563',
  link:    '#f48a4a',
} as const

const C = EMAIL_COLORS

export const DEFAULT_SITE_URL = 'https://www.bossdaddylife.com'

/** Footer paragraph + link styles — use these for any footer copy. */
export const footerText: React.CSSProperties = { color: C.fainter, fontSize: '12px', margin: 0, lineHeight: 1.6 }
export const footerLink: React.CSSProperties = { color: C.faint, textDecoration: 'none' }

interface EmailLayoutProps {
  siteUrl?: string
  /** Footer contents (why-you-got-this, unsubscribe/manage links). Styled by the shell. */
  footer: React.ReactNode
  children: React.ReactNode
}

export function EmailLayout({ siteUrl = DEFAULT_SITE_URL, footer, children }: EmailLayoutProps) {
  return (
    <html>
      <head>
        <meta name='viewport' content='width=device-width, initial-scale=1.0' />
      </head>
      <body style={{ backgroundColor: C.canvas, margin: 0, padding: 0, fontFamily: 'Arial, sans-serif' }}>
        <table width='100%' cellPadding={0} cellSpacing={0} style={{ backgroundColor: C.canvas, padding: '40px 20px' }}>
          <tr>
            <td align='center'>
              <table width='560' cellPadding={0} cellSpacing={0} style={{ backgroundColor: C.card, borderRadius: '12px', overflow: 'hidden', maxWidth: '560px', width: '100%' }}>

                {/* Header */}
                <tr>
                  <td style={{ backgroundColor: C.header, padding: '24px 40px', borderBottom: `1px solid ${C.line}` }}>
                    <table cellPadding={0} cellSpacing={0}>
                      <tr>
                        <td style={{ paddingRight: '12px', verticalAlign: 'middle' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`${siteUrl}/images/bd-logo-icon.png`} alt='Boss Daddy' width={36} height={36} style={{ display: 'block' }} />
                        </td>
                        <td style={{ verticalAlign: 'middle' }}>
                          <p style={{ margin: 0, color: C.orange, fontWeight: 900, fontSize: '20px', letterSpacing: '-0.5px' }}>
                            BOSS DADDY LIFE
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                {/* Body */}
                <tr>
                  <td style={{ padding: '40px' }}>{children}</td>
                </tr>

                {/* Footer */}
                <tr>
                  <td style={{ backgroundColor: C.footer, padding: '24px 40px', borderTop: `1px solid ${C.line}` }}>
                    {footer}
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  )
}

/** Bulletproof table-cell CTA button. */
export function EmailButton({ href, children, style }: { href: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <table cellPadding={0} cellSpacing={0} style={{ margin: '8px 0 0 0', ...style }}>
      <tr>
        <td style={{ backgroundColor: C.orange, borderRadius: '8px' }}>
          <a
            href={href}
            style={{ display: 'inline-block', padding: '14px 28px', color: '#ffffff', fontWeight: 700, fontSize: '15px', textDecoration: 'none' }}
          >
            {children}
          </a>
        </td>
      </tr>
    </table>
  )
}
