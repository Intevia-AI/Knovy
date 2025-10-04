import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { SessionWithTranscripts, GroupedSessions } from '@/types/history'
import { groupSessionsByDate, filterSessions } from '@/lib/history-utils'
import { SessionCard } from './SessionCard'

const SESSIONS_PER_PAGE = 20

export function HistoryView() {
  const { sessionProfile } = useAuth()
  const [sessions, setSessions] = useState<SessionWithTranscripts[]>([])
  const [groupedSessions, setGroupedSessions] = useState<GroupedSessions[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const observerTarget = useRef<HTMLDivElement>(null)

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

  // Apply search filter and grouping
  useEffect(() => {
    const filtered = filterSessions(sessions, searchQuery)
    const grouped = groupSessionsByDate(filtered)
    setGroupedSessions(grouped)
  }, [sessions, searchQuery])

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

    console.log('[HistoryView] loadSessions called with offset:', currentOffset, 'isInitial:', isInitial)

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
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">History</h2>
        <p className="text-sm text-muted-foreground">View and manage your session history</p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search sessions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-background/40 border border-border/30 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Sessions List */}
      <div className="space-y-6">
        {groupedSessions.length === 0 && !isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {searchQuery ? 'No sessions found matching your search' : 'No sessions yet'}
            </p>
          </div>
        ) : (
          groupedSessions.map((group) => (
            <div key={group.group} className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {group.label}
              </h3>
              <div className="space-y-2">
                {group.sessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onExport={handleExport}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
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
