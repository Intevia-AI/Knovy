/**
 * Race a promise against a timeout.
 *
 * Resolves/rejects with the original promise if it settles before `ms`.
 * If `ms` elapses first, rejects with a timeout error. Note: the underlying
 * promise is not cancelled — only the wrapper settles.
 */
export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Operation timed out after ${ms}ms`)
    this.name = 'TimeoutError'
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms)
  })

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>
}
