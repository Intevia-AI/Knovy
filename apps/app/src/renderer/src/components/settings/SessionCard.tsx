import { useState } from 'react'
import { motion, AnimatePresence } from 'motion'
import { ChevronDown, ChevronUp, Download, Trash2, AlertTriangle } from 'lucide-react'
import { SessionWithTranscripts } from '@/types/history'
import { formatTime, formatDate, formatDuration } from '@/lib/date-utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/context/TranslationContext'

interface SessionCardProps {
  session: SessionWithTranscripts
  onExport: (sessionId: string) => void
  onDelete: (sessionId: string) => void
}

export function SessionCard({ session, onExport, onDelete }: SessionCardProps) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const sessionDate = formatDate(session.started_at)
  const sessionTime = formatTime(session.started_at)
  const duration = formatDuration(session.duration)

  const handleDeleteClick = () => {
    setShowDeleteDialog(true)
  }

  const confirmDelete = async () => {
    if (isDeleting) return // Prevent multiple clicks

    setIsDeleting(true)
    try {
      await onDelete(session.id)
      setShowDeleteDialog(false)
    } catch (error) {
      console.error('Failed to delete session:', error)
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  return (
    <>
    <motion.div
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className="bg-background/40 backdrop-blur-md border border-border/30 rounded-lg overflow-hidden"
    >
      {/* Card Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Date and Time */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <span>{sessionDate}</span>
              <span>•</span>
              <span>{sessionTime}</span>
              <span>•</span>
              <span>{duration}</span>
            </div>

            {/* Summary or First Transcript */}
            <div className="text-sm text-foreground/90">
              {session.summary || session.transcripts[0]?.text || 'No content available'}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onExport(session.id)}
              className="p-1.5 rounded-md hover:bg-background/60 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title="Export session"
              aria-label="Export session"
            >
              <Download className="w-4 h-4" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleDeleteClick}
              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
              title="Delete session"
              aria-label="Delete session"
            >
              <Trash2 className="w-4 h-4" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-md hover:bg-background/60 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title={isExpanded ? 'Collapse' : 'Expand'}
              aria-label={isExpanded ? 'Collapse session details' : 'Expand session details'}
              aria-expanded={isExpanded}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="border-t border-border/30 overflow-hidden"
          >
            <div className="p-4 space-y-3">
              {/* Summary Section */}
              {session.summary && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">Summary</h4>
                  <p className="text-sm text-foreground/90">{session.summary}</p>
                </div>
              )}

              {/* Transcripts Section */}
              {session.transcripts.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">
                    Transcripts ({session.transcripts.length})
                  </h4>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto settings-scrollbar">
                    {session.transcripts.map((transcript) => (
                      <div key={transcript.id} className="flex items-start gap-2 text-sm">
                        <div className="flex-shrink-0 text-xs text-muted-foreground mt-0.5">
                          {formatTime(transcript.timestamp)}
                        </div>
                        <div className="flex-shrink-0">
                          {transcript.source_type === 'microphone' ? (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                              Mic
                            </span>
                          ) : (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-500">
                              Sys
                            </span>
                          )}
                        </div>
                        <p className="flex-1 text-foreground/90">{transcript.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No content message */}
              {!session.summary && session.transcripts.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No content available for this session
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence mode="wait">
        {showDeleteDialog && (
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogContent className="bg-background/95 backdrop-blur-xl border-border/50 shadow-2xl">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.1, duration: 0.3, ease: 'backOut' }}
                      className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30"
                    >
                      <AlertTriangle className="w-6 h-6 text-red-500 dark:text-red-400" />
                    </motion.div>
                    <DialogTitle className="text-xl text-foreground">
                      {t('deleteSessionTitle')}
                    </DialogTitle>
                  </div>
                </DialogHeader>
                <DialogDescription className="text-base py-4 text-muted-foreground leading-relaxed">
                  {t('deleteSessionMessage')}
                </DialogDescription>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteDialog(false)}
                    disabled={isDeleting}
                    className="text-foreground hover:bg-accent/50 hover:text-accent-foreground"
                  >
                    {t('cancelDeleteButton')}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={confirmDelete}
                    disabled={isDeleting}
                    className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 border-red-700 shadow-lg shadow-red-500/20"
                  >
                    {isDeleting ? 'Deleting...' : t('deleteButton')}
                  </Button>
                </DialogFooter>
              </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </motion.div>
    </>
  )
}
