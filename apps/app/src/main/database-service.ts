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
