import { describe, it, expect, vi, afterEach } from 'vitest'
import { getOllamaService } from '../src/main/ollamaService'

// A controllable NDJSON streaming Response: `push` a line, `close` to end.
function deferredNdjson(): { response: Response; push: (line: string) => void; close: () => void } {
  const encoder = new TextEncoder()
  let ctrl!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      ctrl = c
    }
  })
  return {
    response: { ok: true, body, status: 200 } as unknown as Response,
    push: (line: string) => ctrl.enqueue(encoder.encode(line)),
    close: () => ctrl.close()
  }
}

const segment = { id: 's1', rawText: 'helo', timestamp: 0, sourceType: 'microphone' as const }
const ctx = { sessionId: 'sess', conversationHistory: [] as string[], userLanguage: 'en' }
const opts = () => ({ signal: new AbortController().signal, onToken: () => {} })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('corrections lane concurrency', () => {
  it('runs two enhanceStream calls concurrently (second fetch issued before first completes)', async () => {
    const svc = getOllamaService()
    ;(svc as any).modelState.phase = 'ready'

    const s1 = deferredNdjson()
    const s2 = deferredNdjson()
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(s1.response)
      .mockResolvedValueOnce(s2.response)

    const p1 = svc.enhanceStream(segment, ctx, opts())
    const p2 = svc.enhanceStream(segment, ctx, opts())

    // Both corrections should have issued their fetch while the first stream
    // is still open (nothing pushed/closed yet).
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))

    s1.push('{"message":{"content":"Hi"}}\n')
    s1.push('{"done":true}\n')
    s1.close()
    s2.push('{"message":{"content":"Yo"}}\n')
    s2.push('{"done":true}\n')
    s2.close()

    await expect(Promise.all([p1, p2])).resolves.toEqual(['Hi', 'Yo'])
  })
})

describe('lane independence', () => {
  it('a blocked chat request does not block a correction', async () => {
    const svc = getOllamaService()
    ;(svc as any).modelState.phase = 'ready'

    const s1 = deferredNdjson()
    const neverResolves = new Promise<Response>(() => {})
    vi.spyOn(global, 'fetch')
      .mockReturnValueOnce(neverResolves as any) // chat fetch — hangs
      .mockResolvedValueOnce(s1.response) // correction fetch

    const chatP = svc.chat({ messages: [{ role: 'user', content: 'hi' }] })
    chatP.catch(() => {})

    const corrP = svc.enhanceStream(segment, ctx, opts())
    s1.push('{"message":{"content":"fixed"}}\n')
    s1.push('{"done":true}\n')
    s1.close()

    // Correction resolves even though the chat request is still in flight.
    await expect(corrP).resolves.toBe('fixed')
  })
})

describe('destroy', () => {
  it('rejects pending queued items in both lanes', async () => {
    const svc = getOllamaService()
    ;(svc as any).modelState.phase = 'ready'

    // All fetches hang so in-flight items never settle; queued items pile up.
    vi.spyOn(global, 'fetch').mockReturnValue(new Promise<Response>(() => {}) as any)

    const inflightA = svc.enhanceStream(segment, ctx, opts())
    const inflightB = svc.enhanceStream(segment, ctx, opts())
    const queuedCorrection = svc.enhanceStream(segment, ctx, opts()) // beyond concurrency=2
    const inflightChat = svc.chat({ messages: [{ role: 'user', content: 'a' }] })
    const queuedChat = svc.chat({ messages: [{ role: 'user', content: 'b' }] })

    // In-flight items stay pending after destroy; swallow to avoid noise.
    inflightA.catch(() => {})
    inflightB.catch(() => {})
    inflightChat.catch(() => {})

    svc.destroy()

    await expect(queuedCorrection).rejects.toThrow('OllamaService destroyed')
    await expect(queuedChat).rejects.toThrow('OllamaService destroyed')
  })
})
