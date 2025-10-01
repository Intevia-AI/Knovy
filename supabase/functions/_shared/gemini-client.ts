/**
 * @fileoverview Shared Gemini API client with retry logic and error handling
 * @description Centralized Gemini API client to be used by all Edge Functions
 */

// Retry configuration for all Gemini API calls
export const GEMINI_RETRY_CONFIG = {
  maxRetries: 3,
  backoffMs: [1000, 2000, 5000], // Exponential backoff
  retryableErrors: [503, 429, 500], // Server errors and rate limits
};

// Gemini API configuration
export interface GeminiConfig {
  temperature?: number;
  topK?: number;
  topP?: number;
  maxOutputTokens?: number;
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export interface GeminiUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

/**
 * Shared Gemini API client with retry logic
 */
export class GeminiClient {
  private apiKey: string;
  private baseConfig: GeminiConfig;

  constructor(apiKey?: string, config?: GeminiConfig) {
    this.apiKey = apiKey || Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") || "";
    if (!this.apiKey) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
    }

    this.baseConfig = {
      temperature: 0.1,
      topK: 1,
      topP: 0.8,
      maxOutputTokens: 2048,
      ...config,
    };
  }

  /**
   * Call Gemini API with retry logic
   */
  async generateContent(
    prompt: string,
    config?: Partial<GeminiConfig>,
    retryCount = 0
  ): Promise<GeminiResponse> {
    try {
      const contents = [{ role: "user", parts: [{ text: prompt }] }];
      const generationConfig = { ...this.baseConfig, ...config };

      const postData = JSON.stringify({
        contents,
        generationConfig,
      });

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: postData,
        },
      );

      if (!res.ok) {
        const errorBody = await res.text();
        console.error(`Gemini API Error (attempt ${retryCount + 1}):`, errorBody);

        // Check if error is retryable
        if (
          GEMINI_RETRY_CONFIG.retryableErrors.includes(res.status) &&
          retryCount < GEMINI_RETRY_CONFIG.maxRetries
        ) {
          const backoffTime = GEMINI_RETRY_CONFIG.backoffMs[retryCount] || 5000;
          console.log(`Retrying Gemini API call in ${backoffTime}ms...`);
          await new Promise((resolve) => setTimeout(resolve, backoffTime));
          return this.generateContent(prompt, config, retryCount + 1);
        }

        throw new Error(`Gemini API request failed with status ${res.status}: ${errorBody}`);
      }

      const geminiResponse: GeminiResponse = await res.json();

      if (!geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error("Invalid response format from Gemini API");
      }

      return geminiResponse;
    } catch (error) {
      if (retryCount < GEMINI_RETRY_CONFIG.maxRetries) {
        const backoffTime = GEMINI_RETRY_CONFIG.backoffMs[retryCount] || 5000;
        console.log(`Network error, retrying Gemini API call in ${backoffTime}ms...`, error.message);
        await new Promise((resolve) => setTimeout(resolve, backoffTime));
        return this.generateContent(prompt, config, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Extract response text from Gemini response
   */
  extractText(response: GeminiResponse): string {
    return response.candidates[0]?.content?.parts[0]?.text || "";
  }

  /**
   * Extract usage metadata from Gemini response
   */
  extractUsage(response: GeminiResponse): GeminiUsage {
    const metadata = response.usageMetadata;
    return {
      input_tokens: metadata?.promptTokenCount || 0,
      output_tokens: metadata?.candidatesTokenCount || 0,
      total_tokens: metadata?.totalTokenCount || 0,
    };
  }

  /**
   * Generate content and extract text in one call
   */
  async generateText(
    prompt: string,
    config?: Partial<GeminiConfig>
  ): Promise<{ text: string; usage: GeminiUsage }> {
    const response = await this.generateContent(prompt, config);
    return {
      text: this.extractText(response),
      usage: this.extractUsage(response),
    };
  }

  /**
   * Generate structured JSON response
   */
  async generateJSON<T = any>(
    prompt: string,
    config?: Partial<GeminiConfig>
  ): Promise<{ data: T; usage: GeminiUsage }> {
    const response = await this.generateContent(prompt, {
      ...config,
      temperature: 0.1, // Lower temperature for more consistent JSON
    });

    const text = this.extractText(response);

    try {
      // Try to extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const data = JSON.parse(jsonMatch[0]);
      return {
        data,
        usage: this.extractUsage(response),
      };
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON:", text);
      throw new Error(`Invalid JSON response: ${parseError.message}`);
    }
  }
}

/**
 * Create a singleton Gemini client instance
 */
let geminiClientInstance: GeminiClient | null = null;

export function getGeminiClient(config?: GeminiConfig): GeminiClient {
  if (!geminiClientInstance) {
    geminiClientInstance = new GeminiClient(undefined, config);
  }
  return geminiClientInstance;
}