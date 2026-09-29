import {
  ArrowLeft,
  Award,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  Info,
  Save,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import VideoPlayer from './VideoPlayer'
import type { Course, Lesson, LessonProgress } from './types'

interface Props {
  course: Course
  lesson: Lesson
  lessonProgress: LessonProgress
  note: string
  isBookmarked: boolean
  onBack: () => void
  onMarkWatched: () => void
  onSavePosition: (seconds: number) => void
  onSaveNote: (note: string) => void
  onToggleBookmark: () => void
  onNavigateTo: (lessonId: string) => void
  onCertificate: () => void
  coursePercent: number
}

type PlayerTab = 'takeaways' | 'notes' | 'resources' | 'assignment'

export default function LessonPlayer({
  course,
  lesson,
  lessonProgress,
  note,
  isBookmarked,
  onBack,
  onMarkWatched,
  onSavePosition,
  onSaveNote,
  onToggleBookmark,
  onNavigateTo,
  onCertificate,
  coursePercent,
}: Props) {
  const [activeTab, setActiveTab] = useState<PlayerTab>('takeaways')
  const [noteText, setNoteText] = useState(note)
  const [noteSaved, setNoteSaved] = useState(false)
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const lessonIndex = course.lessons.findIndex((l) => l.id === lesson.id)
  const prevLesson = lessonIndex > 0 ? course.lessons[lessonIndex - 1] : null
  const nextLesson = lessonIndex < course.lessons.length - 1 ? course.lessons[lessonIndex + 1] : null

  useEffect(() => {
    setNoteText(note)
    setNoteSaved(false)
    setAutoNextCountdown(null)
  }, [lesson.id, note])

  const saveNote = useCallback(() => {
    onSaveNote(noteText)
    setNoteSaved(true)
    setTimeout(() => setNoteSaved(false), 2000)
  }, [noteText, onSaveNote])

  const handleVideoEnd = useCallback(() => {
    onMarkWatched()
    if (!nextLesson) return
    let t = 5
    setAutoNextCountdown(t)
    const iv = setInterval(() => {
      t -= 1
      if (t <= 0) {
        clearInterval(iv)
        countdownIntervalRef.current = null
        setAutoNextCountdown(null)
        onNavigateTo(nextLesson.id)
      } else {
        setAutoNextCountdown(t)
      }
    }, 1000)
    countdownIntervalRef.current = iv
  }, [onMarkWatched, nextLesson, onNavigateTo])

  const cancelAutoNext = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
    setAutoNextCountdown(null)
  }, [])

  return (
    <div className="ld-player-page">
      {/* Top bar */}
      <div className="ld-player-topbar">
        <button className="ld-back-btn" onClick={onBack}>
          <ArrowLeft size={15} /> {course.title}
        </button>
        <div className="ld-player-topbar-center">
          <span className="ld-player-lesson-num">Lesson {lessonIndex + 1}/{course.lessons.length}</span>
          <span className="ld-player-lesson-title">{lesson.title}</span>
        </div>
        <div className="ld-player-topbar-right">
          <span className="ld-player-progress-chip">{coursePercent}%</span>
          <button
            className={`ld-bookmark-btn ${isBookmarked ? 'ld-bookmark-btn--active' : ''}`}
            onClick={onToggleBookmark}
            title={isBookmarked ? 'Remove bookmark' : 'Bookmark lesson'}
          >
            {isBookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
          </button>
          {coursePercent === 100 && (
            <button className="ld-cert-chip-btn" onClick={onCertificate}>
              <Award size={14} /> Certificate
            </button>
          )}
        </div>
      </div>

      <div className="ld-player-layout">
        {/* Main area */}
        <main className="ld-player-main">
          <VideoPlayer
            src={lesson.videoUrl}
            title={lesson.title}
            startAt={lessonProgress.lastPosition}
            onProgress={onSavePosition}
            onEnded={handleVideoEnd}
          />

          {autoNextCountdown !== null && (
            <div className="ld-auto-next-bar">
              <span>Next lesson in {autoNextCountdown}s…</span>
              <button className="ld-btn-gold" onClick={() => { cancelAutoNext(); onNavigateTo(nextLesson!.id) }}>
                Play Now
              </button>
              <button className="ld-btn-outline" onClick={cancelAutoNext}>Cancel</button>
            </div>
          )}

          <div className="ld-player-nav">
            <button className="ld-nav-btn" disabled={!prevLesson} onClick={() => prevLesson && onNavigateTo(prevLesson.id)}>
              <ChevronLeft size={16} /> Previous
            </button>
            <button
              className={`ld-mark-btn ${lessonProgress.watched ? 'ld-mark-btn--done' : ''}`}
              onClick={onMarkWatched}
              disabled={lessonProgress.watched}
            >
              {lessonProgress.watched ? '✓ Marked as Watched' : 'Mark as Watched'}
            </button>
            <button className="ld-nav-btn" disabled={!nextLesson} onClick={() => nextLesson && onNavigateTo(nextLesson.id)}>
              Next <ChevronRight size={16} />
            </button>
          </div>

          {/* Content tabs */}
          <div className="ld-player-tabs">
            {([
              ['takeaways', Info, 'Key Takeaways'],
              ['notes', FileText, 'My Notes'],
              ['resources', Download, 'Resources'],
              ['assignment', ClipboardList, 'Assignment'],
            ] as const).map(([tab, Icon, label]) => (
              <button
                key={tab}
                className={`ld-player-tab ${activeTab === tab ? 'ld-player-tab--active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          <div className="ld-player-tab-content">
            {activeTab === 'takeaways' && (
              <div className="ld-takeaways-panel">
                <h4 style={{ margin: '0 0 10px 0', color: 'var(--gold)' }}>Lesson Insights</h4>
                {lesson.description && (
                  <p className="ld-lesson-long-desc">{lesson.description}</p>
                )}
                <h5 style={{ margin: '14px 0 8px 0' }}>Course Takeaways</h5>
                <ul className="ld-takeaway-ul">
                  {course.takeaways.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="ld-notes-panel">
                <h4 style={{ margin: '0 0 12px 0' }}>Course Notebook</h4>
                <textarea
                  className="ld-notes-textarea"
                  rows={8}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Write your observations, clause notes, or drafting checklists here…"
                />
                <div className="ld-notes-footer">
                  {noteSaved && <span className="ld-notes-saved">Notes saved!</span>}
                  <button className="ld-btn-gold" onClick={saveNote}>
                    <Save size={14} /> Save Notes
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'resources' && (
              <div className="ld-resources-panel">
                <h4 style={{ margin: '0 0 12px 0' }}>Downloadable Resources</h4>
                {(lesson.attachments ?? []).length === 0 && course.templates.length === 0 ? (
                  <p style={{ color: 'var(--text-soft)' }}>No downloads for this lesson.</p>
                ) : (
                  <div className="ld-resource-list">
                    {(lesson.attachments ?? []).map((a, i) => (
                      <a key={i} href={a.url} className="ld-resource-item" download target="_blank" rel="noreferrer">
                        <FileText size={15} /> {a.name}
                        <Download size={13} style={{ marginLeft: 'auto' }} />
                      </a>
                    ))}
                    {course.templates.map((t, i) => (
                      <a key={i} href={t.url !== '#' ? t.url : undefined} className="ld-resource-item">
                        <Download size={15} /> {t.name}
                        <Download size={13} style={{ marginLeft: 'auto' }} />
                      </a>
                    ))}
                  </div>
                )}
                {lesson.readingMaterial && (
                  <div className="ld-reading-material">
                    <h5>Reading Material</h5>
                    <p>{lesson.readingMaterial}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'assignment' && (
              <div className="ld-assignment-panel">
                <h4 style={{ margin: '0 0 12px 0' }}>Practice Assignment</h4>
                <p className="ld-assignment-text">{course.assignment}</p>
              </div>
            )}
          </div>
        </main>

        {/* Sidebar */}
        <aside className="ld-player-sidebar">
          <span className="ld-sidebar-label">Course Content</span>
          <div className="ld-player-lesson-list">
            {course.lessons.map((l, idx) => {
              const isCurrent = l.id === lesson.id
              return (
                <button
                  key={l.id}
                  className={`ld-player-lesson-item ${isCurrent ? 'ld-player-lesson-item--active' : ''}`}
                  onClick={() => !isCurrent && onNavigateTo(l.id)}
                >
                  <span className="ld-pli-num">{idx + 1}</span>
                  <span className="ld-pli-title">{l.title}</span>
                  <span className="ld-pli-dur">{l.duration}</span>
                </button>
              )
            })}
          </div>
        </aside>
      </div>
    </div>
  )
}
