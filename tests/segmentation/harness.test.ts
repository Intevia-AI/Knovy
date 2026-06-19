// tests/segmentation/harness.test.ts
import { describe, it, expect } from 'vitest'
import { SegmentationController } from '../../src/renderer/src/services/segmentation/SegmentationController'
import { isVoiced } from '../../src/renderer/src/services/segmentation/rmsVad'
import type { SegmentationConfig, Segment } from '../../src/renderer/src/services/segmentation/types'
import { tone, silence, concat, framesOf } from './fixtures/generate'

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
})
