// src/renderer/src/services/segmentation/SegmentationController.ts
import type { SegmentationConfig, Segment } from './types'

/**
 * Pure, deterministic per-stream speech segmenter. Frame-count based timing
 * (no wall clock) so it is fully unit-testable. One instance per audio stream;
 * because each instance only ever receives one stream's frames, attribution is
 * correct by construction.
 */
export class SegmentationController {
  private inSpeech = false
  private voicedRun = 0
  private voicedFrameCount = 0
  private silenceRun = 0
  private frames: Float32Array[] = []
  private startFrame = 0
  private frameCounter = 0

  constructor(private readonly cfg: SegmentationConfig) {}

  /** Feed one analysis frame. Returns a completed Segment, or null. */
  pushFrame(frame: Float32Array, voiced: boolean): Segment | null {
    const idx = this.frameCounter++

    if (!this.inSpeech) {
      if (voiced) {
        if (this.voicedRun === 0) {
          this.startFrame = idx
          this.frames = []
        }
        this.voicedRun++
        this.voicedFrameCount++
        this.frames.push(frame)
        if (this.voicedRun >= this.cfg.speechStartFrames) {
          this.inSpeech = true
          this.silenceRun = 0
        }
      } else {
        this.voicedRun = 0
        this.voicedFrameCount = 0
        this.frames = []
      }
      return null
    }

    // inSpeech
    this.frames.push(frame)
    if (voiced) {
      this.voicedFrameCount++
      this.silenceRun = 0
    } else {
      this.silenceRun++
    }

    const hangoverFrames = Math.ceil(this.cfg.silenceHangoverMs / this.cfg.frameMs)
    const maxFrames = Math.ceil(this.cfg.maxSegmentMs / this.cfg.frameMs)

    if (this.frames.length >= maxFrames) {
      return this.finish(idx, true)
    }
    if (this.silenceRun >= hangoverFrames) {
      return this.finish(idx, false)
    }
    return null
  }

  /** Flush any in-progress segment (e.g. on stop). */
  flush(): Segment | null {
    if (!this.inSpeech) return null
    return this.finish(this.frameCounter - 1, true)
  }

  reset(): void {
    this.inSpeech = false
    this.voicedRun = 0
    this.voicedFrameCount = 0
    this.silenceRun = 0
    this.frames = []
  }

  private finish(endFrame: number, forced: boolean): Segment | null {
    const frames = this.frames
    const voicedFrameCount = this.voicedFrameCount
    const durationMs = frames.length * this.cfg.frameMs
    const voicedMs = voicedFrameCount * this.cfg.frameMs
    const startFrame = this.startFrame
    this.reset()
    if (voicedMs < this.cfg.minSegmentMs) return null
    const total = frames.reduce((n, f) => n + f.length, 0)
    const pcm = new Float32Array(total)
    let o = 0
    for (const f of frames) {
      pcm.set(f, o)
      o += f.length
    }
    return { pcm, startFrame, endFrame, durationMs, forced }
  }
}
