import { after } from 'next/server'

/**
 * Wraps after() with double try-catch:
 *   outer — prevents an after() registration failure from crashing the route
 *   inner — prevents an async callback error from surfacing after response is sent
 */
export function safeAfter(label: string, fn: () => Promise<void>): void {
  try {
    after(async () => {
      try {
        await fn()
      } catch (err) {
        console.error(`safeAfter(${label}) callback failed:`, err)
      }
    })
  } catch (err) {
    console.error(`safeAfter(${label}) registration failed:`, err)
  }
}
