/**
 * @fileoverview Type definitions for application settings
 * @description Includes auto-trigger settings for intention-based action execution
 */

/**
 * Auto-trigger settings for intention-based action execution
 */
export interface AutoTriggerSettings {
  /** Whether auto-trigger is enabled */
  enabled: boolean

  /** Approval mode: ask for user confirmation or execute automatically */
  approvalMode: 'ask' | 'automatic'

  /** Minimum confidence threshold (0.0 to 1.0) for triggering actions */
  confidenceThreshold: number

  /** Which actions are enabled for auto-triggering */
  enabledActions: {
    /** Recommend response to questions, requests, or concerns */
    recommendResponse: boolean
    /** Schedule reminders based on time-related statements (future feature) */
    scheduleReminder: boolean
    /** Draft and send emails based on email-related requests (future feature) */
    sendEmail: boolean
  }

  /** Optional per-action confidence thresholds (overrides global threshold) */
  perActionThresholds?: {
    recommendResponse?: number
    scheduleReminder?: number
    sendEmail?: number
  }
}

/**
 * Main application settings
 */
export interface AppSettings {
  /** User interface language */
  language: 'zh-TW' | 'en-US'

  /** Custom prompt for AI interactions */
  customPrompt: string

  /** Whether content protection (screenshot prevention) is enabled */
  contentProtection: boolean

  /** Display ID where the main window is positioned */
  displayId?: number

  /** Auto-trigger settings for intention-based actions */
  autoTrigger: AutoTriggerSettings
}

/**
 * Type of action that can be triggered automatically
 */
export type ActionType = 'recommendResponse' | 'scheduleReminder' | 'sendEmail'

/**
 * Status of a pending action in the approval queue
 */
export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed'

/**
 * Intention detected from transcription enhancement
 */
export interface DetectedIntention {
  /** Primary intention type */
  primary: 'question' | 'command' | 'statement' | 'schedule' | 'reminder' | 'concern' | 'request'

  /** Confidence score (0.0 to 1.0) */
  confidence: number

  /** Suggested actions based on intention */
  suggestedActions: string[]
}

/**
 * Context for a pending action
 */
export interface ActionContext {
  /** The transcribed text that triggered the action */
  transcriptionText: string

  /** Source of the audio (microphone or system) */
  sourceType: 'microphone' | 'system'

  /** ID of the current session */
  sessionId: string
}

/**
 * Pending action awaiting approval or execution
 */
export interface PendingAction {
  /** Unique identifier for this action */
  id: string

  /** ID of the transcript that triggered this action */
  transcriptId: string

  /** Timestamp when the action was created */
  timestamp: number

  /** Detected intention from the transcript */
  intention: DetectedIntention

  /** Type of action to be executed */
  actionType: ActionType

  /** Context for executing the action */
  context: ActionContext

  /** Current status of the action */
  status: ActionStatus

  /** Timestamp when the action was created (for queue management) */
  createdAt: number

  /** Error message if action failed */
  error?: string

  /** Snapshot of settings at the time of action creation (for validation) */
  settingsSnapshot?: AutoTriggerSettings
}

/**
 * Default auto-trigger settings
 */
export const DEFAULT_AUTO_TRIGGER_SETTINGS: AutoTriggerSettings = {
  enabled: false,
  approvalMode: 'ask',
  confidenceThreshold: 0.7,
  enabledActions: {
    recommendResponse: true,
    scheduleReminder: false,
    sendEmail: false
  }
}

/**
 * Action type labels for display
 */
export const ACTION_TYPE_LABELS: Record<ActionType, { en: string; 'zh-TW': string }> = {
  recommendResponse: {
    en: 'Recommend Response',
    'zh-TW': '推薦回應'
  },
  scheduleReminder: {
    en: 'Schedule Reminder',
    'zh-TW': '建立提醒'
  },
  sendEmail: {
    en: 'Send Email',
    'zh-TW': '發送電子郵件'
  }
}

/**
 * Intention type labels for display
 */
export const INTENTION_LABELS: Record<DetectedIntention['primary'], { en: string; 'zh-TW': string }> = {
  question: {
    en: 'Question',
    'zh-TW': '問題'
  },
  command: {
    en: 'Command',
    'zh-TW': '指令'
  },
  statement: {
    en: 'Statement',
    'zh-TW': '陳述'
  },
  schedule: {
    en: 'Schedule',
    'zh-TW': '排程'
  },
  reminder: {
    en: 'Reminder',
    'zh-TW': '提醒'
  },
  concern: {
    en: 'Concern',
    'zh-TW': '關注'
  },
  request: {
    en: 'Request',
    'zh-TW': '請求'
  }
}
