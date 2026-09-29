import { useEffect, useState, useCallback } from 'react'
import { API_BASE_URL } from '../lib/api'
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit,
  Lock,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Trash2,
  Users,
  Video,
  XCircle,
} from 'lucide-react'

// eslint-disable-next-line @typescript-eslint/no-empty-interface

type MgmtTab = 'courses' | 'live' | 'access'

interface Course {
  id: string
  title: string
  description: string
  status: 'draft' | 'published'
  difficulty: string
  category: string
  instructor: string
  duration: string
  isFree: boolean
  takeaways: string[]
  assignment: string
  createdAt: string
}

interface Lesson {
  id: string
  courseId: string
  title: string
  description: string
  videoUrl: string
  duration: string
  sortOrder: number
  isPreview: boolean
}

interface LiveSession {
  id: string
  title: string
  description?: string
  instructor?: string
  status: string
  liveState: 'upcoming' | 'live' | 'ended' | 'cancelled'
  scheduledAt: string
  endAt?: string
  meetLink?: string
  courseId?: string
}

const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced']
const CATEGORIES = [
  'Contract Drafting', 'Legal Notices', 'Affidavits', 'Plaints',
  'Written Statements', 'Petitions', 'Bail Applications', 'Consumer Complaints',
  'Corporate Drafting', 'Memorial Drafting',
]

const BLANK_COURSE = {
  title: '', description: '', difficulty: 'Intermediate', category: 'Contract Drafting',
  instructor: 'The Founder', duration: '2 Hours', isFree: true,
  takeawaysText: '', assignment: '',
}

const BLANK_LESSON = {
  title: '', description: '', videoUrl: '', duration: '20 min', isPreview: false,
}

export default function MasterclassManagement() {
  const [tab, setTab] = useState<MgmtTab>('courses')

  // ── Courses state ─────────────────────────────────────────────────────────
  const [courses, setCourses] = useState<Course[]>([])
  const [loadingCourses, setLoadingCourses] = useState(false)
  const [editCourse, setEditCourse] = useState<Course | null>(null)
  const [courseForm, setCourseForm] = useState(BLANK_COURSE)
  const [showCourseForm, setShowCourseForm] = useState(false)
  const [courseMsg, setCourseMsg] = useState('')
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null)

  // ── Lessons state ─────────────────────────────────────────────────────────
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({})
  const [editLesson, setEditLesson] = useState<Lesson | null>(null)
  const [lessonForm, setLessonForm] = useState(BLANK_LESSON)
  const [showLessonForm, setShowLessonForm] = useState<string | null>(null) // courseId
  const [lessonMsg, setLessonMsg] = useState('')

  // ── Live sessions state ───────────────────────────────────────────────────
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([])
  const BLANK_LIVE_FORM = { title: '', description: '', instructor: '', scheduledAt: '', endAt: '', meetLink: '', courseId: '' }
  const [liveForm, setLiveForm] = useState(BLANK_LIVE_FORM)
  const [editSession, setEditSession] = useState<LiveSession | null>(null)
  const [liveMsg, setLiveMsg] = useState('')
  const [liveLoading, setLiveLoading] = useState(false)

  // ── Access management state ───────────────────────────────────────────────
  const [accessEmail, setAccessEmail] = useState('')
  const [accessMsg, setAccessMsg] = useState('')
  const [accessLoading, setAccessLoading] = useState(false)
  const [revokeEmail, setRevokeEmail] = useState('')
  const [revokeMsg, setRevokeMsg] = useState('')
  const [revokeLoading, setRevokeLoading] = useState(false)
  const [createdLive, setCreatedLive] = useState<any>(null)

  const authHeaders = useCallback(async () => {
    return { 'Content-Type': 'application/json' }
  }, [])

  // ── Fetch helpers ─────────────────────────────────────────────────────────

  const fetchCourses = useCallback(async () => {
    setLoadingCourses(true)
    try {
      const r = await fetch(`${API_BASE_URL}/masterclass/admin/courses`, { headers: await authHeaders() })
      if (r.ok) setCourses(await r.json())
    } finally {
      setLoadingCourses(false)
    }
  }, [authHeaders])

  const fetchLessons = useCallback(async (courseId: string) => {
    const r = await fetch(`${API_BASE_URL}/masterclass/admin/courses/${courseId}/lessons`, { headers: await authHeaders() })
    if (r.ok) {
      const data = await r.json()
      setLessons((prev) => ({ ...prev, [courseId]: data }))
    }
  }, [authHeaders])

  const fetchLiveSessions = useCallback(async () => {
    const r = await fetch(`${API_BASE_URL}/live-sessions/admin`, { headers: await authHeaders() })
    if (r.ok) setLiveSessions(await r.json())
  }, [authHeaders])

  useEffect(() => {
    fetchCourses()
    fetchLiveSessions()
  }, [])

  useEffect(() => {
    if (expandedCourseId) fetchLessons(expandedCourseId)
  }, [expandedCourseId])

  // ── Course actions ────────────────────────────────────────────────────────

  const openNewCourseForm = () => {
    setEditCourse(null)
    setCourseForm(BLANK_COURSE)
    setShowCourseForm(true)
    setCourseMsg('')
  }

  const openEditCourseForm = (c: Course) => {
    setEditCourse(c)
    setCourseForm({
      title: c.title,
      description: c.description ?? '',
      difficulty: c.difficulty ?? 'Intermediate',
      category: c.category ?? 'Contract Drafting',
      instructor: c.instructor ?? 'The Founder',
      duration: c.duration ?? '2 Hours',
      isFree: c.isFree,
      takeawaysText: (c.takeaways ?? []).join('\n'),
      assignment: c.assignment ?? '',
    })
    setShowCourseForm(true)
    setCourseMsg('')
  }

  const saveCourse = async () => {
    if (!courseForm.title.trim()) { setCourseMsg('Title is required.'); return }
    setCourseMsg('')
    const payload = {
      title: courseForm.title,
      description: courseForm.description,
      difficulty: courseForm.difficulty,
      category: courseForm.category,
      instructor: courseForm.instructor,
      duration: courseForm.duration,
      isFree: courseForm.isFree,
      takeaways: courseForm.takeawaysText.split('\n').map((s) => s.trim()).filter(Boolean),
      assignment: courseForm.assignment,
    }
    try {
      const url = editCourse
        ? `${API_BASE_URL}/masterclass/admin/courses/${editCourse.id}`
        : `${API_BASE_URL}/masterclass/admin/courses`
      const r = await fetch(url, { method: editCourse ? 'PUT' : 'POST', headers: await authHeaders(), body: JSON.stringify(payload) })
      if (!r.ok) throw new Error(await r.text())
      setCourseMsg(editCourse ? 'Course updated!' : 'Course created!')
      setShowCourseForm(false)
      fetchCourses()
    } catch (e: any) {
      setCourseMsg(e.message ?? 'Save failed.')
    }
  }

  const deleteCourse = async (id: string) => {
    if (!confirm('Delete this course and all its lessons?')) return
    const r = await fetch(`${API_BASE_URL}/masterclass/admin/courses/${id}`, { method: 'DELETE', headers: await authHeaders() })
    if (r.ok) { setCourseMsg('Course deleted.'); fetchCourses() }
  }

  const togglePublish = async (c: Course) => {
    const endpoint = c.status === 'published' ? 'unpublish' : 'publish'
    const r = await fetch(`${API_BASE_URL}/masterclass/admin/courses/${c.id}/${endpoint}`, { method: 'POST', headers: await authHeaders() })
    if (r.ok) fetchCourses()
  }

  // ── Lesson actions ────────────────────────────────────────────────────────

  const openNewLessonForm = (courseId: string) => {
    setEditLesson(null)
    setLessonForm(BLANK_LESSON)
    setShowLessonForm(courseId)
    setLessonMsg('')
  }

  const openEditLessonForm = (l: Lesson) => {
    setEditLesson(l)
    setLessonForm({ title: l.title, description: l.description ?? '', videoUrl: l.videoUrl ?? '', duration: l.duration ?? '20 min', isPreview: l.isPreview })
    setShowLessonForm(l.courseId)
    setLessonMsg('')
  }

  const saveLesson = async () => {
    if (!lessonForm.title.trim() || !showLessonForm) { setLessonMsg('Title is required.'); return }
    setLessonMsg('')
    const payload = { ...lessonForm }
    try {
      const url = editLesson
        ? `${API_BASE_URL}/masterclass/admin/lessons/${editLesson.id}`
        : `${API_BASE_URL}/masterclass/admin/courses/${showLessonForm}/lessons`
      const r = await fetch(url, { method: editLesson ? 'PUT' : 'POST', headers: await authHeaders(), body: JSON.stringify(payload) })
      if (!r.ok) throw new Error(await r.text())
      setLessonMsg(editLesson ? 'Lesson updated!' : 'Lesson added!')
      setShowLessonForm(null)
      setEditLesson(null)
      fetchLessons(editLesson?.courseId ?? showLessonForm)
    } catch (e: any) {
      setLessonMsg(e.message ?? 'Save failed.')
    }
  }

  const deleteLesson = async (l: Lesson) => {
    if (!confirm('Delete this lesson?')) return
    const r = await fetch(`${API_BASE_URL}/masterclass/admin/lessons/${l.id}`, { method: 'DELETE', headers: await authHeaders() })
    if (r.ok) fetchLessons(l.courseId)
  }

  // ── Live class actions ────────────────────────────────────────────────────

  const MEET_LINK_PATTERN = /^https:\/\/meet\.google\.com\/[a-z0-9-]+$/i

  const openEditSessionForm = (s: LiveSession) => {
    setEditSession(s)
    setLiveForm({
      title: s.title,
      description: s.description ?? '',
      instructor: s.instructor ?? '',
      scheduledAt: s.scheduledAt ? s.scheduledAt.slice(0, 16) : '',
      endAt: s.endAt ? s.endAt.slice(0, 16) : '',
      meetLink: s.meetLink ?? '',
      courseId: s.courseId ?? '',
    })
    setLiveMsg('')
    setCreatedLive(null)
  }

  const cancelSessionForm = () => {
    setEditSession(null)
    setLiveForm(BLANK_LIVE_FORM)
    setLiveMsg('')
  }

  const saveLiveSession = async () => {
    if (!liveForm.title || !liveForm.scheduledAt || !liveForm.endAt) {
      setLiveMsg('Title, start time and end time are required.'); return
    }
    if (!liveForm.meetLink || !MEET_LINK_PATTERN.test(liveForm.meetLink.trim())) {
      setLiveMsg('A valid Google Meet link is required (e.g. https://meet.google.com/abc-defg-hij).'); return
    }
    setLiveLoading(true)
    setLiveMsg('')
    setCreatedLive(null)
    try {
      const payload = {
        title: liveForm.title,
        description: liveForm.description || undefined,
        instructor: liveForm.instructor || undefined,
        scheduledAt: new Date(liveForm.scheduledAt).toISOString(),
        endAt: new Date(liveForm.endAt).toISOString(),
        meetLink: liveForm.meetLink.trim(),
        courseId: liveForm.courseId || undefined,
      }
      const url = editSession
        ? `${API_BASE_URL}/live-sessions/admin/${editSession.id}`
        : `${API_BASE_URL}/live-sessions/admin/schedule`
      const r = await fetch(url, { method: editSession ? 'PUT' : 'POST', headers: await authHeaders(), body: JSON.stringify(payload) })
      if (!r.ok) throw new Error(await r.text())
      const data = await r.json()
      setCreatedLive(data)
      setLiveMsg(editSession ? 'Masterclass updated!' : 'Masterclass scheduled!')
      setEditSession(null)
      setLiveForm(BLANK_LIVE_FORM)
      fetchLiveSessions()
    } catch (e: any) {
      setLiveMsg(e.message ?? 'Failed.')
    } finally {
      setLiveLoading(false)
    }
  }

  const deleteLiveSession = async (s: LiveSession) => {
    if (!confirm(`Delete "${s.title}"?`)) return
    const r = await fetch(`${API_BASE_URL}/live-sessions/admin/${s.id}`, { method: 'DELETE', headers: await authHeaders() })
    if (r.ok) fetchLiveSessions()
  }

  // ── Grant / Revoke access ─────────────────────────────────────────────────
  const grantAccess = async () => {
    if (!accessEmail.trim()) return
    setAccessLoading(true)
    setAccessMsg('')
    try {
      const res = await fetch(`${API_BASE_URL}/masterclass/admin/grant-plan`, {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: accessEmail.trim(), plan: 'drafting' }),
      })
      const data = await res.json()
      if (data.error) setAccessMsg(`Error: ${data.error}`)
      else { setAccessMsg(`Access granted to ${accessEmail.trim()}`); setAccessEmail('') }
    } catch { setAccessMsg('Network error.') }
    finally { setAccessLoading(false) }
  }

  const revokeAccess = async () => {
    if (!revokeEmail.trim()) return
    setRevokeLoading(true)
    setRevokeMsg('')
    try {
      const res = await fetch(`${API_BASE_URL}/masterclass/admin/revoke-plan`, {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: revokeEmail.trim() }),
      })
      const data = await res.json()
      if (data.error) setRevokeMsg(`Error: ${data.error}`)
      else { setRevokeMsg(`Access revoked for ${revokeEmail.trim()}`); setRevokeEmail('') }
    } catch { setRevokeMsg('Network error.') }
    finally { setRevokeLoading(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Sub-nav */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--line)', paddingBottom: '12px' }}>
        {(['courses', 'live', 'access'] as MgmtTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '7px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '700',
              fontSize: '0.84rem',
              background: tab === t ? 'var(--gold-soft)' : 'transparent',
              color: tab === t ? 'var(--gold)' : 'var(--text-soft)',
            }}
          >
            {t === 'courses' && <><BookOpen size={14} style={{ marginRight: 5 }} />Courses & Lessons</>}
            {t === 'live' && <><Radio size={14} style={{ marginRight: 5 }} />Live Classes</>}
            {t === 'access' && <><Lock size={14} style={{ marginRight: 5 }} />Grant Access</>}
          </button>
        ))}
      </div>

      {/* ── COURSES TAB ─────────────────────────────────────────────── */}
      {tab === 'courses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '800' }}>Course Library</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={fetchCourses}
                style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--line)', background: 'transparent', color: 'var(--text-soft)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}
              >
                <RefreshCw size={13} /> Refresh
              </button>
              <button
                onClick={openNewCourseForm}
                style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', background: 'var(--gold)', color: '#000', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem' }}
              >
                <Plus size={14} /> New Course
              </button>
            </div>
          </div>

          {courseMsg && (
            <p style={{ margin: 0, color: courseMsg.includes('!') ? 'var(--ok)' : '#f87171', fontSize: '0.88rem' }}>{courseMsg}</p>
          )}

          {/* Course Form */}
          {showCourseForm && (
            <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', display: 'grid', gap: '12px' }}>
              <h4 style={{ margin: 0 }}>{editCourse ? `Edit: ${editCourse.title}` : 'Create New Course'}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-soft)', display: 'block', marginBottom: 4 }}>Title *</label>
                  <input
                    value={courseForm.title}
                    onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                    placeholder="Masterclass: Contract Drafting"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-soft)', display: 'block', marginBottom: 4 }}>Instructor</label>
                  <input
                    value={courseForm.instructor}
                    onChange={(e) => setCourseForm({ ...courseForm, instructor: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-soft)', display: 'block', marginBottom: 4 }}>Category</label>
                  <select
                    value={courseForm.category}
                    onChange={(e) => setCourseForm({ ...courseForm, category: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  >
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-soft)', display: 'block', marginBottom: 4 }}>Difficulty</label>
                  <select
                    value={courseForm.difficulty}
                    onChange={(e) => setCourseForm({ ...courseForm, difficulty: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  >
                    {DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-soft)', display: 'block', marginBottom: 4 }}>Duration</label>
                  <input
                    value={courseForm.duration}
                    onChange={(e) => setCourseForm({ ...courseForm, duration: e.target.value })}
                    placeholder="2.5 Hours"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 20 }}>
                  <input type="checkbox" id="isFree" checked={courseForm.isFree} onChange={(e) => setCourseForm({ ...courseForm, isFree: e.target.checked })} />
                  <label htmlFor="isFree" style={{ fontSize: '0.88rem' }}>Free Course</label>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-soft)', display: 'block', marginBottom: 4 }}>Description</label>
                <textarea
                  value={courseForm.description}
                  onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                  rows={3}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.88rem', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-soft)', display: 'block', marginBottom: 4 }}>Key Takeaways (one per line)</label>
                <textarea
                  value={courseForm.takeawaysText}
                  onChange={(e) => setCourseForm({ ...courseForm, takeawaysText: e.target.value })}
                  rows={3}
                  placeholder="Draft in active voice&#10;Check stamp duty acts&#10;Verify definitions block"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.88rem', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-soft)', display: 'block', marginBottom: 4 }}>Assignment</label>
                <textarea
                  value={courseForm.assignment}
                  onChange={(e) => setCourseForm({ ...courseForm, assignment: e.target.value })}
                  rows={2}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.88rem', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={saveCourse} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: 'var(--gold)', color: '#000', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Save size={14} /> Save Course
                </button>
                <button onClick={() => setShowCourseForm(false)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--line)', background: 'transparent', color: 'var(--text-soft)', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Course List */}
          {loadingCourses ? (
            <p style={{ color: 'var(--text-soft)', fontSize: '0.88rem' }}>Loading courses…</p>
          ) : courses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-soft)', border: '1px dashed var(--line)', borderRadius: '12px' }}>
              <BookOpen size={32} style={{ marginBottom: 10, opacity: 0.4 }} />
              <p style={{ margin: 0 }}>No courses yet. Create your first masterclass.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {courses.map((c) => (
                <div key={c.id} style={{ border: '1px solid var(--line)', borderRadius: '10px', overflow: 'hidden', background: 'var(--bg-elev)' }}>
                  {/* Course row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px' }}>
                    <button
                      onClick={() => setExpandedCourseId(expandedCourseId === c.id ? null : c.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-soft)', padding: 0 }}
                    >
                      {expandedCourseId === c.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '700', fontSize: '0.92rem', marginBottom: 2 }}>{c.title}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-soft)' }}>{c.category} · {c.difficulty} · {c.duration}</div>
                    </div>
                    <span style={{
                      padding: '2px 8px', borderRadius: '5px', fontSize: '0.74rem', fontWeight: '700',
                      background: c.status === 'published' ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.12)',
                      color: c.status === 'published' ? 'var(--ok)' : 'var(--gold)',
                    }}>
                      {c.status === 'published' ? 'Published' : 'Draft'}
                    </span>
                    <button onClick={() => togglePublish(c)} title={c.status === 'published' ? 'Unpublish' : 'Publish'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.status === 'published' ? '#f87171' : 'var(--ok)', padding: '4px' }}>
                      {c.status === 'published' ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                    </button>
                    <button onClick={() => openEditCourseForm(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold)', padding: '4px' }}>
                      <Edit size={15} />
                    </button>
                    <button onClick={() => deleteCourse(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: '4px' }}>
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* Expanded: Lessons */}
                  {expandedCourseId === c.id && (
                    <div style={{ borderTop: '1px solid var(--line)', padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-soft)' }}>LESSONS</span>
                        <button
                          onClick={() => openNewLessonForm(c.id)}
                          style={{ padding: '5px 12px', borderRadius: '7px', border: 'none', background: 'var(--gold)', color: '#000', fontWeight: '700', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5 }}
                        >
                          <Plus size={12} /> Add Lesson
                        </button>
                      </div>

                      {/* Lesson form */}
                      {showLessonForm === c.id && (
                        <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '8px', padding: '14px', display: 'grid', gap: '10px' }}>
                          <h5 style={{ margin: 0 }}>{editLesson ? 'Edit Lesson' : 'Add Lesson'}</h5>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                              <label style={{ fontSize: '0.78rem', color: 'var(--text-soft)', display: 'block', marginBottom: 3 }}>Title *</label>
                              <input
                                value={lessonForm.title}
                                onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                                placeholder="Lesson title"
                                style={{ width: '100%', padding: '7px 9px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--bg-elev)', color: 'var(--text)', fontSize: '0.85rem', boxSizing: 'border-box' }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.78rem', color: 'var(--text-soft)', display: 'block', marginBottom: 3 }}>Duration</label>
                              <input
                                value={lessonForm.duration}
                                onChange={(e) => setLessonForm({ ...lessonForm, duration: e.target.value })}
                                placeholder="20 min"
                                style={{ width: '100%', padding: '7px 9px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--bg-elev)', color: 'var(--text)', fontSize: '0.85rem', boxSizing: 'border-box' }}
                              />
                            </div>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.78rem', color: 'var(--text-soft)', display: 'block', marginBottom: 3 }}>Video URL</label>
                            <input
                              value={lessonForm.videoUrl}
                              onChange={(e) => setLessonForm({ ...lessonForm, videoUrl: e.target.value })}
                              placeholder="https://..."
                              style={{ width: '100%', padding: '7px 9px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--bg-elev)', color: 'var(--text)', fontSize: '0.85rem', boxSizing: 'border-box' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.78rem', color: 'var(--text-soft)', display: 'block', marginBottom: 3 }}>Description</label>
                            <textarea
                              value={lessonForm.description}
                              onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
                              rows={2}
                              style={{ width: '100%', padding: '7px 9px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--bg-elev)', color: 'var(--text)', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box' }}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input type="checkbox" id={`preview-${c.id}`} checked={lessonForm.isPreview} onChange={(e) => setLessonForm({ ...lessonForm, isPreview: e.target.checked })} />
                            <label htmlFor={`preview-${c.id}`} style={{ fontSize: '0.84rem' }}>Preview lesson (visible without enrollment)</label>
                          </div>
                          {lessonMsg && <p style={{ margin: 0, color: lessonMsg.includes('!') ? 'var(--ok)' : '#f87171', fontSize: '0.82rem' }}>{lessonMsg}</p>}
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={saveLesson} style={{ padding: '7px 14px', borderRadius: '7px', border: 'none', background: 'var(--gold)', color: '#000', fontWeight: '700', cursor: 'pointer', fontSize: '0.82rem' }}>
                              <Save size={13} style={{ marginRight: 4 }} />{editLesson ? 'Update' : 'Add'}
                            </button>
                            <button onClick={() => { setShowLessonForm(null); setEditLesson(null) }} style={{ padding: '7px 12px', borderRadius: '7px', border: '1px solid var(--line)', background: 'transparent', color: 'var(--text-soft)', cursor: 'pointer', fontSize: '0.82rem' }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Lesson list */}
                      {(lessons[c.id] ?? []).length === 0 ? (
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-soft)' }}>No lessons yet. Add the first lesson above.</p>
                      ) : (
                        (lessons[c.id] ?? []).map((l, idx) => (
                          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '7px', background: 'var(--bg)', border: '1px solid var(--line)' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-soft)', minWidth: 22 }}>{idx + 1}</span>
                            <Video size={14} style={{ color: l.videoUrl ? 'var(--ok)' : 'var(--text-soft)' }} />
                            <span style={{ flex: 1, fontSize: '0.88rem', fontWeight: '600' }}>{l.title}</span>
                            <span style={{ fontSize: '0.76rem', color: 'var(--text-soft)' }}>{l.duration}</span>
                            {l.isPreview && <span style={{ fontSize: '0.72rem', background: 'var(--gold-soft)', color: 'var(--gold)', padding: '1px 6px', borderRadius: '4px' }}>Preview</span>}
                            <button onClick={() => openEditLessonForm(l)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold)', padding: '3px' }}><Edit size={13} /></button>
                            <button onClick={() => deleteLesson(l)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: '3px' }}><Trash2 size={13} /></button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── LIVE CLASSES TAB ─────────────────────────────────────────── */}
      {tab === 'live' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '800' }}>{editSession ? `Edit: ${editSession.title}` : 'Schedule Masterclass'}</h3>

          <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', display: 'grid', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-soft)', display: 'block', marginBottom: 4 }}>Class Title *</label>
                <input
                  value={liveForm.title}
                  onChange={(e) => setLiveForm({ ...liveForm, title: e.target.value })}
                  placeholder="Live: Contract Drafting Masterclass"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-soft)', display: 'block', marginBottom: 4 }}>Instructor</label>
                <input
                  value={liveForm.instructor}
                  onChange={(e) => setLiveForm({ ...liveForm, instructor: e.target.value })}
                  placeholder="The Founder"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-soft)', display: 'block', marginBottom: 4 }}>Start Date & Time *</label>
                <input
                  type="datetime-local"
                  value={liveForm.scheduledAt}
                  onChange={(e) => setLiveForm({ ...liveForm, scheduledAt: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-soft)', display: 'block', marginBottom: 4 }}>End Date & Time *</label>
                <input
                  type="datetime-local"
                  value={liveForm.endAt}
                  onChange={(e) => setLiveForm({ ...liveForm, endAt: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-soft)', display: 'block', marginBottom: 4 }}>Description</label>
                <input
                  value={liveForm.description}
                  onChange={(e) => setLiveForm({ ...liveForm, description: e.target.value })}
                  placeholder="What will be covered…"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-soft)', display: 'block', marginBottom: 4 }}>Link to Course (optional)</label>
                <select
                  value={liveForm.courseId}
                  onChange={(e) => setLiveForm({ ...liveForm, courseId: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                >
                  <option value="">— No linked course —</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-soft)', display: 'block', marginBottom: 4 }}>Google Meet Link *</label>
                <input
                  value={liveForm.meetLink}
                  onChange={(e) => setLiveForm({ ...liveForm, meetLink: e.target.value })}
                  placeholder="https://meet.google.com/abc-defg-hij"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={saveLiveSession}
                disabled={liveLoading}
                style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: 'var(--gold)', color: '#000', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.88rem' }}
              >
                <Radio size={15} /> {liveLoading ? 'Saving…' : editSession ? 'Update Masterclass' : 'Schedule Masterclass'}
              </button>
              {editSession && (
                <button onClick={cancelSessionForm} style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--line)', background: 'transparent', color: 'var(--text-soft)', cursor: 'pointer', fontSize: '0.88rem' }}>
                  Cancel
                </button>
              )}
            </div>
            {liveMsg && (
              <p style={{ margin: 0, fontSize: '0.88rem', color: createdLive ? 'var(--ok)' : '#f87171' }}>{liveMsg}</p>
            )}
          </div>

          {/* Live Sessions List */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '800' }}>All Masterclasses</h3>
              <button onClick={fetchLiveSessions} style={{ padding: '5px 10px', borderRadius: '7px', border: '1px solid var(--line)', background: 'transparent', color: 'var(--text-soft)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem' }}>
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
            {liveSessions.length === 0 ? (
              <p style={{ color: 'var(--text-soft)', fontSize: '0.88rem' }}>No masterclasses scheduled yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {liveSessions.map((s) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--line)', background: 'var(--bg-elev)' }}>
                    <Radio size={15} style={{ color: s.liveState === 'live' ? 'var(--ok)' : 'var(--text-soft)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{s.title}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-soft)' }}>
                        {new Date(s.scheduledAt).toLocaleString()}
                        {s.endAt ? ` – ${new Date(s.endAt).toLocaleTimeString()}` : ''}
                        {s.instructor ? ` · ${s.instructor}` : ''}
                        {s.courseId ? ' · linked course' : ''}
                      </div>
                    </div>
                    <span style={{
                      padding: '2px 8px', borderRadius: '5px', fontSize: '0.74rem', fontWeight: '700',
                      background: s.liveState === 'live' ? 'rgba(34,197,94,0.12)' : s.liveState === 'ended' ? 'rgba(100,116,139,0.12)' : s.liveState === 'cancelled' ? 'rgba(239,68,68,0.12)' : 'rgba(234,179,8,0.12)',
                      color: s.liveState === 'live' ? 'var(--ok)' : s.liveState === 'ended' ? 'var(--text-soft)' : s.liveState === 'cancelled' ? '#f87171' : 'var(--gold)',
                    }}>
                      {s.liveState}
                    </span>
                    {s.liveState === 'live' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: 'var(--ok)' }}>
                        <Users size={13} /> Students can join
                      </div>
                    )}
                    <button onClick={() => openEditSessionForm(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold)', padding: '4px' }}>
                      <Edit size={15} />
                    </button>
                    <button onClick={() => deleteLiveSession(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: '4px' }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
