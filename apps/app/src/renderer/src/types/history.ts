export interface Transcript {
  id: string
  session_id: string
  text: string
  timestamp: string
  created_at: string
  source_type?: 'microphone' | 'system'
}

export interface Session {
  id: string
  user_id: string
  started_at: string
  ended_at: string | null
  duration: number | null
  summary: string | null
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
  userId: string
}
