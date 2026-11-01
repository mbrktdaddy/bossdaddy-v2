import { APICallError, NoObjectGeneratedError, NoOutputGeneratedError, RetryError, type LanguageModelUsage } from 'ai'

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
  /**
   * Token usage of the failed call when the SDK reports it (NoObjectGeneratedError
   * carries it). A truncated or schema-failed call is still billed — pass this
   * to `failedCallMeta` so the `generations` row and the cost chip count it.
   */
  usage?: LanguageModelUsage
  /**
   * The first part of the model's raw text on a schema/parse failure, for the
   * `generations` row's `output` — the only way to tell a truncated object from
   * one that broke a `.max()` constraint. Logs only; never sent to the client.
   */
  rawText?: string
}

// Stored on the failed `generations` row only (never sent to the client). The
// old 2000 clipped a critic answer mid-summary, which hid the field that broke
// the schema (2026-10-31); 12k covers every structured answer the pipeline asks
// for, so the whole object is recoverable from the row.
const RAW_TEXT_LIMIT = 12_000

/**
 * The schema issues behind a NoObjectGeneratedError, as `path: message` lines.
 * The SDK wraps the zod error two levels down (NoObjectGeneratedError → 
 * TypeValidationError → ZodError) and TypeValidationError's own message
 * embeds the whole value, so the issues are the only readable part. Duck-typed
 * walk of `cause`, first three issues, so the console line and the failed row
 * say WHICH field broke instead of "did not match schema".
 */
function schemaIssues(err: unknown): string {
  let cur: unknown = err
  for (let depth = 0; depth < 4 && cur && typeof cur === 'object'; depth++) {
    const issues = (cur as { issues?: unknown }).issues
    if (Array.isArray(issues) && issues.length) {
      return issues.slice(0, 3).map((i) => {
        const path = Array.isArray((i as { path?: unknown }).path) ? ((i as { path: unknown[] }).path).join('.') : ''
        const message = String((i as { message?: unknown }).message ?? '')
        return path ? `${path}: ${message}` : message
      }).join('; ')
    }
    cur = (cur as { cause?: unknown }).cause
  }
  return ''
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

/**
 * The HTTP status on a provider or Gateway error. Duck-typed: the Gateway's own
 * GatewayError (rate limit, timeout, internal) carries `statusCode` like
 * APICallError does, but `ai` doesn't re-export it.
 */
function statusOf(err: unknown): number | null {
  const code = (err as { statusCode?: unknown } | null)?.statusCode
  return typeof code === 'number' ? code : null
}

function detailOf(err: unknown): string {
  const status = statusOf(err)
  const name = (err as { name?: unknown } | null)?.name
  const message = err instanceof Error ? err.message : String(err)
  // Status and error class first: "unknown - Delay was aborted" told us nothing.
  return `${status != null ? `[${status}] ` : ''}${typeof name === 'string' && name !== 'Error' ? `${name}: ` : ''}${message}`.slice(0, 300)
}

function classified(kind: AiErrorKind, status: number, detail: string): ClassifiedAiError {
  return { kind, status, userMessage: MSG[kind], detail }
}

/**
 * Normalize any error thrown by an AI SDK call into a stable classification.
 * Use in a route's catch: log `detail`, return `{ error: userMessage }` with `status`.
 */
export function classifyClaudeError(err: unknown): ClassifiedAiError {
  // The SDK's own retries ran out: classify the last real failure, not the wrapper.
  if (RetryError.isInstance(err) && err.lastError != null) {
    const last = classifyClaudeError(err.lastError)
    return { ...last, detail: `after ${err.errors.length} attempts: ${last.detail}`.slice(0, 300) }
  }

  const detail = detailOf(err)

  // The call's `timeout` (or a caller's abort) fired. If it lands while the SDK
  // waits to retry, the error is a bare "Delay was aborted" AbortError.
  const name = (err as { name?: unknown } | null)?.name
  if (name === 'AbortError' || name === 'TimeoutError') return classified('timeout', 502, detail)

  // Schema/format failures — generateObject throws this. `length` finish means
  // the model was cut off mid-object (truncation); anything else is an
  // unparseable / unexpected response.
  if (NoObjectGeneratedError.isInstance(err)) {
    const issues = schemaIssues(err)
    const withIssues = issues ? `${detail} [${issues}]`.slice(0, 400) : detail
    const base = err.finishReason === 'length'
      ? classified('truncated', 502, detail)
      : classified('no_object', 502, withIssues)
    return {
      ...base,
      ...(err.usage ? { usage: err.usage } : {}),
      ...(err.text ? { rawText: err.text.slice(0, RAW_TEXT_LIMIT) } : {}),
    }
  }

  // generateText + `Output.object` (the research bucket) throws this when the run
  // ended without producing the structured output — same class of failure.
  // finishReason=length (see aiResearch) is truncation: out of output tokens.
  if (NoOutputGeneratedError.isInstance(err)) {
    return /finishReason=length/.test(detail)
      ? classified('truncated', 502, detail)
      : classified('no_object', 502, detail)
  }

  // Transport / provider errors surfaced by the gateway (APICallError), or the
  // Gateway's own errors (GatewayError, same `statusCode`).
  if (APICallError.isInstance(err) || statusOf(err) != null) {
    const code = statusOf(err)
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
