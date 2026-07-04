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

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const correctionSystemPrompts: Record<string, string> = {
  en: 'You are a speech-to-text correction assistant. Each user message is one raw transcription; earlier assistant messages are your previous corrections, given only as conversation context. Correct the latest user message: fix homophones, mishearings, grammar, and punctuation. Preserve the original meaning and language. Output ONLY the corrected transcription text — no labels, no quotes, no explanations, no commentary.',
  'zh-TW':
    '你是語音轉文字修正助理。每則使用者訊息是一段原始逐字稿；先前的 assistant 訊息是你之前的修正結果，僅作為對話前後文參考。請修正最新一則使用者訊息：修正同音字、誤聽、語法與標點，保留原意。所有輸出必須使用繁體中文（台灣正體）；若包含簡體中文，請轉換為繁體中文。只輸出修正後的逐字稿文字，不要標籤、不要引號、不要說明、不要附加任何評論。'
}

/**
 * Context rides as prior chat turns, never as labelled text inside the user
 * message: small models echo labels like "Recent context:" verbatim, and the
 * echo then feeds back into the next call's context and compounds.
 */
export function getCorrectionPrompt(params: PromptParams): ChatMessage[] {
  const lang = params.userLanguage === 'zh-TW' ? 'zh-TW' : 'en'
  return [
    { role: 'system', content: correctionSystemPrompts[lang] },
    ...params.conversationHistory.map(
      (text): ChatMessage => ({ role: 'assistant', content: text })
    ),
    { role: 'user', content: params.rawText }
  ]
}

/**
 * Guard against known small-model failure modes on the correction prompt.
 * Returns the text when it looks like a real correction, '' to reject —
 * the caller's empty-text path falls back to the raw transcription and
 * keeps the output out of the correction history.
 */
export function sanitizeCorrection(full: string, rawText: string, history: string[]): string {
  const trimmed = full.trim()
  if (!trimmed) return ''

  // Echo of a previous correction instead of correcting the new input.
  if (history.some((entry) => entry.trim() === trimmed)) return ''

  // Prompt scaffolding / meta-commentary vocabulary observed in failures.
  if (/Recent context:|最近對話：|^Transcription:|逐字稿|請翻譯|修正說明|修正後|（註：|以下為/.test(trimmed))
    return ''

  // Runaway output: a correction (even zh output of an English utterance,
  // which is denser per char) stays near the raw length.
  if (trimmed.length > 3 * Math.max(rawText.length, 20)) return ''

  // A single utterance's correction is one paragraph; meta blobs are many.
  if (/\n\s*\n/.test(trimmed)) return ''

  return full
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
    let user = `優先使用對話前後文回答問題。\n`
    if (params.existingSummary) user += `\n對話摘要：\n${params.existingSummary}\n`
    if (params.recentTranscriptions) user += `\n最近逐字稿：\n${params.recentTranscriptions}\n`
    user += `\n使用者問題：「${params.textInput}」\n\n請用繁體中文直接回答：`
    return {
      system: '你是服務台灣使用者的 AI 對話助理。以繁體中文回應，語氣友善且樂於協助。',
      user
    }
  }
  let user = `Prioritize conversation context when answering.\n`
  if (params.existingSummary) user += `\nConversation Summary:\n${params.existingSummary}\n`
  if (params.recentTranscriptions)
    user += `\nRecent Transcriptions:\n${params.recentTranscriptions}\n`
  user += `\nUser Question: "${params.textInput}"\n\nProvide your answer:`
  return {
    system: 'You are a helpful AI chat assistant. Be conversational and helpful.',
    user
  }
}

// ─── Summarize Prompt ───

export interface StructuredSummary {
  short_summary: string
  key_points: string[]
  decisions: string[]
  action_items: string[]
  open_questions: string[]
  topics: string[]
}

export function getSummarizePrompt(params: AIActionParams): PromptResult {
  const lang = params.language === 'zh-TW' ? 'zh-TW' : 'en'
  if (lang === 'zh-TW') {
    let user = params.existingSummary
      ? `先前的摘要（JSON）：\n${params.existingSummary}\n\n新的對話記錄：\n${params.textInput}`
      : `要摘要的對話記錄：\n${params.textInput}`
    user += `\n\n分析對話並填寫每個欄位：
- short_summary：一句話摘要（100 字元以內）
- key_points：主要重點
- decisions：已做出的決定
- action_items：待辦事項
- open_questions：尚未解決的問題
- topics：討論的主題`
    return {
      system:
        '你是摘要助理。分析對話並產生結構化 JSON 摘要。只記錄對話中實際出現的內容；若某欄位沒有內容，回傳空陣列。以繁體中文填寫所有欄位。',
      user
    }
  }
  let user = params.existingSummary
    ? `Previous Summary (JSON):\n${params.existingSummary}\n\nNew Transcripts:\n${params.textInput}`
    : `Transcripts to Summarize:\n${params.textInput}`
  user += `\n\nAnalyze the conversation and fill each field:
- short_summary: one line (max 100 chars)
- key_points: the main points
- decisions: decisions that were made
- action_items: tasks someone committed to
- open_questions: unresolved questions
- topics: subjects discussed`
  return {
    system:
      'You are a summarization assistant. Produce a structured JSON summary. Only record what actually appears in the conversation; if a section has no content, return an empty array.',
    user
  }
}

/**
 * JSON schema for summarize structured output (enforced via Ollama's format param —
 * the single source of truth for the response shape).
 */
export function getSummarizeJsonSchema(): object {
  return {
    type: 'object',
    properties: {
      short_summary: { type: 'string' },
      key_points: { type: 'array', items: { type: 'string' } },
      decisions: { type: 'array', items: { type: 'string' } },
      action_items: { type: 'array', items: { type: 'string' } },
      open_questions: { type: 'array', items: { type: 'string' } },
      topics: { type: 'array', items: { type: 'string' } }
    },
    required: [
      'short_summary',
      'key_points',
      'decisions',
      'action_items',
      'open_questions',
      'topics'
    ]
  }
}

/**
 * Parse and validate a summarize response. Returns null when the content is not
 * a structurally valid summary (caller decides whether to retry or fall back).
 */
export function parseSummarizeResponse(content: string): StructuredSummary | null {
  try {
    const parsed = JSON.parse(content)
    if (typeof parsed?.short_summary !== 'string' || !parsed.short_summary.trim()) return null
    const arrays = ['key_points', 'decisions', 'action_items', 'open_questions', 'topics'] as const
    for (const key of arrays) {
      if (!Array.isArray(parsed[key])) return null
    }
    return parsed as StructuredSummary
  } catch {
    return null
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
  if (params.recentTranscriptions)
    user += `\nRecent Transcriptions:\n${params.recentTranscriptions}\n`
  user += `\nTranscribed Text: "${params.textInput}"\n\nResponse Guidelines:
- Conclusion first (1 sentence)
- Key points (2-3 bullets)
- Concise (≤150 words)

Provide your response:`
  return {
    system:
      'You are an auto-response engine. Analyze transcribed text and provide concise, helpful responses.',
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
  if (params.recentTranscriptions)
    user += `\nRecent Transcriptions:\n${params.recentTranscriptions}\n`
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
    system:
      'You are a response suggestion assistant. Generate exactly 3 concise recommended responses.',
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
  if (params.recentTranscriptions)
    user += `\nRecent Transcriptions:\n${params.recentTranscriptions}\n`
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
  if (params.recentTranscriptions)
    user += `\nRecent Transcriptions:\n${params.recentTranscriptions}\n`
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
