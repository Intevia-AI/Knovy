import { useState } from 'react'
import { motion, AnimatePresence } from 'motion'
import { ChevronDown, ChevronUp, Download, Trash2 } from 'lucide-react'
import { SessionWithTranscripts } from '@/types/history'
import { formatTime, formatDate, formatDuration } from '@/lib/date-utils'

interface SessionCardProps {
  session: SessionWithTranscripts
  onExport: (sessionId: string) => void
  onDelete: (sessionId: string) => void
}

export function SessionCard({ session, onExport, onDelete }: SessionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const sessionDate = formatDate(session.started_at)
  const sessionTime = formatTime(session.started_at)
  const duration = formatDuration(session.duration)

  return (
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
              className="p-1.5 rounded-md hover:bg-background/60 text-muted-foreground hover:text-foreground transition-colors"
              title="Export session"
            >
              <Download className="w-4 h-4" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onDelete(session.id)}
              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Delete session"
            >
              <Trash2 className="w-4 h-4" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-md hover:bg-background/60 text-muted-foreground hover:text-foreground transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
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
    </motion.div>
  )
}
