import { NextResponse } from 'next/server'

// Minimal health check. If THIS returns JSON, routing + basic runtime is fine.
// If it returns HTML, the whole /api pipeline is broken.
export async function GET() {
  const checks: Record<string, string> = {
    runtime: 'ok',
    timestamp: new Date().toISOString(),
  }

  // Try to import the sanitizer lazily to catch module-load errors
  try {
    const mod = await import('sanitize-html')
    const fn = mod.default ?? mod
    const result = (fn as unknown as (s: string) => string)('<p>hello <script>bad</script></p>')
    checks.sanitize_html = result === '<p>hello </p>' ? 'ok' : `unexpected: ${result}`
  } catch (err) {
    checks.sanitize_html = `FAILED: ${err instanceof Error ? err.message : String(err)}`
  }

  // Try the Claude SDK
  try {
    await import('@anthropic-ai/sdk')
    checks.anthropic_sdk = 'ok'
  } catch (err) {
    checks.anthropic_sdk = `FAILED: ${err instanceof Error ? err.message : String(err)}`
  }

  // Try supabase admin
  try {
    await import('@/lib/supabase/admin')
    checks.supabase_admin = 'ok'
  } catch (err) {
    checks.supabase_admin = `FAILED: ${err instanceof Error ? err.message : String(err)}`
  }

  // Try OpenAI (for images)
  try {
    await import('openai')
    checks.openai_sdk = 'ok'
  } catch (err) {
    checks.openai_sdk = `FAILED: ${err instanceof Error ? err.message : String(err)}`
  }

  return NextResponse.json(checks)
}
