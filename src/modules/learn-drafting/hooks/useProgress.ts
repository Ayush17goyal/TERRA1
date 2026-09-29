import { useCallback, useEffect, useState } from 'react'
import type { AllProgress, LessonProgress } from '../types'

const STORAGE_KEY = 'ld_progress_v2'

function load(): AllProgress {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function save(data: AllProgress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function useProgress() {
  const [progress, setProgress] = useState<AllProgress>(load)

  useEffect(() => {
    save(progress)
  }, [progress])

  const getLessonProgress = useCallback(
    (courseId: string, lessonId: string): LessonProgress =>
      progress[courseId]?.[lessonId] ?? { watched: false, lastPosition: 0 },
    [progress],
  )

  const markWatched = useCallback((courseId: string, lessonId: string) => {
    setProgress((prev) => ({
      ...prev,
      [courseId]: {
        ...prev[courseId],
        [lessonId]: {
          watched: true,
          lastPosition: 0,
          completedAt: new Date().toISOString(),
        },
      },
    }))
  }, [])

  const savePosition = useCallback(
    (courseId: string, lessonId: string, position: number) => {
      setProgress((prev) => ({
        ...prev,
        [courseId]: {
          ...prev[courseId],
          [lessonId]: {
            ...(prev[courseId]?.[lessonId] ?? { watched: false }),
            lastPosition: position,
          },
        },
      }))
    },
    [],
  )

  const getCoursePercent = useCallback(
    (courseId: string, totalLessons: number): number => {
      if (totalLessons === 0) return 0
      const watched = Object.values(progress[courseId] ?? {}).filter(
        (l) => l.watched,
      ).length
      return Math.round((watched / totalLessons) * 100)
    },
    [progress],
  )

  const getLastLesson = useCallback(
    (courseId: string, lessons: { id: string }[]): string | null => {
      const courseProgress = progress[courseId]
      if (!courseProgress) return null
      // Find the latest completed lesson in order
      for (let i = lessons.length - 1; i >= 0; i--) {
        if (courseProgress[lessons[i].id]?.watched) return lessons[i].id
      }
      // Or any lesson with saved position
      for (const lesson of lessons) {
        if ((courseProgress[lesson.id]?.lastPosition ?? 0) > 5) return lesson.id
      }
      return null
    },
    [progress],
  )

  return { progress, getLessonProgress, markWatched, savePosition, getCoursePercent, getLastLesson }
}
