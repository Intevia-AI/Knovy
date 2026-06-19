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
 * Echo-cancelling audio processing adapter (Phase 2).
 * Phase 1 uses only `rmsVad`; this interface is defined now so the harness and
 * worklet depend on a stable contract, not on a specific WASM build.
 */
export interface ApmAdapter {
  /** Process one frame: near-end + far-end reference → cleaned near-end + VAD. */
  processFrame(near: Float32Array, far: Float32Array): { out: Float32Array; voiced: boolean }
  destroy(): void
}
