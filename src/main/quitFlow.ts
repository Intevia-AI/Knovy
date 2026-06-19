/**
 * Two-step quit state machine.
 *
 * The first request() arms the flow and shows the hint popover. A second
 * request() within `armWindowMs` quits. If no second request arrives in time,
 * the flow disarms and hides the hint. All side effects are injected so the
 * logic is unit-testable without Electron.
 */
export interface QuitFlowOptions {
  /** How long (ms) the armed window stays open after the first request. */
  armWindowMs: number
  /** Show the "press again to quit" hint (and reveal the window if hidden). */
  onShowHint: () => void
  /** Hide the hint popover (timeout expiry path). */
  onHideHint: () => void
  /** Actually quit the app. */
  onQuit: () => void
  /** Injectable timer (defaults to the global setTimeout/clearTimeout). */
  setTimer?: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>
  /** Injectable timer cancel (defaults to the global clearTimeout). */
  clearTimer?: (handle: ReturnType<typeof setTimeout>) => void
}

export class QuitFlow {
  private armed = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly setTimer: (cb: () => void, ms: number) => ReturnType<typeof setTimeout>
  private readonly clearTimer: (handle: ReturnType<typeof setTimeout>) => void

  constructor(private readonly options: QuitFlowOptions) {
    this.setTimer = options.setTimer ?? ((cb, ms) => setTimeout(cb, ms))
    this.clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle))
  }

  /** True while armed (hint showing). */
  isArmed(): boolean {
    return this.armed
  }

  /** Handle a quit gesture (Cmd+Q / Ctrl+Q). */
  request(): void {
    if (this.armed) {
      this.disarm()
      this.options.onQuit()
      return
    }

    this.armed = true
    this.options.onShowHint()
    this.timer = this.setTimer(() => {
      this.armed = false
      this.timer = null
      this.options.onHideHint()
    }, this.options.armWindowMs)
  }

  private disarm(): void {
    if (this.timer !== null) {
      this.clearTimer(this.timer)
      this.timer = null
    }
    this.armed = false
  }
}
