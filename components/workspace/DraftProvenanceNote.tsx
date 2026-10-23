// Two facts about a generation the author should see before saving it:
//   • what it cost (list-price estimate from the generations log, mig 164)
//   • whether the voice profile was actually found — the common cause of a
//     flat, generic draft is drafting while signed in as the wrong account
//     (the author profile lives on boss@, not the test gmail).
// Rendered inside the wizards' preview card; nothing here is interactive.

interface Props {
  costUsd: number | null
  voice: { hasProfile: boolean; phraseCount: number } | null
}

export function DraftProvenanceNote({ costUsd, voice }: Props) {
  const missingVoice = voice != null && !voice.hasProfile
  if (costUsd == null && !missingVoice) return null

  return (
    <div className="space-y-1">
      {missingVoice && (
        <p className="text-xs text-warn-ink">
          No voice profile found for this account — the draft was written without your background, family facts or phrases.
          If you&apos;re signed in as a test account, discard this and draft as the author.
        </p>
      )}
      {costUsd != null && (
        <p className="text-xs text-prose-faint">
          Generated for about ${costUsd.toFixed(2)}
          {voice && voice.hasProfile && voice.phraseCount > 0 ? ` · ${voice.phraseCount} signature phrases in play` : ''}
        </p>
      )}
    </div>
  )
}
