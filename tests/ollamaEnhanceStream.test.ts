import { describe, it, expect, vi, afterEach } from 'vitest'
import { getOllamaService } from '../src/main/ollamaService'

function ndjsonResponse(lines: string[]): Response {
  const encoder = new TextEncoder()
  let i = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < lines.length) controller.enqueue(encoder.encode(lines[i++]))
      else controller.close()
    }
  })
  return { ok: true, body, status: 200 } as unknown as Response
}

const segment = { id: 's1', rawText: 'helo', timestamp: 0, sourceType: 'microphone' as const }
const ctx = { sessionId: 'sess', conversationHistory: [] as string[], userLanguage: 'en' }

afterEach(() => {
  vi.restoreAllMocks()
})

describe('enhanceStream', () => {
  it('accumulates streamed chunks and fires onToken per chunk', async () => {
    const svc = getOllamaService()
    ;(svc as any).modelState.phase = 'ready'
    vi.spyOn(global, 'fetch').mockResolvedValue(
      ndjsonResponse([
        '{"message":{"content":"Hel"}}\n',
        '{"message":{"content":"lo"}}\n',
        '{"done":true}\n'
      ])
    )
    const tokens: string[] = []
    const controller = new AbortController()
    const full = await svc.enhanceStream(segment, ctx, {
      signal: controller.signal,
      onToken: (c) => tokens.push(c)
    })
    expect(full).toBe('Hello')
    expect(tokens).toEqual(['Hel', 'lo'])
  })

  it('rejects with an AbortError when the signal is already aborted', async () => {
    const svc = getOllamaService()
    ;(svc as any).modelState.phase = 'ready'
    const fetchSpy = vi.spyOn(global, 'fetch')
    const controller = new AbortController()
    controller.abort()
    await expect(
      svc.enhanceStream(segment, ctx, { signal: controller.signal, onToken: () => {} })
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
