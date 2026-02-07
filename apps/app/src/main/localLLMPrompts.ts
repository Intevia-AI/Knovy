/**
 * Prompts adapted for local LLMs (Ollama).
 * Shorter and more structured than cloud prompts to work well with smaller models.
 * Derived from supabase/functions/_shared/prompts.ts (lines 622-741).
 */

interface PromptParams {
  rawText: string
  conversationHistory: string[]
  userLanguage: string
}

interface PromptResult {
  system: string
  user: string
}

const enhancementPrompts: Record<string, (params: PromptParams) => PromptResult> = {
  en: ({ rawText, conversationHistory, userLanguage }) => ({
    system:
      'You are a transcription correction assistant. Fix speech-to-text errors, detect intent, and extract keywords. Return only valid JSON.',
    user: `Fix this transcription. Consider homophones and mishearings.

${conversationHistory.length > 0 ? `Recent context:\n${conversationHistory.join('\n')}\n` : ''}Raw text: "${rawText}"
Language: ${userLanguage}

Tasks:
1. Correct transcription errors (homophones, mishearings, grammar, punctuation)
2. Detect intention (question/command/statement/schedule/reminder/concern/request)
3. Extract new relevant keywords only
4. Set confidence 0.3-1.0 (lower if uncertain)

Return JSON:
{
  "corrected": "fixed text in user language",
  "translation": null,
  "intention": {
    "primary": "statement",
    "confidence": 0.9,
    "suggestedActions": []
  },
  "keywords": [],
  "confidence": 0.9
}`
  }),

  'zh-TW': ({ rawText, conversationHistory, userLanguage }) => ({
    system:
      '你是逐字稿修正助理。修正語音轉文字錯誤，偵測意圖，萃取關鍵字。僅回傳有效 JSON。',
    user: `修正此逐字稿。注意同音字和誤聽。

${conversationHistory.length > 0 ? `最近對話：\n${conversationHistory.join('\n')}\n` : ''}原始文字：「${rawText}」
語言：${userLanguage}

任務：
1. 修正逐字稿錯誤（同音字、誤聽、語法、標點）
2. 偵測意圖（question/command/statement/schedule/reminder/concern/request）
3. 僅萃取新的相關關鍵字
4. 設定信心度 0.3-1.0（不確定時較低）
5. 確保使用繁體中文和台灣用語

回傳 JSON：
{
  "corrected": "修正後的繁體中文文字",
  "translation": null,
  "intention": {
    "primary": "statement",
    "confidence": 0.9,
    "suggestedActions": []
  },
  "keywords": [],
  "confidence": 0.9
}`
  })
}

export function getEnhancementPrompt(params: PromptParams): PromptResult {
  const lang = params.userLanguage === 'zh-TW' ? 'zh-TW' : 'en'
  return enhancementPrompts[lang](params)
}

/**
 * JSON schema for Ollama's `format` parameter.
 * Guarantees structured output matching EnhancedSegment interface.
 */
export function getEnhancementJsonSchema(): object {
  return {
    type: 'object',
    properties: {
      corrected: { type: 'string' },
      translation: { type: ['string', 'null'] },
      intention: {
        type: 'object',
        properties: {
          primary: {
            type: 'string',
            enum: ['question', 'command', 'statement', 'schedule', 'reminder', 'concern', 'request']
          },
          confidence: { type: 'number' },
          suggestedActions: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['primary', 'confidence']
      },
      keywords: {
        type: 'array',
        items: { type: 'string' }
      },
      confidence: { type: 'number' }
    },
    required: ['corrected', 'intention', 'confidence']
  }
}
