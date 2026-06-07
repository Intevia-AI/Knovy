/**
 * Export formatting utilities for session data
 * Handles timezone conversion and locale-aware date formatting
 */

import { SimplifiedSessionExport, SimplifiedTranscript } from '../types/export'

/**
 * Get user's timezone using Intl API
 */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch (error) {
    console.error('[ExportFormatter] Failed to get timezone:', error)
    return 'UTC'
  }
}

/**
 * Format session date based on locale
 * @param isoString - ISO 8601 timestamp
 * @param locale - User locale (e.g., 'en-US', 'zh-TW')
 * @param timezone - User timezone (e.g., 'Asia/Taipei')
 */
export function formatSessionDate(isoString: string, locale: string, timezone: string): string {
  try {
    const date = new Date(isoString)

    if (locale === 'zh-TW') {
      // Format: YYYY/MM/DD
      const year = date.toLocaleDateString('en-US', { year: 'numeric', timeZone: timezone })
      const month = date.toLocaleDateString('en-US', { month: '2-digit', timeZone: timezone })
      const day = date.toLocaleDateString('en-US', { day: '2-digit', timeZone: timezone })
      return `${year}/${month}/${day}`
    } else {
      // en-US format: Month Day, Year
      return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: timezone
      })
    }
  } catch (error) {
    console.error('[ExportFormatter] Failed to format date:', error)
    return isoString
  }
}

/**
 * Format session time (12-hour format with AM/PM)
 * @param isoString - ISO 8601 timestamp
 * @param timezone - User timezone
 */
export function formatSessionTime(isoString: string, timezone: string): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone
    })
  } catch (error) {
    console.error('[ExportFormatter] Failed to format time:', error)
    return isoString
  }
}

/**
 * Format timestamp for transcriptions (same as session time)
 * @param isoString - ISO 8601 timestamp
 * @param timezone - User timezone
 */
export function formatTimestamp(isoString: string, timezone: string): string {
  return formatSessionTime(isoString, timezone)
}

/**
 * Calculate and format duration between two timestamps
 * @param startTime - ISO 8601 start timestamp
 * @param endTime - ISO 8601 end timestamp (can be null for ongoing sessions)
 * @returns Formatted duration string (e.g., "1h 25m 17s")
 */
export function calculateDuration(startTime: string, endTime: string | null): string {
  try {
    if (!endTime) {
      return 'In Progress'
    }

    const start = new Date(startTime)
    const end = new Date(endTime)
    const diffMs = end.getTime() - start.getTime()

    if (diffMs < 0) {
      return '0s'
    }

    const seconds = Math.floor(diffMs / 1000)
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  } catch (error) {
    console.error('[ExportFormatter] Failed to calculate duration:', error)
    return '0s'
  }
}

/**
 * Transform session data from database format to simplified export format
 * @param sessionData - Raw session data from database
 * @param locale - User locale
 * @param timezone - User timezone
 * @returns Simplified session export object
 */
export function transformSessionForExport(
  sessionData: { session: any; transcripts: any[] },
  locale: string,
  timezone: string
): SimplifiedSessionExport {
  const { session, transcripts } = sessionData

  // Transform transcripts
  const simplifiedTranscripts: SimplifiedTranscript[] = transcripts.map((transcript) => ({
    timestamp: formatTimestamp(transcript.timestamp, timezone),
    source: transcript.source_type || 'system',
    text: transcript.enhanced_text || transcript.content || transcript.raw_text || ''
  }))

  // Build simplified export object
  return {
    session_date: formatSessionDate(session.started_at, locale, timezone),
    session_time: formatSessionTime(session.started_at, timezone),
    duration: calculateDuration(session.started_at, session.ended_at),
    timezone,
    locale,
    title: null, // Placeholder for future feature
    short_summary: null, // Placeholder for future feature
    summary: session.summary || null,
    transcriptions: simplifiedTranscripts
  }
}
