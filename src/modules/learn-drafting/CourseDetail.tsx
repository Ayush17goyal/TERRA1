import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FileText,
  Gavel,
  MessageSquare,
  Play,
  Radio,
  Search,
  Star,
  Video,
} from 'lucide-react'
import { useState } from 'react'
import type { Course } from './types'
import { LessonRowSkeleton } from './SkeletonLoaders'

interface Props {
  course: Course
  pct: number
  getLessonWatched: (lessonId: string) => boolean
  lastLessonId: string | null
  liveSession: any | null
  meetError?: string
  loading: boolean
  review: { rating: number; comment: string } | null
  onBack: () => void
  onOpenLesson: (lessonId: string) => void
  onWatchLive: (session: any) => void
  onSaveReview: (rating: number, comment: string) => void
  onCertificate: () => void
}

const INSTRUCTOR = {
  name: 'The Founder',
  role: 'Senior Advocate & Legal Educator',
  bio: 'Practising advocate with expertise in commercial contracts, civil litigation, and constitutional law. Founded Legatrixon to democratise elite legal education for law students and young practitioners across India.',
  avatar: null as null | string,
}

export default function CourseDetail({
  course,
  pct,
  getLessonWatched,
  lastLessonId,
  liveSession,
  meetError,
  loading,
  review,
  onBack,
  onOpenLesson,
  onWatchLive,
  onSaveReview,
  onCertificate,
}: Props) {
  const [curriculumOpen, setCurriculumOpen] = useState(true)
  const [lessonSearch, setLessonSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'curriculum' | 'reviews' | 'announcements'>('overview')
  const [reviewRating, setReviewRating] = useState(review?.rating ?? 0)
  const [reviewComment, setReviewComment] = useState(review?.comment ?? '')
  const [reviewSaved, setReviewSaved] = useState(!!review)

  const filteredLessons = lessonSearch.trim()
    ? course.lessons.filter((l) =>
        l.title.toLowerCase().includes(lessonSearch.toLowerCase()),
      )
    : course.lessons

  const firstUnwatched = course.lessons.find((l) => !getLessonWatched(l.id))
  const resumeLesson = lastLessonId
    ? course.lessons.find((l) => l.id === lastLessonId) ?? course.lessons[0]
    : firstUnwatched ?? course.lessons[0]

  const handleSaveReview = () => {
    onSaveReview(reviewRating, reviewComment)
    setReviewSaved(true)
  }

  return (
    <div className="ld-detail-page">
      {/* Back */}
      <button className="ld-back-btn" onClick={onBack}>
        <ArrowLeft size={16} /> Back to Library
      </button>

      {/* Hero banner */}
      <div className="ld-detail-hero">
        <div className="ld-detail-hero-content">
          <span className="ld-detail-category">{course.category}</span>
          <h1 className="ld-detail-title">{course.title}</h1>
          <p className="ld-detail-desc">{course.description}</p>

          <div className="ld-detail-meta-row">
            <span><Clock size={13} /> {course.duration}</span>
            <span><Video size={13} /> {course.lessons.length} lessons</span>
            <span className="ld-detail-diff">{course.difficulty}</span>
            {pct > 0 && <span style={{ color: 'var(--gold)' }}>{pct}% complete</span>}
          </div>

          <div className="ld-detail-ctas">
            {!liveSession ? (
              <button className="ld-btn-gold" onClick={() => resumeLesson && onOpenLesson(resumeLesson.id)}>
                <Play size={15} fill="currentColor" />
                {pct > 0 && pct < 100 ? 'Continue Learning' : pct === 100 ? 'Review Course' : 'Start Masterclass'}
              </button>
            ) : liveSession.liveState === 'live' ? (
              <button className="ld-btn-live" onClick={() => onWatchLive(liveSession)}>
                <Radio size={15} /> Join Live Class
              </button>
            ) : liveSession.liveState === 'upcoming' ? (
              <button className="ld-btn-gold" disabled>Coming Soon</button>
            ) : (
              <button className="ld-btn-gold" disabled>Class Ended</button>
            )}
            {pct === 100 && (
              <button className="ld-btn-outline" onClick={onCertificate}>
                <Award size={15} /> View Certificate
              </button>
            )}
          </div>

          {meetError && (
            <p style={{ margin: '8px 0 0', fontSize: '0.84rem', color: '#ef4444' }}>{meetError}</p>
          )}

          {pct > 0 && (
            <div className="ld-detail-progress">
              <div className="ld-detail-progress-bar">
                <div className="ld-detail-progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <span>{pct}%</span>
            </div>
          )}
        </div>

        <div className="ld-detail-hero-visual">
          <div className="ld-detail-hero-thumb">
            <Video size={56} style={{ color: 'var(--gold)', opacity: 0.6 }} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="ld-detail-tabs">
        {(['overview', 'curriculum', 'reviews', 'announcements'] as const).map((t) => (
          <button
            key={t}
            className={`ld-detail-tab ${activeTab === t ? 'ld-detail-tab--active' : ''}`}
            onClick={() => setActiveTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'announcements' && (course.announcements?.length ?? 0) > 0 && (
              <span className="ld-detail-tab-badge">{course.announcements!.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="ld-detail-body">
        {/* LEFT column */}
        <div className="ld-detail-main">
          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="ld-detail-overview">
              {/* Takeaways */}
              <section className="ld-overview-section">
                <h3><BookOpen size={16} /> What You'll Learn</h3>
                <ul className="ld-takeaway-list">
                  {course.takeaways.map((t, i) => (
                    <li key={i}><CheckCircle2 size={14} style={{ color: 'var(--gold)', flexShrink: 0 }} />{t}</li>
                  ))}
                </ul>
              </section>

              {/* Assignment */}
              <section className="ld-overview-section">
                <h3><Gavel size={16} /> Practice Assignment</h3>
                <p className="ld-overview-text">{course.assignment}</p>
              </section>

              {/* Templates */}
              {course.templates.length > 0 && (
                <section className="ld-overview-section">
                  <h3><Download size={16} /> Downloadable Resources</h3>
                  <div className="ld-template-list">
                    {course.templates.map((t, i) => (
                      <a key={i} href={t.url === '#' ? undefined : t.url} className="ld-template-item" download>
                        <FileText size={15} />
                        <span>{t.name}</span>
                        <Download size={13} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {/* Instructor */}
              <section className="ld-overview-section">
                <h3><Gavel size={16} /> Your Instructor</h3>
                <div className="ld-instructor-card">
                  <div className="ld-instructor-avatar">
                    {INSTRUCTOR.avatar
                      ? <img src={INSTRUCTOR.avatar} alt={INSTRUCTOR.name} />
                      : <Gavel size={28} style={{ color: 'var(--gold)' }} />}
                  </div>
                  <div>
                    <strong className="ld-instructor-name">{INSTRUCTOR.name}</strong>
                    <span className="ld-instructor-role">{INSTRUCTOR.role}</span>
                    <p className="ld-instructor-bio">{INSTRUCTOR.bio}</p>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* CURRICULUM */}
          {activeTab === 'curriculum' && (
            <div className="ld-curriculum">
              <div className="ld-curriculum-search">
                <Search size={14} />
                <input
                  placeholder="Search lessons…"
                  value={lessonSearch}
                  onChange={(e) => setLessonSearch(e.target.value)}
                  className="ld-curriculum-search-input"
                />
              </div>

              {loading
                ? Array.from({ length: 4 }).map((_, i) => <LessonRowSkeleton key={i} />)
                : filteredLessons.map((lesson, idx) => {
                    const watched = getLessonWatched(lesson.id)
                    return (
                      <button
                        key={lesson.id}
                        className={`ld-lesson-row ${watched ? 'ld-lesson-row--watched' : ''}`}
                        onClick={() => onOpenLesson(lesson.id)}
                      >
                        <div className="ld-lesson-num">
                          {watched ? <CheckCircle2 size={16} style={{ color: 'var(--gold)' }} /> : <span>{idx + 1}</span>}
                        </div>
                        <div className="ld-lesson-info">
                          <span className="ld-lesson-title">{lesson.title}</span>
                          {lesson.description && <span className="ld-lesson-desc">{lesson.description}</span>}
                        </div>
                        <span className="ld-lesson-dur"><Clock size={11} /> {lesson.duration}</span>
                        <Play size={14} className="ld-lesson-play-icon" />
                      </button>
                    )
                  })}

              {filteredLessons.length === 0 && lessonSearch && (
                <p style={{ color: 'var(--text-soft)', textAlign: 'center', padding: '20px 0' }}>No lessons match your search.</p>
              )}
            </div>
          )}

          {/* REVIEWS */}
          {activeTab === 'reviews' && (
            <div className="ld-reviews">
              <h3 style={{ margin: '0 0 16px 0' }}><MessageSquare size={16} /> Your Review</h3>

              {reviewSaved ? (
                <div className="ld-review-saved">
                  <CheckCircle2 size={18} style={{ color: 'var(--gold)' }} />
                  <strong>Review saved!</strong>
                  <div className="ld-stars">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} size={18} fill={s <= reviewRating ? 'var(--gold)' : 'none'} style={{ color: 'var(--gold)' }} />
                    ))}
                  </div>
                  <p style={{ color: 'var(--text-soft)', margin: 0 }}>{reviewComment}</p>
                  <button className="ld-btn-outline" style={{ marginTop: 8 }} onClick={() => setReviewSaved(false)}>Edit</button>
                </div>
              ) : (
                <div className="ld-review-form">
                  <div className="ld-stars">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button key={s} className="ld-star-btn" onClick={() => setReviewRating(s)}>
                        <Star size={28} fill={s <= reviewRating ? 'var(--gold)' : 'none'} style={{ color: 'var(--gold)' }} />
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="ld-review-textarea"
                    rows={4}
                    placeholder="Share your experience with this masterclass…"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                  />
                  <button
                    className="ld-btn-gold"
                    disabled={reviewRating === 0}
                    onClick={handleSaveReview}
                  >
                    Save Review
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ANNOUNCEMENTS */}
          {activeTab === 'announcements' && (
            <div className="ld-announcements">
              {(course.announcements ?? []).length === 0 ? (
                <div className="ld-empty-state">
                  <MessageSquare size={32} style={{ opacity: 0.3 }} />
                  <p>No announcements yet.</p>
                </div>
              ) : (
                course.announcements!.map((a) => (
                  <div key={a.id} className="ld-announcement-card">
                    <h4>{a.title}</h4>
                    <p>{a.body}</p>
                    <span className="ld-announcement-date">{new Date(a.date).toLocaleDateString()}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* RIGHT sidebar — curriculum quick nav always visible */}
        <aside className="ld-detail-sidebar">
          <div className="ld-sidebar-header" onClick={() => setCurriculumOpen((v) => !v)}>
            <span>Course Content</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: 'var(--text-soft)' }}>
              {course.lessons.filter((l) => getLessonWatched(l.id)).length}/{course.lessons.length}
              {curriculumOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          </div>

          {curriculumOpen && (
            <div className="ld-sidebar-lessons">
              {course.lessons.map((lesson, idx) => {
                const watched = getLessonWatched(lesson.id)
                return (
                  <button
                    key={lesson.id}
                    className={`ld-sidebar-lesson ${watched ? 'ld-sidebar-lesson--done' : ''}`}
                    onClick={() => onOpenLesson(lesson.id)}
                  >
                    <span className="ld-sidebar-lesson-num">
                      {watched ? <CheckCircle2 size={13} style={{ color: 'var(--gold)' }} /> : idx + 1}
                    </span>
                    <span className="ld-sidebar-lesson-title">{lesson.title}</span>
                    <span className="ld-sidebar-lesson-dur">{lesson.duration}</span>
                  </button>
                )
              })}
            </div>
          )}

          {pct === 100 && (
            <div className="ld-sidebar-cert">
              <Award size={20} style={{ color: 'var(--gold)' }} />
              <span>Certificate Unlocked!</span>
              <button className="ld-btn-gold" style={{ marginTop: 8, width: '100%' }} onClick={onCertificate}>
                View Certificate
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
