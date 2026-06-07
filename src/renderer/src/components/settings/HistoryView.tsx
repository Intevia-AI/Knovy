import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'motion'
import { Search, Loader2, Calendar, X } from 'lucide-react'
import { useTranslation } from '@/context/TranslationContext'
import { SessionWithTranscripts, GroupedSessions } from '@/types/history'
import { groupSessionsByDate, filterSessions } from '@/lib/history-utils'
import { SessionCard } from './SessionCard'
import { CalendarPicker } from './CalendarPicker'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardHeader, CardContent } from '@/components/ui/card'

const SESSIONS_PER_PAGE = 20

export function HistoryView() {
  const { t } = useTranslation()
  const [sessions, setSessions] = useState<SessionWithTranscripts[]>([])
  const [allSessionDates, setAllSessionDates] = useState<string[]>([])
  const [groupedSessions, setGroupedSessions] = useState<GroupedSessions[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
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
    loadSessions(0, true)
  }, [])

  // Periodic refresh: Reload sessions every 15 seconds to fetch latest data
  useEffect(() => {
    console.log('[HistoryView] Starting periodic refresh (15s interval)')
    const refreshIntervalId = setInterval(() => {
      console.log('[HistoryView] Periodic refresh tick - reloading sessions')
      loadSessions(0, true) // Reload from beginning to get latest sessions
    }, 15000) // 15 seconds

    return () => {
      console.log('[HistoryView] Stopping periodic refresh')
      clearInterval(refreshIntervalId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      console.log('[HistoryView] Calling getSessionsWithTranscripts')

      const result = await window.electronAPI.getSessionsWithTranscripts(
        SESSIONS_PER_PAGE,
        currentOffset
      )

      console.log('[HistoryView] Received sessions:', result)

      if (result && result.length > 0) {
        setSessions((prev) => {
          if (isInitial) {
            return result
          }
          // Deduplicate sessions by ID when loading more
          const existingIds = new Set(prev.map((s) => s.id))
          const newSessions = result.filter((s) => !existingIds.has(s.id))
          return [...prev, ...newSessions]
        })
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
      if (isInitial) {
        setIsInitialLoading(false)
      }
    }
  }

  const handleExport = useCallback(async (sessionId: string) => {
    try {
      // Get locale and timezone from system
      const locale = Intl.DateTimeFormat().resolvedOptions().locale || 'en-US'
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

      // Export session with locale and timezone for transformation
      const data = await window.electronAPI.exportSession(sessionId, locale, timezone)

      // Create JSON file for download
      const jsonData = JSON.stringify(data, null, 2)
      const blob = new Blob([jsonData], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url

      // Generate user-friendly filename: knovy-session-2025-10-08-0504.json
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      link.download = `knovy-session-${year}-${month}-${day}-${hours}${minutes}.json`

      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export session:', error)
    }
  }, [])

  const handleDelete = useCallback(async (sessionId: string) => {
    // Confirmation dialog is handled by SessionCard component
    try {
      await window.electronAPI.deleteSession(sessionId)

      // Remove from state
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
    } catch (error) {
      console.error('Failed to delete session:', error)
    }
  }, [])

  if (isInitialLoading) {
    return (
      <div className="space-y-4">
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Search and Calendar Controls Skeleton */}
        <div className="flex gap-3">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>

        {/* Session Cards Skeleton */}
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <div className="space-y-2">
                {[1, 2].map((j) => (
                  <Card key={j} className="bg-background/50 backdrop-blur-sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-4 rounded" />
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-5 w-24 rounded-full" />
                          </div>
                          <Skeleton className="h-3 w-40" />
                        </div>
                        <div className="flex gap-1">
                          <Skeleton className="h-8 w-8 rounded" />
                          <Skeleton className="h-8 w-8 rounded" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Skeleton className="h-4 w-24" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h2 className="text-2xl font-bold text-foreground mb-2">{t('historyTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('historyDescription')}</p>
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
            placeholder={t('searchSessions')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background/40 backdrop-blur-md rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            aria-label={t('searchSessions')}
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
          aria-label={
            selectedDate ? 'Clear date filter' : showCalendar ? 'Close calendar' : 'Select date'
          }
        >
          {selectedDate ? (
            <>
              <X className="w-4 h-4" />
              {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </>
          ) : (
            <>
              <Calendar className="w-4 h-4" />
              {t('calendar')}
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
              {searchQuery ? t('noSessionsFound') : t('noSessionsYet')}
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
