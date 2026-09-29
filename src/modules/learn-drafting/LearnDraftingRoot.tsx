import { useCallback, useEffect, useRef, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { MessageSquare } from 'lucide-react'
import { API_BASE_URL } from '../../lib/api'

import type { Course, LearnView, NoteMap, ReviewMap } from './types'
import { useProgress } from './hooks/useProgress'
import { useBookmarks } from './hooks/useBookmarks'
import { useWatchHistory } from './hooks/useWatchHistory'
import CourseLanding from './CourseLanding'
import CourseDetail from './CourseDetail'
import LessonPlayer from './LessonPlayer'
import CertificateView from './CertificateView'
import CommunitySidebar from './CommunitySidebar'

// ── Seed data ─────────────────────────────────────────────────────────────────
const SEED_COURSES: Course[] = [
  {
    id: 'course-1',
    title: 'Masterclass: Contract Drafting',
    category: 'Contract Drafting',
    description:
      'Learn the architectural principles of commercial contracts. Master recitals, definitions blocks, operative provisions, and default boilerplates under Indian Law.',
    difficulty: 'Intermediate',
    duration: '2.5 Hours',
    lessons: [
      { id: 'l-1', title: 'Constitutive Parts of a Contract', duration: '22 min', videoUrl: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4', description: 'Understand the anatomy of a commercial contract from recitals to schedules.' },
      { id: 'l-2', title: 'Parties Block & Corporate Capacities', duration: '18 min', videoUrl: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4' },
      { id: 'l-3', title: 'Operative Clauses, Covenants & Conditions', duration: '28 min', videoUrl: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4' },
      { id: 'l-4', title: 'Boilerplates: Severability, Force Majeure & Notices', duration: '32 min', videoUrl: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4' },
      { id: 'l-5', title: 'Signatures, Attestations, and Schedule Annexures', duration: '20 min', videoUrl: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4' },
    ],
    takeaways: [
      'Draft in active voice ("Buyer shall pay" instead of "Payment shall be made").',
      'Incorporate clear definitions for terms capitalised throughout.',
      'Check stamp duty acts specific to the place of execution.',
    ],
    templates: [
      { name: 'Standard Commercial Service Agreement Template.docx', url: '#' },
      { name: 'Mutual Non-Disclosure Agreement Checklist.pdf', url: '#' },
    ],
    assignment: 'Draft a mutual Non-Disclosure Agreement (NDA) between a software consultancy and an agency client, ensuring all intellectual property disclosures are protected.',
    announcements: [
      { id: 'a-1', title: 'Module 3 updated', body: 'The Operative Clauses lesson has been updated with new examples from recent Supreme Court judgments.', date: '2025-12-01' },
    ],
  },
  {
    id: 'course-2',
    title: 'Masterclass: Legal Notices',
    category: 'Legal Notices',
    description:
      'Master the art of pre-litigation notices. Learn notices under Section 138 of NI Act, Section 80 of CPC, and Consumer Protection regulations.',
    difficulty: 'Beginner',
    duration: '1.8 Hours',
    lessons: [
      { id: 'l-6', title: 'Notice Framework & Legal Intent', duration: '15 min', videoUrl: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4' },
      { id: 'l-7', title: 'Section 138 Cheque Bounce Notices', duration: '25 min', videoUrl: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4' },
      { id: 'l-8', title: 'Civil Notices under Section 80 CPC', duration: '30 min', videoUrl: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4' },
      { id: 'l-9', title: 'Drafting Demand for Specific Performance', duration: '20 min', videoUrl: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4' },
    ],
    takeaways: [
      'Strictly state the cause of action and date of occurrence.',
      'Clearly specify the relief demanded and the time limit (e.g. 15 days).',
      'Ensure proof of service is preserved (Speed Post AD / email logs).',
    ],
    templates: [
      { name: 'Cheque Bounce Notice Section 138 Draft.docx', url: '#' },
      { name: 'General Civil Demand Notice Format.pdf', url: '#' },
    ],
    assignment: 'Draft a legal notice demanding payment for outstanding invoices totalling INR 5,00,000, providing a strict 15-day compliance window before filing suit.',
  },
  {
    id: 'course-3',
    title: 'Masterclass: Plaints & Written Statements',
    category: 'Plaints',
    description:
      'Learn pleading architecture. Master CPC Order VI rules, cause of action framing, valuation, court fees, and jurisdiction details.',
    difficulty: 'Advanced',
    duration: '3.2 Hours',
    lessons: [
      { id: 'l-10', title: 'Rules of Pleading (Order VI CPC)', duration: '35 min', videoUrl: '' },
      { id: 'l-11', title: 'Structure of a Plaint (Order VII CPC)', duration: '40 min', videoUrl: '' },
      { id: 'l-12', title: 'Framing Causes of Action and Jurisdiction', duration: '30 min', videoUrl: '' },
      { id: 'l-13', title: 'Drafting Written Statements & Set-off Claims', duration: '45 min', videoUrl: '' },
      { id: 'l-14', title: 'Verifications, Affidavits & Annexures', duration: '20 min', videoUrl: '' },
    ],
    takeaways: [
      'Plead facts, not laws (state material facts concisely).',
      'Specifically deny every allegation; general denials count as admissions.',
      'Ensure verification is signed on oath before an oath commissioner.',
    ],
    templates: [
      { name: 'Model Plaint for Recovery of Money.docx', url: '#' },
      { name: 'Model Written Statement (Defense).docx', url: '#' },
    ],
    assignment: 'Draft a plaint for the recovery of money against a defaulting buyer, including statements on jurisdiction and cause of action.',
  },
]

// ── Notes & Reviews persistence ──────────────────────────────────────────────

function loadNotes(): NoteMap {
  try { return JSON.parse(localStorage.getItem('ld_notes_v1') ?? '{}') } catch { return {} }
}
function saveNotes(n: NoteMap) { localStorage.setItem('ld_notes_v1', JSON.stringify(n)) }

function loadReviews(): ReviewMap {
  try { return JSON.parse(localStorage.getItem('ld_reviews_v1') ?? '{}') } catch { return {} }
}
function saveReviews(r: ReviewMap) { localStorage.setItem('ld_reviews_v1', JSON.stringify(r)) }

// ── Root Component ────────────────────────────────────────────────────────────

interface Props {
  apiToken: string
}

export default function LearnDraftingRoot({ apiToken }: Props) {
  const { user } = useUser()
  const [view, setView] = useState<LearnView>({ kind: 'landing' })
  const [courses, setCourses] = useState<Course[]>([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [liveSessions, setLiveSessions] = useState<any[]>([])
  const [meetError, setMeetError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [chatOpen, setChatOpen] = useState(() => {
    try {
      const stored = localStorage.getItem('ld_chat_open')
      return stored === null ? true : stored === 'true'
    } catch { return true }
  })

  const toggleChat = useCallback((open: boolean) => {
    setChatOpen(open)
    try { localStorage.setItem('ld_chat_open', String(open)) } catch { /* ignore */ }
  }, [])
  const [notes, setNotes] = useState<NoteMap>(loadNotes)
  const [reviews, setReviews] = useState<ReviewMap>(loadReviews)

  const { getLessonProgress, markWatched, savePosition, getCoursePercent, getLastLesson } = useProgress()
  const { isBookmarked, toggle: toggleBookmark } = useBookmarks()
  const { history, push: pushHistory } = useWatchHistory()

  const livePoller = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch courses ────────────────────────────────────────────────────────
  useEffect(() => {
    setLoadingCourses(true)
    fetch(`${API_BASE_URL}/legal-intelligence/drafting/courses`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: any[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setCourses(
            data.map((item) => ({
              id: item.id,
              title: item.title,
              category: item.category,
              description: item.description,
              difficulty: item.metadata?.difficulty ?? 'Intermediate',
              duration: item.metadata?.duration ?? '2 Hours',
              lessons: item.metadata?.lessons ?? [],
              takeaways: item.metadata?.takeaways ?? [],
              templates: item.metadata?.templates ?? [],
              assignment: item.metadata?.assignment ?? '',
              announcements: item.metadata?.announcements ?? [],
            })),
          )
        } else {
          setCourses(SEED_COURSES)
        }
      })
      .catch(() => setCourses(SEED_COURSES))
      .finally(() => setLoadingCourses(false))
  }, [apiToken])

  // ── Fetch live sessions ──────────────────────────────────────────────────
  const fetchLive = useCallback(() => {
    if (!apiToken) return
    fetch(`${API_BASE_URL}/live-sessions`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((d: any[]) => { if (Array.isArray(d)) setLiveSessions(d) })
      .catch(() => {})
  }, [apiToken])

  useEffect(() => {
    fetchLive()
    livePoller.current = setInterval(fetchLive, 30_000)
    return () => { if (livePoller.current) clearInterval(livePoller.current) }
  }, [fetchLive])

  // ── Notes helpers ────────────────────────────────────────────────────────
  const getNote = useCallback(
    (courseId: string, lessonId: string) => notes[courseId]?.[lessonId] ?? '',
    [notes],
  )
  const saveNote = useCallback((courseId: string, lessonId: string, text: string) => {
    setNotes((prev) => {
      const next = { ...prev, [courseId]: { ...prev[courseId], [lessonId]: text } }
      saveNotes(next)
      return next
    })
  }, [])

  // ── Review helpers ───────────────────────────────────────────────────────
  const saveReview = useCallback((courseId: string, rating: number, comment: string) => {
    const userId = user?.id ?? 'anon'
    setReviews((prev) => {
      const next = { ...prev, [courseId]: { userId, rating, comment, date: new Date().toISOString() } }
      saveReviews(next)
      return next
    })
  }, [user])

  // ── View transitions ─────────────────────────────────────────────────────
  const goLanding = useCallback(() => {
    setView({ kind: 'landing' })
    setSearchQuery('')
  }, [])

  const goCourseDetail = useCallback((courseId: string) => {
    setView({ kind: 'detail', courseId })
  }, [])

  const goLesson = useCallback((courseId: string, lessonId: string) => {
    const course = courses.find((c) => c.id === courseId)
    const lesson = course?.lessons.find((l) => l.id === lessonId)
    if (!course || !lesson) return
    pushHistory({
      courseId,
      lessonId,
      courseTitle: course.title,
      lessonTitle: lesson.title,
    })
    setView({ kind: 'player', courseId, lessonId })
  }, [courses, pushHistory])

  const openMeet = useCallback(async (session: any) => {
    setMeetError('')
    try {
      const r = await fetch(`${API_BASE_URL}/live-sessions/${session.id}/meet-link`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) {
        setMeetError(data.message ?? 'Could not open this class. Please try again.')
        return
      }
      if (!data.meetLink) {
        setMeetError('Meeting link unavailable.')
        return
      }
      window.open(data.meetLink, '_blank', 'noopener,noreferrer')
    } catch {
      setMeetError('Network error. Please check your connection and try again.')
    }
  }, [apiToken])

  const goCertificate = useCallback((courseId: string) => {
    setView({ kind: 'certificate', courseId })
  }, [])

  // ── Derived data for current view ─────────────────────────────────────────
  const activeCourse =
    view.kind !== 'landing' && 'courseId' in view
      ? courses.find((c) => c.id === view.courseId) ?? null
      : null

  const userName = user?.fullName ?? user?.firstName ?? 'Student'

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderMain = () => {
    if (view.kind === 'landing') {
      return (
        <CourseLanding
          courses={courses}
          loading={loadingCourses}
          liveSessions={liveSessions}
          getCoursePercent={getCoursePercent}
          getLastLesson={getLastLesson}
          history={history}
          onSelectCourse={goCourseDetail}
          onWatchLive={openMeet}
          meetError={meetError}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      )
    }

    if (view.kind === 'certificate' && activeCourse) {
      const completedAt =
        activeCourse.lessons
          .map((l: import('./types').Lesson) => getLessonProgress(activeCourse.id, l.id))
          .find((p) => p.completedAt)?.completedAt ?? new Date().toISOString()
      return (
        <CertificateView
          course={activeCourse}
          userName={userName}
          completedAt={completedAt}
          onBack={() => setView({ kind: 'detail', courseId: view.courseId })}
        />
      )
    }

    if (view.kind === 'detail' && activeCourse) {
      const courseSessions = liveSessions.filter((s) => s.courseId === activeCourse.id)
      const liveSession =
        courseSessions.find((s) => s.liveState === 'live')
        ?? [...courseSessions].filter((s) => s.liveState === 'upcoming').sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0]
        ?? [...courseSessions].filter((s) => s.liveState === 'ended').sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())[0]
        ?? null

      return (
        <CourseDetail
          course={activeCourse}
          pct={getCoursePercent(activeCourse.id, activeCourse.lessons.length)}
          getLessonWatched={(lid) => getLessonProgress(activeCourse.id, lid).watched}
          lastLessonId={getLastLesson(activeCourse.id, activeCourse.lessons)}
          liveSession={liveSession}
          meetError={meetError}
          loading={loadingCourses}
          review={reviews[activeCourse.id] ?? null}
          onBack={goLanding}
          onOpenLesson={(lid) => goLesson(activeCourse.id, lid)}
          onWatchLive={openMeet}
          onSaveReview={(rating, comment) => saveReview(activeCourse.id, rating, comment)}
          onCertificate={() => goCertificate(activeCourse.id)}
        />
      )
    }

    if (view.kind === 'player' && activeCourse) {
      const lesson = activeCourse.lessons.find((l) => l.id === view.lessonId)
      if (!lesson) return null

      return (
        <LessonPlayer
          course={activeCourse}
          lesson={lesson}
          lessonProgress={getLessonProgress(activeCourse.id, lesson.id)}
          note={getNote(activeCourse.id, lesson.id)}
          isBookmarked={isBookmarked(activeCourse.id, lesson.id)}
          onBack={() => setView({ kind: 'detail', courseId: activeCourse.id })}
          onMarkWatched={() => markWatched(activeCourse.id, lesson.id)}
          onSavePosition={(s) => savePosition(activeCourse.id, lesson.id, s)}
          onSaveNote={(text) => saveNote(activeCourse.id, lesson.id, text)}
          onToggleBookmark={() => toggleBookmark(activeCourse.id, lesson.id)}
          onNavigateTo={(lid) => goLesson(activeCourse.id, lid)}
          onCertificate={() => goCertificate(activeCourse.id)}
          coursePercent={getCoursePercent(activeCourse.id, activeCourse.lessons.length)}
        />
      )
    }

    return null
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="ld-root-layout">
      <div className={`ld-root-main${chatOpen ? ' ld-root-main--chat-open' : ''}`}>
        {renderMain()}
      </div>

      {/* Floating chat toggle button */}
      {!chatOpen && (
        <button
          className="ld-chat-fab"
          onClick={() => toggleChat(true)}
          aria-label="Open Community Chat"
        >
          <MessageSquare size={20} />
          <span>Community</span>
        </button>
      )}

      {/* Right sidebar */}
      <CommunitySidebar
        apiToken={apiToken}
        open={chatOpen}
        onClose={() => toggleChat(false)}
      />
    </div>
  )
}
