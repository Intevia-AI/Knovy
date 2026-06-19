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
    // First 4 silence frames must NOT emit
    for (let i = 0; i < 4; i++) expect(c.pushFrame(frame(0), false)).toBeNull()
    // Exactly the 5th silence frame triggers the segment
    const seg = c.pushFrame(frame(0), false)
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

  it('startFrame is not stale across back-to-back segments', () => {
    const c = new SegmentationController(cfg)
    // First segment: 6 voiced + 5 silence hangover
    for (let i = 0; i < 6; i++) expect(c.pushFrame(frame(0.5), true)).toBeNull()
    for (let i = 0; i < 4; i++) expect(c.pushFrame(frame(0), false)).toBeNull()
    const seg1 = c.pushFrame(frame(0), false)
    expect(seg1).not.toBeNull()

    // Second segment: 6 voiced + 5 silence hangover
    for (let i = 0; i < 6; i++) expect(c.pushFrame(frame(0.5), true)).toBeNull()
    for (let i = 0; i < 4; i++) expect(c.pushFrame(frame(0), false)).toBeNull()
    const seg2 = c.pushFrame(frame(0), false)
    expect(seg2).not.toBeNull()

    // Second segment must start after the first segment ended
    expect(seg2!.startFrame).toBeGreaterThan(seg1!.endFrame)
  })

  it('discards a false-start voiced run interrupted before speechStartFrames', () => {
    const localCfg: SegmentationConfig = {
      ...cfg,
      speechStartFrames: 3
    }
    const c = new SegmentationController(localCfg)

    // False start: 2 voiced frames, then 1 silent (resets pre-speech run)
    expect(c.pushFrame(frame(0.5), true)).toBeNull()  // voiced #1 (frameIdx 0)
    expect(c.pushFrame(frame(0.5), true)).toBeNull()  // voiced #2 (frameIdx 1)
    expect(c.pushFrame(frame(0), false)).toBeNull()   // silence  (frameIdx 2) — resets

    // Real segment onset starts at frameIdx 3
    const realOnset = 3
    // 3 voiced frames to meet speechStartFrames
    expect(c.pushFrame(frame(0.5), true)).toBeNull()  // frameIdx 3
    expect(c.pushFrame(frame(0.5), true)).toBeNull()  // frameIdx 4
    expect(c.pushFrame(frame(0.5), true)).toBeNull()  // frameIdx 5
    // 5 silence hangover frames (silenceHangoverMs=50, frameMs=10 → 5 frames)
    for (let i = 0; i < 4; i++) expect(c.pushFrame(frame(0), false)).toBeNull()
    const seg = c.pushFrame(frame(0), false)

    // Exactly ONE segment produced
    expect(seg).not.toBeNull()
    // startFrame must reflect the real onset (frameIdx 3), not the false start (0)
    expect(seg!.startFrame).toBe(realOnset)
  })
})
