import { describe, it, expect, vi, afterAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

/**
 * Integration test for mic/system source separation, using the real bundled
 * whisper.cpp binary and the locally installed base model. Two known speech
 * fixtures (JFK "ask not" = microphone, Bush Columbia address = system) are
 * transcribed CONCURRENTLY — the exact condition that previously made both
 * streams read the same temp WAV and emit identical text on both sides.
 *
 * Skips itself when the binary or models aren't present (e.g. CI).
 */

const testDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(testDir, '..')

function findUserDataDir(): string | undefined {
  return [
    path.join(os.homedir(), 'Library/Application Support/knovy'),
    path.join(os.homedir(), 'Library/Application Support/Knovy')
  ].find((p) => fs.existsSync(path.join(p, 'whisper-models')))
}

vi.mock('electron', async () => {
  const { default: os } = await import('os')
  const { default: fs } = await import('fs')
  const { default: path } = await import('path')
  const userData = [
    path.join(os.homedir(), 'Library/Application Support/knovy'),
    path.join(os.homedir(), 'Library/Application Support/Knovy')
  ].find((p) => fs.existsSync(path.join(p, 'whisper-models')))
  return {
    app: {
      isPackaged: false,
      getPath: (name: string) => (name === 'userData' && userData ? userData : os.tmpdir())
    }
  }
})

const userDataDir = findUserDataDir()
const binaryPath = path.join(
  repoRoot,
  'resources/whisper.cpp',
  `whisper-${process.platform}-${process.arch}`
)
const canRun =
  !!userDataDir &&
  fs.existsSync(binaryPath) &&
  fs.existsSync(path.join(userDataDir, 'whisper-models/ggml-base.bin')) &&
  fs.existsSync(path.join(userDataDir, 'whisper-models/ggml-silero-vad.bin'))

/** Extract raw PCM from a 16kHz mono s16le WAV (what the pipeline receives over IPC). */
function wavPcm(file: string): ArrayBuffer {
  const buf = fs.readFileSync(file)
  const idx = buf.indexOf('data', 12)
  const size = buf.readUInt32LE(idx + 4)
  const pcm = buf.subarray(idx + 8, idx + 8 + size)
  return pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength)
}

describe.skipIf(!canRun)('mic/system source separation (real whisper.cpp)', () => {
  // Tests never fire Electron's will-quit, so the persistent whisper-server
  // must be torn down here or every test run leaks a resident model process.
  afterAll(async () => {
    const { getWhisperBackend } = await import('../src/main/whisperBackend')
    getWhisperBackend().destroy()
  })

  it(
    'concurrent mic and system chunks keep their own content and sourceType',
    async () => {
      const { getWhisperBackend } = await import('../src/main/whisperBackend')
      const backend = getWhisperBackend()
      expect(await backend.initialize()).toBe(true)

      const micAudio = wavPcm(path.join(testDir, 'fixtures/mic-jfk.wav'))
      const systemAudio = wavPcm(path.join(testDir, 'fixtures/system-bush.wav'))

      const opts = (sourceType: 'microphone' | 'system') => ({
        sourceType,
        modelSize: 'base' as const,
        language: 'en',
        userLanguage: 'en',
        autoDetectLanguage: false
      })

      // Same session id for both, exactly like the app's IPC handler does.
      const [mic, system] = await Promise.all([
        backend.transcribeAudio(micAudio, opts('microphone'), 'sep-test-session', Date.now()),
        backend.transcribeAudio(systemAudio, opts('system'), 'sep-test-session', Date.now())
      ])

      expect(mic.sourceType).toBe('microphone')
      expect(system.sourceType).toBe('system')

      const micText = mic.text.toLowerCase()
      const systemText = system.text.toLowerCase()

      expect(micText).toContain('ask not what your country')
      expect(micText).not.toMatch(/space shuttle|houston/)

      expect(systemText).toMatch(/space shuttle|houston/)
      expect(systemText).not.toContain('ask not')
    },
    120_000
  )
})
