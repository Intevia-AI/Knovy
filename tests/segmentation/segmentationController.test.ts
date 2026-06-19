// tests/segmentation/segmentationController.test.ts
import { describe, it, expect } from 'vitest'
import { SegmentationController } from '../../src/renderer/src/services/segmentation/SegmentationController'
import type { SegmentationConfig } from '../../src/renderer/src/services/segmentation/types'

const cfg: SegmentationConfig = {
  sampleRate: 16000,
  frameMs: 10,
  speechStartFrames: 2,
  silenceHangoverMs: 50, // 5 frames
  minSegmentMs: 30, // 3 frames
  maxSegmentMs: 200 // 20 frames
}

// 160 samples == 10ms @ 16kHz
const frame = (v: number) => new Float32Array(160).fill(v)

describe('SegmentationController', () => {
  it('emits a segment after voiced run then silence hangover', () => {
    const c = new SegmentationController(cfg)
    // 6 voiced frames (>= speechStartFrames), then 5 silent frames (= hangover)
    for (let i = 0; i < 6; i++) expect(c.pushFrame(frame(0.5), true)).toBeNull()
    let seg = null
    for (let i = 0; i < 5; i++) seg = c.pushFrame(frame(0), false) ?? seg
    expect(seg).not.toBeNull()
    expect(seg!.forced).toBe(false)
    // 6 voiced + part of silence; duration well over minSegmentMs
    expect(seg!.durationMs).toBeGreaterThanOrEqual(cfg.minSegmentMs)
    // pcm length == frames * 160
    expect(seg!.pcm.length % 160).toBe(0)
  })

  it('drops a too-short blip below minSegmentMs', () => {
    const c = new SegmentationController(cfg)
    // 2 voiced frames only (20ms < 30ms min), then silence
    c.pushFrame(frame(0.5), true)
    c.pushFrame(frame(0.5), true)
    let seg = null
    for (let i = 0; i < 5; i++) seg = c.pushFrame(frame(0), false) ?? seg
    expect(seg).toBeNull()
  })
})
