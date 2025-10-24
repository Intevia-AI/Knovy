import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  errors?: Array<{ segmentId: string; error: string }>;
}

// Process individual segment
async function enhanceSegment(
  segment: TranscriptionSegment,
  sessionContext: SessionContext,
  geminiClient: any,
): Promise<{ segment: EnhancedSegment; usage: { input_tokens: number; output_tokens: number } }> {
  const lang = getLanguage(sessionContext.userLanguage);
  const prompt = PROMPTS.transcriptionEnhancement[lang].base({
    rawText: segment.rawText,
    conversationHistory: sessionContext.conversationHistory,
    userLanguage: sessionContext.userLanguage,
  });

  try {
    // Use shared Gemini client with JSON parsing
    const { data: enhancementData, usage } = await geminiClient.generateJSON(prompt, {
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

    return {
      segment: enhancedSegment,
      usage: {
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
      },
    };
  } catch (error) {
    console.error(`Failed to enhance segment ${segment.id}:`, error.message);
    // Return fallback enhancement with zero token usage
    return {
      segment: {
        id: segment.id,
        corrected: segment.rawText,
        intention: {
          primary: "statement",
          confidence: 0.3,
          suggestedActions: [],
        },
        keywords: [],
        confidence: 0.3,
      },
      usage: {
        input_tokens: 0,
        output_tokens: 0,
      },
    };
  }
}

const handleRequest = async (req: Request, profile: Record<string, any>) => {
  const startTime = Date.now();

  try {
    console.log(`[transcription-enhance] function invoked at: ${new Date().toISOString()}`);

    // Create Supabase client for logging
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "User not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // Support both unified AI action format and legacy format
    const segments = body.segments || [];
    const sessionContext = body.sessionContext || {
      sessionId: "",
      conversationHistory: body.recent_transcriptions ? [body.recent_transcriptions] : [],
      userLanguage: body.language || "en-US",
    };

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return new Response(
        JSON.stringify({ error: "Segments array is required and cannot be empty" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
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

    // Separate successful enhancements from errors and aggregate usage
    const enhancedSegments: EnhancedSegment[] = [];
    const errors: Array<{ segmentId: string; error: string }> = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    results.forEach((result) => {
      if ("error" in result) {
        errors.push(result as { segmentId: string; error: string });
      } else {
        const enhancementResult = result as {
          segment: EnhancedSegment;
          usage: { input_tokens: number; output_tokens: number };
        };
        enhancedSegments.push(enhancementResult.segment);
        totalInputTokens += enhancementResult.usage.input_tokens;
        totalOutputTokens += enhancementResult.usage.output_tokens;
      }
    });

    // Count source type distribution for analytics
    const microphoneCount = segments.filter(
      (s: TranscriptionSegment) => s.sourceType === "microphone",
    ).length;
    const systemCount = segments.filter(
      (s: TranscriptionSegment) => s.sourceType === "system",
    ).length;

    const processingTime = Date.now() - startTime;

    const response: EnhanceResponse = {
      segments: enhancedSegments,
      processingTime,
      usage: {
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
      },
      ...(errors.length > 0 && { errors }),
    };

    console.log(
      `[transcription-enhance] processed ${segments.length} segments in ${processingTime}ms`,
    );

    // Log feature usage to feature_usage table (analytics)
    try {
      const { error: logError } = await supabaseClient.from("feature_usage").insert({
        user_id: user.id,
        session_id: sessionContext.sessionId || null,
        feature_name: "ai-transcription-enhance",
        feature_category: "ai-action",
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: processingTime,
        success: errors.length === 0,
        metadata: {
          input_tokens: totalInputTokens,
          output_tokens: totalOutputTokens,
          segment_count: segments.length,
          enhanced_count: enhancedSegments.length,
          error_count: errors.length,
          language: sessionContext.userLanguage,
          // Source type distribution for mic vs system preference tracking
          microphone_segments: microphoneCount,
          system_segments: systemCount,
        },
      });

      if (logError) {
        console.error("[transcription-enhance] Failed to log feature usage:", logError);
        // Don't fail the request if logging fails
      }
    } catch (logException) {
      console.error("[transcription-enhance] Exception while logging feature usage:", logException);
      // Don't fail the request if logging fails
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[transcription-enhance] error:", error.message);

    const processingTime = Date.now() - startTime;

    // Log error to feature_usage table
    try {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
      );

      const {
        data: { user },
      } = await supabaseClient.auth.getUser();

      if (user) {
        const { sessionContext } = await req
          .json()
          .catch(() => ({ sessionContext: { sessionId: null } }));

        await supabaseClient.from("feature_usage").insert({
          user_id: user.id,
          session_id: sessionContext?.sessionId || null,
          feature_name: "ai-transcription-enhance",
          feature_category: "ai-action",
          started_at: new Date(startTime).toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: processingTime,
          success: false,
          error_type: error.name || "UnknownError",
          error_message: error.message || "Internal Server Error",
          metadata: {},
        });
      }
    } catch (logException) {
      console.error("[transcription-enhance] Failed to log error:", logException);
    }

    return new Response(
      JSON.stringify({
        error: "Internal Server Error",
        processingTime,
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
};

const transcriptionEnhanceHandler = withEntitlements(
  "allow_ai_action:transcription_enhance",
  "daily_ai_action:transcription_enhance_calls",
  handleRequest,
);

serve(transcriptionEnhanceHandler);
