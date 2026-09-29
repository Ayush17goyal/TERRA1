export interface Lesson {
  id: string
  title: string
  duration: string
  videoUrl: string
  description?: string
  attachments?: Attachment[]
  readingMaterial?: string
}

export interface Attachment {
  name: string
  url: string
  type: 'pdf' | 'docx' | 'template' | 'other'
}

export interface CourseTemplate {
  name: string
  url: string
}

export interface Announcement {
  id: string
  title: string
  body: string
  date: string
}

export interface Review {
  userId: string
  rating: number
  comment: string
  date: string
}

export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced'

export interface Course {
  id: string
  title: string
  category: string
  description: string
  difficulty: Difficulty
  duration: string
  lessons: Lesson[]
  takeaways: string[]
  templates: CourseTemplate[]
  assignment: string
  announcements?: Announcement[]
}

export interface LessonProgress {
  watched: boolean
  lastPosition: number // seconds
  completedAt?: string
}

export interface CourseProgress {
  [lessonId: string]: LessonProgress
}

export interface AllProgress {
  [courseId: string]: CourseProgress
}

export interface BookmarkMap {
  [courseId: string]: string[] // lesson ids
}

export interface NoteMap {
  [courseId: string]: {
    [lessonId: string]: string
  }
}

export interface WatchHistoryEntry {
  courseId: string
  lessonId: string
  courseTitle: string
  lessonTitle: string
  timestamp: number
}

export interface ReviewMap {
  [courseId: string]: Review
}

export type LearnView =
  | { kind: 'landing' }
  | { kind: 'detail'; courseId: string }
  | { kind: 'player'; courseId: string; lessonId: string }
  | { kind: 'certificate'; courseId: string }
