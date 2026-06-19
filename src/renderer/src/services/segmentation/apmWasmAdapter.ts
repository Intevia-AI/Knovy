// src/renderer/src/services/segmentation/apmWasmAdapter.ts
//
// Adapter over the vendored WebRTC AEC3 wasm (@ennuicastr/webrtcaec3.js,
// BSD-3-Clause), vendored at /vendor/webrtcaec3/. The AEC engine is synchronous;
// it runs on the renderer main thread (not an AudioWorklet). One adapter wraps
// one AEC3 instance for one stream: `process(near, far)` analyses the far-end
// (the other stream) and cancels it from the near-end, optionally resampling the
// output (we use 48k in → 16k out for Whisper).

import type { ApmAdapter } from './types'

/** Minimal shape of one AEC3 instance (see vendor/webrtcaec3/webrtcaec3.types.d.ts). */
export interface Aec3Instance {
  readonly sampleRate: number
  analyze(data: Float32Array[], opts?: Aec3Opts): void
  processSize(data: Float32Array[], opts?: Aec3Opts): number
  process(out: Float32Array[], data: Float32Array[], opts?: Aec3Opts): void
  free(): void
}

export interface Aec3Opts {
  sampleRateIn?: number
  sampleRateOut?: number
}

/** The loaded module: a factory for AEC3 instances. */
export interface Aec3Module {
  AEC3: new (sampleRate: number, renderChannels: number, captureChannels: number) => Aec3Instance
}

/** AEC3 supports 32k or 48k as its internal processing rate; we use 48k. */
const PROCESS_RATE = 48000

/**
 * Wrap a loaded AEC3 module into an AEC-only `ApmAdapter` for one stream.
 * @param module  Loaded WebRtcAec3 module.
 * @param opts.inRate  Sample rate of the near/far frames fed in (e.g. 48000).
 * @param opts.outRate Desired sample rate of the cleaned output (e.g. 16000).
 */
export function createAec3Adapter(
  module: Aec3Module,
  opts: { inRate: number; outRate: number }
): ApmAdapter {
  const aec = new module.AEC3(PROCESS_RATE, 1, 1)
  const callOpts: Aec3Opts = { sampleRateIn: opts.inRate, sampleRateOut: opts.outRate }

  return {
    process(near: Float32Array, far: Float32Array): Float32Array {
      // Far-end (render) must be analysed for the same block before processing
      // the near-end (capture). AEC3's internal delay estimator aligns them.
      aec.analyze([far], callOpts)
      const size = aec.processSize([near], callOpts)
      const out = [new Float32Array(size)]
      aec.process(out, [near], callOpts)
      return out[0]
    },
    destroy(): void {
      aec.free()
    }
  }
}

/**
 * Load the vendored AEC3 wasm module in the renderer (browser) by injecting the
 * Emscripten loader script and pointing it at the vendored assets via `base`.
 * Returns null if loading fails (caller falls back to the no-AEC path).
 */
export async function loadAec3Module(base = '/vendor/webrtcaec3'): Promise<Aec3Module | null> {
  try {
    const g = globalThis as unknown as {
      WebRtcAec3?: unknown
      document?: Document
    }
    // The loader reads a pre-existing `WebRtcAec3` object's `.base`, then replaces
    // the global with the module factory function.
    ;(g as { WebRtcAec3?: unknown }).WebRtcAec3 = { base }

    await new Promise<void>((resolve, reject) => {
      const doc = g.document
      if (!doc) {
        reject(new Error('no document (not a renderer context)'))
        return
      }
      const script = doc.createElement('script')
      script.src = `${base}/webrtcaec3-0.3.0.js`
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('failed to load webrtcaec3 loader script'))
      doc.head.appendChild(script)
    })

    const factory = (globalThis as unknown as { WebRtcAec3?: () => Promise<Aec3Module> }).WebRtcAec3
    if (typeof factory !== 'function') {
      throw new Error('WebRtcAec3 factory not available after script load')
    }
    return await factory()
  } catch (err) {
    console.warn('[apmWasmAdapter] AEC3 wasm unavailable, AEC disabled:', err)
    return null
  }
}
