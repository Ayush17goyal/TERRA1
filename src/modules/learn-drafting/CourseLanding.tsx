import { Clock, Radio } from 'lucide-react'
import type { Course } from './types'
import { CourseCardSkeleton } from './SkeletonLoaders'

interface Props {
  courses: Course[]
  loading: boolean
  liveSessions: any[]
  getCoursePercent: (courseId: string, total: number) => number
  getLastLesson: (courseId: string, lessons: { id: string }[]) => string | null
  history: any[]
  onSelectCourse: (courseId: string) => void
  onWatchLive: (session: any) => void
  meetError?: string
  searchQuery: string
  onSearchChange: (q: string) => void
}

// Pick the most relevant session for a course: the currently live one, else the
// nearest upcoming one, else the most recently ended one.
function pickSession(sessions: any[], courseId: string) {
  const forCourse = sessions.filter((s) => s.courseId === courseId)
  const live = forCourse.find((s) => s.liveState === 'live')
  if (live) return live
  const upcoming = forCourse
    .filter((s) => s.liveState === 'upcoming')
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
  if (upcoming[0]) return upcoming[0]
  const ended = forCourse
    .filter((s) => s.liveState === 'ended')
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
  return ended[0] ?? null
}

export default function CourseLanding({
  courses,
  loading,
  liveSessions,
  onSelectCourse,
  onWatchLive,
  meetError,
}: Props) {
  const anyLive = liveSessions.find((s) => s.liveState === 'live')

  const DIFF_ORDER = { Beginner: 0, Intermediate: 1, Advanced: 2 } as const

  return (
    <div className="ld-landing">
      {/* Live banner */}
      {anyLive && (
        <div className="ld-live-banner">
          <span className="ld-live-dot" />
          <strong>LIVE NOW</strong>
          <span style={{ color: 'var(--text-soft)' }}>{anyLive.title}</span>
          <button className="ld-live-join-btn" onClick={() => onWatchLive(anyLive)}>
            <Radio size={13} /> Join Live Class
          </button>
        </div>
      )}

      {meetError && (
        <p style={{ margin: 0, fontSize: '0.84rem', color: '#ef4444' }}>{meetError}</p>
      )}

      {/* All Masterclasses */}
      <section className="ld-section">
        <h2 className="ld-section-title">
          <Radio size={18} /> All Masterclasses
        </h2>

        {loading ? (
          <div className="ld-course-grid">
            {[1, 2, 3].map((n) => <CourseCardSkeleton key={n} />)}
          </div>
        ) : courses.length === 0 ? (
          <div className="ld-empty-state">
            <p>No masterclasses available yet.</p>
          </div>
        ) : (
          <div className="ld-course-grid">
            {[...courses]
              .sort((a, b) => DIFF_ORDER[a.difficulty] - DIFF_ORDER[b.difficulty])
              .map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  liveSession={pickSession(liveSessions, course.id)}
                  onSelect={() => onSelectCourse(course.id)}
                  onWatchLive={onWatchLive}
                />
              ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ── Course Card ──────────────────────────────────────────────────────────────

const DIFF_COLOR: Record<string, string> = {
  Beginner: '#22c55e',
  Intermediate: '#f59e0b',
  Advanced: '#ef4444',
}

function CourseCard({
  course,
  liveSession,
  onSelect,
  onWatchLive,
}: {
  course: Course
  liveSession: any
  onSelect: () => void
  onWatchLive: (s: any) => void
}) {
  const isLive = liveSession?.liveState === 'live'

  return (
    <article
      className={`ld-course-card ${isLive ? 'ld-course-card--live' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
    >
      <div className="ld-card-body">
        <div className="ld-card-top-row">
          <span
            className="ld-card-diff-badge"
            style={{ background: DIFF_COLOR[course.difficulty] ?? '#888' }}
          >
            {course.difficulty}
          </span>
          {isLive && (
            <span className="ld-card-live-badge">
              <span className="ld-live-dot" /> LIVE
            </span>
          )}
        </div>

        <h3 className="ld-card-title">{course.title}</h3>
        <p className="ld-card-desc">{course.description}</p>

        <div className="ld-card-meta">
          <span><Clock size={12} /> {course.duration}</span>
          <span>{course.lessons.length} lessons</span>
        </div>

        {!liveSession ? (
          <button className="ld-card-btn" onClick={(e) => { e.stopPropagation(); onSelect() }}>
            Today's Class
          </button>
        ) : liveSession.liveState === 'live' ? (
          <button
            className="ld-card-btn ld-card-btn--live"
            onClick={(e) => { e.stopPropagation(); onWatchLive(liveSession) }}
          >
            <Radio size={13} /> Watch Live Now
          </button>
        ) : liveSession.liveState === 'upcoming' ? (
          <button className="ld-card-btn" disabled onClick={(e) => e.stopPropagation()}>
            Coming Soon
          </button>
        ) : (
          <button className="ld-card-btn" disabled onClick={(e) => e.stopPropagation()}>
            Class Ended
          </button>
        )}
      </div>
    </article>
  )
}
