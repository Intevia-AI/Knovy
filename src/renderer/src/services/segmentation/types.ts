// src/renderer/src/services/segmentation/types.ts

/** Configuration for a single-stream segmentation state machine. */
export interface SegmentationConfig {
  /** PCM sample rate, e.g. 16000. */
  sampleRate: number
  /** Duration of one analysis frame in ms (must match what is pushed), e.g. 10. */
  frameMs: number
  /** Consecutive voiced frames required to enter the SPEAKING state (leading hysteresis). */
  speechStartFrames: number
  /** Trailing silence (ms) that ends a segment. */
  silenceHangoverMs: number
  /** Segments shorter than this (ms) are discarded as noise. */
  minSegmentMs: number
  /** Hard cap (ms); a longer run is force-flushed. */
  maxSegmentMs: number
}

/** A completed speech segment for one stream. */
export interface Segment {
  /** Concatenated mono PCM for the whole segment. */
  pcm: Float32Array
  /** Frame index (since last reset) where the segment began. */
  startFrame: number
  /** Frame index where the segment ended (inclusive). */
  endFrame: number
  /** Segment length in ms. */
  durationMs: number
  /** True if flushed by maxSegmentMs rather than a natural silence. */
  forced: boolean
}

/**
 * Acoustic-echo-cancelling adapter (Phase 2). AEC-only: takes a near-end frame
 * plus the far-end reference (the OTHER stream) and returns the cleaned near-end.
 * The underlying WebRTC AEC3 wasm exposes no VAD, so voice activity is decided
 * downstream by `rmsVad` on the cleaned output. The far-end is analysed and the
 * near-end processed for the same block; output may be resampled (e.g. 48k→16k).
 */
export interface ApmAdapter {
  /** Cancel echo: near-end + far-end reference → cleaned (possibly resampled) near-end. */
  process(near: Float32Array, far: Float32Array): Float32Array
  destroy(): void
}
