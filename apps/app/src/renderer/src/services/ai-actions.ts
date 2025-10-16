/**
 * AI Actions Service
 *
 * Centralized wrapper for all AI action Edge Functions.
 * Automatically injects session_id from analytics service.
 *
 * Benefits:
 * - DRY: Single place to handle session_id logic
 * - Scalable: All current and future AI actions automatically get session_id
 * - Type-safe: TypeScript ensures all calls are properly typed
 * - Maintainable: Change once, affects all AI actions
 */

import { supabase } from './supabaseClient'
import { analyticsService } from './analytics-service'

/**
 * Invoke an AI action Edge Function with automatic session_id injection
 *
 * @template TRequest - The request body type (excluding session_id)
 * @template TResponse - The response data type
 * @param functionName - Name of the Edge Function (e.g., 'ai-action-summarize')
 * @param body - Request body (session_id will be automatically added)
 * @returns Promise with data and error
 *
 * @example
 * ```typescript
 * const { data, error } = await invokeAIAction<SummarizeRequest, SummarizeResponse>(
 *   'ai-action-summarize',
 *   {
 *     text_input: transcription,
 *     existing_summary: summary,
 *     language: 'zh-TW'
 *   }
 * )
 * ```
 */
export async function invokeAIAction<TRequest extends Record<string, any>, TResponse>(
  functionName: string,
  body: TRequest
): Promise<{ data: TResponse | null; error: any }> {
  // Get current session ID from analytics service
  const sessionId = analyticsService.getSessionId()

  // Debug logging
  console.log(`[AI Actions] Session check for ${functionName}:`, {
    sessionId,
    isSessionActive: analyticsService.isSessionActive(),
    hasSessionId: !!sessionId
  })

  if (!sessionId) {
    console.warn(`[AI Actions] ⚠️ No active session when calling ${functionName}`)
  }

  // Inject session_id into request body
  const bodyWithSession = {
    ...body,
    session_id: sessionId
  }

  console.log(`[AI Actions] Invoking ${functionName} with payload:`, {
    functionName,
    session_id: sessionId,
    bodyKeys: Object.keys(bodyWithSession)
  })

  // Call Edge Function
  const { data, error } = await supabase.functions.invoke<TResponse>(functionName, {
    body: bodyWithSession
  })

  if (error) {
    console.error(`[AI Actions] Error calling ${functionName}:`, error)
  } else {
    console.log(`[AI Actions] ✓ ${functionName} completed successfully with session_id: ${sessionId}`)
  }

  return { data, error }
}

/**
 * Type definitions for AI action requests and responses
 */

export interface SummarizeRequest {
  text_input: string
  existing_summary?: string
  language?: string
}

export interface SummarizeResponse {
  summary: string
  short_summary: string
  long_summary: string
  context: {
    participants: string[]
    topics: string[]
    keywords: string[]
    time_context: string | null
    scenario: string | null
    key_points: string[]
  }
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

export interface ChatRequest {
  text_input: string
  existing_summary?: string
  recent_transcriptions?: string
  language?: string
}

export interface ChatResponse {
  response: string
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

export interface KeywordSearchRequest {
  text_input: string
  existing_summary?: string
  recent_transcriptions?: string
  language?: string
}

export interface KeywordSearchResponse {
  response: string
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

export interface RecommendResponseRequest {
  text_input: string
  language?: string
}

export interface RecommendResponseResponse {
  response: string
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

export interface ScreenshotAnalysisRequest {
  text_input: string
  image_data?: string // Base64 encoded image
  existing_summary?: string
  recent_transcriptions?: string
  language?: string
}

export interface ScreenshotAnalysisResponse {
  response: string
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

export interface TranscriptionEnhanceRequest {
  segments: Array<{
    id: string
    text: string
    timestamp: number
  }>
  language?: string
}

export interface TranscriptionEnhanceResponse {
  enhanced_segments: Array<{
    id: string
    enhanced_text: string
    keywords?: string[]
    intention?: string
  }>
  usage: {
    input_tokens: number
    output_tokens: number
  }
}
