// tests/segmentation/fixtures/generate.test.ts
import { describe, it, expect } from 'vitest'
import { tone, silence, mix, framesOf } from './generate'

describe('fixture generators', () => {
  it('tone has energy, silence has none', () => {
    expect(tone(16000, 100, 440).some((s) => Math.abs(s) > 0.1)).toBe(true)
    expect(silence(16000, 100).every((s) => s === 0)).toBe(true)
  })
  it('framesOf splits into fixed-size frames', () => {
    const frames = framesOf(new Float32Array(320), 160)
    expect(frames.length).toBe(2)
    expect(frames[0].length).toBe(160)
  })
  it('mix sums two signals and clamps to [-1,1]', () => {
    const a = new Float32Array(4).fill(0.8)
    const b = new Float32Array(4).fill(0.8)
    expect(Array.from(mix(a, b))).toEqual([1, 1, 1, 1])
  })
})
