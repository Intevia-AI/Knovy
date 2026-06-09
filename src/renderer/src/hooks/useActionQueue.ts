/**
 * @fileoverview Hook for managing auto-trigger action queue
 * @description Handles pending actions, approval/rejection, and execution
 */

import { useState, useEffect, useCallback } from 'react'
import type { PendingAction } from '@/types/settings'

export function useActionQueue() {
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([])
  const [settings, setSettings] = useState<any>(null)

  // Load auto-trigger settings AND consume any pending actions from before popover opened
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const autoTriggerSettings = await window.electronAPI.autoTrigger.getSettings()
        setSettings(autoTriggerSettings)
      } catch (error) {
        console.error('[useActionQueue] Error loading settings:', error)
      }
    }
    loadSettings()

    // Consume any pending actions that were triggered before this popover opened (race condition fix)
    const consumePendingActions = async () => {
      try {
        const cachedActions = await window.electronAPI.invoke('popover:consume-pending-actions')
        if (cachedActions && cachedActions.length > 0) {
          console.log(
            `[useActionQueue] Consumed ${cachedActions.length} pending actions from cache`
          )
          setPendingActions(
            cachedActions.map((a) => ({ ...a, timestamp: a.timestamp || Date.now() }))
          )
        }
      } catch (error) {
        console.error('[useActionQueue] Error consuming pending actions:', error)
      }
    }
    consumePendingActions()

    // Listen for settings changes
    const unsubscribe = window.electronAPI.autoTrigger.onSettingsChanged((newSettings) => {
      setSettings(newSettings)
    })

    return () => unsubscribe()
  }, [])

  // Listen for new actions
  useEffect(() => {
    const unsubscribe = window.electronAPI.autoTrigger.onActionTriggered(
      (action: PendingAction) => {
        console.log('[useActionQueue] New action triggered:', action)
        setPendingActions((prev) => [...prev, action])
      }
    )

    return () => unsubscribe()
  }, [])

  // Listen for action status updates
  useEffect(() => {
    const unsubscribeApproved = window.electronAPI.autoTrigger.onActionApproved(
      (actionId: string) => {
        setPendingActions((prev) =>
          prev.map((action) =>
            action.id === actionId ? { ...action, status: 'approved' as const } : action
          )
        )
      }
    )

    const unsubscribeRejected = window.electronAPI.autoTrigger.onActionRejected(
      (actionId: string) => {
        setPendingActions((prev) => prev.filter((action) => action.id !== actionId))
      }
    )

    const unsubscribeExecuting = window.electronAPI.autoTrigger.onActionExecuting(
      (actionId: string) => {
        setPendingActions((prev) =>
          prev.map((action) =>
            action.id === actionId ? { ...action, status: 'executing' as const } : action
          )
        )
      }
    )

    const unsubscribeCompleted = window.electronAPI.autoTrigger.onActionCompleted(
      ({ actionId, result }: { actionId: string; result?: string }) => {
        setPendingActions((prev) =>
          prev.map((action) =>
            action.id === actionId ? { ...action, status: 'completed' as const, result } : action
          )
        )
      }
    )

    const unsubscribeFailed = window.electronAPI.autoTrigger.onActionFailed(
      ({ actionId }: { actionId: string }) => {
        setPendingActions((prev) =>
          prev.map((action) =>
            action.id === actionId ? { ...action, status: 'failed' as const } : action
          )
        )
      }
    )

    return () => {
      unsubscribeApproved()
      unsubscribeRejected()
      unsubscribeExecuting()
      unsubscribeCompleted()
      unsubscribeFailed()
    }
  }, [])

  // Approve an action
  const approveAction = useCallback(async (actionId: string) => {
    try {
      const result = await window.electronAPI.autoTrigger.approveAction(actionId)
      if (!result.success) {
        console.error('[useActionQueue] Failed to approve action:', result.error)
      }
    } catch (error) {
      console.error('[useActionQueue] Error approving action:', error)
    }
  }, [])

  // Reject an action
  const rejectAction = useCallback(async (actionId: string) => {
    try {
      const result = await window.electronAPI.autoTrigger.rejectAction(actionId)
      if (!result.success) {
        console.error('[useActionQueue] Failed to reject action:', result.error)
      }
    } catch (error) {
      console.error('[useActionQueue] Error rejecting action:', error)
    }
  }, [])

  // Execute an approved action
  const executeAction = useCallback(async (action: PendingAction) => {
    try {
      const result = await window.electronAPI.autoTrigger.executeAction(
        action.id,
        action.actionType,
        action.context
      )
      if (!result.success) {
        console.error('[useActionQueue] Failed to execute action:', result.error)
      }
    } catch (error) {
      console.error('[useActionQueue] Error executing action:', error)
    }
  }, [])

  return {
    pendingActions,
    settings,
    approveAction,
    rejectAction,
    executeAction
  }
}
