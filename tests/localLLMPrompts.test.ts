import { describe, it, expect } from 'vitest'
import {
  getCorrectionPrompt,
  getChatPrompt,
  getSummarizePrompt,
  getSummarizeJsonSchema,
  parseSummarizeResponse,
  sanitizeCorrection
} from '../src/main/localLLMPrompts'

describe('getCorrectionPrompt', () => {
  it('puts only the raw text in the user message, with no scaffold labels (en)', () => {
    const messages = getCorrectionPrompt({
      rawText: 'helo wrld',
      conversationHistory: [],
      userLanguage: 'en'
    })
    expect(messages[0].role).toBe('system')
    const user = messages[messages.length - 1]
    expect(user.role).toBe('user')
    expect(user.content).toBe('helo wrld')
    for (const m of messages) {
      expect(m.content.toLowerCase()).not.toContain('json')
      expect(m.content).not.toContain('Recent context:')
      expect(m.content).not.toContain('Transcription:')
    }
  })

  it('uses Traditional Chinese instructions for zh-TW', () => {
    const messages = getCorrectionPrompt({
      rawText: '你好',
      conversationHistory: [],
      userLanguage: 'zh-TW'
    })
    expect(messages[0].content).toContain('繁體中文')
    expect(messages[messages.length - 1].content).toBe('你好')
  })

  it('passes context as prior assistant turns, not inside the user message', () => {
    const messages = getCorrectionPrompt({
      rawText: 'next line',
      conversationHistory: ['prior sentence'],
      userLanguage: 'en'
    })
    expect(messages).toHaveLength(3)
    expect(messages[1]).toEqual({ role: 'assistant', content: 'prior sentence' })
    expect(messages[2]).toEqual({ role: 'user', content: 'next line' })
  })
})

describe('sanitizeCorrection', () => {
  it('passes a normal correction through unchanged', () => {
    const full = 'How fast is it? It is really fast, sir.'
    expect(sanitizeCorrection(full, 'How fast is it? Its really fast, sir.', [])).toBe(full)
  })

  it('accepts a Chinese translation shorter than its English raw text', () => {
    const raw = 'There is a funny term in the defense industry called competimates.'
    const full = '國防產業中有個有趣的用語叫「competimates」。'
    expect(sanitizeCorrection(full, raw, ['先前的修正'])).toBe(full)
  })

  it('rejects an echo of a previous correction', () => {
    const prev = '然後看我想 Xbat 是那種遠程戰略系統。'
    const raw = 'targets having strategic effects that is why you have X-bat.'
    expect(sanitizeCorrection(prev, raw, [prev])).toBe('')
    expect(sanitizeCorrection(` ${prev} `, raw, [prev])).toBe('')
  })

  it('rejects a paraphrase-echo of a previous correction (observed 你→您)', () => {
    const prev = '你看到的結果是通過 Q 和...'
    const raw = 'exactly what it is recording and'
    expect(sanitizeCorrection('您看到的結果是通過 Q 和...', raw, [prev])).toBe('')
  })

  it('accepts a different sentence of similar length to a history entry', () => {
    const prev = '它似乎是我無法確定生成轉錄的速度。'
    const full = '它不是座右銘，而是重複了「motto」一詞。'
    expect(sanitizeCorrection(full, 'it is not the motto is motto and why', [prev])).toBe(full)
  })

  it('keeps exact-match-only semantics for tiny strings', () => {
    expect(sanitizeCorrection('好的。', 'okay', ['對的。'])).toBe('好的。')
    expect(sanitizeCorrection('好的。', 'okay', ['好的。'])).toBe('')
  })

  it('rejects meta-commentary blobs (observed failure)', () => {
    const raw = 'voice is English and I set the language of the app to traditional Chinese'
    const blob =
      '語音轉文字修正助理：\n\n您沒有要使用這個。\n\n（註：原句「voice is English」在中文語境中通常指「語音是英語的」…）\n\n修正後的逐字稿：\n\n您沒有要使用這個。'
    expect(sanitizeCorrection(blob, raw, [])).toBe('')
    expect(sanitizeCorrection('請翻譯以下文字：\n\n您沒有要使用這個。', 'translate the', [])).toBe('')
  })

  it('rejects prompt scaffolding echoes', () => {
    expect(sanitizeCorrection('Recent context: hello', 'hello', [])).toBe('')
    expect(sanitizeCorrection('Transcription: hello', 'hello', [])).toBe('')
    expect(sanitizeCorrection('最近對話：你好', '你好', [])).toBe('')
  })

  it('rejects runaway output more than 3x the raw length', () => {
    const raw = 'an input longer than the twenty char floor'
    expect(sanitizeCorrection('好'.repeat(raw.length * 3 + 1), raw, [])).toBe('')
  })

  it('keeps corrections of tiny fragments within the 20-char floor', () => {
    expect(sanitizeCorrection('我沒有要使用這個。', 'Or.', [])).toBe('我沒有要使用這個。')
  })

  it('rejects multi-paragraph output', () => {
    expect(sanitizeCorrection('第一段。\n\n第二段。', 'one utterance of speech', [])).toBe('')
  })

  it('rejects empty or whitespace-only output', () => {
    expect(sanitizeCorrection('', 'raw', [])).toBe('')
    expect(sanitizeCorrection('   \n ', 'raw', [])).toBe('')
  })
})

describe('getChatPrompt', () => {
  it('states the assistant role once, in the system message only (en)', () => {
    const p = getChatPrompt({ textInput: 'hi', language: 'en' })
    expect(p.system).toContain('You are a helpful AI chat assistant')
    expect(p.user).not.toMatch(/you are a helpful ai/i)
    expect(p.user).toContain('hi')
  })

  it('states the assistant role once, in the system message only (zh-TW)', () => {
    const p = getChatPrompt({ textInput: '你好', language: 'zh-TW' })
    expect(p.system).toContain('AI 對話助理')
    expect(p.user).not.toContain('你是服務台灣使用者的 AI 助理')
    expect(p.user).toContain('你好')
  })
})

describe('structured summary', () => {
  const SECTION_KEYS = ['key_points', 'decisions', 'action_items', 'open_questions', 'topics']

  it('schema requires all structured fields and no legacy long_summary', () => {
    const schema = getSummarizeJsonSchema() as any
    expect(schema.required).toEqual(['short_summary', ...SECTION_KEYS])
    expect(schema.properties.long_summary).toBeUndefined()
    for (const key of SECTION_KEYS) {
      expect(schema.properties[key]).toEqual({ type: 'array', items: { type: 'string' } })
    }
  })

  it('prompt describes each field without an embedded JSON example (en)', () => {
    const p = getSummarizePrompt({ textInput: 'we agreed to ship friday', language: 'en' })
    for (const key of SECTION_KEYS) expect(p.user).toContain(key)
    expect(p.user).not.toContain('{') // shape is enforced by the format param, not prose
    expect(p.system).toContain('empty array')
    expect(p.user).toContain('we agreed to ship friday')
  })

  it('feeds the previous summary back for incremental updates', () => {
    const prev = '{"short_summary":"prior"}'
    const p = getSummarizePrompt({ textInput: 'new stuff', existingSummary: prev, language: 'en' })
    expect(p.user).toContain(prev)
    expect(p.user).toContain('new stuff')
  })

  it('localizes the summarize prompt for zh-TW', () => {
    const p = getSummarizePrompt({ textInput: '討論內容', language: 'zh-TW' })
    expect(p.system).toContain('繁體中文')
    expect(p.user).toContain('討論內容')
  })

  it('parseSummarizeResponse accepts a valid structured summary', () => {
    const valid = {
      short_summary: 'a meeting',
      key_points: ['point'],
      decisions: [],
      action_items: [],
      open_questions: [],
      topics: ['x']
    }
    expect(parseSummarizeResponse(JSON.stringify(valid))).toEqual(valid)
  })

  it('parseSummarizeResponse rejects invalid content', () => {
    expect(parseSummarizeResponse('')).toBeNull()
    expect(parseSummarizeResponse('not json')).toBeNull()
    expect(parseSummarizeResponse('{"short_summary":""}')).toBeNull() // empty summary
    expect(parseSummarizeResponse('{"short_summary":"ok","key_points":"nope"}')).toBeNull()
  })
})
