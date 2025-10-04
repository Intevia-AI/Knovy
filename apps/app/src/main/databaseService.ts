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
  return stmt.all(sessionId)
}

export async function getSummary(sessionId: string) {
  const db = await dbPromise
  const stmt = await db.prepare(
    'SELECT * FROM summaries WHERE session_id = ? ORDER BY updated_at DESC LIMIT 1'
  )
  return stmt.get(sessionId)
}

export async function saveSummary(summary: { sessionId: string; content: string }) {
  const db = await dbPromise
  const { sessionId, content } = summary
  const updatedAt = new Date().toISOString()

  const existingSummary = await getSummary(sessionId)

  if (existingSummary) {
    const stmt = await db.prepare(
      'UPDATE summaries SET content = ?, updated_at = ? WHERE session_id = ?'
    )
    await stmt.run(content, updatedAt, sessionId)
  } else {
    const stmt = await db.prepare(
      'INSERT INTO summaries (session_id, content, updated_at) VALUES (?, ?, ?)'
    )
    await stmt.run(sessionId, content, updatedAt)
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
    return { success: true }
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
  enhancementStatus?: 'pending' | 'processing' | 'completed' | 'failed'
}

export async function addEnhancedTranscript(transcript: EnhancedTranscriptData) {
  console.log('[DB] Adding enhanced transcript for session:', transcript.session_id)
  const db = await dbPromise

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
  status: 'pending' | 'processing' | 'completed' | 'failed'
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
  userId: string, // Not used currently as sessions table doesn't have user_id
  limit: number = 20,
  offset: number = 0
) {
  console.log('[DB] getSessionsWithTranscripts called with userId:', userId, 'limit:', limit, 'offset:', offset)
  const db = await dbPromise

  // Get sessions with pagination (without user_id filter since table doesn't have it)
  const sessionsStmt = await db.prepare(`
    SELECT
      s.*,
      sm.content as summary,
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
        user_id: userId, // Add user_id to match type expectations
        transcripts
      }
    })
  )

  console.log('[DB] Returning', sessionsWithTranscripts.length, 'sessions with transcripts')
  return sessionsWithTranscripts
}

export async function getTotalSessionCount(userId: string) {
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

export async function exportSession(sessionId: string) {
  const db = await dbPromise

  // Get session with summary
  const sessionStmt = await db.prepare(`
    SELECT
      s.*,
      sm.content as summary
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

  return {
    session,
    transcripts
  }
}
