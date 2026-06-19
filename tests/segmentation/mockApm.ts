// tests/segmentation/mockApm.ts
import type { ApmAdapter } from '../../src/renderer/src/services/segmentation/types'

/** Ideal-AEC stand-in: out = near - far (clamped). Same length (no resample). */
export function mockApm(): ApmAdapter {
  return {
    process(near: Float32Array, far: Float32Array): Float32Array {
      const out = new Float32Array(near.length)
      for (let i = 0; i < near.length; i++) {
        out[i] = Math.max(-1, Math.min(1, near[i] - (far[i] || 0)))
      }
      return out
    },
    destroy() {}
  }
}
