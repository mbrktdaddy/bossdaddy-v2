import Link from 'next/link'
import { requireAdmin } from '@/lib/auth-cache'
import { listMerchDesigns } from '@/lib/merch/designs-store'
import { MerchStudio } from './_components/MerchStudio'

export const dynamic = 'force-dynamic'

export default async function MerchStudioPage() {
  await requireAdmin()

  // merch_designs may not exist yet if migration 116 hasn't been applied — fail
  // soft to an empty list so the generator still works before the table lands.
  let approved: Awaited<ReturnType<typeof listMerchDesigns>> = []
  try {
    approved = await listMerchDesigns()
  } catch {
    approved = []
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <Link href="/dashboard/admin/merch" className="text-xs text-prose-faint hover:text-prose">
          ← Merch
        </Link>
        <h1 className="text-2xl font-black mt-2">Merch Studio</h1>
        <p className="text-prose-faint text-sm mt-1">
          Generate on-brand sayings, then approve the ones worth turning into designs. You&apos;re the editor —
          nothing ships without your sign-off.
        </p>
      </div>

      <MerchStudio initialApproved={approved.map((d) => ({
        id: d.id,
        title: d.title,
        content: d.content as { text?: string; subline?: string; angle?: string },
        ip_flag: d.ip_flag,
        status: d.status,
        template_key: (d.template_key as 'statement' | 'stacked' | 'wordmark' | 'logo' | null) ?? null,
        template_config: (d.template_config as { colorway?: 'dark' | 'light'; blank?: 'tee' | 'hat' | 'mug' }) ?? {},
        published: (d.published ?? []) as { blank: string; sync_product_id: number; mockups?: string[] }[],
      }))} />
    </div>
  )
}
