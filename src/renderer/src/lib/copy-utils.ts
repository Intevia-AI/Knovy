/**
 * Clipboard copy utilities for session data
 * Formats session data for easy copying with "Mic" and "Sys" labels
 */

import { SessionWithTranscripts, Transcript } from '@/types/history'
import { formatDate, formatTime, formatDuration } from './date-utils'

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (error) {
    console.error('[CopyUtils] Failed to copy to clipboard:', error)
    return false
  }
}

/**
 * Format session header for copy operations
 */
function formatSessionHeader(session: SessionWithTranscripts): string {
  const date = formatDate(session.started_at)
  const time = formatTime(session.started_at)
  const duration = formatDuration(session.duration)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  return `Session: ${date} ${time} (${timezone})\nDuration: ${duration}\n`
}

/**
 * Format summary for copying
 */
export function formatSummaryForCopy(session: SessionWithTranscripts): string {
  const header = formatSessionHeader(session)
  const summary = session.summary || 'No summary available'

  return `${header}\nSummary:\n${summary}`
}

/**
 * Format all transcriptions for copying with Mic/Sys labels
 */
export function formatTranscriptionsForCopy(session: SessionWithTranscripts): string {
  const header = formatSessionHeader(session)

  if (!session.transcripts || session.transcripts.length === 0) {
    return `${header}\nNo transcriptions available`
  }

  const transcriptsText = session.transcripts
    .map((t) => {
      const time = formatTime(t.timestamp)
      const source = t.source_type === 'microphone' ? 'Mic' : 'Sys'
      return `[${time}] [${source}] ${t.text}`
    })
    .join('\n')

  return `${header}\nTranscriptions:\n${transcriptsText}`
}

/**
 * Format a single transcript line for copying
 */
export function formatTranscriptForCopy(transcript: Transcript): string {
  const time = formatTime(transcript.timestamp)
  const source = transcript.source_type === 'microphone' ? 'Mic' : 'Sys'
  return `[${time}] [${source}] ${transcript.text}`
}
