import { dbPromise } from './database'

export async function getSessions() {
  const db = await dbPromise
  const stmt = await db.prepare('SELECT * FROM sessions ORDER BY started_at DESC')
  return stmt.all()
}

export async function getTranscripts(sessionId: string) {
  const db = await dbPromise
  const stmt = await db.prepare(
    'SELECT * FROM transcripts WHERE session_id = ? ORDER BY timestamp ASC'
  )
  return stmt.all(sessionId)
}

export async function deleteSession(sessionId: string) {
  const db = await dbPromise
  try {
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
}) {
  console.log('[DB] Attempting to add transcript for session:', transcript.session_id)
  const db = await dbPromise
  const { id, session_id, timestamp, content } = transcript
  const stmt = await db.prepare(
    'INSERT INTO transcripts (id, session_id, timestamp, content) VALUES (?, ?, ?, ?)'
  )
  const result = await stmt.run(id, session_id, timestamp, content)
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
