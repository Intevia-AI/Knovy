/**
 * Analytics Service
 *
 * Lean analytics implementation following startup best practices:
 * - Simple session tracking with 60-second heartbeat
 * - Feature usage logging with metadata
 * - Error tracking linked to sessions
 * - Batch operations to minimize database writes
 */

import { supabase } from './supabaseClient'

// Types matching our database schema
interface SessionData {
  sessionId: string
  userId: string
  startedAt: Date
  platform: string
  appVersion: string
  osName: string
  osVersion: string
}

interface SessionMetrics {
  transcriptionCount: number
  transcriptionMinutes: number
  aiActionsCount: number
  errorsCount: number
}

interface FeatureUsage {
  featureName: string
  featureCategory: string
  startedAt: Date
  metadata?: Record<string, any>
}

interface FeatureComplete {
  success: boolean
  durationMs: number
  metadata?: Record<string, any>
}

interface FeatureError {
  errorType: string
  errorMessage: string
  durationMs: number
}

class AnalyticsService {
  private currentSession: SessionData | null = null
  private sessionMetrics: SessionMetrics = {
    transcriptionCount: 0,
    transcriptionMinutes: 0,
    aiActionsCount: 0,
    errorsCount: 0
  }
  private heartbeatInterval: NodeJS.Timeout | null = null
  private featureUsageMap: Map<string, { id: number; startedAt: Date }> = new Map()

  /**
   * Start a new analytics session
   */
  async startSession(userId: string): Promise<void> {
    try {
      // Get platform info
      const platform = 'desktop_app'
      const appVersion = import.meta.env.VITE_APP_VERSION || 'unknown'
      const osName = navigator.platform
      const osVersion = navigator.userAgent

      // Create session in database
      const { data, error } = await supabase
        .from('user_sessions')
        .insert({
          user_id: userId,
          platform,
          app_version: appVersion,
          os_name: osName,
          os_version: osVersion,
          started_at: new Date().toISOString(),
          last_heartbeat_at: new Date().toISOString(),
          is_active: true
        })
        .select('session_id')
        .single()

      if (error) {
        // Check if error is due to foreign key constraint (user doesn't exist in auth.users)
        if (error.code === '23503' && error.message?.includes('user_sessions_user_id_fkey')) {
          console.error(
            '[Analytics] Failed to start session: User ID not found in database.',
            'This can happen after database reset. Please sign out and sign back in.',
            'User ID:', userId
          )
        } else {
          console.error('[Analytics] Failed to start session:', error)
        }
        return
      }

      this.currentSession = {
        sessionId: data.session_id,
        userId,
        startedAt: new Date(),
        platform,
        appVersion,
        osName,
        osVersion
      }

      // Reset metrics
      this.sessionMetrics = {
        transcriptionCount: 0,
        transcriptionMinutes: 0,
        aiActionsCount: 0,
        errorsCount: 0
      }

      // Start heartbeat (every 60 seconds)
      this.startHeartbeat()

      console.log('[Analytics] Session started:', this.currentSession.sessionId)
    } catch (error) {
      console.error('[Analytics] Error starting session:', error)
    }
  }

  /**
   * End the current session
   */
  async endSession(exitReason: 'normal' | 'crash' | 'timeout' = 'normal'): Promise<void> {
    if (!this.currentSession) return

    try {
      // Stop heartbeat
      this.stopHeartbeat()

      // Calculate duration
      const durationSeconds = Math.floor(
        (Date.now() - this.currentSession.startedAt.getTime()) / 1000
      )

      // Update session as ended
      const { error } = await supabase
        .from('user_sessions')
        .update({
          ended_at: new Date().toISOString(),
          duration_seconds: durationSeconds,
          is_active: false,
          exit_reason: exitReason,
          transcription_count: this.sessionMetrics.transcriptionCount,
          transcription_minutes: this.sessionMetrics.transcriptionMinutes,
          ai_actions_count: this.sessionMetrics.aiActionsCount,
          errors_count: this.sessionMetrics.errorsCount
        })
        .eq('session_id', this.currentSession.sessionId)

      if (error) {
        console.error('[Analytics] Failed to end session:', error)
      } else {
        console.log('[Analytics] Session ended:', this.currentSession.sessionId)
      }

      this.currentSession = null
    } catch (error) {
      console.error('[Analytics] Error ending session:', error)
    }
  }

  /**
   * Start heartbeat to update session activity
   */
  private startHeartbeat(): void {
    // Clear any existing interval
    this.stopHeartbeat()

    // Update heartbeat every 60 seconds
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat()
    }, 60000) // 60 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  /**
   * Send heartbeat to update last_heartbeat_at and metrics
   */
  private async sendHeartbeat(): Promise<void> {
    if (!this.currentSession) return

    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({
          last_heartbeat_at: new Date().toISOString(),
          transcription_count: this.sessionMetrics.transcriptionCount,
          transcription_minutes: this.sessionMetrics.transcriptionMinutes,
          ai_actions_count: this.sessionMetrics.aiActionsCount,
          errors_count: this.sessionMetrics.errorsCount
        })
        .eq('session_id', this.currentSession.sessionId)

      if (error) {
        console.error('[Analytics] Heartbeat failed:', error)
      }
    } catch (error) {
      console.error('[Analytics] Error sending heartbeat:', error)
    }
  }

  /**
   * Track transcription activity
   */
  incrementTranscription(durationMinutes: number): void {
    this.sessionMetrics.transcriptionCount++
    this.sessionMetrics.transcriptionMinutes += durationMinutes
  }

  /**
   * Track AI action activity
   */
  incrementAiAction(): void {
    this.sessionMetrics.aiActionsCount++
  }

  /**
   * Track error occurrence
   */
  incrementError(): void {
    this.sessionMetrics.errorsCount++
  }

  /**
   * Start tracking a feature usage
   * Returns a tracking ID to use when completing the feature
   */
  async trackFeatureStart(usage: FeatureUsage): Promise<string | null> {
    if (!this.currentSession) {
      console.warn('[Analytics] Cannot track feature: no active session')
      return null
    }

    try {
      const { data, error } = await supabase
        .from('feature_usage')
        .insert({
          user_id: this.currentSession.userId,
          session_id: this.currentSession.sessionId,
          feature_name: usage.featureName,
          feature_category: usage.featureCategory,
          started_at: usage.startedAt.toISOString(),
          metadata: usage.metadata || {}
        })
        .select('id')
        .single()

      if (error) {
        console.error('[Analytics] Failed to track feature start:', error)
        return null
      }

      // Store for completion tracking
      const trackingId = `${usage.featureName}-${Date.now()}`
      this.featureUsageMap.set(trackingId, {
        id: data.id,
        startedAt: usage.startedAt
      })

      return trackingId
    } catch (error) {
      console.error('[Analytics] Error tracking feature start:', error)
      return null
    }
  }

  /**
   * Complete a feature usage tracking
   */
  async trackFeatureComplete(trackingId: string, completion: FeatureComplete): Promise<void> {
    const usage = this.featureUsageMap.get(trackingId)
    if (!usage) {
      console.warn('[Analytics] Cannot complete feature: tracking ID not found')
      return
    }

    try {
      const { error } = await supabase
        .from('feature_usage')
        .update({
          completed_at: new Date().toISOString(),
          duration_ms: completion.durationMs,
          success: completion.success,
          metadata: completion.metadata || {}
        })
        .eq('id', usage.id)

      if (error) {
        console.error('[Analytics] Failed to complete feature tracking:', error)
      } else {
        this.featureUsageMap.delete(trackingId)
      }
    } catch (error) {
      console.error('[Analytics] Error completing feature tracking:', error)
    }
  }

  /**
   * Track a feature error
   */
  async trackFeatureError(trackingId: string, featureError: FeatureError): Promise<void> {
    const usage = this.featureUsageMap.get(trackingId)
    if (!usage) {
      console.warn('[Analytics] Cannot track error: tracking ID not found')
      return
    }

    try {
      const { error } = await supabase
        .from('feature_usage')
        .update({
          completed_at: new Date().toISOString(),
          duration_ms: featureError.durationMs,
          success: false,
          error_type: featureError.errorType,
          error_message: featureError.errorMessage
        })
        .eq('id', usage.id)

      if (error) {
        console.error('[Analytics] Failed to track feature error:', error)
      } else {
        this.featureUsageMap.delete(trackingId)
        this.incrementError()
      }
    } catch (error) {
      console.error('[Analytics] Error tracking feature error:', error)
    }
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.currentSession?.sessionId || null
  }

  /**
   * Check if session is active
   */
  isSessionActive(): boolean {
    return this.currentSession !== null
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService()
