// Exercises the real vendored WebRTC AEC3 wasm through createAec3Adapter.
// Runs in Node (Vitest default env); the Emscripten module loads via require and
// locates its .wasm beside the vendored .js. Proves: (a) the module loads,
// (b) AEC3 cancels a delayed echo, (c) 48k input is resampled to 16k output.
import { describe, it, expect, beforeAll } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import vm from 'node:vm'
import { createAec3Adapter, type Aec3Module } from '../../src/renderer/src/services/segmentation/apmWasmAdapter'

const require = createRequire(import.meta.url)

const SR = 48000
const BLOCK = 480 // 10ms @48k

function tone(ms: number, freq: number, amp = 0.5): Float32Array {
  const n = Math.round((SR * ms) / 1000)
  const a = new Float32Array(n)
  for (let i = 0; i < n; i++) a[i] = amp * Math.sin((2 * Math.PI * freq * i) / SR)
  return a
}
function energy(a: Float32Array): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * a[i]
  return s
}

let module: Aec3Module

beforeAll(async () => {
  // The vendored file is a sloppy-mode Emscripten UMD (bare-global assignments,
  // CJS export branch). Vitest's transform mangles it, so run it in a Node vm
  // sandbox exactly as plain Node / a renderer <script> tag would: sloppy mode,
  // real `module`/`exports`, and __dirname pointing at the vendored dir so the
  // Emscripten loader can readFile its sibling .wasm.
  const here = dirname(fileURLToPath(import.meta.url))
  const vendorDir = resolve(here, '../../src/renderer/public/vendor/webrtcaec3')
  const file = resolve(vendorDir, 'webrtcaec3-0.3.0.js')
  const code = readFileSync(file, 'utf8')

  const sandboxModule = { exports: {} as Record<string, unknown> }
  const sandbox: Record<string, unknown> = {
    module: sandboxModule,
    exports: sandboxModule.exports,
    require: createRequire(file),
    process,
    Buffer,
    console,
    URL,
    TextDecoder,
    TextEncoder,
    WebAssembly,
    setTimeout,
    clearTimeout,
    __dirname: vendorDir,
    __filename: file
  }
  sandbox.global = sandbox
  vm.runInNewContext(code, sandbox, { filename: file })

  const factory = sandboxModule.exports as unknown as () => Promise<Aec3Module>
  if (typeof factory !== 'function') throw new Error('WebRtcAec3 factory not found in export')
  module = await factory()
})

describe('createAec3Adapter (real vendored wasm)', () => {
  it('cancels a delayed echo and resamples 48k→16k', () => {
    const adapter = createAec3Adapter(module, { inRate: 48000, outRate: 16000 })

    // far = speaker tone; near = same tone delayed+attenuated = pure echo the mic hears
    const far = tone(3000, 440)
    const near = new Float32Array(far.length)
    for (let i = 0; i < far.length; i++) near[i] = i >= 240 ? far[i - 240] * 0.6 : 0

    let inSamples = 0
    let outSamples = 0
    let rawTail = 0
    let outTail = 0
    const tailStart = far.length - SR // last 1s, after AEC convergence

    for (let o = 0; o + BLOCK <= far.length; o += BLOCK) {
      const nearBlk = near.subarray(o, o + BLOCK)
      const farBlk = far.subarray(o, o + BLOCK)
      const out = adapter.process(nearBlk, farBlk)
      inSamples += BLOCK
      outSamples += out.length
      if (o >= tailStart) {
        rawTail += energy(nearBlk)
        outTail += energy(out)
      }
    }
    adapter.destroy()

    // resample ratio 48k→16k = 1/3
    expect(outSamples / inSamples).toBeCloseTo(1 / 3, 2)
    // echo strongly cancelled in the converged tail
    expect(outTail).toBeLessThan(rawTail * 0.1)
  })
})
