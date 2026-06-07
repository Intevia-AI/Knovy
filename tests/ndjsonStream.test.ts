import { describe, it, expect } from 'vitest'
import { parseNdjsonStream } from '../src/main/ndjsonStream'

// Build a ReadableStream<Uint8Array> from arbitrary string chunks.
function streamFrom(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let i = 0
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i++]))
      } else {
        controller.close()
      }
    }
  })
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<any[]> {
  const out: any[] = []
  for await (const obj of parseNdjsonStream(stream)) out.push(obj)
  return out
}

describe('parseNdjsonStream', () => {
  it('parses one object per line', async () => {
    const objs = await collect(
      streamFrom(['{"message":{"content":"He"}}\n', '{"message":{"content":"llo"}}\n'])
    )
    expect(objs.map((o) => o.message.content)).toEqual(['He', 'llo'])
  })

  it('reassembles a line split across chunks', async () => {
    const objs = await collect(streamFrom(['{"message":{"con', 'tent":"hi"}}\n']))
    expect(objs[0].message.content).toBe('hi')
  })

  it('emits a trailing line with no final newline', async () => {
    const objs = await collect(streamFrom(['{"done":true}']))
    expect(objs[0].done).toBe(true)
  })

  it('skips blank and malformed lines', async () => {
    const objs = await collect(streamFrom(['\n', 'not json\n', '{"done":true}\n']))
    expect(objs).toHaveLength(1)
    expect(objs[0].done).toBe(true)
  })

  it('handles a multi-byte UTF-8 char split across chunks', async () => {
    // Scenario: Stream ends with an incomplete multi-byte char buffered in TextDecoder.
    // This ONLY manifests when a single chunk ends with incomplete bytes and no follow-up.
    // We create a stream that sends valid JSON on multiple lines, with the final line
    // truncated mid-character.
    const line1 = new TextEncoder().encode('{"done":true}\n')
    // Final line starts with valid JSON but ends incomplete multi-byte char:
    const line2Start = new TextEncoder().encode('{"msg":"')
    const incompleteChar = Uint8Array.from([228]) // First byte of '中', no more bytes follow
    // When stream ends, decoder still has [228] buffered (incomplete).

    let i = 0
    const parts = [line1, line2Start, incompleteChar]
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (i < parts.length) controller.enqueue(parts[i++])
        else controller.close()
      }
    })
    const out: any[] = []
    for await (const obj of parseNdjsonStream(stream)) out.push(obj)
    // Without decoder.decode() flush, the incomplete byte [228] would be lost.
    // With flush, it becomes the replacement char '�', and the incomplete JSON is skipped.
    // We should see only the first valid line.
    expect(out).toHaveLength(1)
    expect(out[0].done).toBe(true)
  })
})
