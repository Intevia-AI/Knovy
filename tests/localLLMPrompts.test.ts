import { describe, it, expect } from 'vitest'
import { getCorrectionPrompt, getChatPrompt } from '../src/main/localLLMPrompts'

describe('getCorrectionPrompt', () => {
  it('embeds the raw text and asks for plain output (en)', () => {
    const p = getCorrectionPrompt({
      rawText: 'helo wrld',
      conversationHistory: [],
      userLanguage: 'en'
    })
    expect(p.user).toContain('helo wrld')
    expect(p.system.toLowerCase()).not.toContain('json')
    expect(p.user.toLowerCase()).not.toContain('json')
  })

  it('uses Traditional Chinese instructions for zh-TW', () => {
    const p = getCorrectionPrompt({
      rawText: '你好',
      conversationHistory: [],
      userLanguage: 'zh-TW'
    })
    expect(p.system).toContain('繁體中文')
    expect(p.user).toContain('你好')
  })

  it('includes recent context when provided', () => {
    const p = getCorrectionPrompt({
      rawText: 'next line',
      conversationHistory: ['prior sentence'],
      userLanguage: 'en'
    })
    expect(p.user).toContain('prior sentence')
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
