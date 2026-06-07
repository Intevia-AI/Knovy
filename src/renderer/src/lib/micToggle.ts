/**
 * Pure state helpers for the microphone on/off toggle.
 *
 * The mic preference is per-session: every recording session starts ON and the
 * choice is never persisted. Keeping these transitions pure makes them testable
 * without a DOM/media harness; all side-effects live in the hooks/components.
 */

/** Mic starts ON at the beginning of every recording session. */
export const INITIAL_MIC_ENABLED = true

/** Flip the mic-enabled state. */
export function toggleMicEnabled(current: boolean): boolean {
  return !current
}
