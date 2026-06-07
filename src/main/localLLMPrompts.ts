/**
 * Prompts adapted for local LLMs (Ollama).
 * Shorter and more structured than cloud prompts to work well with smaller models.
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

const correctionPrompts: Record<string, (params: PromptParams) => PromptResult> = {
  en: ({ rawText, conversationHistory }) => ({
    system:
      'You are a speech-to-text correction assistant. Output ONLY the corrected transcription text — no labels, no quotes, no explanations, no commentary.',
    user: `Correct this speech-to-text transcription. Fix homophones, mishearings, grammar, and punctuation. Preserve the original meaning and language. Output only the corrected text.

${conversationHistory.length > 0 ? `Recent context:\n${conversationHistory.join('\n')}\n\n` : ''}Transcription: ${rawText}`
  }),

  'zh-TW': ({ rawText, conversationHistory }) => ({
    system:
      '你是語音轉文字修正助理。所有輸出必須使用繁體中文（台灣正體）。只輸出修正後的逐字稿文字，不要標籤、不要引號、不要說明、不要附加任何評論。',
    user: `修正以下語音轉文字逐字稿。修正同音字、誤聽、語法與標點，保留原意。若包含簡體中文，請轉換為繁體中文。只輸出修正後的文字。

${conversationHistory.length > 0 ? `最近對話：\n${conversationHistory.join('\n')}\n\n` : ''}逐字稿：${rawText}`
  })
}

export function getCorrectionPrompt(params: PromptParams): PromptResult {
  const lang = params.userLanguage === 'zh-TW' ? 'zh-TW' : 'en'
  return correctionPrompts[lang](params)
}

// ─── AI Action Prompt Types ───

interface AIActionParams {
  textInput: string
  existingSummary?: string
  recentTranscriptions?: string
  language: string
}

interface ScreenshotAnalysisParams extends AIActionParams {
  imageDescription?: string
}

// ─── Chat Prompt ───

export function getChatPrompt(params: AIActionParams): PromptResult {
  const lang = params.language === 'zh-TW' ? 'zh-TW' : 'en'
  if (lang === 'zh-TW') {
    let user = `你是服務台灣使用者的 AI 助理。優先使用對話前後文回答問題。\n`
    if (params.existingSummary) user += `\n對話摘要：\n${params.existingSummary}\n`
    if (params.recentTranscriptions) user += `\n最近逐字稿：\n${params.recentTranscriptions}\n`
    user += `\n使用者問題：「${params.textInput}」\n\n請用繁體中文直接回答：`
    return {
      system: '你是服務台灣使用者的 AI 對話助理。以繁體中文回應，語氣友善且樂於協助。',
      user
    }
  }
  let user = `You are a helpful AI assistant. Prioritize conversation context when answering.\n`
  if (params.existingSummary) user += `\nConversation Summary:\n${params.existingSummary}\n`
  if (params.recentTranscriptions) user += `\nRecent Transcriptions:\n${params.recentTranscriptions}\n`
  user += `\nUser Question: "${params.textInput}"\n\nProvide your answer:`
  return {
    system: 'You are a helpful AI chat assistant. Be conversational and helpful.',
    user
  }
}

// ─── Summarize Prompt ───

export function getSummarizePrompt(params: AIActionParams): PromptResult {
  const lang = params.language === 'zh-TW' ? 'zh-TW' : 'en'
  if (lang === 'zh-TW') {
    let user = params.existingSummary
      ? `先前的摘要：\n${params.existingSummary}\n\n新的對話記錄：\n${params.textInput}`
      : `要摘要的對話記錄：\n${params.textInput}`
    user += `\n\n分析對話並回傳 JSON：
{
  "short_summary": "一句話摘要（80-100字元）",
  "long_summary": "Markdown 格式詳細摘要",
  "context": {
    "participants": [],
    "topics": [],
    "keywords": [],
    "time_context": null,
    "scenario": null,
    "key_points": []
  }
}

只回傳 JSON。`
    return {
      system: '你是摘要助理。分析對話並產生結構化 JSON 摘要。僅回傳有效 JSON。',
      user
    }
  }
  let user = params.existingSummary
    ? `Previous Summary:\n${params.existingSummary}\n\nNew Transcripts:\n${params.textInput}`
    : `Transcripts to Summarize:\n${params.textInput}`
  user += `\n\nAnalyze and return JSON:
{
  "short_summary": "One-line summary (80-100 chars)",
  "long_summary": "Detailed Markdown summary",
  "context": {
    "participants": [],
    "topics": [],
    "keywords": [],
    "time_context": null,
    "scenario": null,
    "key_points": []
  }
}

Return ONLY JSON.`
  return {
    system: 'You are a summarization assistant. Analyze conversations and produce structured JSON summaries. Return only valid JSON.',
    user
  }
}

/**
 * JSON schema for summarize structured output.
 */
export function getSummarizeJsonSchema(): object {
  return {
    type: 'object',
    properties: {
      short_summary: { type: 'string' },
      long_summary: { type: 'string' },
      context: {
        type: 'object',
        properties: {
          participants: { type: 'array', items: { type: 'string' } },
          topics: { type: 'array', items: { type: 'string' } },
          keywords: { type: 'array', items: { type: 'string' } },
          time_context: { type: ['string', 'null'] },
          scenario: { type: ['string', 'null'] },
          key_points: { type: 'array', items: { type: 'string' } }
        },
        required: ['participants', 'topics', 'keywords', 'key_points']
      }
    },
    required: ['short_summary', 'long_summary', 'context']
  }
}

// ─── Recommend Response Prompt ───

export function getRecommendResponsePrompt(params: AIActionParams): PromptResult {
  const lang = params.language === 'zh-TW' ? 'zh-TW' : 'en'
  if (lang === 'zh-TW') {
    let user = `分析轉錄的問題/陳述並提供有用的回應。\n`
    if (params.existingSummary) user += `\n對話摘要：\n${params.existingSummary}\n`
    if (params.recentTranscriptions) user += `\n最近轉錄：\n${params.recentTranscriptions}\n`
    user += `\n轉錄文字：「${params.textInput}」\n\n回應指引：
- 結論在前（1句話）
- 重點（2-3點）
- 簡潔（≤150字）

請提供回應：`
    return {
      system: '你是「自動建議回覆」引擎。分析轉錄文字並提供簡潔有用的回應。以繁體中文回應。',
      user
    }
  }
  let user = `Analyze the transcribed question/statement and provide a helpful response.\n`
  if (params.existingSummary) user += `\nConversation Summary:\n${params.existingSummary}\n`
  if (params.recentTranscriptions) user += `\nRecent Transcriptions:\n${params.recentTranscriptions}\n`
  user += `\nTranscribed Text: "${params.textInput}"\n\nResponse Guidelines:
- Conclusion first (1 sentence)
- Key points (2-3 bullets)
- Concise (≤150 words)

Provide your response:`
  return {
    system: 'You are an auto-response engine. Analyze transcribed text and provide concise, helpful responses.',
    user
  }
}

// ─── Deep Response Prompt ───

export function getDeepResponsePrompt(params: AIActionParams): PromptResult {
  const lang = params.language === 'zh-TW' ? 'zh-TW' : 'en'
  if (lang === 'zh-TW') {
    let user = `針對以下內容產生恰好 3 個簡潔的建議回覆：「${params.textInput}」\n`
    if (params.existingSummary) user += `\n對話摘要：\n${params.existingSummary}\n`
    if (params.recentTranscriptions) user += `\n最近逐字稿：\n${params.recentTranscriptions}\n`
    user += `\n要求：
- 恰好 3 個回覆選項，每個 10-20 字
- 選項 1：直接且資訊性
- 選項 2：對話式且友善
- 選項 3：行動導向

格式（每行一個）：
1. [回覆]
2. [回覆]
3. [回覆]`
    return {
      system: '你是回覆建議助理。產生 3 個簡潔的建議回覆。以繁體中文回應。',
      user
    }
  }
  let user = `Generate exactly 3 concise recommended responses to: "${params.textInput}"\n`
  if (params.existingSummary) user += `\nConversation Summary:\n${params.existingSummary}\n`
  if (params.recentTranscriptions) user += `\nRecent Transcriptions:\n${params.recentTranscriptions}\n`
  user += `\nRequirements:
- Exactly 3 response options, each 10-20 words
- Option 1: Direct and informative
- Option 2: Conversational and friendly
- Option 3: Action-oriented

Format (one per line):
1. [response]
2. [response]
3. [response]`
  return {
    system: 'You are a response suggestion assistant. Generate exactly 3 concise recommended responses.',
    user
  }
}

// ─── Keyword Search Prompt ───

export function getKeywordSearchPrompt(params: AIActionParams): PromptResult {
  const lang = params.language === 'zh-TW' ? 'zh-TW' : 'en'
  if (lang === 'zh-TW') {
    const hasContext = !!(params.existingSummary || params.recentTranscriptions)
    let user = `為以下內容提供清晰、有用的解釋：「${params.textInput}」\n`
    if (params.existingSummary) user += `\n對話摘要：\n${params.existingSummary}\n`
    if (params.recentTranscriptions) user += `\n最近逐字稿：\n${params.recentTranscriptions}\n`
    user += `\n${hasContext ? '請根據對話前後文客製化回應。' : '請提供通用資訊性的解釋。'}
保持精簡但完整（2-4 句話）。請用繁體中文回應：`
    return {
      system: '你是知識助理。提供清晰、簡潔的解釋。以繁體中文回應。',
      user
    }
  }
  const hasContext = !!(params.existingSummary || params.recentTranscriptions)
  let user = `Provide a clear, helpful explanation for: "${params.textInput}"\n`
  if (params.existingSummary) user += `\nConversation Summary:\n${params.existingSummary}\n`
  if (params.recentTranscriptions) user += `\nRecent Transcriptions:\n${params.recentTranscriptions}\n`
  user += `\n${hasContext ? 'Tailor your response to the conversation context.' : 'Provide a general, informative explanation.'}
Keep concise but comprehensive (2-4 sentences). Respond in English:`
  return {
    system: 'You are a knowledge assistant. Provide clear, concise explanations.',
    user
  }
}

// ─── Screenshot Analysis Prompt ───

export function getScreenshotAnalysisPrompt(params: ScreenshotAnalysisParams): PromptResult {
  const lang = params.language === 'zh-TW' ? 'zh-TW' : 'en'
  if (lang === 'zh-TW') {
    let user = `分析提供的截圖並回答：「${params.textInput}」\n`
    if (params.existingSummary) user += `\n對話摘要：\n${params.existingSummary}\n`
    if (params.recentTranscriptions) user += `\n最近逐字稿：\n${params.recentTranscriptions}\n`
    user += `\n回應指引：
- 直接回答問題
- 描述圖片中的關鍵細節
- 結合對話前後文
- 以繁體中文回應`
    return {
      system: '你是圖片分析助理。分析截圖並提供有用的見解。以繁體中文回應。',
      user
    }
  }
  let user = `Analyze the provided screenshot and answer: "${params.textInput}"\n`
  if (params.existingSummary) user += `\nConversation Summary:\n${params.existingSummary}\n`
  if (params.recentTranscriptions) user += `\nRecent Transcriptions:\n${params.recentTranscriptions}\n`
  user += `\nResponse Guidelines:
- Answer the question directly
- Describe key details visible in the image
- Connect to conversation context
- Respond in English`
  return {
    system: 'You are a screenshot analysis assistant. Analyze images and provide useful insights.',
    user
  }
}
