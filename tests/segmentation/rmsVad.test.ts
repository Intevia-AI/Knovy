// tests/segmentation/rmsVad.test.ts
import { describe, it, expect } from 'vitest'
import { isVoiced, rms } from '../../src/renderer/src/services/segmentation/rmsVad'

describe('rmsVad', () => {
  it('rms of silence is 0, of full-scale is ~1', () => {
    expect(rms(new Float32Array(160))).toBe(0)
    expect(rms(new Float32Array(160).fill(1))).toBeCloseTo(1, 5)
  })
  it('voiced above threshold, unvoiced below', () => {
    expect(isVoiced(new Float32Array(160).fill(0.2), 0.01)).toBe(true)
    expect(isVoiced(new Float32Array(160).fill(0.001), 0.01)).toBe(false)
  })
})
