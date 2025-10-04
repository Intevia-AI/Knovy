import { useState, useMemo } from 'react'
import { motion } from 'motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface CalendarPickerProps {
  sessionDates: string[] // Array of date strings from database (YYYY-MM-DD format)
  selectedDate: Date | null
  onDateSelect: (date: Date | null) => void
}

export function CalendarPicker({ sessionDates, selectedDate, onDateSelect }: CalendarPickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // Get dates that have sessions
  const datesWithSessions = useMemo(() => {
    const dates = new Set<string>()
    sessionDates.forEach((dateStr) => {
      const date = new Date(dateStr + 'T00:00:00') // Add time to avoid timezone issues
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
      dates.add(dateKey)
    })
    console.log('[CalendarPicker] Dates with sessions:', dates.size, 'dates')
    return dates
  }, [sessionDates])

  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
  const startDate = new Date(monthStart)
  startDate.setDate(startDate.getDate() - startDate.getDay()) // Start from Sunday

  const weeks: Date[][] = []
  let days: Date[] = []
  let day = new Date(startDate)

  while (day <= monthEnd || days.length > 0) {
    if (days.length === 7) {
      weeks.push(days)
      days = []
    }
    days.push(new Date(day))
    day.setDate(day.getDate() + 1)

    if (day > monthEnd && days.length === 7) {
      weeks.push(days)
      break
    }
  }

  const hasSession = (date: Date) => {
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    return datesWithSessions.has(dateKey)
  }

  const isSameDate = (date1: Date | null, date2: Date) => {
    if (!date1) return false
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    )
  }

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentMonth.getMonth()
  }

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  const handleDateClick = (date: Date) => {
    if (hasSession(date)) {
      onDateSelect(isSameDate(selectedDate, date) ? null : date)
    }
  }

  const handleClearFilter = () => {
    onDateSelect(null)
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="bg-white/95 backdrop-blur-xl rounded-lg p-4 w-[280px] shadow-lg border border-border/20"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handlePrevMonth}
          className="p-1 hover:bg-background/10 rounded transition-colors text-foreground"
        >
          <ChevronLeft className="w-4 h-4" />
        </motion.button>
        <motion.div
          key={currentMonth.toISOString()}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm font-semibold text-foreground"
        >
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </motion.div>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleNextMonth}
          className="p-1 hover:bg-background/10 rounded transition-colors text-foreground"
        >
          <ChevronRight className="w-4 h-4" />
        </motion.button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
          <div key={day} className="text-center text-xs text-muted-foreground/70 font-semibold">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="space-y-1">
        {weeks.map((week, weekIdx) => (
          <motion.div
            key={weekIdx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: weekIdx * 0.03 }}
            className="grid grid-cols-7 gap-1"
          >
            {week.map((date, dayIdx) => {
              const hasSessions = hasSession(date)
              const isSelected = isSameDate(selectedDate, date)
              const isInCurrentMonth = isCurrentMonth(date)

              return (
                <motion.button
                  key={dayIdx}
                  onClick={() => handleDateClick(date)}
                  disabled={!hasSessions}
                  whileHover={hasSessions ? { scale: 1.15 } : {}}
                  whileTap={hasSessions ? { scale: 0.95 } : {}}
                  className={`
                    aspect-square text-xs rounded-md flex items-center justify-center
                    transition-colors duration-200 font-medium
                    ${!isInCurrentMonth ? 'text-muted-foreground/25' : ''}
                    ${
                      hasSessions
                        ? isSelected
                          ? 'bg-primary text-white font-semibold shadow-sm'
                          : 'bg-background/30 hover:bg-background/50 text-foreground cursor-pointer'
                        : 'text-muted-foreground/20 cursor-not-allowed'
                    }
                  `}
                >
                  {date.getDate()}
                </motion.button>
              )
            })}
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
