// src/renderer/src/services/segmentation/rmsVad.ts

/** Root-mean-square level of a mono frame (0..~1). */
export function rms(frame: Float32Array): number {
  let sum = 0
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i]
  return frame.length ? Math.sqrt(sum / frame.length) : 0
}

/** Simple energy VAD: voiced when RMS exceeds threshold. */
export function isVoiced(frame: Float32Array, threshold = 0.01): boolean {
  return rms(frame) > threshold
}
