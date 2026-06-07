import { dbPromise } from './database'

export async function getSessions() {
  const db = await dbPromise
  const stmt = await db.prepare('SELECT * FROM sessions ORDER BY started_at DESC')
  return stmt.all()
}

export async function getTranscripts(sessionId: string, page: number = 1, limit: number = 50) {
  const db = await dbPromise
  const offset = (page - 1) * limit
  const stmt = await db.prepare(
    'SELECT * FROM transcripts WHERE session_id = ? ORDER BY timestamp ASC LIMIT ? OFFSET ?'
  )
  return stmt.all(sessionId, limit, offset)
}

export async function getAllTranscripts(sessionId: string) {
  const db = await dbPromise
  const stmt = await db.prepare(
    'SELECT * FROM transcripts WHERE session_id = ? ORDER BY timestamp ASC'
  )
  const transcripts = await stmt.all(sessionId)

  // Parse enhancement_metadata JSON for each transcript
  return transcripts.map((t: any) => {
    let parsedMetadata = null
    if (t.enhancement_metadata) {
      try {
        parsedMetadata = JSON.parse(t.enhancement_metadata)
      } catch (e) {
        console.warn(`[DB] Failed to parse enhancement_metadata for transcript ${t.id}:`, e)
      }
    }

    return {
      ...t,
      enhancement_metadata_parsed: parsedMetadata
    }
  })
}

export async function getSummary(sessionId: string) {
  const db = await dbPromise
  const stmt = await db.prepare(
    'SELECT * FROM summaries WHERE session_id = ? ORDER BY updated_at DESC LIMIT 1'
  )
  const summary = await stmt.get(sessionId)

  if (!summary) return null

  // Parse context_data if it exists
  let context = null
  if (summary.context_data) {
    try {
      context = JSON.parse(summary.context_data)
    } catch (e) {
      console.warn(`[DB] Failed to parse context_data for session ${sessionId}:`, e)
    }
  }

  return {
    ...summary,
    context
  }
}

export async function saveSummary(summary: {
  sessionId: string
  content: string
  short_summary?: string
  context?: {
    participants?: string[]
    topics?: string[]
    keywords?: string[]
    time_context?: string | null
    scenario?: string | null
    key_points?: string[]
  }
}) {
  const db = await dbPromise
  const { sessionId, content, short_summary, context } = summary
  const updatedAt = new Date().toISOString()

  const existingSummary = await getSummary(sessionId)

  // Serialize context to JSON string
  const contextData = context ? JSON.stringify(context) : null

  if (existingSummary) {
    const stmt = await db.prepare(
      'UPDATE summaries SET content = ?, short_summary = ?, context_data = ?, updated_at = ? WHERE session_id = ?'
    )
    await stmt.run(content, short_summary || null, contextData, updatedAt, sessionId)
  } else {
    const stmt = await db.prepare(
      'INSERT INTO summaries (session_id, content, short_summary, context_data, updated_at) VALUES (?, ?, ?, ?, ?)'
    )
    await stmt.run(sessionId, content, short_summary || null, contextData, updatedAt)
  }
  return getSummary(sessionId)
}

export async function deleteSession(sessionId: string) {
  const db = await dbPromise
  try {
    // Added deletion for summary
    const deleteSummaryStmt = await db.prepare('DELETE FROM summaries WHERE session_id = ?')
    await deleteSummaryStmt.run(sessionId)

    const deleteTranscriptsStmt = await db.prepare('DELETE FROM transcripts WHERE session_id = ?')
    await deleteTranscriptsStmt.run(sessionId)
    const deleteSessionStmt = await db.prepare('DELETE FROM sessions WHERE id = ?')
    await deleteSessionStmt.run(sessionId)

    console.log(`[DB] Successfully deleted session ${sessionId}`)
    return { success: true, deletedSessionId: sessionId }
  } catch (error) {
    console.error(`[DB] Error deleting session ${sessionId}:`, error)
    throw new Error(`Failed to delete session ${sessionId}`)
  }
}

export async function createSession(session: { id: string; started_at: string; status: string }) {
  console.log('[DB] Attempting to create session:', session)
  const db = await dbPromise
  const { id, started_at, status } = session
  const stmt = await db.prepare('INSERT INTO sessions (id, started_at, status) VALUES (?, ?, ?)')
  const result = await stmt.run(id, started_at, status)
  console.log('[DB] Session create result:', { changes: result.changes, lastID: result.lastID })
  return { id }
}

export async function addTranscript(transcript: {
  id: string
  session_id: string
  timestamp: string
  content: string
  sourceType?: 'microphone' | 'system'
}) {
  console.log('[DB] Attempting to add transcript for session:', transcript.session_id)
  const db = await dbPromise
  const { id, session_id, timestamp, content, sourceType = 'system' } = transcript
  const stmt = await db.prepare(
    'INSERT INTO transcripts (id, session_id, timestamp, content, source_type) VALUES (?, ?, ?, ?, ?)'
  )
  const result = await stmt.run(id, session_id, timestamp, content, sourceType)
  console.log('[DB] Transcript add result:', { changes: result.changes, lastID: result.lastID })
  return { id }
}

// Enhanced transcription functions (Phase 2.1)

export interface EnhancedTranscriptData {
  id: string
  session_id: string
  timestamp: string
  content: string // This becomes the display text (enhanced if available, raw otherwise)
  sourceType?: 'microphone' | 'system'
  // Raw whisper.cpp data
  rawText: string
  detectedLanguage?: string
  whisperLanguage?: string
  userLanguage?: string
  usedTwoStageDetection?: boolean
  processingTimeMs?: number
  // Enhancement data (initially empty)
  enhancementStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
}

export async function addEnhancedTranscript(transcript: EnhancedTranscriptData) {
  console.log('[DB] Adding enhanced transcript for session:', transcript.session_id)
  const db = await dbPromise

  // Validate that session exists, recreate if missing (handles case where session was deleted during recording)
  const sessionCheckStmt = await db.prepare('SELECT id FROM sessions WHERE id = ?')
  const sessionExists = await sessionCheckStmt.get(transcript.session_id)

  if (!sessionExists) {
    console.warn(`[DB] Session ${transcript.session_id} not found, recreating it for orphaned transcript`)
    // Recreate the session with current timestamp and active status
    const recreateStmt = await db.prepare(
      'INSERT INTO sessions (id, started_at, status) VALUES (?, ?, ?)'
    )
    await recreateStmt.run(
      transcript.session_id,
      new Date().toISOString(),
      'active'
    )
    console.log(`[DB] Recreated session ${transcript.session_id}`)
  }

  const {
    id, session_id, timestamp, content, sourceType = 'system',
    rawText, detectedLanguage, whisperLanguage, userLanguage,
    usedTwoStageDetection = false, processingTimeMs,
    enhancementStatus = 'pending'
  } = transcript

  const stmt = await db.prepare(`
    INSERT INTO transcripts (
      id, session_id, timestamp, content, source_type,
      raw_text, detected_language, whisper_language, user_language,
      used_two_stage_detection, processing_time_ms, enhancement_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const result = await stmt.run(
    id, session_id, timestamp, content, sourceType,
    rawText, detectedLanguage, whisperLanguage, userLanguage,
    usedTwoStageDetection ? 1 : 0, processingTimeMs, enhancementStatus
  )

  console.log('[DB] Enhanced transcript add result:', { changes: result.changes, lastID: result.lastID })
  return { id }
}

export interface EnhancementUpdateData {
  enhancedText: string
  enhancementMetadata: {
    intention?: {
      primary: string
      confidence: number
      suggestedActions?: string[]
    }
    keywords?: string[]
    confidence?: number
    processingTime?: number
  }
}

export async function updateTranscriptEnhancement(
  transcriptId: string,
  enhancementData: EnhancementUpdateData
) {
  console.log('[DB] Updating transcript enhancement for:', transcriptId)
  const db = await dbPromise

  // First check if the transcript exists
  const checkStmt = await db.prepare('SELECT id, content, enhancement_status FROM transcripts WHERE id = ?')
  const existingTranscript = await checkStmt.get(transcriptId)

  if (!existingTranscript) {
    console.error(`[DB] Transcript with ID ${transcriptId} not found for enhancement update`)
    return { success: false, error: 'Transcript not found' }
  }

  console.log('[DB] Found existing transcript:', {
    id: existingTranscript.id,
    currentStatus: existingTranscript.enhancement_status,
    currentContent: existingTranscript.content?.substring(0, 50) + '...'
  })

  const { enhancedText, enhancementMetadata } = enhancementData
  const enhancementUpdatedAt = new Date().toISOString()

  const stmt = await db.prepare(`
    UPDATE transcripts
    SET
      enhanced_text = ?,
      content = ?, -- Update display content to enhanced text
      enhancement_metadata = ?,
      enhancement_status = 'completed',
      enhancement_updated_at = ?
    WHERE id = ?
  `)

  const result = await stmt.run(
    enhancedText,
    enhancedText, // Use enhanced text as the display content
    JSON.stringify(enhancementMetadata),
    enhancementUpdatedAt,
    transcriptId
  )

  console.log('[DB] Enhancement update result:', { changes: result.changes })
  return { success: result.changes > 0 }
}

export async function updateTranscriptEnhancementStatus(
  transcriptId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
) {
  const db = await dbPromise
  const stmt = await db.prepare(`
    UPDATE transcripts
    SET enhancement_status = ?
    WHERE id = ?
  `)

  const result = await stmt.run(status, transcriptId)
  return { success: result.changes > 0 }
}

export async function getTranscriptById(transcriptId: string) {
  const db = await dbPromise
  const stmt = await db.prepare('SELECT * FROM transcripts WHERE id = ?')
  return stmt.get(transcriptId)
}

export async function getEnhancedTranscripts(sessionId: string, page: number = 1, limit: number = 50) {
  const db = await dbPromise
  const offset = (page - 1) * limit
  const stmt = await db.prepare(`
    SELECT
      *,
      -- Parse enhancement metadata if available
      CASE
        WHEN enhancement_metadata IS NOT NULL
        THEN enhancement_metadata
        ELSE NULL
      END as enhancement_metadata_parsed
    FROM transcripts
    WHERE session_id = ?
    ORDER BY timestamp ASC
    LIMIT ? OFFSET ?
  `)
  return stmt.all(sessionId, limit, offset)
}

export async function endSession(sessionId: string) {
  const db = await dbPromise
  try {
    const ended_at = new Date().toISOString()
    const stmt = await db.prepare(
      "UPDATE sessions SET ended_at = ?, status = 'completed' WHERE id = ?"
    )
    await stmt.run(ended_at, sessionId)
    console.log(`[DB] Ended session ${sessionId}.`)
    return { success: true }
  } catch (error) {
    console.error(`[DB] Error ending session ${sessionId}:`, error)
    throw new Error(`Failed to end session ${sessionId}`)
  }
}

// History pagination functions

export async function getSessionsWithTranscripts(
  limit: number = 20,
  offset: number = 0
) {
  console.log('[DB] getSessionsWithTranscripts called with limit:', limit, 'offset:', offset)
  const db = await dbPromise

  // Get sessions with pagination
  const sessionsStmt = await db.prepare(`
    SELECT
      s.*,
      sm.content as summary,
      sm.short_summary,
      sm.context_data,
      CAST((julianday(s.ended_at) - julianday(s.started_at)) * 86400 AS INTEGER) as duration
    FROM sessions s
    LEFT JOIN summaries sm ON s.id = sm.session_id
    ORDER BY s.started_at DESC
    LIMIT ? OFFSET ?
  `)
  const sessions = await sessionsStmt.all(limit, offset)
  console.log('[DB] Found sessions:', sessions.length)

  // Get transcripts for each session
  const sessionsWithTranscripts = await Promise.all(
    sessions.map(async (session) => {
      const transcriptsStmt = await db.prepare(`
        SELECT
          id, session_id, content as text, timestamp, timestamp as created_at, source_type
        FROM transcripts
        WHERE session_id = ?
        ORDER BY timestamp ASC
      `)
      const transcripts = await transcriptsStmt.all(session.id)
      console.log(`[DB] Session ${session.id} has ${transcripts.length} transcripts`)

      return {
        ...session,
        transcripts
      }
    })
  )

  console.log('[DB] Returning', sessionsWithTranscripts.length, 'sessions with transcripts')
  return sessionsWithTranscripts
}

export async function getTotalSessionCount() {
  const db = await dbPromise
  const stmt = await db.prepare('SELECT COUNT(*) as count FROM sessions')
  const result = await stmt.get()
  return result?.count || 0
}

export async function getAllSessionDates() {
  console.log('[DB] getAllSessionDates called')
  const db = await dbPromise
  const stmt = await db.prepare(`
    SELECT DISTINCT DATE(started_at) as date
    FROM sessions
    WHERE started_at IS NOT NULL
    ORDER BY started_at DESC
  `)
  const results = await stmt.all()
  console.log('[DB] Found session dates:', results.length)
  return results.map(r => r.date)
}

export async function exportSession(
  sessionId: string,
  locale?: string,
  timezone?: string
) {
  const db = await dbPromise

  // Get session with summary
  const sessionStmt = await db.prepare(`
    SELECT
      s.*,
      sm.content as summary,
      sm.short_summary,
      sm.context_data
    FROM sessions s
    LEFT JOIN summaries sm ON s.id = sm.session_id
    WHERE s.id = ?
  `)
  const session = await sessionStmt.get(sessionId)

  if (!session) {
    throw new Error(`Session ${sessionId} not found`)
  }

  // Get all transcripts
  const transcriptsStmt = await db.prepare(`
    SELECT * FROM transcripts WHERE session_id = ? ORDER BY timestamp ASC
  `)
  const transcripts = await transcriptsStmt.all(sessionId)

  // Apply transformation if locale and timezone provided
  if (locale && timezone) {
    const { transformSessionForExport } = await import('./utils/export-formatter')
    return transformSessionForExport({ session, transcripts }, locale, timezone)
  }

  // Fallback to original format if no locale/timezone
  return {
    session,
    transcripts
  }
}
