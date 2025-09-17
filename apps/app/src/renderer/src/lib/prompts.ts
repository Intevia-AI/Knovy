export const basePromptMap = {
  answer_template: {
    'en-US':
      'Based on the attached transcription of the entire meeting, please provide a detailed answer to the last question asked: ',
    'zh-TW': '附上的轉錄內容是一個會議全部的對話，請根據整個會議的對話，詳細回答最後提出的問題: '
  },
  summary_template: {
    'en-US': 'Please provide a concise summary based on the following transcription: ',
    'zh-TW': '根據以下的轉錄內容，提供簡明摘要: '
  },
  keyword_search_template: {
    'en-US': 'Please search the web for the following query, and answer the question directly: ',
    'zh-TW': '請搜尋以下查詢，並直接回答問題: '
  },
  screenshot_template: {
    'en-US': 'Please analyze the screenshot and answer the following question:\n\n{{query_text}}',
    'zh-TW': '請你分析截圖，並回答以下問題：\n\n{{query_text}}'
  }
} as const

export const baseDisplayPromptMap = {
  chat: {
    'en-US': 'Chat',
    'zh-TW': '聊天'
  },
  answer: {
    'en-US': 'Answer based on transcription',
    'zh-TW': '根據轉錄內容回答出現或是潛在的問題，請針對最後出現的問題回答'
  },
  summary: {
    'en-US': 'Generate summary from transcription',
    'zh-TW': '根據轉錄內容產生摘要'
  },
  keyword_search: {
    'en-US': 'Keyword search',
    'zh-TW': '關鍵字搜尋'
  },
  screenshot: {
    'en-US': 'Screenshot analysis',
    'zh-TW': '截圖分析'
  }
} as const
