import { useState, useEffect, useCallback } from 'react'
import type { ModelPhase, AiCorrectionMode } from '@/lib/recordGate'

export interface ModelStateError {
  kind: 'disk-full' | 'network' | 'generic'
  raw: string
}

export interface OllamaModel {
  name: string
  size: number
  modifiedAt: string
  digest: string
}

export interface ModelState {
  phase: ModelPhase
  model: string
  progress: number
  reachable: boolean
  error: ModelStateError | null
  pendingModel: string | null
}

const INITIAL: ModelState = {
  phase: 'idle',
  model: '',
  progress: 0,
  reachable: false,
  error: null,
  pendingModel: null
}

export function useOllamaModelState() {
  const [state, setState] = useState<ModelState>(INITIAL)
  const [models, setModels] = useState<OllamaModel[]>([])
  const [aiCorrection, setAiCorrectionState] = useState<AiCorrectionMode>('on')
  const [thinkEnabled, setThinkState] = useState(true)

  const refreshState = useCallback(async () => {
    try {
      const s = await window.electronAPI.invoke('ollama:get-model-state')
      if (s) setState(s)
    } catch {
      /* leave previous state */
    }
  }, [])

  const refreshModels = useCallback(async () => {
    try {
      const list = await window.electronAPI.invoke('ollama:get-models')
      setModels(list || [])
    } catch {
      setModels([])
    }
  }, [])

  const refreshAiCorrection = useCallback(async () => {
    try {
      const r = await window.electronAPI.invoke('ollama:get-ai-correction')
      setAiCorrectionState(r?.mode === 'off' ? 'off' : 'on')
    } catch {
      setAiCorrectionState('on')
    }
  }, [])

  const refreshThink = useCallback(async () => {
    try {
      const r = await window.electronAPI.invoke('ollama:get-think')
      setThinkState(r?.enabled !== false)
    } catch {
      setThinkState(true)
    }
  }, [])

  useEffect(() => {
    refreshState()
    refreshModels()
    refreshAiCorrection()
    refreshThink()
    const unsub = window.electronAPI.on('ollama:model-state', (s: ModelState) => {
      setState(s)
      // Installed set may have changed when a pull reaches "ready".
      if (s.phase === 'ready' || s.phase === 'idle') refreshModels()
    })
    return () => unsub()
  }, [refreshState, refreshModels, refreshAiCorrection, refreshThink])

  const selectModel = useCallback(async (name: string) => {
    await window.electronAPI.invoke('ollama:select-model', name)
  }, [])

  const cancelPull = useCallback(async () => {
    await window.electronAPI.invoke('ollama:cancel-pull')
  }, [])

  const retry = useCallback(async () => {
    await window.electronAPI.invoke('ollama:select-model', state.model)
  }, [state.model])

  const deleteModel = useCallback(
    async (name: string) => {
      await window.electronAPI.invoke('ollama:delete-model', name)
      await refreshModels()
    },
    [refreshModels]
  )

  const checkConnection = useCallback(async () => {
    await window.electronAPI.invoke('ollama:check-connection')
    await refreshState()
    await refreshModels()
  }, [refreshState, refreshModels])

  const setAiCorrection = useCallback(async (mode: AiCorrectionMode) => {
    await window.electronAPI.invoke('ollama:set-ai-correction', mode)
    setAiCorrectionState(mode)
  }, [])

  const setThink = useCallback(async (enabled: boolean) => {
    await window.electronAPI.invoke('ollama:set-think', enabled)
    setThinkState(enabled)
  }, [])

  return {
    state,
    models,
    aiCorrection,
    thinkEnabled,
    selectModel,
    cancelPull,
    retry,
    deleteModel,
    checkConnection,
    setAiCorrection,
    setThink,
    refreshState
  }
}
