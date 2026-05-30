'use client'

// The actionable core of the /install page. Unlike the opportunistic banner
// and the menu button (which render NOTHING when no native prompt is ready),
// this ALWAYS shows something useful — it's the robust anchor every other
// surface links to. Three states:
//   - already installed  → a confirming "you're all set" panel
//   - native prompt ready → a one-tap "Get the App" button (Chrome/Android/Edge)
//   - everything else     → platform-specific manual instructions, so iOS
//     Safari, pre-engagement Chrome, and unsupported browsers all get a path.
// Install state comes from the root PwaInstallProvider.

import { useState } from 'react'
import { usePwaInstall } from '@/components/pwa/PwaInstallProvider'

function StepList({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="shrink-0 w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <span className="text-sm text-prose-muted leading-snug pt-0.5">{step}</span>
        </li>
      ))}
    </ol>
  )
}

export default function InstallCta() {
  const { canPrompt, isStandalone, isIOSSafari, promptInstall } = usePwaInstall()
  const [installed, setInstalled] = useState(false)

  // Already running as an installed app — nothing left to do.
  if (isStandalone || installed) {
    return (
      <div className="bg-surface border border-soft rounded-2xl p-6 sm:p-8 flex items-start gap-4">
        <svg className="w-7 h-7 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        <div>
          <p className="font-black text-prose text-lg leading-tight">You&apos;re all set.</p>
          <p className="text-sm text-prose-muted leading-snug mt-1">
            Boss Daddy is on your home screen — tap the icon any time to jump right back in.
          </p>
        </div>
      </div>
    )
  }

  async function handleInstall() {
    const ok = await promptInstall()
    if (ok) setInstalled(true)
  }

  return (
    <div className="bg-surface border border-soft rounded-2xl p-6 sm:p-8">
      {/* Native one-tap path — Chrome, Edge, Android. */}
      {canPrompt && (
        <div className="mb-6">
          <button
            type="button"
            onClick={handleInstall}
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-extrabold text-sm px-7 py-3.5 rounded-xl transition-colors min-h-[44px]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0-4-4m4 4 4-4M4 20h16" />
            </svg>
            Get the App
          </button>
          <p className="text-xs text-prose-faint mt-3">One tap — no app store, no download wait.</p>
        </div>
      )}

      {/* Manual instructions. Always shown when there's no live prompt; also a
          quiet reference even when the button exists, in case the dialog is
          dismissed. */}
      {isIOSSafari ? (
        <>
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-4">Add it on iPhone or iPad</p>
          <StepList
            steps={[
              <>Tap the <span className="font-semibold text-prose">Share</span> button at the bottom of Safari.</>,
              <>Scroll down and tap <span className="font-semibold text-prose">Add to Home Screen</span>.</>,
              <>Tap <span className="font-semibold text-prose">Add</span> — the Boss Daddy icon lands on your home screen.</>,
            ]}
          />
        </>
      ) : !canPrompt ? (
        <>
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-4">Add it from your browser</p>
          <StepList
            steps={[
              <>Open your browser menu (<span className="font-semibold text-prose">⋮</span> on Android Chrome, or the install icon in the address bar on desktop).</>,
              <>Tap <span className="font-semibold text-prose">Install app</span> or <span className="font-semibold text-prose">Add to Home screen</span>.</>,
              <>Confirm — the Boss Daddy icon lands on your home screen.</>,
            ]}
          />
          <p className="text-xs text-prose-faint mt-4 leading-snug">
            Don&apos;t see the option? Some browsers only offer it after you&apos;ve looked around for a moment — come back to this page and the one-tap button will appear.
          </p>
        </>
      ) : null}
    </div>
  )
}
