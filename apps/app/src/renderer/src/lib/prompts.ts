export const basePromptMap = {
  answer_template: {
    'en-US':
      'Based on the attached transcription of the entire meeting, please provide a detailed answer to the last question asked: ',
    'zh-TW':
      '附上的轉錄內容是一個會議全部的對話，請根據整個會議的對話，詳細回答最後提出的問題: ',
    'ja-JP':
      '添付された会議全体の文字起こしに基づいて、最後に質問された内容について詳細に回答してください: '
  },
  summary_template: {
    'en-US': 'Please provide a concise summary based on the following transcription: ',
    'zh-TW': '根據以下的轉錄內容，提供簡明摘要: ',
    'ja-JP': '以下の文字起こしに基づいて、簡潔な要約を提供してください: '
  },
  keyword_search_template: {
    'en-US':
      'Please search the web for the following query, and answer the question directly: ',
    'zh-TW': '請搜尋以下查詢，並直接回答問題: ',
    'ja-JP': '以下のクエリを検索し、質問に直接回答してください: '
  },
  screenshot_template: {
    'en-US':
      'Please analyze the screenshot and answer the following question:\n\n{{query_text}}',
    'zh-TW': '請你分析截圖，並回答以下問題：\n\n{{query_text}}',
    'ja-JP': 'スクリーンショットを分析し、以下の質問に回答してください：\n\n{{query_text}}'
  }
} as const

export const baseDisplayPromptMap = {
  chat: {
    'en-US': 'Chat',
    'zh-TW': '聊天',
    'ja-JP': 'チャット'
  },
  answer: {
    'en-US': 'Answer based on transcription',
    'zh-TW': '根據轉錄內容回答出現或是潛在的問題，請針對最後出現的問題回答',
    'ja-JP': '文字起こしに基づいて回答'
  },
  summary: {
    'en-US': 'Generate summary from transcription',
    'zh-TW': '根據轉錄內容產生摘要',
    'ja-JP': '文字起こしから要約を生成'
  },
  keyword_search: {
    'en-US': 'Keyword search',
    'zh-TW': '關鍵字搜尋',
    'ja-JP': 'キーワード検索'
  },
  screenshot: {
    'en-US': 'Screenshot analysis',
    'zh-TW': '截圖分析',
    'ja-JP': 'スクリーンショット分析'
  }
} as const
