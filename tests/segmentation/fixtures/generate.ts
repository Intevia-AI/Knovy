// tests/segmentation/fixtures/generate.ts

/** Sine tone of `ms` at `freq` Hz. Stands in for "speech-like" energy. */
export function tone(sampleRate: number, ms: number, freq: number, amp = 0.5): Float32Array {
  const n = Math.round((sampleRate * ms) / 1000)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / sampleRate)
  return out
}

/** `ms` of digital silence. */
export function silence(sampleRate: number, ms: number): Float32Array {
  return new Float32Array(Math.round((sampleRate * ms) / 1000))
}

/** Concatenate signals. */
export function concat(...parts: Float32Array[]): Float32Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Float32Array(total)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

/** Element-wise sum, clamped to [-1, 1]. Used to model acoustic bleed. */
export function mix(a: Float32Array, b: Float32Array): Float32Array {
  const n = Math.max(a.length, b.length)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const v = (a[i] || 0) + (b[i] || 0)
    out[i] = Math.max(-1, Math.min(1, v))
  }
  return out
}

/** Scale a signal (e.g. attenuated bleed). */
export function scale(a: Float32Array, k: number): Float32Array {
  const out = new Float32Array(a.length)
  for (let i = 0; i < a.length; i++) out[i] = a[i] * k
  return out
}

/** Split a signal into fixed-size frames (drops a trailing partial frame). */
export function framesOf(signal: Float32Array, frameSize: number): Float32Array[] {
  const frames: Float32Array[] = []
  for (let o = 0; o + frameSize <= signal.length; o += frameSize) {
    frames.push(signal.subarray(o, o + frameSize))
  }
  return frames
}
