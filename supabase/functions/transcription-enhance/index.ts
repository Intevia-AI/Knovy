import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withEntitlements } from "../_shared/rbac.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getLanguage, PROMPTS } from "../_shared/prompts.ts";
import { getGeminiClient } from "../_shared/gemini-client.ts";

// Enhanced interfaces based on plan specifications
interface TranscriptionSegment {
  id: string;
  rawText: string;
  timestamp: number;
  sourceType: "microphone" | "system";
}

interface SessionContext {
  sessionId: string;
  conversationHistory: string[];
  userLanguage: string;
}

interface EnhanceRequest {
  segments: TranscriptionSegment[];
  sessionContext: SessionContext;
}

interface EnhancedSegment {
  id: string;
  corrected: string;
  translation?: string;
  intention: {
    primary: "question" | "command" | "statement" | "schedule" | "reminder" | "concern" | "request";
    confidence: number;
    suggestedActions?: string[];
  };
  keywords?: string[];
  confidence: number;
}

interface EnhanceResponse {
  segments: EnhancedSegment[];
  processingTime: number;
  errors?: Array<{ segmentId: string; error: string }>;
}



// Process individual segment
async function enhanceSegment(
  segment: TranscriptionSegment,
  sessionContext: SessionContext,
  geminiClient: any
): Promise<EnhancedSegment> {
  const lang = getLanguage(sessionContext.userLanguage);
  const prompt = PROMPTS.transcriptionEnhancement[lang].base({
    rawText: segment.rawText,
    conversationHistory: sessionContext.conversationHistory,
    userLanguage: sessionContext.userLanguage,
  });

  try {
    // Use shared Gemini client with JSON parsing
    const { data: enhancementData } = await geminiClient.generateJSON(prompt, {
      temperature: 0.1,
      maxOutputTokens: 1024,
    });

    // Validate and sanitize response
    const enhancedSegment: EnhancedSegment = {
      id: segment.id,
      corrected: enhancementData.corrected || segment.rawText,
      translation: enhancementData.translation || undefined,
      intention: {
        primary: enhancementData.intention?.primary || "statement",
        confidence: Math.min(Math.max(enhancementData.intention?.confidence || 0.5, 0), 1),
        suggestedActions: enhancementData.intention?.suggestedActions || [],
      },
      keywords: Array.isArray(enhancementData.keywords) ? enhancementData.keywords : [],
      confidence: Math.min(Math.max(enhancementData.confidence || 0.5, 0), 1),
    };

    return enhancedSegment;
  } catch (error) {
    console.error(`Failed to enhance segment ${segment.id}:`, error.message);
    // Return fallback enhancement
    return {
      id: segment.id,
      corrected: segment.rawText,
      intention: {
        primary: "statement",
        confidence: 0.3,
        suggestedActions: [],
      },
      keywords: [],
      confidence: 0.3,
    };
  }
}

const handleRequest = async (req: Request, profile: Record<string, any>) => {
  const startTime = Date.now();

  try {
    console.log(`[transcription-enhance] function invoked at: ${new Date().toISOString()}`);

    const body = await req.json();

    // Support both unified AI action format and legacy format
    const segments = body.segments || [];
    const sessionContext = body.sessionContext || {
      sessionId: '',
      conversationHistory: body.recent_transcriptions ? [body.recent_transcriptions] : [],
      userLanguage: body.language || 'en-US'
    };

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return new Response(JSON.stringify({ error: "Segments array is required and cannot be empty" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!sessionContext || !sessionContext.sessionId) {
      return new Response(JSON.stringify({ error: "Session context with sessionId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize shared Gemini client
    const geminiClient = getGeminiClient({
      temperature: 0.1,
      topK: 1,
      topP: 0.8,
      maxOutputTokens: 1024,
    });

    // Process segments in parallel with error handling
    const enhancementPromises = segments.map(async (segment) => {
      try {
        return await enhanceSegment(segment, sessionContext, geminiClient);
      } catch (error) {
        console.error(`Error processing segment ${segment.id}:`, error.message);
        return {
          segmentId: segment.id,
          error: error.message,
        };
      }
    });

    const results = await Promise.all(enhancementPromises);

    // Separate successful enhancements from errors
    const enhancedSegments: EnhancedSegment[] = [];
    const errors: Array<{ segmentId: string; error: string }> = [];

    results.forEach((result) => {
      if ('error' in result) {
        errors.push(result as { segmentId: string; error: string });
      } else {
        enhancedSegments.push(result as EnhancedSegment);
      }
    });

    const processingTime = Date.now() - startTime;

    const response: EnhanceResponse = {
      segments: enhancedSegments,
      processingTime,
      ...(errors.length > 0 && { errors }),
    };

    console.log(`[transcription-enhance] processed ${segments.length} segments in ${processingTime}ms`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[transcription-enhance] error:", error.message);

    const processingTime = Date.now() - startTime;

    return new Response(JSON.stringify({
      error: "Internal Server Error",
      processingTime,
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

const transcriptionEnhanceHandler = withEntitlements(
  "allow_ai_action:transcription_enhance",
  "daily_ai_action:transcription_enhance_calls",
  handleRequest,
);

serve(transcriptionEnhanceHandler);