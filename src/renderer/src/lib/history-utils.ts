import { SessionWithTranscripts, GroupedSessions, DateGroup } from '@/types/history'
import { getDateGroup, getDateGroupLabel } from './date-utils'

/**
 * Groups sessions by date ranges (Today, Yesterday, This Week, etc.)
 */
export function groupSessionsByDate(sessions: SessionWithTranscripts[]): GroupedSessions[] {
  const groups: Record<DateGroup, SessionWithTranscripts[]> = {
    today: [],
    yesterday: [],
    'this-week': [],
    'this-month': [],
    older: []
  }

  // Group sessions by date
  sessions.forEach((session) => {
    const group = getDateGroup(session.started_at)
    groups[group].push(session)
  })

  // Convert to array format and filter out empty groups
  const groupOrder: DateGroup[] = ['today', 'yesterday', 'this-week', 'this-month', 'older']

  return groupOrder
    .filter((group) => groups[group].length > 0)
    .map((group) => ({
      group,
      label: getDateGroupLabel(group),
      sessions: groups[group]
    }))
}

/**
 * Filters sessions based on search query (searches in transcripts and summary)
 */
export function filterSessions(
  sessions: SessionWithTranscripts[],
  searchQuery: string
): SessionWithTranscripts[] {
  if (!searchQuery.trim()) return sessions

  const query = searchQuery.toLowerCase()

  return sessions.filter((session) => {
    // Search in summary
    if (session.summary?.toLowerCase().includes(query)) return true

    // Search in transcripts
    return session.transcripts.some((transcript) => transcript.text.toLowerCase().includes(query))
  })
}
