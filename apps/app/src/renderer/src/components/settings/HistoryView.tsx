import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'motion'
import { Search, Loader2, Calendar, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { SessionWithTranscripts, GroupedSessions } from '@/types/history'
import { groupSessionsByDate, filterSessions } from '@/lib/history-utils'
import { SessionCard } from './SessionCard'
import { CalendarPicker } from './CalendarPicker'

const SESSIONS_PER_PAGE = 20

export function HistoryView() {
  const { sessionProfile } = useAuth()
  const [sessions, setSessions] = useState<SessionWithTranscripts[]>([])
  const [allSessionDates, setAllSessionDates] = useState<string[]>([])
  const [groupedSessions, setGroupedSessions] = useState<GroupedSessions[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const observerTarget = useRef<HTMLDivElement>(null)

  // Load all session dates for calendar (only once on mount)
  useEffect(() => {
    const loadAllDates = async () => {
      try {
        console.log('[HistoryView] Loading all session dates for calendar')
        const dates = await window.electronAPI.getAllSessionDates()
        console.log('[HistoryView] Received session dates:', dates)
        setAllSessionDates(dates)
      } catch (error) {
        console.error('[HistoryView] Failed to load session dates:', error)
      }
    }
    loadAllDates()
  }, [])

  // Load initial sessions
  useEffect(() => {
    console.log('[HistoryView] sessionProfile:', sessionProfile)
    console.log('[HistoryView] sessionProfile.id:', sessionProfile?.id)

    if (sessionProfile?.id) {
      console.log('[HistoryView] Loading sessions for user:', sessionProfile.id)
      loadSessions(0, true)
    } else {
      console.log('[HistoryView] No sessionProfile.id, loading all sessions')
      loadSessions(0, true)
    }
  }, [sessionProfile?.id])

  // Apply search filter, date filter, and grouping
  useEffect(() => {
    console.log(
      '[HistoryView] Filtering sessions. Total:',
      sessions.length,
      'Selected date:',
      selectedDate
    )
    let filtered = filterSessions(sessions, searchQuery)
    console.log('[HistoryView] After search filter:', filtered.length)

    // Apply date filter if a date is selected
    if (selectedDate) {
      console.log('[HistoryView] Applying date filter for:', selectedDate.toLocaleDateString())
      filtered = filtered.filter((session) => {
        const sessionDate = new Date(session.started_at)
        const matches =
          sessionDate.getFullYear() === selectedDate.getFullYear() &&
          sessionDate.getMonth() === selectedDate.getMonth() &&
          sessionDate.getDate() === selectedDate.getDate()
        console.log(
          '[HistoryView] Session',
          session.id,
          'date:',
          sessionDate.toLocaleDateString(),
          'matches:',
          matches
        )
        return matches
      })
      console.log('[HistoryView] After date filter:', filtered.length)

      // When a date is selected, don't group - just show sessions from that date
      setGroupedSessions([
        {
          group: 'today', // Placeholder, won't be displayed
          label: selectedDate.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          }),
          sessions: filtered
        }
      ])
    } else {
      // No date selected - use normal date grouping
      const grouped = groupSessionsByDate(filtered)
      console.log('[HistoryView] Grouped sessions:', grouped.length, 'groups')
      setGroupedSessions(grouped)
    }
  }, [sessions, searchQuery, selectedDate])

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadSessions(offset, false)
        }
      },
      { threshold: 0.1 }
    )

    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }

    return () => observer.disconnect()
  }, [hasMore, isLoading, offset])

  const loadSessions = async (currentOffset: number, isInitial: boolean) => {
    if (isLoading) return

    console.log(
      '[HistoryView] loadSessions called with offset:',
      currentOffset,
      'isInitial:',
      isInitial
    )

    setIsLoading(true)
    try {
      const userId = sessionProfile?.id || 'local-user'
      console.log('[HistoryView] Calling getSessionsWithTranscripts with userId:', userId)

      const result = await window.electronAPI.getSessionsWithTranscripts(
        userId,
        SESSIONS_PER_PAGE,
        currentOffset
      )

      console.log('[HistoryView] Received sessions:', result)

      if (result && result.length > 0) {
        setSessions((prev) => (isInitial ? result : [...prev, ...result]))
        setOffset(currentOffset + SESSIONS_PER_PAGE)
        setHasMore(result.length === SESSIONS_PER_PAGE)
        console.log('[HistoryView] Updated sessions state, total count:', result.length)
      } else {
        setHasMore(false)
        console.log('[HistoryView] No sessions returned')
      }
    } catch (error) {
      console.error('[HistoryView] Failed to load sessions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleExport = useCallback(async (sessionId: string) => {
    try {
      const data = await window.electronAPI.exportSession(sessionId)

      // Create JSON file for download
      const jsonData = JSON.stringify(data, null, 2)
      const blob = new Blob([jsonData], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `session-${sessionId}-${new Date().toISOString()}.json`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export session:', error)
    }
  }, [])

  const handleDelete = useCallback(async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
      return
    }

    try {
      await window.electronAPI.deleteSession(sessionId)

      // Remove from state
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
    } catch (error) {
      console.error('Failed to delete session:', error)
    }
  }, [])

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h2 className="text-2xl font-bold text-foreground mb-2">History</h2>
        <p className="text-sm text-muted-foreground">View and manage your session history</p>
      </motion.div>

      {/* Search and Calendar Controls */}
      <motion.div
        initial={{ opacity: 0, y: 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex gap-3"
      >
        {/* Search Bar */}
        <div className="relative flex-1" role="search">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background/40 backdrop-blur-md rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            aria-label="Search sessions"
          />
        </div>

        {/* Calendar Toggle Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            if (selectedDate) {
              // Clear filter if date is selected
              setSelectedDate(null)
            } else {
              // Toggle calendar
              setShowCalendar(!showCalendar)
            }
          }}
          className={`px-4 py-2 rounded-lg text-sm transition-all duration-200 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            selectedDate
              ? 'bg-primary text-white shadow-sm'
              : showCalendar
                ? 'bg-white/90 text-foreground shadow-sm'
                : 'bg-background/40 backdrop-blur-md hover:bg-white/60 text-muted-foreground'
          }`}
          aria-label={selectedDate ? 'Clear date filter' : showCalendar ? 'Close calendar' : 'Select date'}
        >
          {selectedDate ? (
            <>
              <X className="w-4 h-4" />
              {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </>
          ) : (
            <>
              <Calendar className="w-4 h-4" />
              Calendar
            </>
          )}
        </motion.button>
      </motion.div>

      {/* Calendar Picker - Absolute positioned overlay */}
      {showCalendar && (
        <div className="relative">
          <div className="absolute right-0 top-0 z-10">
            <CalendarPicker
              sessionDates={allSessionDates}
              selectedDate={selectedDate}
              onDateSelect={(date) => {
                setSelectedDate(date)
                setShowCalendar(false) // Always close calendar when a date is selected
              }}
            />
          </div>
        </div>
      )}

      {/* Sessions List */}
      <div className="space-y-6">
        {groupedSessions.length === 0 && !isLoading ? (
          <motion.div
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center py-12"
          >
            <p className="text-muted-foreground">
              {searchQuery ? 'No sessions found matching your search' : 'No sessions yet'}
            </p>
          </motion.div>
        ) : (
          groupedSessions.map((group, groupIdx) => (
            <motion.div
              key={group.group}
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: groupIdx * 0.05 }}
              className="space-y-3"
            >
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {group.label}
              </h3>
              <div className="space-y-2">
                {group.sessions.map((session, sessionIdx) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, x: 0 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: sessionIdx * 0.03 }}
                  >
                    <SessionCard
                      session={session}
                      onExport={handleExport}
                      onDelete={handleDelete}
                    />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {/* Intersection Observer Target */}
        <div ref={observerTarget} className="h-4" />
      </div>
    </div>
  )
}
