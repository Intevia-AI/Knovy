// Shared transcription/enhancement types.

export interface TranscriptionSegment {
  id: string
  rawText: string
  timestamp: number
  sourceType: 'microphone' | 'system'
}

export interface SessionContext {
  sessionId: string
  conversationHistory: string[]
  userLanguage: string
}

export interface EnhancedSegment {
  id: string
  corrected: string
  translation?: string
  intention: {
    primary: 'question' | 'command' | 'statement' | 'schedule' | 'reminder' | 'concern' | 'request'
    confidence: number
    suggestedActions?: string[]
  }
  keywords?: string[]
  confidence: number
}
