import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QuitFlow } from '../src/main/quitFlow'

describe('QuitFlow', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function setup() {
    const onShowHint = vi.fn()
    const onHideHint = vi.fn()
    const onQuit = vi.fn()
    const flow = new QuitFlow({ armWindowMs: 3000, onShowHint, onHideHint, onQuit })
    return { flow, onShowHint, onHideHint, onQuit }
  }

  it('shows the hint and arms on the first request', () => {
    const { flow, onShowHint, onQuit } = setup()
    flow.request()
    expect(onShowHint).toHaveBeenCalledTimes(1)
    expect(onQuit).not.toHaveBeenCalled()
    expect(flow.isArmed()).toBe(true)
  })

  it('quits on a second request within the window', () => {
    const { flow, onShowHint, onHideHint, onQuit } = setup()
    flow.request()
    vi.advanceTimersByTime(1000)
    flow.request()
    expect(onQuit).toHaveBeenCalledTimes(1)
    expect(onShowHint).toHaveBeenCalledTimes(1) // hint not shown a second time
    expect(onHideHint).not.toHaveBeenCalled() // quit path must not run the hide-hint callback
    expect(flow.isArmed()).toBe(false)
  })

  it('disarms and hides the hint after the window expires', () => {
    const { flow, onHideHint, onQuit } = setup()
    flow.request()
    vi.advanceTimersByTime(3000)
    expect(onHideHint).toHaveBeenCalledTimes(1)
    expect(onQuit).not.toHaveBeenCalled()
    expect(flow.isArmed()).toBe(false)
  })

  it('re-arms (shows the hint again) when requested after expiry', () => {
    const { flow, onShowHint } = setup()
    flow.request()
    vi.advanceTimersByTime(3000)
    flow.request()
    expect(onShowHint).toHaveBeenCalledTimes(2)
    expect(flow.isArmed()).toBe(true)
  })

  it('does not quit when the second request arrives after expiry', () => {
    const { flow, onQuit } = setup()
    flow.request()
    vi.advanceTimersByTime(3001)
    flow.request()
    expect(onQuit).not.toHaveBeenCalled()
  })
})
