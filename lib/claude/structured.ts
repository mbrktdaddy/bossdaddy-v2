import Anthropic from '@anthropic-ai/sdk'
import { getClaudeClient, MODEL } from './client'

// Structured tool output: instead of asking the model for "JSON only" and
// regex-parsing it out of free text (fragile — truncation, stray braces, code
// fences all break the parse), we give the model a single tool whose
// input_schema IS the desired shape and read the validated tool input back.
// This eliminates the entire "unexpected format / malformed JSON" failure class.

type SystemParam = Anthropic.Messages.MessageCreateParams['system']

export interface StructuredResult {
  data: Record<string, unknown> | null
  stopReason: string | null
}

// Forces the model to answer by calling ONE tool. Use ONLY for calls that have
// no server tool (web_search) in play — tool_choice forces the call immediately,
// which would short-circuit a search loop. Throws on transport/API error so the
// caller can map it to a JSON response.
export async function createStructured(opts: {
  system: SystemParam
  messages: Anthropic.Messages.MessageParam[]
  tool: Anthropic.Tool
  maxTokens: number
  // Extra SDK retry headroom (default 2) to ride out transient 529 overloads on
  // long, expensive calls. The SDK honors x-should-retry + Retry-After.
  maxRetries?: number
}): Promise<StructuredResult> {
  const message = await getClaudeClient().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens,
    system: opts.system,
    tools: [opts.tool],
    tool_choice: { type: 'tool', name: opts.tool.name },
    messages: opts.messages,
  }, opts.maxRetries != null ? { maxRetries: opts.maxRetries } : undefined)
  return { data: extractToolInput(message, opts.tool.name), stopReason: message.stop_reason }
}

// Pull the input object from the first tool_use block matching `name`, or null
// if the model didn't call it (e.g. answered in prose instead).
export function extractToolInput(
  message: Anthropic.Messages.Message,
  name: string,
): Record<string, unknown> | null {
  const block = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === name,
  )
  return block ? (block.input as Record<string, unknown>) : null
}
