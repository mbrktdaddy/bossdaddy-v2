import * as React from 'react'

// The one email shell (Hard Goods, light): grey canvas, white 560px card, black masthead
// with a 4px orange rule, body, footer. Palette follows brand-guide §2 light-page tokens.
// Every template in emails/ renders inside <EmailLayout> and uses <EmailButton>
// for its CTA — so the brand frame changes in one place.
//
// Plain HTML tables + inline styles, no @react-email/components — that
// dependency isn't installed and importing it makes the render fail silently
// at send time (see feedback_resend_from_email_gotcha).

export const EMAIL_COLORS = {
  canvas:  '#f4f4f5',
  card:    '#ffffff',
  header:  '#09090b',
  footer:  '#fafafa',
  line:    '#e4e4e7',
  orange:  '#CC5500',
  heading: '#18181b',
  text:    '#52525b',
  faint:   '#71717a',
  fainter: '#71717a',
  link:    '#B85A14',
  ink:     '#09090b',
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
              <table width='560' cellPadding={0} cellSpacing={0} style={{ backgroundColor: C.card, borderRadius: '4px', overflow: 'hidden', maxWidth: '560px', width: '100%' }}>

                {/* Header */}
                <tr>
                  <td style={{ backgroundColor: C.header, padding: '20px 40px', borderBottom: `4px solid ${C.orange}` }}>
                    <table cellPadding={0} cellSpacing={0}>
                      <tr>
                        <td style={{ paddingRight: '12px', verticalAlign: 'middle' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`${siteUrl}/images/bd-logo-icon.png`} alt='Boss Daddy' width={36} height={36} style={{ display: 'block' }} />
                        </td>
                        <td style={{ verticalAlign: 'middle' }}>
                          <p style={{ margin: 0, color: '#ffffff', fontWeight: 900, fontSize: '20px', letterSpacing: '-0.5px' }}>
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
        <td style={{ backgroundColor: C.ink, borderRadius: '4px' }}>
          <a
            href={href}
            style={{ display: 'inline-block', padding: '14px 28px', color: '#ffffff', fontWeight: 800, fontSize: '14px', letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none' }}
          >
            {children}
          </a>
        </td>
      </tr>
    </table>
  )
}
