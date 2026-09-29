import { useCallback, useEffect, useState } from 'react'
import type { WatchHistoryEntry } from '../types'

const KEY = 'ld_history_v1'
const MAX = 20

function load(): WatchHistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

export function useWatchHistory() {
  const [history, setHistory] = useState<WatchHistoryEntry[]>(load)

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(history)) }, [history])

  const push = useCallback((entry: Omit<WatchHistoryEntry, 'timestamp'>) => {
    setHistory((prev) => {
      const filtered = prev.filter(
        (h) => !(h.courseId === entry.courseId && h.lessonId === entry.lessonId),
      )
      return [{ ...entry, timestamp: Date.now() }, ...filtered].slice(0, MAX)
    })
  }, [])

  return { history, push }
}
