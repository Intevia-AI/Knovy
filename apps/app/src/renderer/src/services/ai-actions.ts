/**
 * AI Actions Service
 *
 * Centralized wrapper for all AI action Edge Functions.
 */

import { supabase } from './supabaseClient'

/**
 * Invoke an AI action Edge Function
 *
 * @template TRequest - The request body type
 * @template TResponse - The response data type
 * @param functionName - Name of the Edge Function (e.g., 'ai-action-summarize')
 * @param body - Request body
 * @returns Promise with data and error
 */
export async function invokeAIAction<TRequest extends Record<string, any>, TResponse>(
  functionName: string,
  body: TRequest
): Promise<{ data: TResponse | null; error: any }> {
  console.log(`[AI Actions] Invoking ${functionName} with payload:`, {
    functionName,
    bodyKeys: Object.keys(body)
  })

  // Call Edge Function
  const { data, error } = await supabase.functions.invoke<TResponse>(functionName, {
    body
  })

  if (error) {
    console.error(`[AI Actions] Error calling ${functionName}:`, error)
  } else {
    console.log(`[AI Actions] ✓ ${functionName} completed successfully`)
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
  existing_summary?: string
  recent_transcriptions?: string
  language?: string
}

export interface RecommendResponseResponse {
  recommendation: string
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

export interface DeepResponseRequest {
  text_input: string
  existing_summary?: string
  recent_transcriptions?: string
  language?: string
}

export interface DeepResponseResponse {
  recommendation: string
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
