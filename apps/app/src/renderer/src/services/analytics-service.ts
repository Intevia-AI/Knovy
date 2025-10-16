/**
 * Analytics Service
 *
 * Client-side analytics service for session management:
 * - Session lifecycle (start/end) for screen-share sessions
 * - 60-second heartbeat to track active sessions
 * - Session metrics (transcription count, AI actions, errors)
 * - Provides session_id for server-side feature tracking
 *
 * Note: Feature usage tracking (AI actions, transcription enhancement)
 * happens server-side in Edge Functions, not here.
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

class AnalyticsService {
  private currentSession: SessionData | null = null
  private sessionMetrics: SessionMetrics = {
    transcriptionCount: 0,
    transcriptionMinutes: 0,
    aiActionsCount: 0,
    errorsCount: 0
  }
  private heartbeatInterval: NodeJS.Timeout | null = null

  /**
   * Start a new analytics session
   * Returns the session ID
   */
  async startSession(userId: string): Promise<string | null> {
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
        return null
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
      return this.currentSession.sessionId
    } catch (error) {
      console.error('[Analytics] Error starting session:', error)
      return null
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
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.currentSession?.sessionId || null
  }

  /**
   * Set session ID from broadcast (for popover windows)
   * This allows popover windows to use the same session_id as the main window
   */
  setSessionIdFromBroadcast(sessionId: string | null): void {
    if (sessionId) {
      // If we don't have a session, create a minimal session object with just the ID
      if (!this.currentSession) {
        console.log('[Analytics] Received session ID from broadcast:', sessionId)
        this.currentSession = {
          sessionId,
          userId: '', // Not needed for getting session_id
          startedAt: new Date(),
          platform: 'desktop_app',
          appVersion: '',
          osName: '',
          osVersion: ''
        }
      }
    } else {
      // Clear session if null is broadcast
      console.log('[Analytics] Received session clear from broadcast')
      this.currentSession = null
    }
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

// Listen for session ID broadcasts from main process (for popover windows)
if ((window as any).electronAPI) {
  console.log('[Analytics] Registering session ID broadcast listener...')

  // Register broadcast listener
  ;(window as any).electronAPI.on('analytics:session-id-changed', (sessionId: string | null) => {
    console.log('[Analytics] Session ID broadcast received:', sessionId)
    analyticsService.setSessionIdFromBroadcast(sessionId)
  })

  // IMPORTANT: Request current session ID from main process
  // This handles the case where a popover window is created AFTER the session started
  // Without this, the popover would miss the initial broadcast
  console.log('[Analytics] Requesting current session ID from main process...')
  ;(window as any).electronAPI.invoke('analytics:get-session-id')
    .then((sessionId: string | null) => {
      if (sessionId) {
        console.log('[Analytics] Current session ID retrieved:', sessionId)
        analyticsService.setSessionIdFromBroadcast(sessionId)
      } else {
        console.log('[Analytics] No active session in main process')
      }
    })
    .catch((error: any) => {
      console.error('[Analytics] Error requesting current session ID:', error)
    })
}
