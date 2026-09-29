import { API_BASE_URL } from '../lib/api'
import React, { useMemo, useState, useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CheckCircle2,
  Briefcase,
  Sparkles,
  TrendingUp,
  Plus,
  Target,
  Workflow,
  Clock,
  Flame,
  AlertCircle,
  Bell,
  BarChart3,
  BookOpen,
  Gavel,
  FileText,
  Swords,
  Pencil,
  Trash2,
} from 'lucide-react'
import './AcademicNavigator.css'
import { supabase } from '../lib/supabase-client'
import { useAuth, useUser } from '@clerk/clerk-react'
import { eventBus, EVENTS } from '../lib/event-bus'
import { renderAvatar } from '../lib/avatars'

type CalendarCategory =
  | 'lecture'
  | 'exam'
  | 'assignment'
  | 'moot'
  | 'internship'
  | 'hackathon'
  | 'project_deadline'
  | 'personal_event'
  | 'research_paper'
  | 'study_session'
  | 'revision'

type LegacyEventType = 'class' | 'assignment' | 'moot' | 'internship' | 'exam' | 'study' | 'research' | 'revision'
type Priority = 'Low' | 'Medium' | 'High' | 'Critical'
type TaskType = 'study' | 'revision' | 'daily_target' | 'weekly_roadmap' | 'priority'
type InternshipStatus = 'Interested' | 'Applied' | 'Assessment' | 'Interview' | 'Selected' | 'Rejected'
type NavigatorViewMode = 'Week' | 'Month' | 'Agenda'
type BuilderMode = 'event' | 'exam' | 'moot' | 'research' | 'judgment'
const apiBaseUrl = ((import.meta as any).env?.VITE_API_URL || `${API_BASE_URL}`).replace(/\/$/, '')

interface CalendarEventRecord {
  id: string
  title: string
  description: string | null
  event_date: string
  end_date: string | null
  event_time: string
  subject: string
  event_type: LegacyEventType
  category: CalendarCategory | null
  priority: Priority | null
  reminder_settings: { enabled?: boolean; minutes_before?: number } | null
  google_event_id?: string | null
  is_synced: boolean
}

interface AcademicTask {
  id: string
  calendar_event_id: string | null
  title: string
  task_type: TaskType
  target_date: string
  priority: Priority
  status: 'pending' | 'completed'
  metadata?: Record<string, any>
  updated_at?: string
}

interface HabitLog {
  id: string
  log_date: string
  study_hours: number
  judgments_read: number
  research_sessions: number
  moot_preparation: number
  flashcard_revision: number
  assignment_completion: number
  calendar_event_id: string | null
}

interface InternshipApplication {
  id: string
  organization: string
  position: string
  deadline: string
  status: InternshipStatus
  notes: string
}

interface NotificationRecord {
  id: string
  title: string
  message: string
  type: string
  is_read: boolean
  trigger_time: string
}

interface AnalyticsSnapshot {
  id: string
  snapshot_date: string
  productivity_score: number
  consistency_score: number
  study_hours: number
  revision_completion: number
  goal_achievement: number
}

interface ExamTopicRecord {
  id: string
  exam_id: string
  title: string
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Needs Revision'
  mastery_score: number
  quiz_score: number
  flashcard_score: number
  difficulty: 'Easy' | 'Medium' | 'Hard'
}

interface ExamRecord {
  id: string
  subject: string
  exam_date: string
  exam_time?: string | null
  prep_level: 'Beginner' | 'Intermediate' | 'Expert'
  syllabus_completion: number
}

interface FlashcardRecord {
  id: string
  topic: string
  mastery_level: number
}

interface QuizResultRecord {
  id: string
  quiz_title: string
  score: number
  total_questions: number
  correct_answers: number
  created_at: string
}

interface UserActivityRecord {
  id: string
  module: string | null
  action: string | null
  module_name: string | null
  action_type: string | null
  created_at: string
}

interface AcademicEventDraft {
  title: string
  description: string
  startDate: string
  endDate: string
  time: string
  priority: Priority
  category: CalendarCategory
  reminderMinutes: number
}

interface GeneratedExamPlan {
  subject: string
  examDate: string
  topics: string[]
  taskCount: number
}

const todayString = new Date().toISOString().split('T')[0]
const categoryOptions: { value: CalendarCategory; label: string; eventType: LegacyEventType; subject: string }[] = [
  { value: 'lecture', label: 'Lectures', eventType: 'class', subject: 'Lectures' },
  { value: 'exam', label: 'Exams', eventType: 'exam', subject: 'Exam Command Center' },
  { value: 'assignment', label: 'Assignments', eventType: 'assignment', subject: 'Assignments' },
  { value: 'moot', label: 'Moot Competitions', eventType: 'moot', subject: 'Moot Court' },
  { value: 'internship', label: 'Internship Activity', eventType: 'internship', subject: 'Internships' },
  { value: 'hackathon', label: 'Hackathons', eventType: 'study', subject: 'Hackathons' },
  { value: 'project_deadline', label: 'Project Deadlines', eventType: 'assignment', subject: 'Projects' },
  { value: 'personal_event', label: 'Personal Events', eventType: 'study', subject: 'Personal' },
  { value: 'research_paper', label: 'Research Paper Deadlines', eventType: 'research', subject: 'Research' },
  { value: 'study_session', label: 'Personal Study Sessions', eventType: 'study', subject: 'Smart Study Forge' },
  { value: 'revision', label: 'Revision Blocks', eventType: 'revision', subject: 'Revision' },
]

const internshipStatusOptions: InternshipStatus[] = ['Interested', 'Applied', 'Assessment', 'Interview', 'Selected', 'Rejected']

const priorityWeight: Record<Priority, number> = { Low: 1, Medium: 2, High: 3, Critical: 4 }

function addDays(dateString: string, amount: number) {
  const date = new Date(`${dateString}T12:00:00`)
  date.setDate(date.getDate() + amount)
  return date.toISOString().split('T')[0]
}

function daysUntil(dateString?: string) {
  if (!dateString) return 0
  const start = new Date(`${todayString}T00:00:00`).getTime()
  const end = new Date(dateString.includes('T') ? dateString : `${dateString}T00:00:00`).getTime()
  if (isNaN(end)) return 0
  return Math.ceil((end - start) / 86400000)
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function getExamTopicProgress(topic: ExamTopicRecord) {
  const statusScore =
    topic.status === 'Completed' ? 40 :
    topic.status === 'In Progress' ? 20 :
    topic.status === 'Needs Revision' ? 10 : 0
  const assessmentScore = (
    Number(topic.mastery_score || 0) +
    Number(topic.quiz_score || 0) +
    Number(topic.flashcard_score || 0)
  ) / 3
  return clamp(Math.round(statusScore + assessmentScore * 0.6))
}

function getCategory(event: CalendarEventRecord): CalendarCategory {
  if (event.category) return event.category
  if (event.event_type === 'class') return 'lecture'
  if (event.event_type === 'research') return 'research_paper'
  if (event.event_type === 'study') return 'study_session'
  return event.event_type as CalendarCategory
}

function getCategoryClass(event: CalendarEventRecord) {
  const category = getCategory(event)
  if (category === 'exam') return 'event-criminal' // Red
  if (category === 'revision') return 'event-contract' // Gold
  if (category === 'research_paper') return 'event-research' // Blue
  if (category === 'moot') return 'event-juris' // Purple
  if (category === 'internship') return 'event-moot' // Green
  if (category === 'hackathon') return 'event-research'
  if (category === 'project_deadline') return 'event-intern'
  if (category === 'personal_event') return 'event-const'
  if (category === 'assignment') return 'event-intern' // Orange/Gold
  if (category === 'lecture') return 'event-const' // Light Blue
  return 'event-const'
}

function internshipCalendarEventTitle(status: InternshipStatus, organization: string, position: string) {
  const company = organization.trim()
  const role = position.trim()
  if (status === 'Applied') return `Applied to ${company}`
  if (status === 'Interview') return `Interview Scheduled - ${company}`
  if (status === 'Selected') return `Offer Received - ${company}`
  if (status === 'Assessment') return `Assessment - ${company}`
  if (status === 'Rejected') return `Application Closed - ${company}`
  return `Interested in ${company}${role ? ` - ${role}` : ''}`
}

async function getUserId(clerkUserId: string | null | undefined) {
  if (!clerkUserId) throw new Error('Authenticated Clerk user is required')
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle()
  if (!data?.id) throw new Error('Database user profile not initialized')
  return data.id
}

function buildLexMentorTasks(event: CalendarEventRecord, userId: string) {
  const category = getCategory(event)
  const days = Math.max(1, daysUntil(event.event_date))
  const priority = event.priority || (days <= 3 ? 'Critical' : days <= 7 ? 'High' : 'Medium')
  const base = {
    user_id: userId,
    calendar_event_id: event.id,
    priority,
    status: 'pending',
    metadata: {
      source: 'LexMentor AI',
      eventCategory: category,
      linkedModules: getLinkedModules(category),
    },
  }

  if (category === 'exam') {
    return [
      { ...base, title: `Study plan: master core syllabus for ${event.title}`, task_type: 'study', target_date: addDays(event.event_date, -Math.min(14, days)) },
      { ...base, title: `Weekly roadmap: complete topic blocks before ${event.event_date}`, task_type: 'weekly_roadmap', target_date: addDays(todayString, 7) },
      { ...base, title: `Revision schedule: consolidate notes and leading judgments`, task_type: 'revision', target_date: addDays(event.event_date, -5) },
      { ...base, title: `Mock test schedule: attempt timed paper for ${event.title}`, task_type: 'daily_target', target_date: addDays(event.event_date, -3) },
      { ...base, title: `Daily target: protect 90 focused minutes for ${event.subject}`, task_type: 'daily_target', target_date: todayString },
      { ...base, title: `Priority recommendation: protect revision time for ${event.title}`, task_type: 'priority', target_date: todayString },
    ]
  }

  if (category === 'moot') {
    return [
      { ...base, title: `Research task: build authorities matrix for ${event.title}`, task_type: 'study', target_date: addDays(event.event_date, -10) },
      { ...base, title: `Memorial drafting task: structure issues and prayer`, task_type: 'weekly_roadmap', target_date: addDays(event.event_date, -7) },
      { ...base, title: `AI Judge practice session for ${event.title}`, task_type: 'daily_target', target_date: addDays(event.event_date, -3) },
      { ...base, title: `Submission reminder: final memorial QA`, task_type: 'revision', target_date: addDays(event.event_date, -1) },
      { ...base, title: `Priority recommendation: connect research notes to Moot Court Suite`, task_type: 'priority', target_date: todayString },
    ]
  }

  if (category === 'assignment' || category === 'research_paper') {
    return [
      { ...base, title: `Research authorities for ${event.title}`, task_type: 'study', target_date: addDays(event.event_date, -4) },
      { ...base, title: `Research follow-up: update notes in Legal Research Command Center`, task_type: 'weekly_roadmap', target_date: addDays(event.event_date, -3) },
      { ...base, title: `Case revision session for ${event.title}`, task_type: 'revision', target_date: addDays(event.event_date, -2) },
      { ...base, title: `Revision pass: citations and final structure`, task_type: 'revision', target_date: addDays(event.event_date, -1) },
      { ...base, title: `Daily target: complete one writing block`, task_type: 'daily_target', target_date: todayString },
      { ...base, title: `Priority recommendation: move source collection into Smart Study Forge`, task_type: 'priority', target_date: todayString },
    ]
  }

  if (category === 'internship') {
    return [
      { ...base, title: `Prepare application/interview notes for ${event.title}`, task_type: 'study', target_date: addDays(event.event_date, -2) },
      { ...base, title: `Priority recommendation: finalize documents before ${event.event_date}`, task_type: 'priority', target_date: todayString },
    ]
  }

  return [
    { ...base, title: `Study block: ${event.title}`, task_type: 'study', target_date: event.event_date },
    { ...base, title: `Flashcard revision: ${event.title}`, task_type: 'revision', target_date: addDays(event.event_date, 1) },
    { ...base, title: `Quiz reminder: test recall for ${event.title}`, task_type: 'daily_target', target_date: addDays(event.event_date, 2) },
    { ...base, title: `Daily target: complete ${event.title}`, task_type: 'daily_target', target_date: event.event_date },
  ]
}

function getLinkedModules(category: CalendarCategory) {
  if (category === 'exam' || category === 'revision') return ['LexMentor AI', 'Exam Command Center', 'Smart Study Forge', 'Judgment Mastery Engine']
  if (category === 'moot') return ['LexMentor AI', 'Moot Court Suite', 'Judgment Mastery Engine', 'AI Bench Simulator']
  if (category === 'research_paper' || category === 'assignment') return ['LexMentor AI', 'Smart Study Forge', 'Legal Research Command Center', 'Judgment Mastery Engine']
  return ['LexMentor AI', 'Academic Navigator']
}

function complianceScore(logs: HabitLog[], from: string, to: string) {
  const scoped = logs.filter((log) => log.log_date >= from && log.log_date <= to)
  if (!scoped.length) return 0
  const raw = scoped.reduce((sum, log) => {
    const dayScore =
      Math.min(log.study_hours / 3, 1) * 25 +
      Math.min(log.judgments_read / 5, 1) * 18 +
      Math.min(log.research_sessions / 2, 1) * 15 +
      Math.min(log.moot_preparation / 1, 1) * 14 +
      Math.min(log.flashcard_revision / 1, 1) * 14 +
      Math.min(log.assignment_completion / 1, 1) * 14
    return sum + dayScore
  }, 0)
  return Math.round(raw / scoped.length)
}

interface AcademicNavigatorProps {
  variant?: 'full' | 'career' | 'exam'
}

export default function AcademicNavigator({ variant = 'full' }: AcademicNavigatorProps) {
  const { userId: clerkUserId, getToken } = useAuth()
  const { user } = useUser()
  const queryClient = useQueryClient()
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [googleConnected, setGoogleConnected] = useState<boolean>(false)
  const [checkingGoogleStatus, setCheckingGoogleStatus] = useState<boolean>(true)
  const [categoryFilter, setCategoryFilter] = useState<string>('All')
  const isCareerTracker = variant === 'career'
  const isExamCalendar = variant === 'exam'
  const isCalendarSurface = isCareerTracker || isExamCalendar

  const fetchGoogleStatus = async () => {
    try {
      const token = await getToken()
      if (!token) return
      const response = await fetch(`${apiBaseUrl}/exam/oauth/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setGoogleConnected(data.connected)
      }
    } catch (err) {
      console.error('Failed to fetch Google Calendar connection status:', err)
    } finally {
      setCheckingGoogleStatus(false)
    }
  }

  React.useEffect(() => {
    fetchGoogleStatus()
  }, [])

  const handleConnectCalendar = async () => {
    try {
      const token = await getToken()
      if (!token) return
      const response = await fetch(`${apiBaseUrl}/exam/oauth/url`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        if (data.url) {
          window.location.href = data.url
        }
      }
    } catch (err) {
      console.error('Failed to get Google Calendar auth URL:', err)
    }
  }

  const handleDisconnectCalendar = async () => {
    if (!window.confirm('Are you sure you want to disconnect Google Calendar?')) return
    try {
      const token = await getToken()
      if (!token) return
      const response = await fetch(`${apiBaseUrl}/exam/oauth/disconnect`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        setGoogleConnected(false)
      }
    } catch (err) {
      console.error('Failed to disconnect Google Calendar:', err)
    }
  }

  // CRUD event states
  const [selectedEventForPopup, setSelectedEventForPopup] = useState<CalendarEventRecord | null>(null)
  const [isEditingPopupEvent, setIsEditingPopupEvent] = useState<boolean>(false)
  const [popupEventTitle, setPopupEventTitle] = useState<string>('')
  const [popupEventTime, setPopupEventTime] = useState<string>('')
  const [popupEventDescription, setPopupEventDescription] = useState<string>('')
  const [popupEventPriority, setPopupEventPriority] = useState<Priority>('Medium')
  const [popupEventCategory, setPopupEventCategory] = useState<CalendarCategory>('study_session')

  const handleOpenEventPopup = (event: CalendarEventRecord, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedEventForPopup(event)
    setIsEditingPopupEvent(false)
    setPopupEventTitle(event.title)
    setPopupEventTime(event.event_time)
    setPopupEventDescription(event.description || '')
    setPopupEventPriority(event.priority || 'Medium')
    setPopupEventCategory(getCategory(event))
  }

  const handleDeleteEvent = async (eventId: string, googleEventId?: string | null) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return
    try {
      const identifier = googleEventId || eventId
      const token = await getToken()
      if (token) {
        await fetch(`${apiBaseUrl}/exam/calendar/events/${identifier}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        })
      }

      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', eventId)
        .eq('user_id', await getUserId(clerkUserId))

      if (error) throw error
      await createNotification(await getUserId(clerkUserId), 'Calendar Event Deleted', 'An Academic Navigator calendar event was deleted.', 'info')

      eventBus.dispatch(EVENTS.ACADEMIC_EVENT_DELETED, eventId)
      queryClient.invalidateQueries({ queryKey: ['calendar_events'] })
      queryClient.invalidateQueries({ queryKey: ['academic_ai_tasks'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      
      setSelectedEventForPopup(null)
    } catch (err) {
      console.error('Failed to delete event:', err)
      alert('Failed to delete event.')
    }
  }

  const handleSaveEventEdits = async () => {
    if (!selectedEventForPopup) return
    if (!popupEventTitle.trim()) {
      alert('Title is required')
      return
    }
    try {
      const identifier = selectedEventForPopup.google_event_id || selectedEventForPopup.id
      const token = await getToken()
      const option = categoryOptions.find((item) => item.value === popupEventCategory)!
      
      if (token) {
        await fetch(`${apiBaseUrl}/exam/calendar/events/${identifier}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: popupEventTitle.trim(),
            time: popupEventTime,
            description: popupEventDescription.trim(),
            priority: popupEventPriority,
            category: popupEventCategory,
            subject: option.subject,
            type: option.eventType
          })
        })
      }

      const { error } = await supabase
        .from('calendar_events')
        .update({
          title: popupEventTitle.trim(),
          event_time: popupEventTime,
          description: popupEventDescription.trim(),
          priority: popupEventPriority,
          category: popupEventCategory,
          subject: option.subject,
          event_type: option.eventType
        })
        .eq('id', selectedEventForPopup.id)
        .eq('user_id', await getUserId(clerkUserId))

      if (error) throw error
      await createNotification(await getUserId(clerkUserId), 'Calendar Event Updated', `${popupEventTitle.trim()} was updated.`, 'info')

      eventBus.dispatch(EVENTS.ACADEMIC_EVENT_UPDATED, selectedEventForPopup)
      queryClient.invalidateQueries({ queryKey: ['calendar_events'] })
      setSelectedEventForPopup(null)
    } catch (err) {
      console.error('Failed to update event details:', err)
      alert('Failed to update event.')
    }
  }

  const handleEventDateUpdate = async (eventId: string, newDate: string) => {
    const event = events.find(e => e.id === eventId)
    if (!event) return

    try {
      const identifier = event.google_event_id || event.id
      const token = await getToken()
      if (token) {
        await fetch(`${apiBaseUrl}/exam/calendar/events/${identifier}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            date: newDate
          })
        })
      }

      const { error } = await supabase
        .from('calendar_events')
        .update({ event_date: newDate })
        .eq('id', eventId)
        .eq('user_id', await getUserId(clerkUserId))

      if (error) throw error

      eventBus.dispatch(EVENTS.ACADEMIC_EVENT_UPDATED, event)
      queryClient.invalidateQueries({ queryKey: ['calendar_events'] })
    } catch (err) {
      console.error('Failed to drag and drop update event date:', err)
      alert('Failed to update event date.')
    }
  }

  const [selectedDate, setSelectedDate] = useState<string>(todayString)
  const [viewMode, setViewMode] = useState<NavigatorViewMode>('Month')
  const [builderMode, setBuilderMode] = useState<BuilderMode>('event')
  const [activeDeadlineTab, setActiveDeadlineTab] = useState<'exams' | 'assignments' | 'research' | 'moot' | 'internship' | 'today' | 'weekly'>('exams')
  const [showEventForm, setShowEventForm] = useState(false)
  const [showInternForm, setShowInternForm] = useState(false)
  const [trackerEntryType, setTrackerEntryType] = useState<'career' | 'event'>('career')
  const [aiMode, setAiMode] = useState<'plan' | 'roadmap' | 'revision' | 'priority'>('plan')
  const aiSuggestionRef = useRef<HTMLDivElement | null>(null)
  const [newEvent, setNewEvent] = useState<AcademicEventDraft>({
    title: '',
    description: '',
    startDate: todayString,
    endDate: todayString,
    time: '09:00',
    priority: 'Medium' as Priority,
    category: 'study_session' as CalendarCategory,
    reminderMinutes: 1440,
  })
  const [examDraft, setExamDraft] = useState({
    subject: '',
    examDate: todayString,
    topics: '',
    studyHours: 3,
  })
  const [generatedExamPlan, setGeneratedExamPlan] = useState<GeneratedExamPlan | null>(null)
  const [mootDraft, setMootDraft] = useState({
    problem: '',
    memorialDeadline: todayString,
    oralRoundDate: addDays(todayString, 7),
  })
  const [researchDraft, setResearchDraft] = useState({
    doctrine: '',
    followUpDate: addDays(todayString, 2),
  })
  const [judgmentDraft, setJudgmentDraft] = useState({
    caseName: '',
    sessionDate: todayString,
  })
  const [newIntern, setNewIntern] = useState({
    organization: '',
    position: '',
    deadline: todayString,
    status: 'Interested' as InternshipStatus,
    notes: '',
  })
  const [editingInternshipId, setEditingInternshipId] = useState<string | null>(null)
  const [editIntern, setEditIntern] = useState({
    organization: '',
    position: '',
    deadline: todayString,
    status: 'Interested' as InternshipStatus,
    notes: '',
  })

  const dbUserQuery = useQuery({
    queryKey: ['db_user_id', clerkUserId],
    queryFn: async () => {
      if (!clerkUserId) return null
      const { data } = await supabase
        .from('users')
        .select('id, avatar_url')
        .eq('clerk_user_id', clerkUserId)
        .maybeSingle()
      return data || null
    },
    enabled: !!clerkUserId,
  })
  const dbUserId = dbUserQuery.data?.id || null
  const dbUserAvatar = dbUserQuery.data?.avatar_url || 'law_student_male'

  const userQuery = useQuery({
    queryKey: ['academic_navigator_user', clerkUserId],
    queryFn: async () => {
      return user || null
    },
  })

  const calendarEventsQuery = useQuery({
    queryKey: ['calendar_events', 'academic_navigator', dbUserId],
    queryFn: async () => {
      if (!dbUserId) return []
      const { data, error } = await supabase
        .from('calendar_events')
        .select('id,title,description,event_date,end_date,event_time,subject,event_type,category,priority,reminder_settings,google_event_id,is_synced')
        .eq('user_id', dbUserId)
        .order('event_date', { ascending: true })
        .order('event_time', { ascending: true })
      if (error) throw error
      return (data || []) as CalendarEventRecord[]
    },
    enabled: !!dbUserId,
  })

  const tasksQuery = useQuery({
    queryKey: ['academic_ai_tasks', dbUserId],
    queryFn: async () => {
      if (!dbUserId) return []
      const { data, error } = await supabase
        .from('academic_ai_tasks')
        .select('*')
        .eq('user_id', dbUserId)
        .order('target_date', { ascending: true })
      if (error) throw error
      return (data || []) as AcademicTask[]
    },
    enabled: !!dbUserId,
  })

  const habitLogsQuery = useQuery({
    queryKey: ['academic_habit_logs', dbUserId],
    queryFn: async () => {
      if (!dbUserId) return []
      const { data, error } = await supabase
        .from('academic_habit_logs')
        .select('*')
        .eq('user_id', dbUserId)
        .order('log_date', { ascending: false })
      if (error) throw error
      return (data || []) as HabitLog[]
    },
    enabled: !!dbUserId,
  })

  const internshipsQuery = useQuery({
    queryKey: ['internship_applications', dbUserId],
    queryFn: async () => {
      if (!dbUserId) return []
      const { data, error } = await supabase
        .from('internship_applications')
        .select('*')
        .eq('user_id', dbUserId)
        .order('deadline', { ascending: true })
      if (error) throw error
      return (data || []) as InternshipApplication[]
    },
    enabled: !!dbUserId,
  })

  const notificationsQuery = useQuery({
    queryKey: ['notifications', 'academic_navigator', dbUserId],
    queryFn: async () => {
      if (!dbUserId) return []
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', dbUserId)
        .order('trigger_time', { ascending: false })
      if (error) throw error
      const now = new Date()
      return ((data || []) as NotificationRecord[]).filter((n) => {
        if (!n.trigger_time) return true
        return new Date(n.trigger_time) <= now
      })
    },
    enabled: !!dbUserId,
  })

  const analyticsQuery = useQuery({
    queryKey: ['academic_analytics_snapshots', dbUserId],
    queryFn: async () => {
      if (!dbUserId) return []
      const { data, error } = await supabase
        .from('academic_analytics_snapshots')
        .select('*')
        .eq('user_id', dbUserId)
        .order('snapshot_date', { ascending: false })
        .limit(12)
      if (error) throw error
      return (data || []) as AnalyticsSnapshot[]
    },
    enabled: !!dbUserId,
  })

  const examsQuery = useQuery({
    queryKey: ['academic_navigator_exams', dbUserId],
    queryFn: async () => {
      if (!dbUserId) return []
      const { data, error } = await supabase
        .from('exams')
        .select('id,subject,exam_date,exam_time,prep_level,syllabus_completion')
        .eq('user_id', dbUserId)
        .order('exam_date', { ascending: true })
      if (error) throw error
      return (data || []) as ExamRecord[]
    },
    enabled: !!dbUserId,
    refetchInterval: 60000,
  })

  const examTopicsQuery = useQuery({
    queryKey: ['exam_topics', dbUserId],
    queryFn: async () => {
      if (!dbUserId) return []
      const { data, error } = await supabase
        .from('exam_topics')
        .select('id,exam_id,title,status,mastery_score,quiz_score,flashcard_score,difficulty')
        .eq('user_id', dbUserId)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data || []) as ExamTopicRecord[]
    },
    enabled: !!dbUserId,
  })

  const flashcardsQuery = useQuery({
    queryKey: ['flashcards', clerkUserId, dbUserId],
    queryFn: async () => {
      const ids = [clerkUserId, dbUserId].filter(Boolean) as string[]
      if (!ids.length) return []
      const { data, error } = await supabase
        .from('flashcards')
        .select('id,topic,mastery_level')
        .in('user_id', ids)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as FlashcardRecord[]
    },
    enabled: !!clerkUserId || !!dbUserId,
  })

  const quizResultsQuery = useQuery({
    queryKey: ['quiz_results', clerkUserId, dbUserId],
    queryFn: async () => {
      const ids = [clerkUserId, dbUserId].filter(Boolean) as string[]
      if (!ids.length) return []
      const { data, error } = await supabase
        .from('quiz_results')
        .select('id,quiz_title,score,total_questions,correct_answers,created_at')
        .in('user_id', ids)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as QuizResultRecord[]
    },
    enabled: !!clerkUserId || !!dbUserId,
  })

  const userActivityQuery = useQuery({
    queryKey: ['user_activity_logs', clerkUserId, dbUserId],
    queryFn: async () => {
      const ids = [clerkUserId, dbUserId].filter(Boolean) as string[]
      if (!ids.length) return []
      const { data, error } = await supabase
        .from('user_activity_logs')
        .select('id,module,action,module_name,action_type,created_at')
        .in('user_id', ids)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as UserActivityRecord[]
    },
    enabled: !!clerkUserId || !!dbUserId,
  })

  useEffect(() => {
    const unsubscribes = [
      eventBus.subscribe(EVENTS.ACADEMIC_EVENT_CREATED, () => {
        queryClient.invalidateQueries({ queryKey: ['calendar_events'] })
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
        queryClient.invalidateQueries({ queryKey: ['backend_academic_analytics'] })
      }),
      eventBus.subscribe(EVENTS.ACADEMIC_EVENT_UPDATED, () => {
        queryClient.invalidateQueries({ queryKey: ['calendar_events'] })
        queryClient.invalidateQueries({ queryKey: ['backend_academic_analytics'] })
      }),
      eventBus.subscribe(EVENTS.ACADEMIC_EVENT_DELETED, () => {
        queryClient.invalidateQueries({ queryKey: ['calendar_events'] })
        queryClient.invalidateQueries({ queryKey: ['academic_ai_tasks'] })
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
        queryClient.invalidateQueries({ queryKey: ['backend_academic_analytics'] })
      }),
      eventBus.subscribe(EVENTS.TASK_COMPLETED, () => {
        queryClient.invalidateQueries({ queryKey: ['academic_ai_tasks'] })
        queryClient.invalidateQueries({ queryKey: ['academic_analytics_snapshots'] })
        queryClient.invalidateQueries({ queryKey: ['lexmentor_strategy'] })
        queryClient.invalidateQueries({ queryKey: ['backend_academic_analytics'] })
      }),
      eventBus.subscribe(EVENTS.HABIT_LOG_UPDATED, () => {
        queryClient.invalidateQueries({ queryKey: ['academic_habit_logs'] })
        queryClient.invalidateQueries({ queryKey: ['academic_analytics_snapshots'] })
        queryClient.invalidateQueries({ queryKey: ['backend_academic_analytics'] })
      }),
      eventBus.subscribe(EVENTS.MOCK_TEST_SUBMITTED, () => {
        queryClient.invalidateQueries({ queryKey: ['academic_analytics_snapshots'] })
        queryClient.invalidateQueries({ queryKey: ['lexmentor_strategy'] })
        queryClient.invalidateQueries({ queryKey: ['backend_academic_analytics'] })
      }),
      eventBus.subscribe(EVENTS.EXAM_STRATEGY_GENERATED, () => {
        queryClient.invalidateQueries({ queryKey: ['calendar_events'] })
        queryClient.invalidateQueries({ queryKey: ['academic_ai_tasks'] })
        queryClient.invalidateQueries({ queryKey: ['academic_analytics_snapshots'] })
        queryClient.invalidateQueries({ queryKey: ['lexmentor_strategy'] })
        queryClient.invalidateQueries({ queryKey: ['backend_academic_analytics'] })
      })
    ]
    return () => {
      unsubscribes.forEach(unsub => unsub())
    }
  }, [queryClient])

  const events = calendarEventsQuery.data || []
  const filteredEvents = useMemo(() => {
    if (categoryFilter === 'All') return events;
    return events.filter(evt => {
      const cat = (evt.category || evt.event_type || '').toLowerCase();
      if (categoryFilter === 'Exams' && cat.includes('exam')) return true;
      if (categoryFilter === 'Study' && cat.includes('study')) return true;
      if (categoryFilter === 'Revision' && cat.includes('revision')) return true;
      if (categoryFilter === 'Moot Court' && cat.includes('moot')) return true;
      if (categoryFilter === 'Internship' && (cat.includes('internship') || cat.includes('intern'))) return true;
      if (categoryFilter === 'Research' && (cat.includes('research') || cat.includes('paper'))) return true;
      if (categoryFilter === 'Hackathon' && cat.includes('hackathon')) return true;
      if (categoryFilter === 'Project' && cat.includes('project')) return true;
      if (categoryFilter === 'Personal' && cat.includes('personal')) return true;
      return false;
    });
  }, [events, categoryFilter]);
  const tasks = tasksQuery.data || []
  const habitLogs = habitLogsQuery.data || []
  const internships = internshipsQuery.data || []
  const notifications = notificationsQuery.data || []
  const unreadNotificationCount = notifications.filter((notice) => !notice.is_read).length
  const analytics = analyticsQuery.data || []
  const exams = examsQuery.data || []
  const examTopics = examTopicsQuery.data || []
  const flashcards = flashcardsQuery.data || []
  const quizResults = quizResultsQuery.data || []
  const userActivity = userActivityQuery.data || []

  const selectedHabitLog = habitLogs.find((log) => log.log_date === selectedDate)
  const selectedDateEvents = filteredEvents.filter((event) => event.event_date === selectedDate)
  const pendingTasks = tasks.filter((task) => task.status === 'pending')
  const upcomingDeadlines = [...filteredEvents]
    .filter((event) => ['exam', 'assignment', 'moot', 'internship', 'research_paper'].includes(getCategory(event)))
    .filter((event) => daysUntil(event.event_date) >= -1)
    .sort((a, b) => priorityWeight[b.priority || 'Medium'] - priorityWeight[a.priority || 'Medium'] || daysUntil(a.event_date) - daysUntil(b.event_date))
    .slice(0, 8)

  const weekStart = addDays(todayString, -new Date(`${todayString}T00:00:00`).getDay())
  const weekEnd = addDays(weekStart, 6)
  const monthStart = todayString.slice(0, 8) + '01'
  const dailyCompliance = complianceScore(habitLogs, todayString, todayString)
  const weeklyCompliance = complianceScore(habitLogs, weekStart, weekEnd)

  const examDeadlines = useMemo(() => {
    return events
      .filter((e) => getCategory(e) === 'exam' && daysUntil(e.event_date) >= -1)
      .sort((a, b) => daysUntil(a.event_date) - daysUntil(b.event_date))
  }, [events])

  const assignmentDeadlines = useMemo(() => {
    return events
      .filter((e) => getCategory(e) === 'assignment' && daysUntil(e.event_date) >= -1)
      .sort((a, b) => daysUntil(a.event_date) - daysUntil(b.event_date))
  }, [events])

  const researchDeadlines = useMemo(() => {
    return events
      .filter((e) => getCategory(e) === 'research_paper' && daysUntil(e.event_date) >= -1)
      .sort((a, b) => daysUntil(a.event_date) - daysUntil(b.event_date))
  }, [events])

  const mootDeadlines = useMemo(() => {
    return events
      .filter((e) => getCategory(e) === 'moot' && daysUntil(e.event_date) >= -1)
      .sort((a, b) => daysUntil(a.event_date) - daysUntil(b.event_date))
  }, [events])

  const internshipDeadlines = useMemo(() => {
    return events
      .filter((e) => getCategory(e) === 'internship' && daysUntil(e.event_date) >= -1)
      .sort((a, b) => daysUntil(a.event_date) - daysUntil(b.event_date))
  }, [events])

  const todayTasksDeadlines = useMemo(() => {
    return tasks.filter((t) => t.target_date === todayString && t.status === 'pending')
  }, [tasks, todayString])

  const weeklyTasksDeadlines = useMemo(() => {
    return tasks.filter((t) => t.target_date >= weekStart && t.target_date <= weekEnd && t.status === 'pending')
  }, [tasks, weekStart, weekEnd])

  const monthlyCompliance = complianceScore(habitLogs, monthStart, todayString)
  const totalStudyHours = habitLogs.reduce((sum, log) => sum + Number(log.study_hours || 0), 0)
  const revisionCompletion = tasks.length ? Math.round((tasks.filter((task) => task.task_type === 'revision' && task.status === 'completed').length / Math.max(1, tasks.filter((task) => task.task_type === 'revision').length)) * 100) : 0
  const goalAchievement = tasks.length ? Math.round((tasks.filter((task) => task.status === 'completed').length / tasks.length) * 100) : 0

  const localAnalyticsData = useMemo(() => {
    const completedTaskCount = tasks.filter((task) => task.status === 'completed').length
    const taskCompletionScore = tasks.length ? Math.round((completedTaskCount / tasks.length) * 100) : null
    const habitScore = habitLogs.length ? monthlyCompliance : null
    const quizScore = quizResults.length
      ? Math.round(quizResults.reduce((sum, result) => sum + Number(result.score || 0), 0) / quizResults.length)
      : null
    const completedExams = exams.filter((exam) => exam.exam_date ? new Date(exam.exam_date).getTime() < Date.now() : false).length
    const examCompletionScore = exams.length ? Math.round((completedExams / exams.length) * 100) : null
    const productivitySources = [taskCompletionScore, habitScore, quizScore, examCompletionScore].filter((score): score is number => score !== null)
    const productivityScore = productivitySources.length
      ? Math.round(productivitySources.reduce((sum, score) => sum + score, 0) / productivitySources.length)
      : 0

    const activeDates = new Set<string>()
    habitLogs.forEach((log) => {
      const active =
        Number(log.study_hours || 0) > 0 ||
        Number(log.judgments_read || 0) > 0 ||
        Number(log.research_sessions || 0) > 0 ||
        Number(log.moot_preparation || 0) > 0 ||
        Number(log.flashcard_revision || 0) > 0 ||
        Number(log.assignment_completion || 0) > 0
      if (active) activeDates.add(log.log_date)
    })
    tasks
      .filter((task) => task.status === 'completed' && task.updated_at)
      .forEach((task) => activeDates.add(task.updated_at!.split('T')[0]))

    let activeDays14 = 0
    for (let i = 0; i < 14; i += 1) {
      if (activeDates.has(addDays(todayString, -i))) activeDays14 += 1
    }
    const consistencyScore = Math.round((activeDays14 / 14) * 100)

    let streak = 0
    for (let i = 0; i < 365; i += 1) {
      const date = addDays(todayString, -i)
      if (!activeDates.has(date)) break
      streak += 1
    }

    const topicMastery = examTopics.length
      ? Math.round(examTopics.reduce((sum, topic) => sum + getExamTopicProgress(topic), 0) / examTopics.length)
      : 0
    const flashcardMastery = flashcards.length
      ? Math.round(flashcards.reduce((sum, card) => sum + Number(card.mastery_level || 0), 0) / flashcards.length)
      : 0
    const quizMastery = quizResults.length
      ? Math.round(quizResults.reduce((sum, result) => sum + Number(result.score || 0), 0) / quizResults.length)
      : 0
    const masterySources = [topicMastery, flashcardMastery, quizMastery].filter((score) => score > 0)
    const masteryScore = masterySources.length
      ? Math.round(masterySources.reduce((sum, score) => sum + score, 0) / masterySources.length)
      : 0

    const examReadinessSources = [
      examTopics.length ? topicMastery : null,
      exams.length ? Math.round(exams.reduce((sum, exam) => sum + Number(exam.syllabus_completion || 0), 0) / exams.length) : null,
      quizResults.length ? quizMastery : null,
    ].filter((score): score is number => score !== null)
    const examReadiness = examReadinessSources.length
      ? Math.round(examReadinessSources.reduce((sum, score) => sum + score, 0) / examReadinessSources.length)
      : 0

    const revisionSources = [
      tasks.some((task) => task.task_type === 'revision') ? revisionCompletion : null,
      flashcards.length ? flashcardMastery : null,
    ].filter((score): score is number => score !== null)
    const revisionConfidence = revisionSources.length
      ? Math.round(revisionSources.reduce((sum, score) => sum + score, 0) / revisionSources.length)
      : 0

    const researchSessions = habitLogs.reduce((sum, log) => sum + Number(log.research_sessions || 0), 0)
    const researchTasks = tasks.filter((task) => /research/i.test(task.title))
    const researchTaskCompletion = researchTasks.length
      ? Math.round((researchTasks.filter((task) => task.status === 'completed').length / researchTasks.length) * 100)
      : 0
    const researchProgress = researchTasks.length
      ? Math.round((Math.min(100, researchSessions * 20) + researchTaskCompletion) / 2)
      : Math.min(100, researchSessions * 20)

    const mootSessions = habitLogs.reduce((sum, log) => sum + Number(log.moot_preparation || 0), 0)
    const mootTasks = tasks.filter((task) => /moot|memorial|judge|oral/i.test(task.title))
    const mootTaskCompletion = mootTasks.length
      ? Math.round((mootTasks.filter((task) => task.status === 'completed').length / mootTasks.length) * 100)
      : 0
    const mootReadiness = mootTasks.length
      ? Math.round((Math.min(100, mootSessions * 20) + mootTaskCompletion) / 2)
      : Math.min(100, mootSessions * 20)

    return {
      productivityScore,
      consistencyScore,
      streak,
      examReadiness,
      revisionConfidence,
      researchProgress,
      mootReadiness,
      masteryScore,
    }
  }, [tasks, quizResults, habitLogs, examTopics, flashcards, revisionCompletion, exams, monthlyCompliance])

  const analyticsData = localAnalyticsData

  const productivityScore = analyticsData.productivityScore
  const consistencyScore = analyticsData.consistencyScore
  const studyStreak = analyticsData.streak
  const masteryScore = analyticsData.masteryScore

  const nextDeadline = upcomingDeadlines[0]
  const nextExam = [...exams]
    .filter((exam) => {
      if (!exam.exam_date) return false;
      const t = new Date(exam.exam_date).getTime();
      return !isNaN(t) && t >= Date.now();
    })
    .sort((a, b) => new Date(a.exam_date!).getTime() - new Date(b.exam_date!).getTime())[0]
  const subjectReadiness = useMemo(() => {
    const bySubject = new Map<string, { total: number; completed: number; events: number }>()
    examTopics.forEach((topic) => {
      const subject = exams.find((exam) => exam.id === topic.exam_id)?.subject || topic.title
      const record = bySubject.get(subject) || { total: 0, completed: 0, events: 0 }
      record.total += 100
      record.completed += getExamTopicProgress(topic)
      record.events += 1
      bySubject.set(subject, record)
    })
    flashcards.forEach((card) => {
      const key = card.topic || 'Flashcards'
      const record = bySubject.get(key) || { total: 0, completed: 0, events: 0 }
      record.total += 100
      record.completed += Number(card.mastery_level || 0)
      record.events += 1
      bySubject.set(key, record)
    })
    return Array.from(bySubject.entries()).map(([subject, record]) => ({
      subject,
      score: clamp(Math.round((record.completed / Math.max(record.total, 1)) * 100)),
      totalTasks: record.total,
    })).sort((a, b) => a.score - b.score)
  }, [examTopics, flashcards, exams])
  const weakSubjects = subjectReadiness.filter((subject) => subject.score < 75).slice(0, 5)
  const weakestSubject = weakSubjects[0] || subjectReadiness[0]
  const completedExamTopics = examTopics.filter((topic) => topic.status === 'Completed' || Number(topic.mastery_score || 0) >= 90)
  const pendingExamTopics = examTopics.filter((topic) => topic.status !== 'Completed' && Number(topic.mastery_score || 0) < 90)
  const isGeneratedTopicTask = (task: AcademicTask) => /^Pending topic:\s*/i.test(task.title)
  const nonTopicTasks = tasks.filter((task) => !isGeneratedTopicTask(task))
  const completedNonTopicTasks = nonTopicTasks.filter((task) => task.status === 'completed')
  const pendingNonTopicTasks = nonTopicTasks.filter((task) => task.status === 'pending')
  const completedTopics = [...completedNonTopicTasks, ...completedExamTopics]
  const pendingTopics = [...pendingNonTopicTasks, ...pendingExamTopics]
  const overdueTopics = pendingTasks.filter((task) => task.target_date < todayString)
  const todayTasks = tasks.filter((task) => task.target_date === todayString)


  const trackerDashboardCards = [
    { label: 'Upcoming Events', value: upcomingDeadlines.length, sub: nextDeadline ? nextDeadline.title : 'No upcoming events' },
    { label: 'Upcoming Interviews', value: internships.filter((intern) => intern.status === 'Interview').length, sub: 'Interview status applications' },
    { label: 'Pending Applications', value: internships.filter((intern) => ['Interested', 'Applied', 'Assessment'].includes(intern.status)).length, sub: 'Interested, applied, or assessment' },
    { label: 'Selected Internships', value: internships.filter((intern) => intern.status === 'Selected').length, sub: 'Confirmed selections' },
    { label: 'Upcoming Exams', value: examDeadlines.length, sub: nextExam ? nextExam.subject : 'No upcoming exams' },
  ]
  const predictionScores = {
    examReadiness: analyticsData.examReadiness,
    subjectReadiness: subjectReadiness.length ? Math.round(subjectReadiness.reduce((sum, item) => sum + item.score, 0) / subjectReadiness.length) : 0,
    revisionConfidence: analyticsData.revisionConfidence,
    mootReadiness: analyticsData.mootReadiness,
    researchProgress: analyticsData.researchProgress,
  }

  const activityModule = (activity: UserActivityRecord) => activity.module_name || activity.module || ''
  const activityAction = (activity: UserActivityRecord) => activity.action_type || activity.action || ''
  const moduleActivityCount = (moduleName: string) =>
    userActivity.filter((activity) => activityModule(activity) === moduleName).length
  const masteryModuleSignals: Record<string, number> = {
    'LexMentor AI': moduleActivityCount('LexMentor AI'),
    'Smart Study Forge': moduleActivityCount('Smart Study Forge') + flashcards.length + quizResults.length,
    'Exam Command Center': moduleActivityCount('Exam Command Center') + exams.length + examTopics.length,
    'Judgment Mastery Engine': moduleActivityCount('Judgment Mastery Engine'),
    'Legal Research Command Center': moduleActivityCount('Legal Research Command Center'),
    'AI Bench Simulator': userActivity.filter((activity) => {
      const moduleName = activityModule(activity)
      const actionName = activityAction(activity)
      return moduleName === 'AI Bench Simulator' ||
        (moduleName === 'Moot Court Suite' && /judge|bench|simulation/i.test(actionName))
    }).length,
  }

  const createNotification = async (userId: string, title: string, message: string, type = 'alert', triggerTime = new Date().toISOString()) => {
    await supabase.from('notifications').insert({
      user_id: userId,
      user: clerkUserId,
      title,
      message,
      type,
      trigger_time: triggerTime,
      sent_at: new Date().toISOString(),
      delivery_status: 'sent'
    })
  }

  const saveAnalyticsSnapshot = async (userId: string) => {
    await supabase.from('academic_analytics_snapshots').insert({
      user_id: userId,
      snapshot_date: todayString,
      productivity_score: productivityScore,
      consistency_score: consistencyScore,
      study_hours: totalStudyHours,
      revision_completion: revisionCompletion,
      goal_achievement: goalAchievement,
    })
  }

  const syncEventToGoogle = async (event: CalendarEventRecord) => {
    const token = await getToken()
    if (!token) throw new Error('Unauthenticated')
    const response = await fetch(`${apiBaseUrl}/exam/calendar/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        syncOnly: true,
        title: event.title,
        date: event.event_date,
        time: event.event_time,
        endDate: event.end_date || event.event_date,
        subject: event.subject,
        type: event.event_type,
        description: event.description || '',
        priority: event.priority || 'Medium',
        category: getCategory(event),
        moduleSource: 'Academic Navigator'
      })
    })
    if (!response.ok) throw new Error('Failed to sync calendar event')
    const data = await response.json()
    return data.googleEventId as string | null
  }

  const persistAcademicEvent = async (draft: AcademicEventDraft) => {
    if (!draft.title.trim()) throw new Error('Event title is required.')
    const userId = await getUserId(clerkUserId)
    const option = categoryOptions.find((item) => item.value === draft.category)!
    const { data: event, error } = await supabase
      .from('calendar_events')
      .insert({
        user_id: userId,
        title: draft.title.trim(),
        description: draft.description.trim(),
        event_date: draft.startDate,
        end_date: draft.endDate,
        event_time: draft.time,
        subject: option.subject,
        event_type: option.eventType,
        category: draft.category,
        priority: draft.priority,
        reminder_settings: { enabled: true, minutes_before: Number(draft.reminderMinutes) },
        is_synced: false,
        created_by: user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Student',
        clerk_user_id: clerkUserId,
        event_created_at: new Date().toISOString()
      })
      .select('id,title,description,event_date,end_date,event_time,subject,event_type,category,priority,reminder_settings,google_event_id,is_synced')
      .single()
    if (error) throw error

    const savedEvent = event as CalendarEventRecord
    if (googleConnected) {
      try {
        const googleEventId = await syncEventToGoogle(savedEvent)
        if (googleEventId) {
          const { data: syncedEvent, error: syncUpdateError } = await supabase
            .from('calendar_events')
            .update({ google_event_id: googleEventId, is_synced: true })
            .eq('id', savedEvent.id)
            .select('id,title,description,event_date,end_date,event_time,subject,event_type,category,priority,reminder_settings,google_event_id,is_synced')
            .single()
          if (syncUpdateError) throw syncUpdateError
          Object.assign(savedEvent, syncedEvent)
        }
      } catch (err) {
        console.warn('Google Calendar sync skipped for saved event:', err)
      }
    }
    const generatedTasks = buildLexMentorTasks(savedEvent, userId)
    await supabase.from('academic_ai_tasks').insert(generatedTasks)

    const reminderAt = new Date(`${savedEvent.event_date}T${savedEvent.event_time || '09:00'}`)
    reminderAt.setMinutes(reminderAt.getMinutes() - Number(savedEvent.reminder_settings?.minutes_before || 1440))
    await createNotification(
      userId,
      `Academic Navigator Reminder`,
      `${savedEvent.title} is scheduled for ${savedEvent.event_date}. LexMentor generated ${generatedTasks.length} connected tasks.`,
      savedEvent.priority === 'Critical' ? 'critical' : 'alert',
      reminderAt.toISOString()
    )
    await supabase.from('recommendations').insert(generatedTasks.slice(0, 2).map((task) => ({
      user_id: userId,
      content: task.title,
      target_date: task.target_date,
    })))
    await saveAnalyticsSnapshot(userId)
    return savedEvent
  }

  const createEventMutation = useMutation({
    mutationFn: () => persistAcademicEvent(newEvent),
    onSuccess: () => {
      setShowEventForm(false)
      setNewEvent({
        title: '',
        description: '',
        startDate: selectedDate,
        endDate: selectedDate,
        time: '09:00',
        priority: 'Medium',
        category: 'study_session',
        reminderMinutes: 1440,
      })
      eventBus.dispatch(EVENTS.ACADEMIC_EVENT_CREATED)
      queryClient.invalidateQueries({ queryKey: ['calendar_events'] })
      queryClient.invalidateQueries({ queryKey: ['academic_ai_tasks'] })
      queryClient.invalidateQueries({ queryKey: ['academic_habit_logs'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['recommendations'] })
      queryClient.invalidateQueries({ queryKey: ['academic_analytics_snapshots'] })
    },
  })

  const createExamPlanMutation = useMutation({
    mutationFn: async () => {
      if (!examDraft.subject.trim()) throw new Error('Subject is required.')
      const topics = examDraft.topics.split(',').map((topic) => topic.trim()).filter(Boolean)
      if (!topics.length) throw new Error('Add at least one syllabus topic.')
      const userId = await getUserId(clerkUserId)
      const { data: exam, error: examError } = await supabase
        .from('exams')
        .insert({
          user_id: userId,
          subject: examDraft.subject.trim(),
          exam_date: `${examDraft.examDate}T09:00:00.000Z`,
          prep_level: 'Intermediate',
          syllabus_completion: 0,
        })
        .select('id')
        .single()
      if (examError) throw examError

      try {
        const { error: topicError } = await supabase.from('exam_topics').insert(topics.map((topic, index) => ({
          user_id: userId,
          exam_id: exam.id,
          title: topic,
          status: 'Not Started',
          difficulty: index < 2 ? 'Hard' : 'Medium',
          quiz_score: 0,
          flashcard_score: 0,
          mastery_score: 0,
          pyq_frequency: Math.max(1, 5 - (index % 5)),
        })))
        if (topicError) throw topicError

        const examEvent = await persistAcademicEvent({
          title: `${examDraft.subject} Exam`,
          description: `Syllabus topics: ${topics.join(', ')}. Available study hours: ${examDraft.studyHours}/day.`,
          startDate: examDraft.examDate,
          endDate: examDraft.examDate,
          time: '09:00',
          priority: 'Critical',
          category: 'exam',
          reminderMinutes: 2880,
        })

        await supabase
          .from('calendar_events')
          .update({ exam_id: exam.id })
          .eq('id', examEvent.id)
          .eq('user_id', userId)

        const topicTasks = topics.map((topic, index) => ({
          user_id: userId,
          calendar_event_id: examEvent.id,
          title: `Pending topic: ${topic}`,
          task_type: 'study',
          target_date: addDays(todayString, Math.min(index + 1, Math.max(1, daysUntil(examDraft.examDate) - 1))),
          priority: index < 2 ? 'High' : 'Medium',
          status: 'pending',
          metadata: { source: 'Exam Command Center', linkedModules: ['LexMentor AI', 'Exam Command Center', 'Smart Study Forge'] },
        }))
        const { error: taskError } = await supabase.from('academic_ai_tasks').insert(topicTasks)
        if (taskError) throw taskError

        return {
          subject: examDraft.subject.trim(),
          examDate: examDraft.examDate,
          topics,
          taskCount: buildLexMentorTasks(examEvent, userId).length + topicTasks.length,
        } as GeneratedExamPlan
      } catch (error) {
        await supabase.from('exams').delete().eq('id', exam.id).eq('user_id', userId)
        throw error
      }
    },
    onSuccess: (plan) => {
      setGeneratedExamPlan(plan)
      setExamDraft({ subject: '', examDate: selectedDate, topics: '', studyHours: 3 })
      eventBus.dispatch(EVENTS.ACADEMIC_EVENT_CREATED)
      queryClient.invalidateQueries({ queryKey: ['academic_navigator_exams'] })
      queryClient.invalidateQueries({ queryKey: ['exam_topics'] })
      queryClient.invalidateQueries({ queryKey: ['calendar_events'] })
      queryClient.invalidateQueries({ queryKey: ['academic_ai_tasks'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const createMootPlanMutation = useMutation({
    mutationFn: async () => {
      if (!mootDraft.problem.trim()) throw new Error('Moot problem is required.')
      await persistAcademicEvent({
        title: `${mootDraft.problem} Memorial Deadline`,
        description: `Moot problem: ${mootDraft.problem}. Oral round date: ${mootDraft.oralRoundDate}.`,
        startDate: mootDraft.memorialDeadline,
        endDate: mootDraft.memorialDeadline,
        time: '17:00',
        priority: 'Critical',
        category: 'moot',
        reminderMinutes: 2880,
      })
      await persistAcademicEvent({
        title: `${mootDraft.problem} Oral Round`,
        description: 'AI Bench Simulator practice and oral argument rehearsal.',
        startDate: mootDraft.oralRoundDate,
        endDate: mootDraft.oralRoundDate,
        time: '10:00',
        priority: 'High',
        category: 'moot',
        reminderMinutes: 1440,
      })
    },
    onSuccess: () => {
      setMootDraft({ problem: '', memorialDeadline: selectedDate, oralRoundDate: addDays(selectedDate, 7) })
      eventBus.dispatch(EVENTS.ACADEMIC_EVENT_CREATED)
      queryClient.invalidateQueries({ queryKey: ['calendar_events'] })
      queryClient.invalidateQueries({ queryKey: ['academic_ai_tasks'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const createResearchPlanMutation = useMutation({
    mutationFn: async () => {
      if (!researchDraft.doctrine.trim()) throw new Error('Research topic is required.')
      return persistAcademicEvent({
        title: `Research Follow-up: ${researchDraft.doctrine}`,
        description: `Legal Research Command Center follow-up for ${researchDraft.doctrine}. Includes revision reminder, research follow-up, and case revision session.`,
        startDate: researchDraft.followUpDate,
        endDate: researchDraft.followUpDate,
        time: '16:00',
        priority: 'High',
        category: 'research_paper',
        reminderMinutes: 1440,
      })
    },
    onSuccess: () => {
      setResearchDraft({ doctrine: '', followUpDate: addDays(selectedDate, 2) })
      eventBus.dispatch(EVENTS.ACADEMIC_EVENT_CREATED)
      queryClient.invalidateQueries({ queryKey: ['calendar_events'] })
      queryClient.invalidateQueries({ queryKey: ['academic_ai_tasks'] })
    },
  })

  const createJudgmentPlanMutation = useMutation({
    mutationFn: async () => {
      if (!judgmentDraft.caseName.trim()) throw new Error('Case name is required.')
      return persistAcademicEvent({
        title: `Judgment Mastery: ${judgmentDraft.caseName}`,
        description: `Create flashcard revision, quiz reminder, and case analysis session for ${judgmentDraft.caseName}.`,
        startDate: judgmentDraft.sessionDate,
        endDate: judgmentDraft.sessionDate,
        time: '18:00',
        priority: 'High',
        category: 'revision',
        reminderMinutes: 1440,
      })
    },
    onSuccess: () => {
      setJudgmentDraft({ caseName: '', sessionDate: selectedDate })
      eventBus.dispatch(EVENTS.ACADEMIC_EVENT_CREATED)
      queryClient.invalidateQueries({ queryKey: ['calendar_events'] })
      queryClient.invalidateQueries({ queryKey: ['academic_ai_tasks'] })
    },
  })

  const updateHabitMutation = useMutation({
    mutationFn: async (patch: Partial<HabitLog>) => {
      const userId = await getUserId(clerkUserId)
      const current = selectedHabitLog || {
        study_hours: 0,
        judgments_read: 0,
        research_sessions: 0,
        moot_preparation: 0,
        flashcard_revision: 0,
        assignment_completion: 0,
      }
      const { error } = await supabase.from('academic_habit_logs').upsert({
        user_id: userId,
        log_date: selectedDate,
        calendar_event_id: selectedDateEvents[0]?.id || null,
        study_hours: Number(patch.study_hours ?? current.study_hours ?? 0),
        judgments_read: Number(patch.judgments_read ?? current.judgments_read ?? 0),
        research_sessions: Number(patch.research_sessions ?? current.research_sessions ?? 0),
        moot_preparation: Number(patch.moot_preparation ?? current.moot_preparation ?? 0),
        flashcard_revision: Number(patch.flashcard_revision ?? current.flashcard_revision ?? 0),
        assignment_completion: Number(patch.assignment_completion ?? current.assignment_completion ?? 0),
      }, { onConflict: 'user_id,log_date' })
      if (error) throw error
      await saveAnalyticsSnapshot(userId)
    },
    onSuccess: () => {
      eventBus.dispatch(EVENTS.HABIT_LOG_UPDATED)
      queryClient.invalidateQueries({ queryKey: ['academic_habit_logs'] })
      queryClient.invalidateQueries({ queryKey: ['academic_analytics_snapshots'] })
    },
  })

  const toggleTaskMutation = useMutation({
    mutationFn: async (task: AcademicTask) => {
      const userId = await getUserId(clerkUserId)
      const nextStatus = task.status === 'completed' ? 'pending' : 'completed'
      const { error } = await supabase
        .from('academic_ai_tasks')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', task.id)
        .eq('user_id', userId)
      if (error) throw error

      const topicTitle = task.title.replace(/^Pending topic:\s*/i, '').trim()
      if (topicTitle !== task.title) {
        const matchingTopic = examTopics.find((topic) => topic.title.toLowerCase() === topicTitle.toLowerCase())
        if (matchingTopic) {
          const { error: topicError } = await supabase
            .from('exam_topics')
            .update({
              status: nextStatus === 'completed' ? 'Completed' : 'Not Started',
              updated_at: new Date().toISOString(),
            })
            .eq('id', matchingTopic.id)
            .eq('user_id', userId)
          if (topicError) throw topicError

          const examTopicList = examTopics.filter((topic) => topic.exam_id === matchingTopic.exam_id)
          const completedCount = examTopicList.filter((topic) =>
            topic.id === matchingTopic.id
              ? nextStatus === 'completed'
              : topic.status === 'Completed'
          ).length
          const syllabusCompletion = examTopicList.length
            ? Math.round((completedCount / examTopicList.length) * 100)
            : 0
          const { error: examError } = await supabase
            .from('exams')
            .update({ syllabus_completion: syllabusCompletion, updated_at: new Date().toISOString() })
            .eq('id', matchingTopic.exam_id)
            .eq('user_id', userId)
          if (examError) throw examError
        }
      }

      await saveAnalyticsSnapshot(userId)
    },
    onSuccess: () => {
      eventBus.dispatch(EVENTS.TASK_COMPLETED)
      queryClient.invalidateQueries({ queryKey: ['academic_ai_tasks'] })
      queryClient.invalidateQueries({ queryKey: ['exam_topics'] })
      queryClient.invalidateQueries({ queryKey: ['academic_navigator_exams'] })
      queryClient.invalidateQueries({ queryKey: ['academic_analytics_snapshots'] })
    },
  })

  const addInternshipMutation = useMutation({
    mutationFn: async () => {
      if (!newIntern.organization.trim() || !newIntern.position.trim()) throw new Error('Organization and position are required.')
      const userId = await getUserId(clerkUserId)
      const { data: internship, error } = await supabase
        .from('internship_applications')
        .insert({
          user_id: userId,
          organization: newIntern.organization.trim(),
          position: newIntern.position.trim(),
          deadline: newIntern.deadline,
          status: newIntern.status,
          notes: newIntern.notes.trim(),
        })
        .select('*')
        .single()
      if (error) throw error

      const option = categoryOptions.find((item) => item.value === 'internship')!
      const { data: event, error: eventError } = await supabase
        .from('calendar_events')
        .insert({
          user_id: userId,
          title: internshipCalendarEventTitle(newIntern.status, newIntern.organization, newIntern.position),
          description: newIntern.notes.trim(),
          event_date: newIntern.deadline,
          end_date: newIntern.deadline,
          event_time: '17:00',
          subject: option.subject,
          event_type: option.eventType,
          category: 'internship',
          priority: newIntern.status === 'Interview' || newIntern.status === 'Assessment' ? 'High' : newIntern.status === 'Selected' ? 'Critical' : 'Medium',
          reminder_settings: { enabled: true, minutes_before: 1440 },
          is_synced: false,
          created_by: user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Student',
          clerk_user_id: clerkUserId,
          event_created_at: new Date().toISOString()
        })
        .select('id,title,description,event_date,end_date,event_time,subject,event_type,category,priority,reminder_settings,google_event_id,is_synced')
        .single()
      if (eventError) throw eventError

      const tasksForInternship = buildLexMentorTasks(event as CalendarEventRecord, userId)
      await supabase.from('academic_ai_tasks').insert(tasksForInternship)
      await createNotification(userId, 'Internship Deadline Added', `${newIntern.organization} activity is now connected to the calendar and LexMentor tasks.`, 'alert')
      await saveAnalyticsSnapshot(userId)
      return internship as InternshipApplication
    },
    onSuccess: () => {
      setShowInternForm(false)
      setNewIntern({ organization: '', position: '', deadline: selectedDate, status: 'Interested', notes: '' })
      queryClient.invalidateQueries({ queryKey: ['internship_applications'] })
      queryClient.invalidateQueries({ queryKey: ['calendar_events'] })
      queryClient.invalidateQueries({ queryKey: ['academic_ai_tasks'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['academic_analytics_snapshots'] })
    },
  })

  const startEditingInternship = (intern: InternshipApplication) => {
    setEditingInternshipId(intern.id)
    setEditIntern({
      organization: intern.organization,
      position: intern.position,
      deadline: intern.deadline,
      status: intern.status,
      notes: intern.notes || '',
    })
  }

  const updateInternshipMutation = useMutation({
    mutationFn: async () => {
      if (!editingInternshipId) throw new Error('No internship selected.')
      if (!editIntern.organization.trim() || !editIntern.position.trim()) throw new Error('Organization and position are required.')
      const userId = await getUserId(clerkUserId)
      const original = internships.find((intern) => intern.id === editingInternshipId)
      const title = internshipCalendarEventTitle(editIntern.status, editIntern.organization, editIntern.position)
      const { error } = await supabase
        .from('internship_applications')
        .update({
          organization: editIntern.organization.trim(),
          position: editIntern.position.trim(),
          deadline: editIntern.deadline,
          status: editIntern.status,
          notes: editIntern.notes.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingInternshipId)
        .eq('user_id', userId)
      if (error) throw error

      if (original) {
        const previousTitle = internshipCalendarEventTitle(original.status, original.organization, original.position)
        await supabase
          .from('calendar_events')
          .update({
            title,
            description: editIntern.notes.trim(),
            event_date: editIntern.deadline,
            end_date: editIntern.deadline,
            priority: editIntern.status === 'Interview' || editIntern.status === 'Assessment' ? 'High' : editIntern.status === 'Selected' ? 'Critical' : 'Medium',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('category', 'internship')
          .eq('title', previousTitle)
      }

      await createNotification(userId, 'Internship Application Updated', `${title} was updated on your Calender and career Tracker.`, 'info')
      await saveAnalyticsSnapshot(userId)
    },
    onSuccess: () => {
      setEditingInternshipId(null)
      queryClient.invalidateQueries({ queryKey: ['internship_applications'] })
      queryClient.invalidateQueries({ queryKey: ['calendar_events'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['academic_analytics_snapshots'] })
    },
  })

  const deleteInternshipMutation = useMutation({
    mutationFn: async (intern: InternshipApplication) => {
      const userId = await getUserId(clerkUserId)
      const title = internshipCalendarEventTitle(intern.status, intern.organization, intern.position)
      const { error } = await supabase
        .from('internship_applications')
        .delete()
        .eq('id', intern.id)
        .eq('user_id', userId)
      if (error) throw error

      await supabase
        .from('calendar_events')
        .delete()
        .eq('user_id', userId)
        .eq('category', 'internship')
        .eq('title', title)

      await createNotification(userId, 'Internship Application Deleted', `${title} was removed from your Calender and career Tracker.`, 'info')
      await saveAnalyticsSnapshot(userId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internship_applications'] })
      queryClient.invalidateQueries({ queryKey: ['calendar_events'] })
      queryClient.invalidateQueries({ queryKey: ['academic_ai_tasks'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['academic_analytics_snapshots'] })
    },
  })

  const syncCalendarMutation = useMutation({
    mutationFn: async () => {
      const unsynced = events.filter((event) => !event.is_synced)
      for (const event of unsynced) {
        const googleEventId = await syncEventToGoogle(event)
        if (googleEventId) {
          await supabase.from('calendar_events').update({ google_event_id: googleEventId, is_synced: true }).eq('id', event.id)
        }
      }
      await createNotification(await getUserId(clerkUserId), 'Calendar Sync Complete', `${unsynced.length} internal calendar events were checked for optional external sync.`, 'info')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar_events'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markNotificationsReadMutation = useMutation({
    mutationFn: async () => {
      if (!dbUserId) throw new Error('Database user profile not initialized')
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, opened_at: new Date().toISOString() })
        .eq('user_id', dbUserId)
        .or('is_read.eq.false,is_read.is.null')
      if (error) throw error
    },
    onMutate: async () => {
      const queryKey = ['notifications', 'academic_navigator', dbUserId]
      await queryClient.cancelQueries({ queryKey })
      const previousNotifications = queryClient.getQueryData<NotificationRecord[]>(queryKey)
      queryClient.setQueryData<NotificationRecord[]>(queryKey, (current = []) =>
        current.map((notice) => ({ ...notice, is_read: true }))
      )
      return { previousNotifications, queryKey }
    },
    onError: (error, _variables, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(context.queryKey, context.previousNotifications)
      }
      console.error('Failed to mark notifications read:', error)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markNotificationReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!dbUserId) throw new Error('Database user profile not initialized')
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, opened_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', dbUserId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!dbUserId) throw new Error('Database user profile not initialized')
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', dbUserId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const lexMentorResponse = useMemo(() => {
    const nextExam = [...exams]
      .filter((exam) => {
        if (!exam.exam_date) return false
        const datePart = exam.exam_date.split('T')[0]
        const days = daysUntil(datePart)
        return !isNaN(days) && days >= 0
      })
      .sort((a, b) => (a.exam_date || '').localeCompare(b.exam_date || ''))[0]
    const weakSubject = weakSubjects[0]
    const prioritizedTasks = [...pendingTasks].sort(
      (a, b) => (priorityWeight[b.priority || 'Medium'] || 2) - (priorityWeight[a.priority || 'Medium'] || 2) || (a.target_date || '').localeCompare(b.target_date || '')
    )
    const datedTasks = [...pendingTasks].sort((a, b) => (a.target_date || '').localeCompare(b.target_date || ''))
    const taskLines = (items: AcademicTask[]) =>
      items.map((task, index) => `${index + 1}. ${task.title || 'Untitled'}\n   Due: ${task.target_date || 'No Date'} | Priority: ${task.priority || 'Medium'}`)
    const examDatePart = nextExam && nextExam.exam_date ? nextExam.exam_date.split('T')[0] : ''
    const examContext = nextExam
      ? `${nextExam.subject || 'Subject'} exam: ${examDatePart} (${daysUntil(examDatePart)} days remaining)`
      : 'No upcoming exam is saved.'
    const performanceContext =
      `Progress: ${productivityScore}% productivity | ${consistencyScore}% consistency | ${masteryScore}% mastery | ${studyStreak}-day streak`

    if (aiMode === 'roadmap') {
      const roadmapTasks = [...weeklyTasksDeadlines]
        .sort((a, b) => a.target_date.localeCompare(b.target_date))
        .slice(0, 7)
      return [
        'Weekly Roadmap',
        `Week: ${weekStart} to ${weekEnd}`,
        examContext,
        roadmapTasks.length
          ? ['Milestones:', ...taskLines(roadmapTasks)].join('\n')
          : 'No pending tasks fall within this week. Generate an exam plan or add calendar deadlines.',
        `Upcoming calendar deadlines: ${upcomingDeadlines.length}`,
        performanceContext,
      ].join('\n\n')
    }

    if (aiMode === 'revision') {
      const revisionTasks = datedTasks.filter((task) => task.task_type === 'revision').slice(0, 5)
      const revisionTopics = [...pendingExamTopics]
        .sort((a, b) => getExamTopicProgress(a) - getExamTopicProgress(b))
        .slice(0, 5)
      const flashcardMastery = flashcards.length
        ? Math.round(flashcards.reduce((sum, card) => sum + Number(card.mastery_level || 0), 0) / flashcards.length)
        : 0
      return [
        'Revision Plan',
        examContext,
        revisionTasks.length
          ? ['Scheduled revision:', ...taskLines(revisionTasks)].join('\n')
          : 'No dated revision task is currently pending.',
        revisionTopics.length
          ? ['Topics requiring revision:', ...revisionTopics.map((topic, index) => {
              const subject = exams.find((exam) => exam.id === topic.exam_id)?.subject || 'Exam'
              return `${index + 1}. ${subject}: ${topic.title} (${getExamTopicProgress(topic)}% readiness)`
            })].join('\n')
          : 'No pending exam topics require revision.',
        `Flashcard mastery: ${flashcardMastery}% across ${flashcards.length} saved card(s).`,
        performanceContext,
      ].join('\n\n')
    }

    if (aiMode === 'priority') {
      const priorityTasks = prioritizedTasks.slice(0, 5)
      return [
        'Priority Suggestions',
        weakSubject
          ? `Primary focus: ${weakSubject.subject} (${weakSubject.score}% readiness)`
          : 'No weak subject can be calculated until exam topics or flashcards are saved.',
        priorityTasks.length
          ? ['Complete in this order:', ...taskLines(priorityTasks)].join('\n')
          : 'There are no pending tasks to prioritize.',
        overdueTopics.length
          ? `Attention: ${overdueTopics.length} task(s) are overdue.`
          : 'No tasks are overdue.',
        examContext,
        performanceContext,
      ].join('\n\n')
    }

    const dailyTasks = datedTasks
      .filter((task) => task.target_date <= addDays(todayString, 2))
      .slice(0, 5)
    const fallbackTasks = dailyTasks.length ? dailyTasks : datedTasks.slice(0, 5)
    return [
      'Daily Study Plan',
      `Date: ${todayString}`,
      examContext,
      fallbackTasks.length
        ? ['Study blocks:', ...taskLines(fallbackTasks)].join('\n')
        : 'No pending study blocks exist. Generate an exam plan or add a calendar event.',
      `Logged today: ${Number(selectedHabitLog?.study_hours || 0)} study hour(s), ${Number(selectedHabitLog?.judgments_read || 0)} judgment(s), ${Number(selectedHabitLog?.flashcard_revision || 0)} flashcard session(s).`,
      performanceContext,
    ].join('\n\n')
  }, [
    exams,
    weakSubjects,
    pendingTasks,
    productivityScore,
    consistencyScore,
    studyStreak,
    masteryScore,
    aiMode,
    weeklyTasksDeadlines,
    upcomingDeadlines,
    flashcards,
    overdueTopics,
    selectedHabitLog,
    pendingExamTopics,
    weekStart,
    weekEnd,
  ])

  const selectAiMode = (mode: 'plan' | 'roadmap' | 'revision' | 'priority') => {
    setAiMode(mode)
    window.requestAnimationFrame(() => {
      aiSuggestionRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    })
    const actionLabels = {
      plan: 'Viewed Study Plan',
      roadmap: 'Viewed Weekly Roadmap',
      revision: 'Viewed Revision Plan',
      priority: 'Viewed Priority Suggestions',
    }
    ;(window as any).logUserActivity?.('LexMentor AI', actionLabels[mode], {
      source: 'Academic Navigator',
    })
  }

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()
  const calendarDaysList = [
    ...Array.from({ length: firstDay }, () => ({ day: '', isOutside: true, dateString: '' })),
    ...Array.from({ length: daysInMonth }, (_, idx) => {
      const day = idx + 1
      return { day, isOutside: false, dateString: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` }
    }),
  ]
  const weekDates = Array.from({ length: 7 }, (_, idx) => addDays(selectedDate, idx - new Date(`${selectedDate}T00:00:00`).getDay()))

  const renderEventForm = () => (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        createEventMutation.mutate()
      }}
      className="acad-nav-form-grid"
    >
      <input value={newEvent.title} onChange={(event) => setNewEvent({ ...newEvent, title: event.target.value })} placeholder="Title" required />
      <select value={newEvent.category} onChange={(event) => setNewEvent({ ...newEvent, category: event.target.value as CalendarCategory })}>
        {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <input type="date" value={newEvent.startDate} onChange={(event) => setNewEvent({ ...newEvent, startDate: event.target.value, endDate: event.target.value })} />
      <input type="date" value={newEvent.endDate} onChange={(event) => setNewEvent({ ...newEvent, endDate: event.target.value })} />
      <input type="time" value={newEvent.time} onChange={(event) => setNewEvent({ ...newEvent, time: event.target.value })} />
      <select value={newEvent.priority} onChange={(event) => setNewEvent({ ...newEvent, priority: event.target.value as Priority })}>
        <option>Low</option>
        <option>Medium</option>
        <option>High</option>
        <option>Critical</option>
      </select>
      <select value={newEvent.reminderMinutes} onChange={(event) => setNewEvent({ ...newEvent, reminderMinutes: Number(event.target.value) })}>
        <option value={60}>1 hour before</option>
        <option value={360}>6 hours before</option>
        <option value={1440}>1 day before</option>
        <option value={2880}>2 days before</option>
      </select>
      <textarea value={newEvent.description} onChange={(event) => setNewEvent({ ...newEvent, description: event.target.value })} placeholder="Description" />
      <button type="submit" className="acad-nav-btn acad-nav-save-btn" disabled={createEventMutation.isPending}>
        {createEventMutation.isPending ? 'Saving...' : 'Save Event'}
      </button>
    </form>
  )

  const renderCommandBuilder = () => (
    <div className="acad-nav-command-builder">
      <div className="acad-nav-builder-tabs">
        {([
          ['event', 'Calendar Event'],
          ['exam', 'Exam Plan'],
          ['moot', 'Moot Workflow'],
          ['research', 'Research Follow-up'],
          ['judgment', 'Judgment Mastery'],
        ] as [BuilderMode, string][]).map(([mode, label]) => (
          <button key={mode} type="button" className={builderMode === mode ? 'active' : ''} onClick={() => setBuilderMode(mode)}>
            {label}
          </button>
        ))}
      </div>

      {builderMode === 'event' && renderEventForm()}

      {builderMode === 'exam' && (
        <form className="acad-nav-form-grid" onSubmit={(event) => { event.preventDefault(); createExamPlanMutation.mutate() }}>
          <input value={examDraft.subject} onChange={(event) => setExamDraft({ ...examDraft, subject: event.target.value })} placeholder="Subject" required />
          <input type="date" value={examDraft.examDate} onChange={(event) => setExamDraft({ ...examDraft, examDate: event.target.value })} />
          <input type="number" min="1" value={examDraft.studyHours} onChange={(event) => setExamDraft({ ...examDraft, studyHours: Number(event.target.value) })} placeholder="Study hours/day" />
          <textarea value={examDraft.topics} onChange={(event) => setExamDraft({ ...examDraft, topics: event.target.value })} placeholder="Syllabus topics, comma separated" />
          <button type="submit" className="acad-nav-btn acad-nav-save-btn" disabled={createExamPlanMutation.isPending}>
            {createExamPlanMutation.isPending ? 'Generating...' : 'Generate Exam Plan'}
          </button>
          {createExamPlanMutation.error && (
            <p className="acad-nav-error">{(createExamPlanMutation.error as Error).message}</p>
          )}
          {generatedExamPlan && (
            <div className="acad-nav-ai-note" style={{ gridColumn: '1 / -1' }}>
              <strong>Generated Plan: {generatedExamPlan.subject}</strong>
              <p>Exam deadline: {generatedExamPlan.examDate}</p>
              <p>Topic sequence: {generatedExamPlan.topics.join(' -> ')}</p>
              <p>{generatedExamPlan.taskCount} saved study, revision, mock-test, and priority tasks are available in Pending Topics and the Activity Dashboard.</p>
            </div>
          )}
        </form>
      )}

      {builderMode === 'moot' && (
        <form className="acad-nav-form-grid" onSubmit={(event) => { event.preventDefault(); createMootPlanMutation.mutate() }}>
          <input value={mootDraft.problem} onChange={(event) => setMootDraft({ ...mootDraft, problem: event.target.value })} placeholder="Moot problem" required />
          <input type="date" value={mootDraft.memorialDeadline} onChange={(event) => setMootDraft({ ...mootDraft, memorialDeadline: event.target.value })} />
          <input type="date" value={mootDraft.oralRoundDate} onChange={(event) => setMootDraft({ ...mootDraft, oralRoundDate: event.target.value })} />
          <button type="submit" className="acad-nav-btn acad-nav-save-btn" disabled={createMootPlanMutation.isPending}>
            {createMootPlanMutation.isPending ? 'Generating...' : 'Create Moot Workflow'}
          </button>
        </form>
      )}

      {builderMode === 'research' && (
        <form className="acad-nav-form-grid" onSubmit={(event) => { event.preventDefault(); createResearchPlanMutation.mutate() }}>
          <input value={researchDraft.doctrine} onChange={(event) => setResearchDraft({ ...researchDraft, doctrine: event.target.value })} placeholder="Research topic or doctrine" required />
          <input type="date" value={researchDraft.followUpDate} onChange={(event) => setResearchDraft({ ...researchDraft, followUpDate: event.target.value })} />
          <button type="submit" className="acad-nav-btn acad-nav-save-btn" disabled={createResearchPlanMutation.isPending}>
            {createResearchPlanMutation.isPending ? 'Scheduling...' : 'Create Research Follow-up'}
          </button>
        </form>
      )}

      {builderMode === 'judgment' && (
        <form className="acad-nav-form-grid" onSubmit={(event) => { event.preventDefault(); createJudgmentPlanMutation.mutate() }}>
          <input value={judgmentDraft.caseName} onChange={(event) => setJudgmentDraft({ ...judgmentDraft, caseName: event.target.value })} placeholder="Judgment name" required />
          <input type="date" value={judgmentDraft.sessionDate} onChange={(event) => setJudgmentDraft({ ...judgmentDraft, sessionDate: event.target.value })} />
          <button type="submit" className="acad-nav-btn acad-nav-save-btn" disabled={createJudgmentPlanMutation.isPending}>
            {createJudgmentPlanMutation.isPending ? 'Scheduling...' : 'Create Mastery Session'}
          </button>
        </form>
      )}
    </div>
  )

  const renderCalendarBody = () => {
    if (viewMode === 'Week') {
      return (
        <div className="acad-nav-week-grid">
          {weekDates.map((date) => (
            <button
              key={date}
              type="button"
              className={`acad-nav-week-day ${date === selectedDate ? 'active' : ''}`}
              onClick={() => setSelectedDate(date)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const eventId = e.dataTransfer.getData('text/plain')
                if (eventId) {
                  handleEventDateUpdate(eventId, date)
                }
              }}
            >
              <strong>{new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</strong>
              <span>{date}</span>
              <small>{filteredEvents.filter((event) => event.event_date === date).length} events</small>
            </button>
          ))}
        </div>
      )
    }



    if (viewMode === 'Agenda') {
      const list = [...filteredEvents].filter((event) => daysUntil(event.event_date) >= -7).sort((a, b) => a.event_date.localeCompare(b.event_date)).slice(0, 18)
      return (
        <div className="acad-nav-agenda-list">
          {list.map((event) => (
            <article
              key={event.id}
              className={`acad-nav-timeline-event ${getCategoryClass(event)}`}
              onClick={(e) => handleOpenEventPopup(event, e)}
              style={{ cursor: 'pointer' }}
            >
              <strong>{event.event_date} · {event.title}</strong>
              <span>{event.description || categoryOptions.find((item) => item.value === getCategory(event))?.label}</span>
            </article>
          ))}
          {!list.length && <p className="acad-nav-empty">Create academic events to populate the {viewMode.toLowerCase()} view.</p>}
        </div>
      )
    }

    return (
      <div className="acad-nav-month-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => <div key={label} className="acad-nav-day-label">{label}</div>)}
        {calendarDaysList.map((cell, index) => {
          const isToday = cell.dateString === todayString
          const isSelected = selectedDate === cell.dateString
          const cellEvents = filteredEvents.filter((event) => event.event_date === cell.dateString)
          return (
            <div
              key={`${cell.dateString}-${index}`}
              onClick={() => {
                if (cell.dateString) {
                  setSelectedDate(cell.dateString)
                  setNewEvent((prev) => ({ ...prev, startDate: cell.dateString, endDate: cell.dateString }))
                }
              }}
              onDragOver={(e) => {
                if (!cell.isOutside) e.preventDefault()
              }}
              onDrop={(e) => {
                if (!cell.isOutside && cell.dateString) {
                  e.preventDefault()
                  const eventId = e.dataTransfer.getData('text/plain')
                  if (eventId) {
                    handleEventDateUpdate(eventId, cell.dateString)
                  }
                }
              }}
              className={`acad-nav-day-cell ${cell.isOutside ? 'outside' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
            >
              <span className="acad-nav-day-number">{cell.day}</span>
              <div className="acad-nav-day-events">
                {cellEvents.map((event) => (
                  <span
                    key={event.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', event.id)}
                    onClick={(e) => handleOpenEventPopup(event, e)}
                    className={`acad-nav-event-pill ${getCategoryClass(event)}`}
                    style={{ cursor: 'grab' }}
                    title={event.title}
                  >
                    {event.title}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderHabitMetric = (key: keyof Pick<HabitLog, 'study_hours' | 'judgments_read' | 'research_sessions' | 'moot_preparation' | 'flashcard_revision' | 'assignment_completion'>, label: string, icon: React.ReactNode) => (
    <label className="acad-nav-habit-metric">
      <span>{icon}{label}</span>
      <input
        type="number"
        min="0"
        step={key === 'study_hours' ? '0.5' : '1'}
        value={Number(selectedHabitLog?.[key] || 0)}
        onChange={(event) => updateHabitMutation.mutate({ [key]: Number(event.target.value) } as Partial<HabitLog>)}
      />
    </label>
  )

  const renderEmptyStateIllustration = (type: string, message: string) => {
    let svgIcon = null

    switch (type) {
      case 'Exams':
        svgIcon = (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--gold)' }}>
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" strokeDasharray="3,3" />
            <path d="M12 6v6l4 2" />
            <circle cx="12" cy="12" r="9" fill="url(#glass-grad)" fillOpacity="0.05" />
            <defs>
              <linearGradient id="glass-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--gold)" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
          </svg>
        )
        break
      case 'Assignments':
        svgIcon = (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#42c98f' }}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeDasharray="3,3" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        )
        break
      case 'Research':
        svgIcon = (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#38bdf8' }}>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        )
        break
      case 'Moot Court':
        svgIcon = (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#8b6aeb' }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        )
        break
      case 'Internships':
        svgIcon = (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#f59e42' }}>
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        )
        break
      case "Today's Tasks":
      case 'Weekly Tasks':
      default:
        svgIcon = (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--gold)' }}>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
        )
        break
    }

    return (
      <div className="acad-nav-deadline-empty-state">
        <div className="acad-nav-deadline-empty-icon">
          {svgIcon}
        </div>
        <h4 className="acad-nav-deadline-empty-title">{type} Cleared</h4>
        <p className="acad-nav-deadline-empty-text">{message}</p>
      </div>
    )
  }

  const renderDeadlineWidget = (title: string, items: CalendarEventRecord[], emptyMessage: string) => {
    if (items.length === 0) {
      return renderEmptyStateIllustration(title, emptyMessage)
    }

    return items.map((event) => {
      const diffDays = daysUntil(event.event_date)
      const urgencyClass = diffDays < 4 || event.priority === 'Critical' ? 'urgency-critical' : diffDays < 10 || event.priority === 'High' ? 'urgency-moderate' : 'urgency-safe'
      return (
        <article key={event.id} className="acad-nav-deadline-card">
          <span className={`acad-nav-deadline-urgency ${urgencyClass}`}>{event.priority || 'Medium'}</span>
          <h4 className="acad-nav-deadline-title">{event.title}</h4>
          <div className="acad-nav-deadline-sub">
            <span>{event.subject || 'General'}</span>
            <span>{diffDays > 0 ? `${diffDays} days left` : diffDays === 0 ? 'Today' : 'Overdue'}</span>
          </div>
        </article>
      )
    })
  }

  const renderTaskWidget = (title: string, items: AcademicTask[], emptyMessage: string) => {
    if (items.length === 0) {
      return renderEmptyStateIllustration(title, emptyMessage)
    }

    return items.map((task) => (
      <article
        key={task.id}
        className="acad-nav-deadline-card"
        style={{ cursor: 'pointer' }}
        onClick={() => toggleTaskMutation.mutate(task)}
      >
        <span className={`acad-nav-deadline-urgency ${task.priority === 'Critical' ? 'urgency-critical' : task.priority === 'High' ? 'urgency-moderate' : 'urgency-safe'}`}>
          {task.priority || 'Medium'}
        </span>
        <h4 className="acad-nav-deadline-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--gold)' }} />
          {task.title}
        </h4>
        <div className="acad-nav-deadline-sub">
          <span>{task.task_type.replace('_', ' ')}</span>
          <span>{task.target_date}</span>
        </div>
      </article>
    ))
  }

  const renderCalendarAndCareerTracker = () => {
    const combinedList = [
      ...internships.map((intern) => ({
        id: intern.id,
        type: 'career' as const,
        title: intern.organization,
        subtitle: intern.position,
        date: intern.deadline,
        status: intern.status,
        notes: intern.notes,
        raw: intern,
        time: undefined
      })),
      ...events.map((evt) => ({
        id: evt.id,
        type: 'event' as const,
        title: evt.title,
        subtitle: categoryOptions.find((o) => o.value === getCategory(evt))?.label || 'Event',
        date: evt.event_date,
        time: evt.event_time,
        status: `Priority: ${evt.priority || 'Medium'}`,
        notes: evt.description,
        raw: evt
      }))
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    return (
      <div className="acad-nav-bottom-panel-inner" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '8px' }}>
          <h3 className="acad-nav-panel-title" style={{ border: 'none', padding: 0, margin: 0 }}>
            <Briefcase size={15} style={{ color: 'var(--gold)' }} /> Calender and career Tracker™
          </h3>
          <button type="button" className="acad-nav-btn" style={{ padding: '2px 8px', fontSize: '0.7rem' }} onClick={() => setShowInternForm(!showInternForm)}>
            Add Row
          </button>
        </div>

        {showInternForm && (
          <div className="acad-nav-tracker-form-container" style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255, 255, 255, 0.02)', padding: '14px', borderRadius: '8px', border: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--line)', paddingBottom: '8px', marginBottom: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text)', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="tracker_entry_type" 
                  checked={trackerEntryType === 'career'} 
                  onChange={() => setTrackerEntryType('career')} 
                  style={{ accentColor: 'var(--gold)' }}
                />
                Career (Internship)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text)', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="tracker_entry_type" 
                  checked={trackerEntryType === 'event'} 
                  onChange={() => setTrackerEntryType('event')}
                  style={{ accentColor: 'var(--gold)' }}
                />
                Calendar Event
              </label>
            </div>

            {trackerEntryType === 'career' ? (
              <form onSubmit={(event) => { event.preventDefault(); addInternshipMutation.mutate() }} className="acad-nav-intern-form" style={{ display: 'grid', gap: '10px' }}>
                <input placeholder="Company Name" required value={newIntern.organization} onChange={(event) => setNewIntern({ ...newIntern, organization: event.target.value })} style={{ width: '100%' }} />
                <input placeholder="Role" required value={newIntern.position} onChange={(event) => setNewIntern({ ...newIntern, position: event.target.value })} style={{ width: '100%' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <select value={newIntern.status} onChange={(event) => setNewIntern({ ...newIntern, status: event.target.value as InternshipStatus })} style={{ width: '100%' }}>
                    {internshipStatusOptions.map((status) => <option key={status}>{status}</option>)}
                  </select>
                  <input type="date" aria-label="Application Date" value={newIntern.deadline} onChange={(event) => setNewIntern({ ...newIntern, deadline: event.target.value })} style={{ width: '100%' }} />
                </div>
                <textarea placeholder="Notes" value={newIntern.notes} onChange={(event) => setNewIntern({ ...newIntern, notes: event.target.value })} style={{ width: '100%', minHeight: '60px' }} />
                <button type="submit" className="acad-nav-btn acad-nav-save-btn" disabled={addInternshipMutation.isPending}>
                  {addInternshipMutation.isPending ? 'Saving...' : 'Save Application'}
                </button>
              </form>
            ) : (
              <form onSubmit={(event) => { event.preventDefault(); createEventMutation.mutate() }} className="acad-nav-intern-form" style={{ display: 'grid', gap: '10px' }}>
                <input placeholder="Event Title (e.g. Constitutional Law Exam)" required value={newEvent.title} onChange={(event) => setNewEvent({ ...newEvent, title: event.target.value })} style={{ width: '100%' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <select value={newEvent.category} onChange={(event) => setNewEvent({ ...newEvent, category: event.target.value as CalendarCategory })} style={{ width: '100%' }}>
                    {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <select value={newEvent.priority} onChange={(event) => setNewEvent({ ...newEvent, priority: event.target.value as Priority })} style={{ width: '100%' }}>
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <input type="date" value={newEvent.startDate} onChange={(event) => setNewEvent({ ...newEvent, startDate: event.target.value, endDate: event.target.value })} style={{ width: '100%' }} />
                  <input type="time" value={newEvent.time} onChange={(event) => setNewEvent({ ...newEvent, time: event.target.value })} style={{ width: '100%' }} />
                </div>
                <textarea placeholder="Description" value={newEvent.description} onChange={(event) => setNewEvent({ ...newEvent, description: event.target.value })} style={{ width: '100%', minHeight: '60px' }} />
                <button type="submit" className="acad-nav-btn acad-nav-save-btn" disabled={createEventMutation.isPending}>
                  {createEventMutation.isPending ? 'Saving...' : 'Save Event'}
                </button>
              </form>
            )}
          </div>
        )}

        <div className="acad-nav-intern-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {combinedList.map((item) => (
            <div key={item.id} className="acad-nav-intern-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px', background: 'rgba(255, 255, 255, 0.015)', border: '1px solid var(--line)', borderRadius: '8px', gap: '10px' }}>
              {item.type === 'career' && editingInternshipId === item.id ? (
                <form onSubmit={(event) => { event.preventDefault(); updateInternshipMutation.mutate() }} className="acad-nav-intern-form" style={{ width: '100%', display: 'grid', gap: '10px' }}>
                  <input placeholder="Company Name" required value={editIntern.organization} onChange={(event) => setEditIntern({ ...editIntern, organization: event.target.value })} />
                  <input placeholder="Role" required value={editIntern.position} onChange={(event) => setEditIntern({ ...editIntern, position: event.target.value })} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <select value={editIntern.status} onChange={(event) => setEditIntern({ ...editIntern, status: event.target.value as InternshipStatus })}>
                      {internshipStatusOptions.map((status) => <option key={status}>{status}</option>)}
                    </select>
                    <input type="date" aria-label="Application Date" value={editIntern.deadline} onChange={(event) => setEditIntern({ ...editIntern, deadline: event.target.value })} />
                  </div>
                  <textarea placeholder="Notes" value={editIntern.notes} onChange={(event) => setEditIntern({ ...editIntern, notes: event.target.value })} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="submit" className="acad-nav-btn acad-nav-save-btn" disabled={updateInternshipMutation.isPending}>{updateInternshipMutation.isPending ? 'Saving...' : 'Save'}</button>
                    <button type="button" className="acad-nav-btn" onClick={() => setEditingInternshipId(null)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {item.type === 'event' ? (
                        <CalendarDays size={13} style={{ color: 'var(--gold)' }} />
                      ) : (
                        <Briefcase size={13} style={{ color: 'var(--gold)' }} />
                      )}
                      <strong style={{ color: 'var(--text)', fontSize: '0.86rem' }}>{item.title}</strong>
                    </div>
                    <span style={{ color: 'var(--text-soft)', fontSize: '0.72rem' }}>
                      {item.subtitle} · {item.date} {item.time ? `· ${item.time}` : ''}
                    </span>
                    {item.notes && <p style={{ margin: '4px 0 0 0', color: 'var(--text-soft)', fontSize: '0.74rem', whiteSpace: 'pre-wrap' }}>{item.notes}</p>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`acad-nav-intern-status ${
                      item.type === 'career'
                        ? (item.status === 'Applied' ? 'status-applied' : item.status === 'Selected' ? 'status-offer' : item.status === 'Rejected' ? 'status-rejected' : 'status-interview')
                        : (item.status.includes('Critical') ? 'status-rejected' : item.status.includes('High') ? 'status-interview' : 'status-applied')
                    }`} style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px' }}>
                      {item.status}
                    </span>
                    {item.type === 'career' ? (
                      <>
                        <button type="button" className="acad-nav-btn acad-nav-btn-icon" onClick={() => startEditingInternship(item.raw)} aria-label="Edit internship" style={{ padding: '4px' }}><Pencil size={12} /></button>
                        <button type="button" className="acad-nav-btn acad-nav-btn-icon" onClick={() => deleteInternshipMutation.mutate(item.raw)} aria-label="Delete internship" disabled={deleteInternshipMutation.isPending} style={{ padding: '4px' }}><Trash2 size={12} /></button>
                      </>
                    ) : (
                      <button type="button" className="acad-nav-btn acad-nav-btn-icon" onClick={() => handleDeleteEvent(item.id, item.raw.google_event_id)} aria-label="Delete event" style={{ padding: '4px' }}><Trash2 size={12} /></button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
          {!combinedList.length && <p style={{ color: 'var(--text-soft)', fontSize: '0.78rem' }}>No activities or calendar events have been saved yet.</p>}
        </div>
      </div>
    )
  }
  const userName = userQuery.data?.fullName || userQuery.data?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'Scholar'

  return (
    <div className="acad-nav-container">
      <header className="acad-nav-header">
        <div className="acad-nav-title-group">
          <h2>{isExamCalendar ? 'Exam Calendar' : isCareerTracker ? 'Calender and career Tracker\u2122' : 'Academic Navigator\u2122'}</h2>
          <p>{isExamCalendar ? 'Exam dates, study sessions, reminders, and Google Calendar sync' : isCareerTracker ? 'Calendar and internship activity tracker' : 'Planning and productivity hub for today\'s academic work'}</p>
        </div>
        <div className="google-calendar-connection-panel" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {checkingGoogleStatus ? (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-soft)' }}>Checking connection...</span>
          ) : googleConnected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ display: 'block', fontSize: '0.72rem', color: '#4ade80', fontWeight: 'bold' }}>CONNECTED</span>
                <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-soft)' }}>Google Calendar Synced</span>
              </div>
              <button
                type="button"
                className="acad-nav-btn"
                onClick={handleDisconnectCalendar}
                style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#fca5a5' }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ display: 'block', fontSize: '0.72rem', color: '#f87171', fontWeight: 'bold' }}>NOT CONNECTED</span>
                <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-soft)' }}>Connect Calendar</span>
              </div>
              <button
                type="button"
                className="acad-nav-btn"
                onClick={handleConnectCalendar}
              >
                Connect Calendar
              </button>
            </div>
          )}
        </div>
      </header>

      {!isCalendarSurface && (
        <>
          <section className="acad-nav-command-center" style={{ padding: '18px' }}>
            <div className="acad-nav-command-left">
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '10px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', flexShrink: 0, border: '1.5px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {renderAvatar(dbUserAvatar, undefined, undefined, '100%')}
                </div>
                <div>
                  <span className="acad-nav-eyebrow" style={{ display: 'block', margin: 0 }}>Daily Command Center</span>
                  <h3 style={{ margin: '4px 0 0 0', fontSize: '1.25rem', fontWeight: 800 }}>Good Morning {userName}</h3>
                </div>
              </div>

              <div className="acad-nav-command-progress" style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-soft)' }}>Productivity Score</span>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--text)' }}>{productivityScore}%</strong>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'var(--line)', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                  <div style={{ width: `${productivityScore}%`, height: '100%', background: 'var(--gold)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-soft)' }}>
                  <span>Consistency: {consistencyScore}%</span>
                  <span>Streak: {studyStreak} days</span>
                </div>
              </div>
            </div>

            <div className="acad-nav-ai-card">
              <div className="acad-nav-ai-header">
                <div className="acad-nav-ai-avatar">
                  <Sparkles size={16} />
                </div>
                <div className="acad-nav-ai-intro">
                  <h4>LexMentor AI Assistant™</h4>
                  <p>Real-time personalized study planning & performance analytics</p>
                </div>
              </div>
              <div className="acad-nav-ai-suggestion-box" ref={aiSuggestionRef}>
                {lexMentorResponse}
              </div>
              <div className="acad-nav-ai-actions">
                <button
                  type="button"
                  className={`acad-nav-btn ${aiMode === 'plan' ? 'active' : ''}`}
                  onClick={() => selectAiMode('plan')}
                  style={{
                    background: aiMode === 'plan' ? 'rgba(245, 193, 79, 0.16)' : 'rgba(255,255,255,0.02)',
                    border: aiMode === 'plan' ? '1px solid var(--gold)' : '1px solid var(--line)',
                    color: aiMode === 'plan' ? 'var(--text)' : 'var(--text-soft)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    fontSize: '0.74rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Daily Plan
                </button>
                <button
                  type="button"
                  className={`acad-nav-btn ${aiMode === 'roadmap' ? 'active' : ''}`}
                  onClick={() => selectAiMode('roadmap')}
                  style={{
                    background: aiMode === 'roadmap' ? 'rgba(245, 193, 79, 0.16)' : 'rgba(255,255,255,0.02)',
                    border: aiMode === 'roadmap' ? '1px solid var(--gold)' : '1px solid var(--line)',
                    color: aiMode === 'roadmap' ? 'var(--text)' : 'var(--text-soft)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    fontSize: '0.74rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Weekly Roadmap
                </button>
                <button
                  type="button"
                  className={`acad-nav-btn ${aiMode === 'revision' ? 'active' : ''}`}
                  onClick={() => selectAiMode('revision')}
                  style={{
                    background: aiMode === 'revision' ? 'rgba(245, 193, 79, 0.16)' : 'rgba(255,255,255,0.02)',
                    border: aiMode === 'revision' ? '1px solid var(--gold)' : '1px solid var(--line)',
                    color: aiMode === 'revision' ? 'var(--text)' : 'var(--text-soft)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    fontSize: '0.74rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Revision Plan
                </button>
                <button
                  type="button"
                  className={`acad-nav-btn ${aiMode === 'priority' ? 'active' : ''}`}
                  onClick={() => selectAiMode('priority')}
                  style={{
                    background: aiMode === 'priority' ? 'rgba(245, 193, 79, 0.16)' : 'rgba(255,255,255,0.02)',
                    border: aiMode === 'priority' ? '1px solid var(--gold)' : '1px solid var(--line)',
                    color: aiMode === 'priority' ? 'var(--text)' : 'var(--text-soft)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    fontSize: '0.74rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Priorities
                </button>
              </div>
            </div>
          </section>



      <section className="acad-nav-intelligence-grid" style={{ gridTemplateColumns: '1fr' }}><div className="acad-nav-bottom-panel">
          <h3 className="acad-nav-panel-title"><BookOpen size={15} style={{ color: 'var(--gold)' }} /> Pending Topics Tracker</h3>
          <div className="acad-nav-topic-stats">
            <article><strong>{completedTopics.length}</strong><span>Completed Topics</span></article>
            <article><strong>{pendingTopics.length}</strong><span>Pending Topics</span></article>
            <article><strong>{overdueTopics.length}</strong><span>Overdue Topics</span></article>
          </div>
          <div className="acad-nav-topic-list">
            {pendingNonTopicTasks.slice(0, 5).map((task) => (
              <button key={task.id} type="button" onClick={() => toggleTaskMutation.mutate(task)}>
                <span>{task.title}</span>
                <small>{task.target_date}</small>
              </button>
            ))}
            {pendingExamTopics.slice(0, Math.max(0, 5 - pendingNonTopicTasks.length)).map((topic) => {
              const matchingTask = tasks.find((task) =>
                task.status === 'pending' &&
                task.title.replace(/^Pending topic:\s*/i, '').trim().toLowerCase() === topic.title.toLowerCase()
              )
              return (
              <button
                key={topic.id}
                type="button"
                disabled={!matchingTask || toggleTaskMutation.isPending}
                onClick={() => matchingTask && toggleTaskMutation.mutate(matchingTask)}
              >
                <span>{topic.title}</span>
                <small>{topic.status} - {topic.mastery_score}% mastery</small>
              </button>
              )
            })}
            {!pendingTopics.length && <p className="acad-nav-empty">No pending LexMentor topics.</p>}
          </div>
        </div>
      </section>
        </>
      )}

      {isCalendarSurface && (
      <section className="acad-nav-main-layout">
        <div className="acad-nav-calendar-card">
          <header className="acad-nav-calendar-header">
            <div className="acad-nav-calendar-nav">
              <button type="button" className="acad-nav-btn acad-nav-btn-icon" onClick={() => setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={16} /></button>
              <h3 className="acad-nav-month-title">{monthNames[month]} {year}</h3>
              <button type="button" className="acad-nav-btn acad-nav-btn-icon" onClick={() => setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={16} /></button>
              <button type="button" className="acad-nav-btn" onClick={() => { setCurrentDate(new Date()); setSelectedDate(todayString); setNewEvent({ ...newEvent, startDate: todayString, endDate: todayString }) }}>Today</button>
            </div>
            <div className="acad-nav-calendar-filter">
              <span>Filter:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="All">All Categories</option>
                <option value="Exams">Exams</option>
                <option value="Study">Study</option>
                <option value="Revision">Revision</option>
                <option value="Moot Court">Moot Court</option>
                <option value="Internship">Internships</option>
                <option value="Hackathon">Hackathons</option>
                <option value="Project">Projects</option>
                <option value="Personal">Personal</option>
                <option value="Research">Research</option>
              </select>
            </div>
            <div className="acad-nav-view-toggles">
              {(['Month', 'Week', 'Agenda'] as NavigatorViewMode[]).map((mode) => (
                <button key={mode} type="button" className={`acad-nav-toggle-btn ${viewMode === mode ? 'active' : ''}`} onClick={() => setViewMode(mode)}>
                  {mode}
                </button>
              ))}
            </div>
          </header>

          {!isCalendarSurface && (
            <div className="acad-nav-stats-grid" style={{ gridTemplateColumns: 'repeat(5, minmax(120px, 1fr))', marginBottom: '14px' }}>
            {trackerDashboardCards.map((card) => (
              <article key={card.label} className="acad-nav-stat-card">
                <span className="acad-nav-stat-label">{card.label}</span>
                <strong className="acad-nav-stat-value">{card.value}</strong>
                <span className="acad-nav-stat-sub">{card.sub}</span>
              </article>
            ))}
            </div>
          )}
          {calendarEventsQuery.error && <p className="acad-nav-error">Calendar data could not load: {(calendarEventsQuery.error as Error).message}</p>}

          {renderCalendarBody()}

          <div style={{ borderTop: '1px solid var(--line)', paddingTop: '12px', marginTop: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.86rem', color: 'var(--text-soft)' }}>Agenda for <strong>{selectedDate}</strong>:</span>
              <button type="button" className="acad-nav-btn" style={{ padding: '4px 10px', fontSize: '0.74rem' }} onClick={() => setShowEventForm(!showEventForm)}>
                <Plus size={12} /> Add Event
              </button>
            </div>

            {showEventForm && renderEventForm()}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {selectedDateEvents.length > 0 ? selectedDateEvents.map((event) => (
                <div key={event.id} className="acad-nav-agenda-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '4px', height: '28px', borderRadius: '2px', background: event.priority === 'Critical' ? '#e85d5d' : event.priority === 'High' ? 'var(--gold)' : '#42c98f' }} />
                    <div>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{event.title}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', marginLeft: '10px' }}>{categoryOptions.find((item) => item.value === getCategory(event))?.label}</span>
                      {event.description && <p>{event.description}</p>}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-soft)', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> {event.event_time}</span>
                </div>
              )) : <p style={{ fontSize: '0.78rem', color: 'var(--text-soft)', margin: '4px 0 0 0' }}>No scheduled academic events for this date.</p>}
            </div>
          </div>
        </div>

        {isCareerTracker ? (
          <aside className="acad-nav-deadlines-panel">
            {renderCalendarAndCareerTracker()}
          </aside>
        ) : (
          <aside className="acad-nav-deadlines-panel">
          <h3 className="acad-nav-deadlines-header">
            <AlertCircle size={16} style={{ color: 'var(--gold)' }} /> Activity Dashboard™
          </h3>
          
          <div className="acad-nav-deadline-tabs">
            <button
              type="button"
              className={`acad-nav-deadline-tab-btn ${activeDeadlineTab === 'exams' ? 'active' : ''}`}
              onClick={() => setActiveDeadlineTab('exams')}
              title="Upcoming Exams"
            >
              <FileText size={16} />
              <span className="tab-label">Exams</span>
              <span className="tab-count">{examDeadlines.length}</span>
            </button>
            <button
              type="button"
              className={`acad-nav-deadline-tab-btn ${activeDeadlineTab === 'assignments' ? 'active' : ''}`}
              onClick={() => setActiveDeadlineTab('assignments')}
              title="Pending Assignments"
            >
              <Target size={16} />
              <span className="tab-label">Assigns</span>
              <span className="tab-count">{assignmentDeadlines.length}</span>
            </button>
            <button
              type="button"
              className={`acad-nav-deadline-tab-btn ${activeDeadlineTab === 'research' ? 'active' : ''}`}
              onClick={() => setActiveDeadlineTab('research')}
              title="Research Deadlines"
            >
              <BookOpen size={16} />
              <span className="tab-label">Research</span>
              <span className="tab-count">{researchDeadlines.length}</span>
            </button>
            <button
              type="button"
              className={`acad-nav-deadline-tab-btn ${activeDeadlineTab === 'moot' ? 'active' : ''}`}
              onClick={() => setActiveDeadlineTab('moot')}
              title="Moot Court Deadlines"
            >
              <Gavel size={16} />
              <span className="tab-label">Moots</span>
              <span className="tab-count">{mootDeadlines.length}</span>
            </button>
            <button
              type="button"
              className={`acad-nav-deadline-tab-btn ${activeDeadlineTab === 'internship' ? 'active' : ''}`}
              onClick={() => setActiveDeadlineTab('internship')}
              title="Internship Activity"
            >
              <Briefcase size={16} />
              <span className="tab-label">Interns</span>
              <span className="tab-count">{internshipDeadlines.length}</span>
            </button>
            <button
              type="button"
              className={`acad-nav-deadline-tab-btn ${activeDeadlineTab === 'today' ? 'active' : ''}`}
              onClick={() => setActiveDeadlineTab('today')}
              title="Today's Tasks"
            >
              <Clock size={16} />
              <span className="tab-label">Today</span>
              <span className="tab-count">{todayTasksDeadlines.length}</span>
            </button>
            <button
              type="button"
              className={`acad-nav-deadline-tab-btn ${activeDeadlineTab === 'weekly' ? 'active' : ''}`}
              onClick={() => setActiveDeadlineTab('weekly')}
              title="Weekly Tasks"
            >
              <CalendarDays size={16} />
              <span className="tab-label">Weekly</span>
              <span className="tab-count">{weeklyTasksDeadlines.length}</span>
            </button>
          </div>

          <div className="acad-nav-deadline-list">
            {activeDeadlineTab === 'exams' && renderDeadlineWidget('Exams', examDeadlines, 'No upcoming exams. Ready to conquer your courses!')}
            {activeDeadlineTab === 'assignments' && renderDeadlineWidget('Assignments', assignmentDeadlines, 'Zero pending assignments. Outstanding efficiency!')}
            {activeDeadlineTab === 'research' && renderDeadlineWidget('Research', researchDeadlines, 'No research drafts pending. Library stack clear.')}
            {activeDeadlineTab === 'moot' && renderDeadlineWidget('Moot Court', mootDeadlines, 'Zero moot court milestones. Courtroom rest mode active.')}
            {activeDeadlineTab === 'internship' && renderDeadlineWidget('Internship Activity', internshipDeadlines, 'No internship activity pending.')}
            {activeDeadlineTab === 'today' && renderTaskWidget("Today's Tasks", todayTasksDeadlines, 'Your slate is clean for today. Enjoy the peace!')}
            {activeDeadlineTab === 'weekly' && renderTaskWidget('Weekly Milestones', weeklyTasksDeadlines, 'All weekly objectives accomplished. Excellent sync.')}
          </div>
        </aside>
        )}
      </section>
      )}

      {!isCalendarSurface && (
        <>
          <section className="acad-nav-bottom-grid" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
            <div className="acad-nav-bottom-panel">
              <h3 className="acad-nav-panel-title"><Clock size={15} style={{ color: 'var(--gold)' }} /> Today's Tasks</h3>
              <div className="acad-nav-deadline-list">
                {renderTaskWidget("Today's Tasks", todayTasksDeadlines, 'Your slate is clean for today.')}
              </div>
            </div>
            <div className="acad-nav-bottom-panel">
              {renderCalendarAndCareerTracker()}
            </div>
          </section>

      
          <section className="acad-nav-operating-grid" style={{ gridTemplateColumns: '1.1fr 1fr' }}>
        <div className="acad-nav-bottom-panel">
          <h3 className="acad-nav-panel-title"><Bell size={15} style={{ color: 'var(--gold)' }} /> Notification Center</h3>
          <div className="acad-nav-notification-toolbar">
            <span>{unreadNotificationCount} unread</span>
            <button
              type="button"
              className="acad-nav-btn"
              style={{ width: 'fit-content', fontSize: '0.72rem' }}
              disabled={!unreadNotificationCount || markNotificationsReadMutation.isPending}
              onClick={() => markNotificationsReadMutation.mutate()}
            >
              {markNotificationsReadMutation.isPending ? 'Marking...' : 'Mark All Read'}
            </button>
          </div>
          <div className="acad-nav-notification-list">
            {notifications.slice(0, 7).map((notice) => (
              <article key={notice.id} className={`acad-nav-notification ${notice.is_read ? '' : 'unread'}`}>
                <div className="acad-nav-notification-heading">
                  <strong>{notice.title}</strong>
                  <span>{notice.is_read ? 'Read' : 'Unread'}</span>
                </div>
                <span>{notice.message}</span>
                <small>{new Date(notice.trigger_time).toLocaleString()}</small>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  {!notice.is_read && (
                    <button
                      type="button"
                      className="acad-nav-btn"
                      style={{ width: 'fit-content', fontSize: '0.68rem' }}
                      onClick={() => markNotificationReadMutation.mutate(notice.id)}
                    >
                      Mark Read
                    </button>
                  )}
                  <button
                    type="button"
                    className="acad-nav-btn"
                    style={{ width: 'fit-content', fontSize: '0.68rem' }}
                    onClick={() => deleteNotificationMutation.mutate(notice.id)}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </article>
            ))}
            {!notifications.length && <p style={{ color: 'var(--text-soft)', fontSize: '0.78rem' }}>Notifications will trigger from deadlines, missed sessions, and reminders.</p>}
          </div>
        </div>
      </section>

      <footer className="acad-nav-banner-quote">
        <p>"The law is not a monument, but a constant progression toward equity and systemic balance."</p>
        <cite>— Oliver Wendell Holmes Jr.</cite>
      </footer>
        </>
      )}

      {selectedEventForPopup && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-card" style={{
            maxWidth: '500px',
            width: '100%',
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)' }}>
                {isEditingPopupEvent ? 'Edit Academic Event' : 'Academic Event Details'}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedEventForPopup(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-soft)', cursor: 'pointer' }}
              >
                <ChevronLeft size={20} />
              </button>
            </div>

            {isEditingPopupEvent ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase' }}>Title</label>
                  <input
                    type="text"
                    value={popupEventTitle}
                    onChange={(e) => setPopupEventTitle(e.target.value)}
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text)', padding: '8px 10px', fontSize: '0.88rem' }}
                  />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase' }}>Time</label>
                    <input
                      type="time"
                      value={popupEventTime}
                      onChange={(e) => setPopupEventTime(e.target.value)}
                      style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text)', padding: '8px 10px', fontSize: '0.88rem' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase' }}>Priority</label>
                    <select
                      value={popupEventPriority}
                      onChange={(e) => setPopupEventPriority(e.target.value as Priority)}
                      style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text)', padding: '8px 10px', fontSize: '0.88rem' }}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase' }}>Category</label>
                  <select
                    value={popupEventCategory}
                    onChange={(e) => setPopupEventCategory(e.target.value as CalendarCategory)}
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text)', padding: '8px 10px', fontSize: '0.88rem' }}
                  >
                    {categoryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase' }}>Description</label>
                  <textarea
                    rows={3}
                    value={popupEventDescription}
                    onChange={(e) => setPopupEventDescription(e.target.value)}
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text)', padding: '8px 10px', fontSize: '0.88rem', resize: 'vertical' }}
                  />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', color: '#fff' }}>{selectedEventForPopup.title}</h4>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                    <span className="acad-nav-intern-status status-applied" style={{ background: 'rgba(245, 193, 79, 0.1)', color: 'var(--gold)', border: '1px solid rgba(245,193,79,0.2)' }}>
                      {categoryOptions.find(opt => opt.value === getCategory(selectedEventForPopup))?.label || 'General'}
                    </span>
                    <span className="acad-nav-intern-status status-interview" style={{
                      background: selectedEventForPopup.priority === 'Critical' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                      color: selectedEventForPopup.priority === 'Critical' ? '#fca5a5' : 'var(--text-soft)'
                    }}>
                      Priority: {selectedEventForPopup.priority || 'Medium'}
                    </span>
                    {selectedEventForPopup.is_synced && (
                      <span className="acad-nav-intern-status status-offer" style={{ background: 'rgba(74, 222, 128, 0.15)', color: '#4ade80' }}>
                        Google Synced
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--line)', borderRadius: '8px', padding: '12px', fontSize: '0.86rem', color: 'var(--text-soft)' }}>
                  <strong>Date:</strong> {selectedEventForPopup.event_date}<br/>
                  <strong>Time:</strong> {selectedEventForPopup.event_time}<br/>
                  {selectedEventForPopup.subject && <><strong>Subject:</strong> {selectedEventForPopup.subject}</>}
                </div>

                {selectedEventForPopup.description && (
                  <div>
                    <h5 style={{ margin: '0 0 4px 0', fontSize: '0.78rem', color: 'var(--text-soft)', textTransform: 'uppercase' }}>Description</h5>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-soft)', whiteSpace: 'pre-wrap', lineHeight: '1.45' }}>
                      {selectedEventForPopup.description}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--line)', paddingTop: '16px', marginTop: '4px' }}>
              {isEditingPopupEvent ? (
                <>
                  <button
                    type="button"
                    className="acad-nav-btn"
                    onClick={() => setIsEditingPopupEvent(false)}
                    style={{ padding: '8px 16px', fontSize: '0.84rem' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="acad-nav-btn acad-nav-save-btn"
                    onClick={handleSaveEventEdits}
                    style={{ padding: '8px 16px', fontSize: '0.84rem' }}
                  >
                    Save Changes
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="acad-nav-btn"
                    onClick={() => handleDeleteEvent(selectedEventForPopup.id, selectedEventForPopup.google_event_id)}
                    style={{ padding: '8px 16px', fontSize: '0.84rem', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ffa4a4' }}
                  >
                    Delete Event
                  </button>
                  <button
                    type="button"
                    className="acad-nav-btn"
                    onClick={() => setIsEditingPopupEvent(true)}
                    style={{ padding: '8px 16px', fontSize: '0.84rem', color: 'var(--gold)', borderColor: 'rgba(245,193,79,0.3)' }}
                  >
                    Edit Details
                  </button>
                  <button
                    type="button"
                    className="acad-nav-btn acad-nav-save-btn"
                    onClick={() => setSelectedEventForPopup(null)}
                    style={{ padding: '8px 16px', fontSize: '0.84rem' }}
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}





















