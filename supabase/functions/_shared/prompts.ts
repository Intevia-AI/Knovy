/**
 * @fileoverview Centralized, simple, and consistent prompts for all AI actions.
 * @description This file consolidates all prompts used by Supabase Edge Functions
 * to improve maintainability and support for multiple languages.
 */

// Using a consistent 'lang' type for clarity
type Language = "en" | "zh-TW";

// A simple helper to get the language, defaulting to 'en'
export const getLanguage = (langCode?: string): Language => {
  return langCode === "zh-TW" ? "zh-TW" : "en";
};

export const PROMPTS = {
  chat: {
    en: {
      base: ({
        existing_summary,
        recent_transcriptions,
        text_input,
      }: {
        existing_summary?: string;
        recent_transcriptions?: string;
        text_input: string;
      }) => {
        let prompt = `You are a helpful AI chat assistant. **Prioritize conversation context** when answering questions.

**CONTEXT PRIORITY**:
1. If user's question mentions topics/keywords from the conversation → Use conversation context as PRIMARY source
2. If no relevant context is found → Use general knowledge but still provide complete answer
3. Never refuse to answer due to lack of context

`;

        if (existing_summary) {
          prompt += `\n**CONVERSATION SUMMARY**:\n${existing_summary}\n`;
        }

        if (recent_transcriptions) {
          prompt += `\n**RECENT TRANSCRIPTIONS**:\n${recent_transcriptions}\n`;
        }

        prompt += `\n**USER QUESTION**: "${text_input}"

**RESPONSE GUIDELINES**:
- **Context Match**: If question relates to conversation topics/keywords, answer primarily from context
- **Conflict Resolution**: If context conflicts, use most recent information and explain briefly
- **No Context**: If no relevant context, provide complete answer from general knowledge
- **Format**: Lead with direct answer, then key points
- **Tone**: Conversational and helpful
- **Language**: Respond in English

Provide your answer now:`;
        return prompt;
      },
    },
    "zh-TW": {
      base: ({
        existing_summary,
        recent_transcriptions,
        text_input,
      }: {
        existing_summary?: string;
        recent_transcriptions?: string;
        text_input: string;
      }) => {
        let prompt = `你是服務台灣使用者的 AI 助理，熟悉台灣的文化、用語、時事和在地知識。**優先使用對話前後文**來回答問題。

**前後文優先順序**：
1. 如果使用者問題提及對話中的主題/關鍵字 → 以對話前後文為主要資訊來源
2. 如果找不到相關前後文 → 使用一般知識但仍提供完整回答
3. 絕不因缺乏前後文而拒絕回答

`;

        if (existing_summary) {
          prompt += `\n**對話摘要**：\n${existing_summary}\n`;
        }

        if (recent_transcriptions) {
          prompt += `\n**最近的逐字稿**：\n${recent_transcriptions}\n`;
        }

        prompt += `\n**使用者問題**：「${text_input}」

**回應指引**：
- **前後文配對**：如果問題與對話主題/關鍵字相關，主要從前後文回答
- **衝突處理**：如果前後文有衝突，使用最新資訊並簡短說明
- **無前後文**：如果無相關前後文，從一般知識提供完整回答
- **格式**：先給直接答案，再列重點
- **語氣**：對話式且樂於協助
- **語言**：以繁體中文回應

請現在提供你的回答：`;
        return prompt;
      },
    },
  },
  keywordSearch: {
    en: {
      base: ({
        text_input,
        existing_summary,
        recent_transcriptions,
      }: {
        text_input: string;
        existing_summary?: string;
        recent_transcriptions?: string;
      }) => {
        let prompt = `Provide a clear, helpful explanation for: "${text_input}"

`;

        // Explicitly handle the no-context scenario
        const hasContext = !!(existing_summary || recent_transcriptions);

        if (hasContext) {
          prompt += `**CONTEXT AVAILABLE** - Tailor your response to the user's specific situation:\n`;
        } else {
          prompt += `**NO CONTEXT** - Provide a general, informative explanation based on your knowledge.\n`;
        }

        if (existing_summary) {
          prompt += `\nConversation Summary:\n${existing_summary}\n`;
        }

        if (recent_transcriptions) {
          prompt += `\nRecent Transcriptions:\n${recent_transcriptions}\n`;
        }

        prompt += `\n**RESPONSE GUIDELINES**:
- **Clarity**: Use simple, accessible language
- **Accuracy**: Provide factual, reliable information
- **Relevance**: ${hasContext ? "Connect to conversation context when relevant" : "Focus on practical, useful information"}
- **Examples**: Include relevant examples or use cases
- **Length**: Keep concise but comprehensive (2-4 sentences)
- **Technical Terms**: Explain in accessible terms if needed

Provide your explanation in English:`;

        return prompt;
      },
    },
    "zh-TW": {
      base: ({
        text_input,
        existing_summary,
        recent_transcriptions,
      }: {
        text_input: string;
        existing_summary?: string;
        recent_transcriptions?: string;
      }) => {
        let prompt = `你是服務台灣使用者的 AI 助理，熟悉台灣的文化、用語、時事和在地知識。請為以下內容提供清晰、有用的解釋：「${text_input}」

`;

        // 明確處理無前後文的情況
        const hasContext = !!(existing_summary || recent_transcriptions);

        if (hasContext) {
          prompt += `**有可用的前後文** - 請根據使用者的具體情況客製化回應：\n`;
        } else {
          prompt += `**無前後文** - 請根據你的知識提供通用且資訊豐富的解釋。\n`;
        }

        if (existing_summary) {
          prompt += `\n對話摘要：\n${existing_summary}\n`;
        }

        if (recent_transcriptions) {
          prompt += `\n最近的對話逐字稿：\n${recent_transcriptions}\n`;
        }

        prompt += `\n**回應指引**：
- **清晰度**：使用簡單易懂的語言
- **準確性**：提供事實可靠的資訊
- **相關性**：${hasContext ? "在相關時連結對話前後文" : "專注於實用有用的資訊"}
- **範例**：包含相關範例或使用情境
- **長度**：保持精簡但完整（2-4 句話）
- **技術術語**：如需要請用淺顯易懂的方式解釋

請用繁體中文提供你的解釋：`;

        return prompt;
      },
    },
  },
  recommendResponse: {
    en: {
      base: ({
        text_input,
        existing_summary,
        recent_transcriptions,
      }: {
        text_input: string;
        existing_summary?: string;
        recent_transcriptions?: string;
      }) => {
        let prompt = `Generate exactly 3 concise recommended responses to: "${text_input}"

`;

        if (existing_summary) {
          prompt += `CONVERSATION SUMMARY:\n${existing_summary}\n\n`;
        }
        if (recent_transcriptions) {
          prompt += `RECENT TRANSCRIPTIONS:\n${recent_transcriptions}\n\n`;
        }

        prompt += `**REQUIREMENTS**:
- Return exactly 3 different response options
- Each response: 10-20 words maximum
- Make them diverse in tone/approach:
  * Option 1: Direct and informative
  * Option 2: Conversational and friendly
  * Option 3: Action-oriented or question-based
- Use conversation context when available
- Keep language simple and natural

**OUTPUT FORMAT** (plain text, one per line):
1. [First concise response]
2. [Second concise response]
3. [Third concise response]

Generate the 3 responses now:`;

        return prompt;
      },
    },
    "zh-TW": {
      base: ({
        text_input,
        existing_summary,
        recent_transcriptions,
      }: {
        text_input: string;
        existing_summary?: string;
        recent_transcriptions?: string;
      }) => {
        let prompt = `你是服務台灣使用者的 AI 助理，熟悉台灣的文化、用語、時事和在地知識。請針對以下內容產生恰好 3 個簡潔的建議回覆：「${text_input}」

`;

        if (existing_summary) {
          prompt += `對話摘要：\n${existing_summary}\n\n`;
        }
        if (recent_transcriptions) {
          prompt += `最近的逐字稿：\n${recent_transcriptions}\n\n`;
        }

        prompt += `**要求**：
- 回傳恰好 3 個不同的回覆選項
- 每個回覆：10-20 字以內
- 讓它們在語氣/方式上有所不同：
  * 選項 1：直接且資訊性
  * 選項 2：對話式且友善
  * 選項 3：行動導向或提問式
- 有對話前後文時請善加利用
- 保持語言簡單自然

**輸出格式**（純文字，每行一個）：
1. [第一個簡潔回覆]
2. [第二個簡潔回覆]
3. [第三個簡潔回覆]

請現在產生 3 個回覆：`;

        return prompt;
      },
    },
  },
  screenshotAnalysis: {
    en: {
      base: ({
        text_input,
        existing_summary,
        recent_transcriptions,
      }: {
        text_input: string;
        existing_summary?: string;
        recent_transcriptions?: string;
      }) => {
        let prompt = `Analyze the provided screenshot and answer: "${text_input}"

**ANALYSIS APPROACH**:
1. **Understand Context**: Use conversation context to understand what user is looking for
2. **Detailed Observation**: Analyze image content thoroughly
3. **Targeted Response**: Answer the specific question or provide comprehensive analysis if question is general
4. **Structured Output**: Use clear formatting (lists, sections) for readability

`;

        if (existing_summary) {
          prompt += `\n**CONVERSATION SUMMARY**:\n${existing_summary}\n`;
        }

        if (recent_transcriptions) {
          prompt += `\n**RECENT TRANSCRIPTIONS**:\n${recent_transcriptions}\n`;
        }

        prompt += `\n**RESPONSE GUIDELINES**:
- If question is specific: Answer directly with evidence from image
- If question is general: Provide comprehensive analysis covering:
  * Main subject/content
  * Key details or data visible
  * Relevant context from conversation
  * Actionable insights if applicable
- Use conversation context to tailor analysis
- Be accurate and factual
- Respond in English

Provide your analysis now:`;
        return prompt;
      },
    },
    "zh-TW": {
      base: ({
        text_input,
        existing_summary,
        recent_transcriptions,
      }: {
        text_input: string;
        existing_summary?: string;
        recent_transcriptions?: string;
      }) => {
        let prompt = `你是服務台灣使用者的 AI 助理，熟悉台灣的文化、用語、時事和在地知識。請分析提供的截圖並回答：「${text_input}」

**分析方法**：
1. **理解前後文**：使用對話前後文來理解使用者在尋找什麼
2. **詳細觀察**：徹底分析圖片內容
3. **針對性回應**：回答特定問題，或在問題籠統時提供全面分析
4. **結構化輸出**：使用清晰格式（列表、區段）以提升可讀性

`;

        if (existing_summary) {
          prompt += `\n**對話摘要**：\n${existing_summary}\n`;
        }

        if (recent_transcriptions) {
          prompt += `\n**最近的逐字稿**：\n${recent_transcriptions}\n`;
        }

        prompt += `\n**回應指引**：
- 如果問題具體：直接回答並提供圖片中的證據
- 如果問題籠統：提供簡短分析，包含：
  * 主要主題/內容
  * 可見的關鍵細節或數據
  * 來自對話的相關前後文
  * 適用時提供可行的見解
- 使用對話前後文調整分析
- 準確且基於事實
- 以繁體中文回應

請現在提供你的分析：`;
        return prompt;
      },
    },
  },
  summarize: {
    en: {
      with_previous: (text_input: string, existing_summary: string) =>
        `You are given a previous summary and new conversation transcripts. Your task is to produce a structured JSON response with both a comprehensive summary and extracted context.

**IMPORTANT**: You must return ONLY valid JSON. Do not include any explanatory text before or after the JSON.

Previous Summary:
${existing_summary}

New Transcripts:
${text_input}

Analyze the transcripts and return a JSON object with this EXACT structure:
{
  "short_summary": "A one-line summary (80-100 characters) capturing the main theme",
  "long_summary": "A detailed Markdown-formatted summary with embedded context at the beginning. Start with a brief paragraph mentioning the scenario, participants, and topics (if identifiable), then provide numbered key points. Do NOT use a 'Summary' heading.",
  "context": {
    "participants": ["Name1", "Name2"],
    "topics": ["Topic1", "Topic2"],
    "keywords": ["technical_term1", "technical_term2"],
    "time_context": "e.g., 'Q4 planning', 'morning standup', or null if not mentioned",
    "scenario": "e.g., 'meeting', 'lecture', 'interview', 'casual conversation', or null",
    "key_points": ["Main takeaway 1", "Main takeaway 2"]
  }
}

Guidelines:
- **short_summary**: Keep it concise, 80-100 characters, one complete sentence
- **long_summary**: Begin with context paragraph (e.g., "This was a team meeting with John and Sarah discussing product launch..."), then use markdown headings and numbered lists for key points
- **participants**: Extract names if mentioned, otherwise empty array
- **topics**: Main themes discussed (3-5 items max)
- **keywords**: Technical terms, specialized vocabulary, acronyms (5-10 items max, high-signal only)
- **time_context**: Temporal references like "Q4", "morning", "next week"
- **scenario**: Type of conversation
- **key_points**: Main outcomes, decisions, or takeaways (3-7 items)

Return ONLY the JSON object, nothing else.`,
      without_previous: (text_input: string) =>
        `You are tasked with creating a structured summary of a conversation. Your task is to produce a JSON response with both a comprehensive summary and extracted context.

**IMPORTANT**: You must return ONLY valid JSON. Do not include any explanatory text before or after the JSON.

Transcripts to Summarize:
${text_input}

Analyze the transcripts and return a JSON object with this EXACT structure:
{
  "short_summary": "A one-line summary (80-100 characters) capturing the main theme",
  "long_summary": "A detailed Markdown-formatted summary with embedded context at the beginning. Start with a brief paragraph mentioning the scenario, participants, and topics (if identifiable), then provide numbered key points. Do NOT use a 'Summary' heading.",
  "context": {
    "participants": ["Name1", "Name2"],
    "topics": ["Topic1", "Topic2"],
    "keywords": ["technical_term1", "technical_term2"],
    "time_context": "e.g., 'Q4 planning', 'morning standup', or null if not mentioned",
    "scenario": "e.g., 'meeting', 'lecture', 'interview', 'casual conversation', or null",
    "key_points": ["Main takeaway 1", "Main takeaway 2"]
  }
}

Guidelines:
- **short_summary**: Keep it concise, 80-100 characters, one complete sentence
- **long_summary**: Begin with context paragraph (e.g., "This was a team meeting with John and Sarah discussing product launch..."), then use markdown headings and numbered lists for key points
- **participants**: Extract names if mentioned, otherwise empty array
- **topics**: Main themes discussed (3-5 items max)
- **keywords**: Technical terms, specialized vocabulary, acronyms (5-10 items max, high-signal only)
- **time_context**: Temporal references like "Q4", "morning", "next week"
- **scenario**: Type of conversation
- **key_points**: Main outcomes, decisions, or takeaways (3-7 items)

Return ONLY the JSON object, nothing else.`,
    },
    "zh-TW": {
      with_previous: (text_input: string, existing_summary: string) =>
        `你正在處理一份先前的摘要和新的對話記錄。你的任務是產生一個結構化的 JSON 回應，包含完整摘要和提取的前後文資訊。

**重要**：你必須只回傳有效的 JSON。不要在 JSON 前後加上任何說明文字。

先前的摘要：
${existing_summary}

新的對話記錄：
${text_input}

分析對話記錄並回傳符合以下確切結構的 JSON 物件：
{
  "short_summary": "一句話摘要（80-100字元）概括主要主題",
  "long_summary": "詳細的 Markdown 格式摘要，開頭嵌入前後文。從簡短段落開始，提及情境、參與者和主題（如果可識別），然後提供編號的重點。不要使用「摘要」標題。",
  "context": {
    "participants": ["姓名1", "姓名2"],
    "topics": ["主題1", "主題2"],
    "keywords": ["技術術語1", "技術術語2"],
    "time_context": "例如：「第四季規劃」、「晨間站會」，或如果未提及則為 null",
    "scenario": "例如：「會議」、「演講」、「訪談」、「閒聊」，或 null",
    "key_points": ["主要收穫 1", "主要收穫 2"]
  }
}

指引：
- **short_summary**：保持簡潔，80-100字元，一個完整句子
- **long_summary**：以前後文段落開始（例如：「這是一場團隊會議，參與者包括 John 和 Sarah，討論產品發布...」），然後使用 markdown 標題和編號列表列出重點
- **participants**：提取提及的姓名，否則為空陣列
- **topics**：討論的主要主題（最多 3-5 項）
- **keywords**：技術術語、專業詞彙、縮寫（最多 5-10 項，只包含高價值詞彙）
- **time_context**：時間參考，如「第四季」、「早上」、「下週」
- **scenario**：對話類型
- **key_points**：主要成果、決策或收穫（3-7 項）

只回傳 JSON 物件，不要加上其他內容。`,
      without_previous: (text_input: string) =>
        `你的任務是為對話創建結構化摘要。你需要產生一個 JSON 回應，包含完整摘要和提取的前後文資訊。

**重要**：你必須只回傳有效的 JSON。不要在 JSON 前後加上任何說明文字。

要摘要的對話記錄：
${text_input}

分析對話記錄並回傳符合以下確切結構的 JSON 物件：
{
  "short_summary": "一句話摘要（80-100字元）概括主要主題",
  "long_summary": "詳細的 Markdown 格式摘要，開頭嵌入前後文。從簡短段落開始，提及情境、參與者和主題（如果可識別），然後提供編號的重點。不要使用「摘要」標題。",
  "context": {
    "participants": ["姓名1", "姓名2"],
    "topics": ["主題1", "主題2"],
    "keywords": ["技術術語1", "技術術語2"],
    "time_context": "例如：「第四季規劃」、「晨間站會」，或如果未提及則為 null",
    "scenario": "例如：「會議」、「演講」、「訪談」、「閒聊」，或 null",
    "key_points": ["主要收穫 1", "主要收穫 2"]
  }
}

指引：
- **short_summary**：保持簡潔，80-100字元，一個完整句子
- **long_summary**：以前後文段落開始（例如：「這是一場團隊會議，參與者包括 John 和 Sarah，討論產品發布...」），然後使用 markdown 標題和編號列表列出重點
- **participants**：提取提及的姓名，否則為空陣列
- **topics**：討論的主要主題（最多 3-5 項）
- **keywords**：技術術語、專業詞彙、縮寫（最多 5-10 項，只包含高價值詞彙）
- **time_context**：時間參考，如「第四季」、「早上」、「下週」
- **scenario**：對話類型
- **key_points**：主要成果、決策或收穫（3-7 項）

只回傳 JSON 物件，不要加上其他內容。`,
    },
  },
  transcriptionEnhancement: {
    en: {
      base: ({
        rawText,
        conversationHistory,
        userLanguage,
      }: {
        rawText: string;
        conversationHistory: string[];
        userLanguage: string;
      }) => `You are a critical transcription enhancement assistant. The raw transcription from whisper.cpp STT model often contains ERRORS due to pronunciation similarity, especially for:
- Chinese homophones (e.g., "有心" vs "有薪", "方家" vs "房價")
- English mishearings (e.g., "Lady Goode" vs "Let It Go")
- Proper nouns and brand names

**CRITICAL THINKING REQUIRED**:
- Be HIGHLY SKEPTICAL of the raw transcription
- Words may be INCORRECT due to similar pronunciation
- Use conversation context to VALIDATE and CORRECT misheard words
- Consider semantic fit over phonetic match
- Question words that seem out of place given the context

RECENT CONVERSATION HISTORY:
${conversationHistory.length > 0 ? conversationHistory.join("\n") : "No previous context available"}

RAW TRANSCRIPTION: "${rawText}"
USER LANGUAGE: ${userLanguage}

Your task:
1. **Critical Analysis**: Question words that don't fit the context
2. **Context Validation**: Use conversation history to validate word choices
3. **Pronunciation Check**: Consider if transcription errors are due to similar sounds (homophones, mishearings)
4. **Correct with Evidence**: Fix errors based on semantic fit
5. **Grammar & Punctuation**: Fix grammar, add punctuation
6. **Language Consistency**: Ensure output matches user's preferred language (${userLanguage})
7. **Intent Detection**: Identify primary intention
8. **Keyword Extraction**: Extract ONLY new, contextually-relevant technical/specialized terms

IMPORTANT:
- If raw transcription is in Chinese and user language is zh-TW, ensure Traditional Chinese characters and Taiwan-specific terminology
- Mark uncertain corrections with lower confidence
- Use conversation history to validate corrections

Return ONLY valid JSON with this exact structure:
{
  "corrected": "Enhanced and corrected transcription text in the user's preferred language",
  "translation": "Translation if different from userLanguage, otherwise null",
  "intention": {
    "primary": "question|command|statement|schedule|reminder|concern|request",
    "confidence": 0.95,
    "suggestedActions": ["ai-action-answer", "ai-action-schedule"]
  },
  "keywords": ["only", "new", "relevant", "terms"],
  "confidence": 0.95
}

Constraints:
- **keywords**: Only include NEW contextually-relevant terms
- **confidence**: Lower confidence (0.3-0.7) for uncertain transcriptions
`,
    },
    "zh-TW": {
      base: ({
        rawText,
        conversationHistory,
        userLanguage,
      }: {
        rawText: string;
        conversationHistory: string[];
        userLanguage: string;
      }) => `你是服務台灣使用者、具批判性思考的逐字稿增強助理，熟悉台灣的文化、用語、時事和在地知識。whisper.cpp 語音轉文字模型的原始輸出經常因發音相似而產生錯誤，特別是：
- 中文同音字（例如：「有心」vs「有薪」、「方家」vs「房價」）
- 英文誤聽（例如：「Lady Goode」vs「Let It Go」）
- 專有名詞和品牌名稱

**需要批判性思考**：
- 對原始逐字稿保持高度懷疑
- 用字可能因發音相似而錯誤
- 使用對話前後文來驗證和修正誤聽的詞彙
- 優先考慮語意適配度而非語音相似度
- 質疑在前後文中似乎不合理的詞彙

最近對話紀錄：
${conversationHistory.length > 0 ? conversationHistory.join("\n") : "無先前對話紀錄"}

原始逐字稿：「${rawText}」
使用者語言：${userLanguage}

你的任務：
1. **批判性分析**：質疑不符合前後文的詞彙
2. **前後文驗證**：使用對話紀錄來驗證用字選擇
3. **發音檢查**：考慮逐字稿錯誤是否因相似發音（同音字、誤聽）
4. **依據語意修正**：根據語意適配度修正錯誤
5. **語法與標點**：修正語法、加上標點符號
6. **語言一致性**：確保輸出符合使用者偏好的語言（${userLanguage}）
7. **意圖偵測**：辨識主要意圖
8. **關鍵字萃取**：僅萃取新的、與前後文相關的技術/專業術語

重要：
- 如果原始逐字稿是中文且使用者語言為 zh-TW，請確保使用繁體中文字元和台灣特定術語
- 不確定的修正請標記較低信心度
- 使用對話紀錄來驗證修正

僅回傳有效的 JSON，結構如下：
{
  "corrected": "使用者偏好語言的增強和修正後逐字稿文字",
  "translation": "如果與使用者語言不同則翻譯，否則為 null",
  "intention": {
    "primary": "question|command|statement|schedule|reminder|concern|request",
    "confidence": 0.95,
    "suggestedActions": ["ai-action-answer", "ai-action-schedule"]
  },
  "keywords": ["僅", "新的", "相關", "術語"],
  "confidence": 0.95
}

限制條件：
- **keywords**：只包含新的、與前後文相關的術語
- **confidence**：不確定的逐字稿使用較低信心度（0.3-0.7）
`,
    },
  },
};
