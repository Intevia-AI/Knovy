import { describe, it, expect } from 'vitest'
import { classifyPullError, mapOllamaPullStatus } from '../src/main/ollamaErrors'

describe('classifyPullError', () => {
  it('detects disk-full conditions', () => {
    expect(classifyPullError('write /root/.ollama: no space left on device')).toBe('disk-full')
    expect(classifyPullError('ENOSPC: no space left')).toBe('disk-full')
  })

  it('detects network/offline conditions', () => {
    expect(classifyPullError('dial tcp: connection refused')).toBe('network')
    expect(classifyPullError('fetch failed')).toBe('network')
    expect(classifyPullError('request timeout')).toBe('network')
    expect(classifyPullError('unexpected EOF')).toBe('network')
  })

  it('falls back to generic', () => {
    expect(classifyPullError('manifest unknown')).toBe('generic')
    expect(classifyPullError('')).toBe('generic')
  })
})

describe('mapOllamaPullStatus', () => {
  it('maps verifying-family statuses', () => {
    expect(mapOllamaPullStatus('verifying sha256 digest')).toBe('verifying')
    expect(mapOllamaPullStatus('writing manifest')).toBe('verifying')
  })

  it('maps downloading-family statuses', () => {
    expect(mapOllamaPullStatus('pulling manifest')).toBe('downloading')
    expect(mapOllamaPullStatus('downloading abc123')).toBe('downloading')
  })

  it('returns null for statuses with no phase change', () => {
    expect(mapOllamaPullStatus('success')).toBeNull()
    expect(mapOllamaPullStatus('removing any unused layers')).toBeNull()
  })
})
