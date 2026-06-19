// tests/segmentation/harness.test.ts
import { describe, it, expect } from 'vitest'
import { SegmentationController } from '../../src/renderer/src/services/segmentation/SegmentationController'
import { isVoiced } from '../../src/renderer/src/services/segmentation/rmsVad'
import type { SegmentationConfig, Segment } from '../../src/renderer/src/services/segmentation/types'
import { tone, silence, concat, framesOf, mix } from './fixtures/generate'
import { mockApm } from './mockApm'

const SR = 16000
const FRAME = 160 // 10ms
const cfg: SegmentationConfig = {
  sampleRate: SR,
  frameMs: 10,
  speechStartFrames: 3,
  silenceHangoverMs: 200,
  minSegmentMs: 200,
  maxSegmentMs: 5000
}

/** Run a mono signal through VAD + controller, collect segments. */
function run(signal: Float32Array): Segment[] {
  const c = new SegmentationController(cfg)
  const segs: Segment[] = []
  for (const f of framesOf(signal, FRAME)) {
    const s = c.pushFrame(f, isVoiced(f, 0.01))
    if (s) segs.push(s)
  }
  const tail = c.flush()
  if (tail) segs.push(tail)
  return segs
}

describe('offline harness — attribution (no AEC)', () => {
  // NOTE (documented limitation): Phase 1 has no AEC, so these fixtures model
  // CLEAN streams (no cross-bleed). This proves the routing/attribution logic in
  // isolation. Phase 2 (mockApm + real APM) adds bleed-laden fixtures and the
  // AEC that removes them — see tests added in the AEC tasks.

  it('mic stream (user speech) yields mic segments only; system stream stays empty when silent', () => {
    // user speaks 600ms, system silent the whole time
    const userSpeech = concat(tone(SR, 600, 300), silence(SR, 300))
    const systemSilent = silence(SR, 900)

    const micSegs = run(userSpeech)
    const sysSegs = run(systemSilent)

    expect(micSegs.length).toBe(1)
    expect(sysSegs.length).toBe(0)
  })

  it('both speaking (double-talk) yields one segment on EACH side', () => {
    const userSpeech = concat(tone(SR, 600, 300), silence(SR, 300))
    const computerAudio = concat(tone(SR, 600, 800), silence(SR, 300))

    const micSegs = run(userSpeech)
    const sysSegs = run(computerAudio)

    expect(micSegs.length).toBe(1)
    expect(sysSegs.length).toBe(1)
  })

  it('AEC removes far-end bleed from the mic stream (energy reduction)', () => {
    const SRr = 16000
    // Bleed at full amplitude so ideal AEC (near - far) drives residual to near-zero.
    const computer = concat(tone(SRr, 600, 800), silence(SRr, 300)) // far-end reference
    const userSilent = silence(SRr, 900)
    const micWithBleed = mix(userSilent, computer) // mic = bleed at 1× (ideal coupling for mock)

    const apm = mockApm()
    let rawEnergy = 0
    let cleanEnergy = 0
    const fNear = framesOf(micWithBleed, 160)
    const fFar = framesOf(computer, 160)
    for (let i = 0; i < fNear.length; i++) {
      const out = apm.process(fNear[i], fFar[i] ?? new Float32Array(160))
      for (let j = 0; j < out.length; j++) {
        rawEnergy += fNear[i][j] ** 2
        cleanEnergy += out[j] ** 2
      }
    }
    apm.destroy()
    expect(cleanEnergy).toBeLessThan(rawEnergy * 0.1)
  })

  it('after AEC, bleed-only mic produces NO mic segment', () => {
    const SRr = 16000
    const segCfg = { sampleRate: SRr, frameMs: 10, speechStartFrames: 3, silenceHangoverMs: 200, minSegmentMs: 200, maxSegmentMs: 5000 }
    const computer = concat(tone(SRr, 600, 800), silence(SRr, 300))
    // Bleed at full amplitude so ideal AEC cancels it completely
    const micWithBleed = mix(silence(SRr, 900), computer)
    const apm = mockApm()
    const c = new SegmentationController(segCfg)
    const fNear = framesOf(micWithBleed, 160)
    const fFar = framesOf(computer, 160)
    const segs: unknown[] = []
    for (let i = 0; i < fNear.length; i++) {
      const out = apm.process(fNear[i], fFar[i] ?? new Float32Array(160))
      const s = c.pushFrame(out, isVoiced(out, 0.01))
      if (s) segs.push(s)
    }
    apm.destroy()
    expect(segs.length).toBe(0) // bleed cancelled → no false "user" segment
  })
})
