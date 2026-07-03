import { describe, it, expect } from 'vitest'
import {
  getCorrectionPrompt,
  getChatPrompt,
  getSummarizePrompt,
  getSummarizeJsonSchema,
  parseSummarizeResponse
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
