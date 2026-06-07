import { describe, it, expect } from 'vitest'
import { decideRecordAction } from '../src/renderer/src/lib/recordGate'

describe('decideRecordAction', () => {
  it('records raw immediately when aiCorrection is off, ignoring everything else', () => {
    expect(decideRecordAction({ aiCorrection: 'off', phase: 'idle', reachable: false }).type).toBe('start-raw')
    expect(decideRecordAction({ aiCorrection: 'off', phase: 'downloading', reachable: true }).type).toBe('start-raw')
  })

  it('prompts error when Ollama unreachable (aiCorrection on)', () => {
    expect(decideRecordAction({ aiCorrection: 'on', phase: 'ready', reachable: false }).type).toBe('prompt-error')
    expect(decideRecordAction({ aiCorrection: 'on', phase: 'idle', reachable: false }).type).toBe('prompt-error')
  })

  it('starts enhanced when reachable and ready', () => {
    expect(decideRecordAction({ aiCorrection: 'on', phase: 'ready', reachable: true }).type).toBe('start-enhanced')
  })

  it('prompts no-model when reachable but no model installed', () => {
    expect(decideRecordAction({ aiCorrection: 'on', phase: 'idle', reachable: true }).type).toBe('prompt-no-model')
  })

  it('prompts downloading while a pull is in flight', () => {
    expect(decideRecordAction({ aiCorrection: 'on', phase: 'downloading', reachable: true }).type).toBe('prompt-downloading')
    expect(decideRecordAction({ aiCorrection: 'on', phase: 'verifying', reachable: true }).type).toBe('prompt-downloading')
  })

  it('prompts error when phase is error', () => {
    expect(decideRecordAction({ aiCorrection: 'on', phase: 'error', reachable: true }).type).toBe('prompt-error')
  })
})
