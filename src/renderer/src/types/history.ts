export interface Transcript {
  id: string
  session_id: string
  text: string
  timestamp: string
  created_at: string
  source_type?: 'microphone' | 'system'
}

export interface SessionContext {
  participants?: string[]
  topics?: string[]
  keywords?: string[]
  time_context?: string | null
  scenario?: string | null
  key_points?: string[]
}

export interface Session {
  id: string
  user_id?: string
  started_at: string
  ended_at: string | null
  duration: number | null
  summary: string | null // Long summary (backward compat)
  short_summary?: string | null // New field
  context_data?: string | null // JSON string
  created_at: string
  transcripts?: Transcript[]
}

export interface SessionWithTranscripts extends Session {
  transcripts: Transcript[]
}

export type DateGroup = 'today' | 'yesterday' | 'this-week' | 'this-month' | 'older'

export interface GroupedSessions {
  group: DateGroup
  label: string
  sessions: SessionWithTranscripts[]
}

export interface HistoryPaginationParams {
  limit: number
  offset: number
}
