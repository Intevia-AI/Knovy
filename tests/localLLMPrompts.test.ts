import { describe, it, expect } from 'vitest'
import { getCorrectionPrompt } from '../src/main/localLLMPrompts'

describe('getCorrectionPrompt', () => {
  it('embeds the raw text and asks for plain output (en)', () => {
    const p = getCorrectionPrompt({ rawText: 'helo wrld', conversationHistory: [], userLanguage: 'en' })
    expect(p.user).toContain('helo wrld')
    expect(p.system.toLowerCase()).not.toContain('json')
    expect(p.user.toLowerCase()).not.toContain('json')
  })

  it('uses Traditional Chinese instructions for zh-TW', () => {
    const p = getCorrectionPrompt({ rawText: '你好', conversationHistory: [], userLanguage: 'zh-TW' })
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
