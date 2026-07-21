import { APICallError, NoObjectGeneratedError, NoOutputGeneratedError } from 'ai'

// Consolidates the timeout/overload error-classification regex that was
// copy-pasted across the Claude routes, and maps AI SDK error types
// (APICallError statusCode, NoObjectGeneratedError) to safe, stable responses.
//
// `detail` is for SERVER LOGS ONLY — never return it to the client (raw provider
// error text can leak internals; see audit A6). Send `userMessage` + `status`.

export type AiErrorKind =
  | 'timeout'
  | 'overload'
  | 'rate_limit'
  | 'budget'
  | 'truncated'
  | 'no_object'
  | 'unknown'

export interface ClassifiedAiError {
  kind: AiErrorKind
  /** Suggested HTTP status for the route's JSON response. */
  status: number
  /** Safe, user-facing message — no internal detail or secrets. */
  userMessage: string
  /** Short internal detail for server logs ONLY. Never send to the client. */
  detail: string
}

// User-facing copy, kept in the Boss Daddy register and matching the wording the
// Claude routes used before consolidation (502 preserved for timeout/overload so
// existing client handling is unchanged).
const MSG: Record<AiErrorKind, string> = {
  timeout: 'Generation timed out — the AI is busy. Please wait a moment and try again.',
  overload: 'The AI service is currently overloaded. Please try again in a minute.',
  rate_limit: 'Too many requests right now — slow down and try again shortly.',
  budget: 'The AI service is temporarily unavailable. Please try again later.',
  truncated: 'The response ran long and got cut off. Try again, or shorten the request.',
  no_object: 'The AI returned an unexpected format — please try again.',
  unknown: 'AI service error — please try again.',
}

function detailOf(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 200)
}

function classified(kind: AiErrorKind, status: number, detail: string): ClassifiedAiError {
  return { kind, status, userMessage: MSG[kind], detail }
}

/**
 * Normalize any error thrown by an AI SDK call into a stable classification.
 * Use in a route's catch: log `detail`, return `{ error: userMessage }` with `status`.
 */
export function classifyClaudeError(err: unknown): ClassifiedAiError {
  const detail = detailOf(err)

  // Schema/format failures — generateObject throws this. `length` finish means
  // the model was cut off mid-object (truncation); anything else is an
  // unparseable / unexpected response.
  if (NoObjectGeneratedError.isInstance(err)) {
    return err.finishReason === 'length'
      ? classified('truncated', 502, detail)
      : classified('no_object', 502, detail)
  }

  // generateText + `Output.object` (the research bucket) throws this when the run
  // ended without producing the structured output — same class of failure.
  if (NoOutputGeneratedError.isInstance(err)) {
    return classified('no_object', 502, detail)
  }

  // Transport / provider errors surfaced by the gateway.
  if (APICallError.isInstance(err)) {
    const code = err.statusCode
    if (code === 429) return classified('rate_limit', 429, detail)
    if (code === 402) return classified('budget', 503, detail)
    if (code === 408 || code === 504 || /timeout|timed.?out|deadline/i.test(detail)) {
      return classified('timeout', 502, detail)
    }
    if (code === 529 || (code != null && code >= 500) || /overload|capacity/i.test(detail)) {
      return classified('overload', 502, detail)
    }
    return classified('unknown', 502, detail)
  }

  // Non-SDK errors — preserve the legacy message-regex classification.
  if (/timeout|timed.?out|deadline/i.test(detail)) return classified('timeout', 502, detail)
  if (/overload|529|capacity/i.test(detail)) return classified('overload', 502, detail)

  return classified('unknown', 502, detail)
}
