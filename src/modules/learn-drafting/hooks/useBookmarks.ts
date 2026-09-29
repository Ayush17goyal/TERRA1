import { useCallback, useEffect, useState } from 'react'
import type { BookmarkMap } from '../types'

const KEY = 'ld_bookmarks_v1'

function load(): BookmarkMap {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { return {} }
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<BookmarkMap>(load)

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(bookmarks)) }, [bookmarks])

  const isBookmarked = useCallback(
    (courseId: string, lessonId: string) =>
      bookmarks[courseId]?.includes(lessonId) ?? false,
    [bookmarks],
  )

  const toggle = useCallback((courseId: string, lessonId: string) => {
    setBookmarks((prev) => {
      const list = prev[courseId] ?? []
      return {
        ...prev,
        [courseId]: list.includes(lessonId)
          ? list.filter((id) => id !== lessonId)
          : [...list, lessonId],
      }
    })
  }, [])

  return { bookmarks, isBookmarked, toggle }
}
