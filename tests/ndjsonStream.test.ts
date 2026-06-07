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
})
