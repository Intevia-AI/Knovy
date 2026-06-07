export type PullErrorKind = 'disk-full' | 'network' | 'generic'

/** Classify an Ollama pull/connection error message into an actionable kind. */
export function classifyPullError(message: string): PullErrorKind {
  const m = (message || '').toLowerCase()
  if (m.includes('no space') || m.includes('enospc') || m.includes('disk full')) {
    return 'disk-full'
  }
  if (
    m.includes('connection refused') ||
    m.includes('dial tcp') ||
    m.includes('network') ||
    m.includes('timeout') ||
    m.includes('timed out') ||
    m.includes('eof') ||
    m.includes('fetch failed') ||
    m.includes('econnrefused') ||
    m.includes('enotfound')
  ) {
    return 'network'
  }
  return 'generic'
}

/**
 * Map an Ollama pull stream `status` line to a lifecycle phase.
 * Returns null when the status implies no phase change.
 */
export function mapOllamaPullStatus(status: string): 'downloading' | 'verifying' | null {
  const s = (status || '').toLowerCase()
  if (s.includes('verif') || s.includes('writing')) return 'verifying'
  if (s.includes('pulling') || s.includes('downloading')) return 'downloading'
  return null
}
