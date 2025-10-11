import path from 'path'
import { app } from 'electron'
import { open } from 'sqlite'
import sqlite3 from 'sqlite3'
import fs from 'fs'

const dbPath = path.join(app.getPath('userData'), 'knovy_sessions.db')
const oldDbPath = path.join(app.getPath('userData'), 'intevia_sessions.db')

// Migrate old database file to new name
function migrateOldDatabase() {
  if (fs.existsSync(oldDbPath) && !fs.existsSync(dbPath)) {
    console.log('[DB] Migrating database from intevia_sessions.db to knovy_sessions.db')
    fs.renameSync(oldDbPath, dbPath)
    console.log('[DB] Migration completed successfully')
  }
}

// This function will open the database and create tables if they don't exist
async function initializeDatabase() {
  // Migrate old database if it exists
  migrateOldDatabase()
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  })

  await db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
      started_at TEXT,
      ended_at TEXT,
      status TEXT
    );
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS transcripts (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      timestamp TEXT,
      content TEXT,
      source_type TEXT DEFAULT 'system',
      FOREIGN KEY (session_id) REFERENCES sessions (id)
    );
  `)

  // Add source_type column to existing transcripts table if it doesn't exist
  try {
    await db.exec(`
      ALTER TABLE transcripts ADD COLUMN source_type TEXT DEFAULT 'system';
    `)
  } catch (error) {
    // Column already exists, ignore error
    console.log('[DB] source_type column already exists or another error occurred')
  }

  // Add enhanced transcription columns (Phase 2.1 - Enhanced Storage)
  const enhancementColumns = [
    'raw_text TEXT', // Original whisper.cpp output
    'enhanced_text TEXT', // Gemini-enhanced text
    'detected_language TEXT', // Language detected by whisper.cpp Stage 1
    'whisper_language TEXT', // Language used for whisper.cpp Stage 2
    'user_language TEXT', // User's preferred language
    'used_two_stage_detection INTEGER DEFAULT 0', // Boolean: whether two-stage detection was used
    'enhancement_status TEXT DEFAULT "pending"', // 'pending', 'processing', 'completed', 'failed'
    'enhancement_metadata TEXT', // JSON string with intention, keywords, confidence, etc.
    'processing_time_ms INTEGER', // Total processing time in milliseconds
    'enhancement_updated_at TEXT' // When enhancement was last updated
  ]

  for (const column of enhancementColumns) {
    try {
      await db.exec(`ALTER TABLE transcripts ADD COLUMN ${column};`)
      console.log(`[DB] Added enhancement column: ${column.split(' ')[0]}`)
    } catch (error) {
      // Column already exists, ignore error
      console.log(`[DB] Enhancement column ${column.split(' ')[0]} already exists`)
    }
  }

  await db.exec(`
    CREATE TABLE IF NOT EXISTS summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      content TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
    );
  `)

  // Add structured summary columns (Phase: Structured Summary Response)
  const summaryColumns = [
    'short_summary TEXT', // Brief one-line summary for preview
    'context_data TEXT' // JSON string with participants, topics, keywords, etc.
  ]

  for (const column of summaryColumns) {
    try {
      await db.exec(`ALTER TABLE summaries ADD COLUMN ${column};`)
      console.log(`[DB] Added summary column: ${column.split(' ')[0]}`)
    } catch (error) {
      // Column already exists, ignore error
      console.log(`[DB] Summary column ${column.split(' ')[0]} already exists`)
    }
  }

  return db
}

// We export the promise so the main process can await it
export const dbPromise = initializeDatabase()
