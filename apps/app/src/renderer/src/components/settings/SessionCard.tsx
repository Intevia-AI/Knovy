import { useState } from 'react'
import { motion, AnimatePresence } from 'motion'
import { ChevronDown, ChevronUp, Download, Trash2, AlertTriangle, Copy, Check } from 'lucide-react'
import { SessionWithTranscripts } from '@/types/history'
import { formatTime, formatDate, formatDuration } from '@/lib/date-utils'
import {
  copyToClipboard,
  formatSummaryForCopy,
  formatTranscriptionsForCopy,
  formatTranscriptForCopy
} from '@/lib/copy-utils'
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
import { toast } from 'sonner'
import { Markdown } from '@/components/MarkdownRenderer'

interface SessionCardProps {
  session: SessionWithTranscripts
  onExport: (sessionId: string) => void
  onDelete: (sessionId: string) => void
}

export function SessionCard({ session, onExport, onDelete }: SessionCardProps) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<'summary' | 'transcriptions'>('summary')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showCopyMenu, setShowCopyMenu] = useState(false)
  const [hoveredTranscriptId, setHoveredTranscriptId] = useState<string | null>(null)
  const [copiedTranscriptId, setCopiedTranscriptId] = useState<string | null>(null)

  const sessionDate = formatDate(session.started_at)
  const sessionTime = formatTime(session.started_at)
  const duration = formatDuration(session.duration)

  // Get display summary for collapsed state
  const displaySummary = session.short_summary ||
    (session.summary ? session.summary.slice(0, 100) + '...' : null) ||
    session.transcripts[0]?.text ||
    'No content available'

  const handleDeleteClick = () => {
    setShowDeleteDialog(true)
  }

  const handleCopySummary = async () => {
    const text = formatSummaryForCopy(session)
    const success = await copyToClipboard(text)
    if (success) {
      toast.success(t('copiedToClipboard'))
    } else {
      toast.error(t('copyFailed'))
    }
    setShowCopyMenu(false)
  }

  const handleCopyTranscriptions = async () => {
    const text = formatTranscriptionsForCopy(session)
    const success = await copyToClipboard(text)
    if (success) {
      toast.success(t('copiedToClipboard'))
    } else {
      toast.error(t('copyFailed'))
    }
    setShowCopyMenu(false)
  }

  const handleCopyTranscript = async (transcript: any) => {
    const text = formatTranscriptForCopy(transcript)
    const success = await copyToClipboard(text)
    if (success) {
      setCopiedTranscriptId(transcript.id)
      toast.success(t('copiedToClipboard'))
      setTimeout(() => setCopiedTranscriptId(null), 2000)
    } else {
      toast.error(t('copyFailed'))
    }
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
        className="bg-background/40 backdrop-blur-md rounded-lg p-2 overflow-hidden"
      >
        {/* Card Header - Now clickable as accordion */}
        <div
          className="p-4 cursor-pointer select-none"
          onClick={() => setIsExpanded(!isExpanded)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setIsExpanded(!isExpanded)
            }
          }}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse session details' : 'Expand session details'}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0 pointer-events-none">
              {/* Date and Time */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <span>{sessionDate}</span>
                <span>•</span>
                <span>{sessionTime}</span>
                <span>•</span>
                <span>{duration}</span>
              </div>

              {/* Short Summary or First Transcript */}
              <div className="text-sm text-foreground/90 line-clamp-2">
                {displaySummary}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0 pointer-events-auto">
              {/* Copy Button with Dropdown */}
              <div className="relative">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowCopyMenu(!showCopyMenu)
                  }}
                  className="p-1.5 rounded-md hover:bg-background/60 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  title={t('copyTranscript')}
                  aria-label={t('copyTranscript')}
                >
                  <Copy className="w-4 h-4" />
                </motion.button>

                {/* Copy Menu Dropdown */}
                {showCopyMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-background backdrop-blur-xl rounded-md shadow-lg z-10 min-w-[200px]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCopySummary()
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent/50 transition-colors first:rounded-t-md"
                    >
                      {t('copySummary')}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCopyTranscriptions()
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent/50 transition-colors last:rounded-b-md"
                    >
                      {t('copyTranscriptions')}
                    </button>
                  </div>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation()
                  onExport(session.id)
                }}
                className="p-1.5 rounded-md hover:bg-background/60 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                title="Export session"
                aria-label="Export session"
              >
                <Download className="w-4 h-4" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteClick()
                }}
                className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                title="Delete session"
                aria-label="Delete session"
              >
                <Trash2 className="w-4 h-4" />
              </motion.button>
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="p-1.5 text-muted-foreground"
              >
                <ChevronDown className="w-4 h-4" />
              </motion.div>
            </div>
          </div>
        </div>

        {/* Expanded Content with Tabs */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="border-t border-secondary overflow-hidden"
            >
              {/* Tab Navigation */}
              <div className="flex border-b border-secondary/50 px-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveTab('summary')
                  }}
                  className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                    activeTab === 'summary'
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Summary
                  {activeTab === 'summary' && (
                    <motion.div
                      layoutId={`activeTab-${session.id}`}
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveTab('transcriptions')
                  }}
                  className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                    activeTab === 'transcriptions'
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Transcriptions ({session.transcripts.length})
                  {activeTab === 'transcriptions' && (
                    <motion.div
                      layoutId={`activeTab-${session.id}`}
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-4">
                <AnimatePresence mode="wait">
                  {activeTab === 'summary' && (
                    <motion.div
                      key="summary"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-3"
                    >
                      {session.summary ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none overflow-x-hidden break-words">
                          <Markdown>{session.summary}</Markdown>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No summary available for this session
                        </p>
                      )}
                    </motion.div>
                  )}

                  {activeTab === 'transcriptions' && (
                    <motion.div
                      key="transcriptions"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.15 }}
                    >
                      {session.transcripts.length > 0 ? (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto overflow-x-hidden settings-scrollbar pr-2">
                          {session.transcripts.map((transcript) => (
                            <div
                              key={transcript.id}
                              className="flex items-start gap-2 text-sm p-2 -ml-2 rounded-md hover:bg-accent/30 transition-colors cursor-pointer group relative"
                              onMouseEnter={() => setHoveredTranscriptId(transcript.id)}
                              onMouseLeave={() => setHoveredTranscriptId(null)}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopyTranscript(transcript)
                              }}
                            >
                              <div className="flex-shrink-0 text-xs text-muted-foreground mt-0.5">
                                {formatTime(transcript.timestamp)}
                              </div>
                              <div className="flex-shrink-0">
                                {transcript.source_type === 'microphone' ? (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                                    User
                                  </span>
                                ) : (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-500">
                                    Others
                                  </span>
                                )}
                              </div>
                              <p className="flex-1 text-foreground/90 break-words overflow-wrap-anywhere">
                                {transcript.text}
                              </p>

                              {/* Copy Icon on Hover */}
                              {(hoveredTranscriptId === transcript.id ||
                                copiedTranscriptId === transcript.id) && (
                                <div className="flex-shrink-0">
                                  {copiedTranscriptId === transcript.id ? (
                                    <Check className="w-3.5 h-3.5 text-green-500" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No transcriptions available for this session
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
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
