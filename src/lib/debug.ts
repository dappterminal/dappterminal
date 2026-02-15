const DEBUG_LOGS_ENABLED = process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true'

export function debugLog(scope: string, ...args: unknown[]): void {
  if (!DEBUG_LOGS_ENABLED) {
    return
  }

  console.debug(`[${scope}]`, ...args)
}
