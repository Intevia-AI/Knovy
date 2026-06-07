import { describe, it, expect } from 'vitest'
import { INITIAL_MIC_ENABLED, toggleMicEnabled } from '../src/renderer/src/lib/micToggle'

describe('micToggle', () => {
  it('defaults to enabled (mic on) for a fresh session', () => {
    expect(INITIAL_MIC_ENABLED).toBe(true)
  })

  it('flips the enabled state on toggle', () => {
    expect(toggleMicEnabled(true)).toBe(false)
    expect(toggleMicEnabled(false)).toBe(true)
  })
})
