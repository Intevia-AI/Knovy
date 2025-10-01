import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withEntitlements } from "../_shared/rbac.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { PROMPTS, getLanguage } from "../_shared/prompts.ts";
import { getGeminiClient } from "../_shared/gemini-client.ts";

const handleRequest = async (req: Request, profile: Record<string, any>) => {
  try {
    console.log(`[ai-action-screenshot-analysis] function invoked at: ${new Date().toISOString()}`);

    const { text_input, image_input, existing_summary, recent_transcriptions, language } = await req.json();
    if (!text_input || !image_input) {
      return new Response(JSON.stringify({ error: "Prompt and screenshot are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lang = getLanguage(language);
    const prompt = PROMPTS.screenshotAnalysis[lang].base({
      text_input,
      existing_summary,
      recent_transcriptions,
    });

    // Use shared Gemini client for retry logic
    const geminiClient = getGeminiClient({
      temperature: 0.4,
      topK: 32,
      topP: 0.8,
      maxOutputTokens: 2048,
    });

    // For multimodal (image + text), build custom contents
    const contents = [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: image_input.split(",")[1], // Remove base64 prefix
            },
          },
        ],
      },
    ];

    // Call with multimodal contents - retry logic handled internally
    const geminiResponse = await geminiClient.generateContentWithCustomContents(contents);
    const analysis = geminiClient.extractText(geminiResponse);
    const usage = geminiClient.extractUsage(geminiResponse);

    return new Response(JSON.stringify({
      analysis: analysis || "",
      usage: {
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error.message);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

const screenshotAnalysisHandler = withEntitlements(
  "allow_ai_action:screenshot-analysis",
  "daily_ai_action:screenshot-analysis_calls",
  handleRequest,
);

serve(screenshotAnalysisHandler);
