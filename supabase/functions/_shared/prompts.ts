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
        let prompt = `You are a helpful AI assistant. Your goal is to answer the user's question based on the context provided. The context includes a summary of the entire conversation and the most recent transcriptions.

Please provide a concise, accurate, and helpful response in English.`;

        if (existing_summary) {
          prompt += `

Here is the summary of the conversation so far:
---
${existing_summary}
---`;
        }

        if (recent_transcriptions) {
          prompt += `

Here are the most recent transcriptions from the conversation:
---
${recent_transcriptions}
---`;
        }

        prompt += `

Based on the available context, please answer the following user question:
User Question: "${text_input}"`;
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
        let prompt = `你是一個協助使用者解決問題的助理，目標是根據前後文回答使用者的問題。前後文包括整個對話的摘要和最近的逐字稿。

請以繁體中文提供簡潔有力的回應。`;

        if (existing_summary) {
          prompt += `

這是目前為止的對話摘要：
---
${existing_summary}
---`;
        }

        if (recent_transcriptions) {
          prompt += `

這是對話中最近的逐字稿：
---
${recent_transcriptions}
---`;
        }

        prompt += `

根據現有前後文，請回答以下使用者問題：
使用者問題：「${text_input}」`;
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
        let prompt = `Your goal is to provide a precise and relevant summary for the term: "${text_input}". Use the provided conversation context to understand the user's intent.

If the context is relevant, tailor the summary to it. If not, provide a general, informative summary. Use your knowledge and web search capabilities to ensure the information is accurate and up-to-date. Please provide the response in English.`;

        if (existing_summary) {
          prompt += `

Here is the summary of the conversation so far, which might give you context:
---
${existing_summary}
---`;
        }

        if (recent_transcriptions) {
          prompt += `

Here are the most recent transcriptions, which might also be relevant:
---
${recent_transcriptions}
---`;
        }

        prompt += `

Based on the available context and your knowledge, please provide a summary for the term: "${text_input}"`;
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
        let prompt = `你的目標是為「${text_input}」這個詞提供一個精確、精簡、相關的摘要，避免重複解釋來龍去脈，讓使用者能快速閱讀並理解。請利用提供的對話前後文來理解使用者的意圖。

如果前後文有關，請客製化摘要。如果無關，請提供一個通用且資訊豐富的摘要。請利用你的知識和網路搜尋能力以確保資訊的準確性和即時性，避免提供過時或編造的資訊。請以繁體中文提供回應。`;

        if (existing_summary) {
          prompt += `

這是目前為止的對話摘要，可能能提供相關背景資訊：
---
${existing_summary}
---`;
        }

        if (recent_transcriptions) {
          prompt += `

這是最近的對話逐字稿，可能也與主題相關：
---
${recent_transcriptions}
---`;
        }

        prompt += `

根據現有的前後文和你的知識，請為「${text_input}」提供一個摘要。`;
        return prompt;
      },
    },
  },
  recommendResponse: {
    en: {
      base: (text_input: string) =>
        `Recommend a response to the following text:

${text_input}

Please return a short response, no more than 50 words.`,
    },
    "zh-TW": {
      base: (text_input: string) =>
        `針對以下文字推薦一個回覆：

${text_input}

請回覆一個不超過50字的簡短回覆。`,
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
        let prompt = `Analyze the provided screenshot and answer the user's question: "${text_input}".

Please provide a detailed, accurate analysis based on what you can see in the image. If the user's question is general (like "What do you see?" or "Analyze this"), provide a comprehensive description of the image content.

Use the conversation context below to better understand what the user might be looking for and tailor your response accordingly. Provide your response in English.`;

        if (existing_summary) {
          prompt += `

Here is the summary of the conversation so far, which might give you context:
---
${existing_summary}
---`;
        }

        if (recent_transcriptions) {
          prompt += `

Here are the most recent transcriptions, which might also be relevant:
---
${recent_transcriptions}
---`;
        }

        prompt += `

Based on the image and the available context, please provide your analysis.`;
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
        let prompt = `請分析提供的截圖並回答使用者的問題：「${text_input}」。

請根據你在圖片中看到的內容提供精簡、簡短且準確的分析。如果使用者的問題比較籠統（如「你看到什麼？」或「分析這個」），請提供圖片內容的精簡、簡短描述。

請利用以下對話前後文來理解使用者可能在尋找什麼，並據此調整你的回應；如果無關，那請針對截圖回應即可。請以繁體中文提供回應。`;

        if (existing_summary) {
          prompt += `

這是目前為止的對話摘要，可能能提供相關背景資訊：
---
${existing_summary}
---`;
        }

        if (recent_transcriptions) {
          prompt += `

這是最近的對話逐字稿，可能也與主題相關：
---
${recent_transcriptions}
---`;
        }

        prompt += `

根據圖片和現有的前後文，請提供你的分析。`;
        return prompt;
      },
    },
  },
  summarize: {
    en: {
      with_previous: (text_input: string, existing_summary: string) =>
        `You are given a previous summary and new conversation transcripts. Integrate the new transcripts into the summary, refining and extending it. The goal is to produce a single, coherent, updated summary. Format the output in Markdown without a "Summary" heading and use numbering for key takeaways.

Previous Summary:
${existing_summary}

New Transcripts:
${text_input}`,
      without_previous: (text_input: string) =>
        `Summarize the following text into a concise summary. Format the output in Markdown without a "Summary" heading and use numbering for key takeaways. The text to summarize is:

${text_input}`,
    },
    "zh-TW": {
      with_previous: (text_input: string, existing_summary: string) =>
        `你正在處理一份先前的摘要和新的對話記錄。請將新的對話記錄整合到摘要中，加以完善和擴充。目標是產生一份連貫、更新的摘要。請以 Markdown 格式輸出，不要加上「摘要」標題，並為重點加上編號。

先前的摘要：
${existing_summary}

新的對話記錄：
${text_input}`,
      without_previous: (text_input: string) =>
        `將以下文字摘要成一份簡潔的摘要。請以 Markdown 格式輸出，不要加上「摘要」標題，並為重點加上編號。要摘要的文字如下：

${text_input}`,
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
      }) => `You are a transcription enhancement assistant. You will be given a raw transcription generated by an STT model and conversation history for context. The wording might be wrong due to similar pronunciation, so use context to correct words.

Your task is to enhance the transcription by:
1. **Correct**: Fix grammar, punctuation, wording, spelling
2. **Contextualize**: Use conversation history for coherence
3. **Detect Intent**: Identify primary intention and confidence
4. **Extract Keywords**: Technical/specialized terms only
5. **Language Consistency**: Ensure the corrected text matches the user's preferred language (${userLanguage})

CONVERSATION HISTORY:
${conversationHistory.length > 0 ? conversationHistory.join("\n") : "No previous context"}

RAW TRANSCRIPTION: "${rawText}"
USER LANGUAGE: ${userLanguage}

IMPORTANT: If the raw transcription is in Chinese but user language is zh-TW, ensure the corrected text uses Traditional Chinese characters and Taiwan-specific terminology. If user language is zh-CN, use Simplified Chinese.

Return ONLY valid JSON with this exact structure:
{
  "corrected": "Enhanced and corrected transcription text in the user's preferred language",
  "translation": "Translation if different from userLanguage, otherwise null",
  "intention": {
    "primary": "question|command|statement|schedule|reminder|concern|request",
    "confidence": 0.95,
    "suggestedActions": ["ai-action-answer", "ai-action-schedule"]
  },
  "keywords": ["technical", "terms", "only"],
  "confidence": 0.95
}`,
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
      }) => `你是一個文書處理助理。你會收到語音轉文字模型生成的原始逐字稿和對話紀錄。用字可能因發音相似而錯誤，請利用上下文來修正單詞。

處理規則如下：
1. **修正**: 修正語法、標點符號、用字、拼寫
2. **語境**: 使用對話歷史來確保連貫性
3. **偵測意圖**: 辨識主要意圖和信心度
4. **偵測關鍵字**: 僅限技術/專有名詞/術語/少用詞彙
5. **翻譯**: 確保修正後的文字符合使用者偏好的語言（${userLanguage}）

對話紀錄：
${conversationHistory.length > 0 ? conversationHistory.join("\n") : "無先前對話紀錄"}

原始逐字稿：「${rawText}」
使用者語言：${userLanguage}

重要：如果原始逐字稿是中文，請強制翻譯為使用者偏好的語言（${userLanguage}），繁體中文需使用繁體中文字元和台灣特定術語。

僅回傳有效的JSON，結構如下：
{
  "corrected": "使用者偏好語言的增強和修正後逐字稿文字",
  "translation": "如果與使用者語言不同則翻譯，否則為 null",
  "intention": {
    "primary": "question|command|statement|schedule|reminder|concern|request",
    "confidence": 0.95,
    "suggestedActions": ["ai-action-answer", "ai-action-schedule"]
  },
  "keywords": ["技術", "術語", "專有名詞"],
  "confidence": 0.95
}`,
    },
  },
};
