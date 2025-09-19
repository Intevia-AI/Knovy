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
        previous_summary,
        recent_transcriptions,
        text_input,
      }: {
        previous_summary?: string;
        recent_transcriptions?: string;
        text_input: string;
      }) => {
        let prompt = `You are a helpful AI assistant. Your goal is to answer the user's question based on the context provided. The context includes a summary of the entire conversation and the most recent transcriptions.

Please provide a concise and helpful response in English.`;

        if (previous_summary) {
          prompt += `

Here is the summary of the conversation so far:
---
${previous_summary}
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
        previous_summary,
        recent_transcriptions,
        text_input,
      }: {
        previous_summary?: string;
        recent_transcriptions?: string;
        text_input: string;
      }) => {
        let prompt = `你是一個樂於助人的人工智慧助理。你的目標是根據提供的上下文來回答使用者的問題。上下文包括整個對話的摘要和最近的轉錄。

請以繁體中文提供簡潔而有幫助的回應。`;

        if (previous_summary) {
          prompt += `

這是目前為止的對話摘要：
---
${previous_summary}
---`;
        }

        if (recent_transcriptions) {
          prompt += `

這是對話中最近的轉錄：
---
${recent_transcriptions}
---`;
        }

        prompt += `

根據現有上下文，請回答以下使用者問題：
使用者問題：「${text_input}」`;
        return prompt;
      },
    },
  },
  keywordSearch: {
    en: {
      base: (text_input: string) =>
        `Please provide a brief and concise summary of the term: "${text_input}". The summary should be informative and directly related to the term.`,
    },
    "zh-TW": {
      base: (text_input: string) =>
        `請提供關於「${text_input}」這個詞的簡潔摘要。摘要應該內容豐富且與該詞直接相關。`,
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
      // The prompt is the user's direct input. This makes the structure consistent.
      base: (text_input: string) => text_input,
    },
    "zh-TW": {
      base: (text_input: string) => text_input,
    },
  },
  summarize: {
    en: {
      with_previous: (text_input: string, previous_summary: string) =>
        `You are given a previous summary and new conversation transcripts. Integrate the new transcripts into the summary, refining and extending it. The goal is to produce a single, coherent, updated summary. Format the output in Markdown without a "Summary" heading and use numbering for key takeaways.

Previous Summary:
${previous_summary}

New Transcripts:
${text_input}`,
      without_previous: (text_input: string) =>
        `Summarize the following text into a concise summary. Format the output in Markdown without a "Summary" heading and use numbering for key takeaways. The text to summarize is:

${text_input}`,
    },
    "zh-TW": {
      with_previous: (text_input: string, previous_summary: string) =>
        `你正在處理一份先前的摘要和新的對話記錄。請將新的對話記錄整合到摘要中，加以完善和擴充。目標是產生一份連貫、更新的摘要。請以 Markdown 格式輸出，不要加上「摘要」標題，並為重點加上編號。

先前的摘要：
${previous_summary}

新的對話記錄：
${text_input}`,
      without_previous: (text_input: string) =>
        `將以下文字摘要成一份簡潔的摘要。請以 Markdown 格式輸出，不要加上「摘要」標題，並為重點加上編號。要摘要的文字如下：

${text_input}`,
    },
  },
};
