/**
 * @fileoverview Action Queue Component
 * @description Displays pending auto-trigger actions with approval/rejection UI
 */

import React from 'react'
import { motion, AnimatePresence } from 'motion'
import { Button } from '@/components/ui/button'
import { Check, X, Loader2, MessageSquareQuote, Calendar, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PendingAction } from '@/types/settings'
import { useI18n } from '@/hooks/useI18n'
import { ACTION_TYPE_LABELS, INTENTION_LABELS } from '@/types/settings'

interface ActionQueueProps {
  pendingActions: PendingAction[]
  approvalMode: 'ask' | 'automatic'
  onApprove: (actionId: string) => void
  onReject: (actionId: string) => void
  onExecute: (action: PendingAction) => void
}

const getActionIcon = (actionType: string) => {
  switch (actionType) {
    case 'recommendResponse':
      return MessageSquareQuote
    case 'scheduleReminder':
      return Calendar
    case 'sendEmail':
      return Mail
    default:
      return MessageSquareQuote
  }
}

export function ActionQueue({
  pendingActions,
  approvalMode,
  onApprove,
  onReject,
  onExecute
}: ActionQueueProps) {
  const { t, language } = useI18n()

  // Filter out completed and failed actions
  const activeActions = pendingActions.filter(
    (action) => action.status !== 'completed' && action.status !== 'failed'
  )

  if (activeActions.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {activeActions.map((action) => {
          const Icon = getActionIcon(action.actionType)
          const actionLabel = ACTION_TYPE_LABELS[action.actionType][language]
          const intentionLabel = INTENTION_LABELS[action.intention.primary][language]

          return (
            <motion.div
              key={action.id}
              layout
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'p-3 rounded-lg border bg-gradient-to-br',
                action.status === 'pending'
                  ? 'from-blue-50/80 to-blue-100/80 border-blue-200'
                  : action.status === 'approved'
                    ? 'from-green-50/80 to-green-100/80 border-green-200'
                    : action.status === 'executing'
                      ? 'from-amber-50/80 to-amber-100/80 border-amber-200'
                      : 'from-red-50/80 to-red-100/80 border-red-200'
              )}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div
                  className={cn(
                    'p-2 rounded-lg shrink-0',
                    action.status === 'pending'
                      ? 'bg-blue-500/10'
                      : action.status === 'approved'
                        ? 'bg-green-500/10'
                        : action.status === 'executing'
                          ? 'bg-amber-500/10'
                          : 'bg-red-500/10'
                  )}
                >
                  {action.status === 'executing' ? (
                    <Loader2 className="h-5 w-5 text-amber-600 animate-spin" />
                  ) : (
                    <Icon
                      className={cn(
                        'h-5 w-5',
                        action.status === 'pending'
                          ? 'text-blue-600'
                          : action.status === 'approved'
                            ? 'text-green-600'
                            : 'text-red-600'
                      )}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-semibold text-gray-900 truncate">
                        {actionLabel}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-black/10 text-gray-700 shrink-0">
                        {intentionLabel}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 shrink-0">
                      {Math.round(action.intention.confidence * 100)}%
                    </span>
                  </div>

                  {/* Transcription text */}
                  <p className="text-xs text-gray-700 line-clamp-2">
                    {action.context.transcriptionText}
                  </p>

                  {/* Action buttons - only show for pending actions in ask mode */}
                  {action.status === 'pending' && approvalMode === 'ask' && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          onApprove(action.id)
                          // Execute immediately after approval
                          setTimeout(() => onExecute(action), 100)
                        }}
                        className="h-7 px-3 text-xs bg-green-500/20 hover:bg-green-500/30 text-green-700 border-green-300"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        {t('approve')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onReject(action.id)}
                        className="h-7 px-3 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-700 border-red-300"
                      >
                        <X className="h-3 w-3 mr-1" />
                        {t('reject')}
                      </Button>
                    </div>
                  )}

                  {/* Status message for automatic mode */}
                  {action.status === 'executing' && (
                    <p className="text-xs text-amber-700 font-medium">
                      {t('executingAction')}...
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
