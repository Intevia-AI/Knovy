/**
 * Type definitions for simplified session export format
 * Uses snake_case convention for consistency with exported JSON
 */

export interface SimplifiedSessionExport {
  session_date: string
  session_time: string
  duration: string
  timezone: string
  locale: string
  title: string | null
  short_summary: string | null
  summary: string | null
  transcriptions: SimplifiedTranscript[]
}

export interface SimplifiedTranscript {
  timestamp: string
  source: 'microphone' | 'system'
  text: string
}
