import { describe, it, expect, vi } from 'vitest'
import { withTimeout, TimeoutError } from '../src/main/utils/withTimeout'

describe('withTimeout', () => {
  it('resolves with the original value when it settles before the timeout', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 1000)
    expect(result).toBe('ok')
  })

  it('rejects with the original error when it rejects before the timeout', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000)).rejects.toThrow('boom')
  })

  it('rejects with a TimeoutError when the promise is too slow', async () => {
    vi.useFakeTimers()
    try {
      const slow = new Promise((resolve) => setTimeout(() => resolve('late'), 20_000))
      const raced = withTimeout(slow, 10_000)
      const assertion = expect(raced).rejects.toBeInstanceOf(TimeoutError)
      await vi.advanceTimersByTimeAsync(10_000)
      await assertion
    } finally {
      vi.useRealTimers()
    }
  })

  it('TimeoutError message includes the timeout duration', () => {
    expect(new TimeoutError(10_000).message).toBe('Operation timed out after 10000ms')
  })
})
