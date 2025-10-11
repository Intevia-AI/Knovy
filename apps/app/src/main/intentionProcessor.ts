/**
 * @fileoverview Intention Processor for auto-trigger system
 * @description Analyzes enhanced transcriptions and triggers appropriate actions
 */

import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import type {
  AutoTriggerSettings,
  DetectedIntention,
  PendingAction,
  ActionType,
  ActionContext
} from '../renderer/src/types/settings'
import { isActionValidForSource } from '../renderer/src/types/settings'
import type { EnhancedSegment } from './transcriptionEnhancementService'

/**
 * Intention Processor
 * Analyzes enhanced transcriptions and determines which actions to trigger
 */
export class IntentionProcessor extends EventEmitter {
  private settings: AutoTriggerSettings
  private sessionId: string | null = null

  constructor(settings: AutoTriggerSettings) {
    super()
    this.settings = settings
    console.log('[IntentionProcessor] Initialized with settings:', settings)
  }

  /**
   * Update auto-trigger settings
   */
  updateSettings(settings: AutoTriggerSettings): void {
    this.settings = settings
    console.log('[IntentionProcessor] Settings updated:', settings)
  }

  /**
   * Set current session ID
   */
  setSessionId(sessionId: string | null): void {
    this.sessionId = sessionId
    console.log('[IntentionProcessor] Session ID set:', sessionId)
  }

  /**
   * Process an enhanced segment and determine if actions should be triggered
   */
  processEnhancedSegment(data: {
    sessionId: string
    original: {
      id: string
      rawText: string
      timestamp: number
      sourceType: 'microphone' | 'system'
    }
    enhanced: EnhancedSegment
    processingTime: number
  }): void {
    // Check if auto-trigger is enabled
    if (!this.settings.enabled) {
      console.log('[IntentionProcessor] Auto-trigger disabled, skipping processing')
      return
    }

    // Check if we have a valid session
    if (!this.sessionId || this.sessionId !== data.sessionId) {
      console.warn('[IntentionProcessor] Session ID mismatch or not set')
      return
    }

    const { original, enhanced } = data
    const { intention } = enhanced

    console.log('[IntentionProcessor] Processing segment:', {
      id: original.id,
      sourceType: original.sourceType,
      intention: intention.primary,
      confidence: intention.confidence
    })

    // Analyze intention and determine eligible actions
    const eligibleActions = this.analyzeIntention(
      intention,
      original.sourceType,
      enhanced.confidence
    )

    console.log('[IntentionProcessor] Eligible actions:', eligibleActions)

    // Create pending actions for each eligible action
    eligibleActions.forEach((actionType) => {
      const pendingAction = this.createPendingAction(
        actionType,
        original,
        intention,
        enhanced
      )

      // Emit action for approval/execution
      this.emit('actionTriggered', pendingAction)
      console.log('[IntentionProcessor] Action triggered:', {
        actionType,
        transcriptId: original.id,
        confidence: intention.confidence
      })
    })
  }

  /**
   * Analyze intention and determine which actions should be triggered
   */
  private analyzeIntention(
    intention: DetectedIntention,
    sourceType: 'microphone' | 'system',
    confidence: number
  ): ActionType[] {
    const eligibleActions: ActionType[] = []

    // Check each enabled action
    const enabledActions = Object.entries(this.settings.enabledActions)
      .filter(([_, enabled]) => enabled)
      .map(([actionType, _]) => actionType as ActionType)

    console.log('[IntentionProcessor] Checking enabled actions:', enabledActions)

    for (const actionType of enabledActions) {
      // 1. Check if action is valid for the source type (CRITICAL: filters microphone for recommendResponse)
      if (!isActionValidForSource(actionType, sourceType)) {
        console.log(`[IntentionProcessor] Action ${actionType} not valid for source ${sourceType}`)
        continue
      }

      // 2. Check confidence threshold
      const threshold = this.getThresholdForAction(actionType)
      if (confidence < threshold) {
        console.log(
          `[IntentionProcessor] Confidence ${confidence} below threshold ${threshold} for ${actionType}`
        )
        continue
      }

      // 3. Check if intention matches action type
      if (this.intentionMatchesAction(intention, actionType)) {
        eligibleActions.push(actionType)
        console.log(`[IntentionProcessor] Action ${actionType} eligible`)
      }
    }

    return eligibleActions
  }

  /**
   * Get confidence threshold for a specific action
   */
  private getThresholdForAction(actionType: ActionType): number {
    // Check for per-action threshold override
    const perActionThreshold = this.settings.perActionThresholds?.[actionType]
    if (perActionThreshold !== undefined) {
      return perActionThreshold
    }

    // Use global threshold
    return this.settings.confidenceThreshold
  }

  /**
   * Check if intention matches the action type
   */
  private intentionMatchesAction(intention: DetectedIntention, actionType: ActionType): boolean {
    switch (actionType) {
      case 'recommendResponse':
        // Recommend response for questions, concerns, and requests
        return ['question', 'concern', 'request'].includes(intention.primary)

      case 'scheduleReminder':
        // Schedule reminder for schedule and reminder intentions
        return ['schedule', 'reminder'].includes(intention.primary)

      case 'sendEmail':
        // Send email for commands or requests that mention email
        return (
          ['command', 'request'].includes(intention.primary) &&
          intention.suggestedActions?.some((action) => action.toLowerCase().includes('email'))
        )

      default:
        return false
    }
  }

  /**
   * Create a pending action object
   */
  private createPendingAction(
    actionType: ActionType,
    original: {
      id: string
      rawText: string
      timestamp: number
      sourceType: 'microphone' | 'system'
    },
    intention: DetectedIntention,
    enhanced: EnhancedSegment
  ): PendingAction {
    const actionContext: ActionContext = {
      transcriptionText: enhanced.corrected || original.rawText,
      sourceType: original.sourceType,
      sessionId: this.sessionId!
    }

    const pendingAction: PendingAction = {
      id: randomUUID(),
      transcriptId: original.id,
      timestamp: original.timestamp,
      intention: {
        primary: intention.primary,
        confidence: intention.confidence,
        suggestedActions: intention.suggestedActions || []
      },
      actionType,
      context: actionContext,
      status: 'pending',
      createdAt: Date.now(),
      settingsSnapshot: { ...this.settings }
    }

    return pendingAction
  }

  /**
   * Clear processor state
   */
  clear(): void {
    this.sessionId = null
    this.removeAllListeners()
    console.log('[IntentionProcessor] Cleared')
  }
}

/**
 * Singleton instance for the intention processor
 */
let intentionProcessorInstance: IntentionProcessor | null = null

export function getIntentionProcessor(settings?: AutoTriggerSettings): IntentionProcessor {
  if (!intentionProcessorInstance) {
    if (!settings) {
      throw new Error('Settings required to initialize IntentionProcessor')
    }
    intentionProcessorInstance = new IntentionProcessor(settings)
  }
  return intentionProcessorInstance
}
