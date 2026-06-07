export type ModelPhase = 'idle' | 'downloading' | 'verifying' | 'ready' | 'error'
export type AiCorrectionMode = 'on' | 'off'

export interface RecordGateInput {
  aiCorrection: AiCorrectionMode
  phase: ModelPhase
  reachable: boolean
}

export type RecordAction =
  | { type: 'start-enhanced' }
  | { type: 'start-raw' }
  | { type: 'prompt-no-model' }
  | { type: 'prompt-downloading' }
  | { type: 'prompt-error' }

/**
 * Decide what should happen when the user attempts to start recording.
 * Pure: caller is responsible for refreshing `phase`/`reachable` first
 * (e.g. via ollama:get-model-state) so out-of-band model deletion is caught.
 */
export function decideRecordAction(input: RecordGateInput): RecordAction {
  if (input.aiCorrection === 'off') return { type: 'start-raw' }
  if (!input.reachable) return { type: 'prompt-error' }
  switch (input.phase) {
    case 'ready':
      return { type: 'start-enhanced' }
    case 'idle':
      return { type: 'prompt-no-model' }
    case 'downloading':
    case 'verifying':
      return { type: 'prompt-downloading' }
    case 'error':
    default:
      return { type: 'prompt-error' }
  }
}
