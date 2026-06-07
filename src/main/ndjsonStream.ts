/**
 * Parse a ReadableStream of UTF-8 bytes as newline-delimited JSON.
 * Yields one parsed object per complete line. Reassembles lines split
 * across chunks, emits a trailing newline-less line, and skips blank or
 * malformed lines (does not throw on bad JSON).
 */
export async function* parseNdjsonStream(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<any, void, unknown> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let newlineIndex: number
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim()
        buffer = buffer.slice(newlineIndex + 1)
        if (!line) continue
        try {
          yield JSON.parse(line)
        } catch {
          // skip malformed line
        }
      }
    }

    // Flush any bytes the decoder buffered for an incomplete multi-byte char.
    buffer += decoder.decode()

    const tail = buffer.trim()
    if (tail) {
      try {
        yield JSON.parse(tail)
      } catch {
        // skip malformed trailing line
      }
    }
  } finally {
    reader.releaseLock()
  }
}
