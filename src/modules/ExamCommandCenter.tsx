import { API_BASE_URL } from '../lib/api'
import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Award,
  Bell,
  BookMarked,
  Brain,
  CalendarDays,
  Flame,
  Layers,
  LineChart,
  Play,
  RefreshCcw,
  Send,
  Sparkles,
  Swords,
  Target,
  Timer,
  TrendingUp,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './ExamCommandCenter.css'
import AcademicNavigator from './AcademicNavigator'
import { supabase } from '../lib/supabase-client'
import { useAuth, useUser } from '@clerk/clerk-react'
import { eventBus, EVENTS } from '../lib/event-bus'

type PrepLevel = 'Beginner' | 'Intermediate' | 'Expert'
type Difficulty = 'Easy' | 'Medium' | 'Hard'
type TopicStatus = 'Not Started' | 'In Progress' | 'Completed' | 'Needs Revision'
type PaperType = 'University Style Paper' | 'PYQ Style Paper' | 'MCQ Test' | 'Case Based Questions' | 'Short Notes' | 'Long Questions'
type ForgeAssetType = 'Notes' | 'Flashcards' | 'MCQs' | 'Revision Sheet' | 'One Page Summary'

interface ExamProfile {
  id: string
  subject: string
  subject_name?: string
  exam_date: string
  exam_time?: string
  prep_level: PrepLevel
  syllabus_completion: number
  university?: string
  available_hours_per_day?: number
  difficulty_level?: Difficulty
  credits_weightage?: number
  email_reminder_enabled?: boolean
  email_reminder_minutes?: number
  reminder_type?: string
  reminder_enabled?: boolean
  reminder_trigger_at?: string
}

interface ExamTopic {
  id: string
  exam_id: string
  title: string
  status: TopicStatus
  difficulty: Difficulty
  quiz_score: number
  flashcard_score: number
  mastery_score: number
  pyq_frequency: number
}

interface MockAttempt {
  id: string
  exam_id: string
  paper_type: PaperType
  title: string
  attempt_score: number | null
  time_taken_minutes: number | null
  accuracy: number | null
  scheduled_date: string
  questions: Array<{ id: string; question: string; marks: number; topic: string; answerGuidance?: string[] }>
  responses: Record<string, string>
  evaluation: {
    score?: number
    maxMarks?: number
    percentage?: number
    feedback?: string
    questionFeedback?: Array<{ questionId: string; awardedMarks: number; maxMarks: number; feedback: string }>
    weakTopics?: string[]
  }
  instructions: string[]
  max_marks: number
  status: 'scheduled' | 'in_progress' | 'submitted'
}

interface ReadinessSnapshot {
  readiness_score: number
  revision_progress: number
  mock_scores_avg: number
  study_hours_total: number
  habit_compliance: number
}

interface Recommendation {
  id: string
  content: string
}

interface ForgeAsset {
  id: string
  exam_id: string
  topic_id: string | null
  asset_type: ForgeAssetType
  title: string
  content: { generated_content?: string; citations?: Array<{ title?: string }> }
  created_at: string
}

interface ExamTask {
  id: string
  title: string
  task_type: 'study' | 'revision' | 'daily_target' | 'weekly_roadmap' | 'priority'
  target_date: string
  priority: 'Low' | 'Medium' | 'High' | 'Critical'
  status: 'pending' | 'completed'
  metadata: { examId?: string; source?: string }
}

const todayString = new Date().toISOString().split('T')[0]
const statusOptions: TopicStatus[] = ['Not Started', 'In Progress', 'Completed', 'Needs Revision']
const paperTypes: PaperType[] = ['University Style Paper', 'PYQ Style Paper', 'MCQ Test', 'Case Based Questions', 'Short Notes', 'Long Questions']
const forgeAssets: ForgeAssetType[] = ['Notes', 'Flashcards', 'MCQs', 'Revision Sheet', 'One Page Summary']
const apiBaseUrl = ((import.meta as any).env?.VITE_API_URL || `${API_BASE_URL}`).replace(/\/$/, '')

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

async function getApiError(response: Response, fallback: string) {
  const text = await response.text()
  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed.message) ? parsed.message.join(' ') : parsed.message || fallback
  } catch {
    return text || fallback
  }
}

function topicScore(topic: ExamTopic) {
  const statusScore = topic.status === 'Completed' ? 100 : topic.status === 'In Progress' ? 55 : topic.status === 'Needs Revision' ? 35 : 10
  const difficultyPenalty = topic.difficulty === 'Hard' ? 10 : topic.difficulty === 'Medium' ? 4 : 0
  return clamp(Math.round(statusScore * 0.35 + (topic.quiz_score || 0) * 0.2 + (topic.flashcard_score || 0) * 0.2 + (topic.mastery_score || 0) * 0.25 - difficultyPenalty))
}

function predictedMarks(readiness: number) {
  const low = clamp(readiness - 8, 0, 100)
  const high = clamp(readiness + 8, 0, 100)
  return `${low}-${high} Marks`
}

function riskLevel(readiness: number, days: number) {
  if (readiness < 45 || days <= 3) return 'High'
  if (readiness < 72 || days <= 7) return 'Medium'
  return 'Low'
}

function highYieldTags(topic: ExamTopic) {
  const title = (topic.title || '').toLowerCase()
  const articles = title.includes('fundamental') ? 'Art. 14, 19, 21' : title.includes('emergency') ? 'Art. 352, 356, 360' : title.includes('amend') || title.includes('basic') ? 'Art. 368' : 'Core provisions'
  const cases = title.includes('basic') ? 'Kesavananda Bharati' : title.includes('judicial') ? 'Minerva Mills' : title.includes('right') ? 'Maneka Gandhi, Puttaswamy' : 'Leading university cases'
  return { articles, cases }
}

export default function ExamCommandCenter() {
  const { userId: clerkUserId, getToken } = useAuth()
  const { user } = useUser()
  const queryClient = useQueryClient()

  useEffect(() => {
    const unsubscribes = [
      eventBus.subscribe(EVENTS.EXAM_STRATEGY_GENERATED, () => {
        queryClient.invalidateQueries({ queryKey: ['exam_command_exams'] })
        queryClient.invalidateQueries({ queryKey: ['exam_topics'] })
        queryClient.invalidateQueries({ queryKey: ['exam_mock_attempts'] })
        queryClient.invalidateQueries({ queryKey: ['exam_notifications'] })
        queryClient.invalidateQueries({ queryKey: ['exam_readiness'] })
      }),
      eventBus.subscribe(EVENTS.MOCK_TEST_SUBMITTED, () => {
        queryClient.invalidateQueries({ queryKey: ['exam_mock_attempts'] })
        queryClient.invalidateQueries({ queryKey: ['exam_readiness'] })
        queryClient.invalidateQueries({ queryKey: ['exam_command_exams'] })
      }),
      eventBus.subscribe(EVENTS.TASK_COMPLETED, () => {
        queryClient.invalidateQueries({ queryKey: ['exam_topics'] })
        queryClient.invalidateQueries({ queryKey: ['exam_readiness'] })
      })
    ]
    return () => {
      unsubscribes.forEach(unsub => unsub())
    }
  }, [queryClient])

  const [showCreateExam, setShowCreateExam] = useState(false)
  const [activeExamId, setActiveExamId] = useState('')
  const [mentorQuestion, setMentorQuestion] = useState('')
  const [mentorReply, setMentorReply] = useState('LexMentor Exam Mentor is monitoring readiness, weak topics, mock scores, and revision gaps.')
  const [newExam, setNewExam] = useState({
    subject: '',
    examDate: addDays(todayString, 30),
    examTime: '09:30',
    university: '',
    hoursPerDay: 3,
    difficulty: 'Medium' as Difficulty,
    weightage: 4,
    prepLevel: 'Intermediate' as PrepLevel,
    topics: '',
    emailReminderEnabled: true,
    emailReminderMinutes: 1440,
  })
  const [newTopic, setNewTopic] = useState({ title: '', difficulty: 'Medium' as Difficulty, pyqFrequency: 1 })
  const [mockEntry, setMockEntry] = useState({ paperType: 'University Style Paper' as PaperType, score: 0, timeTaken: 180, accuracy: 0 })
  const [activeMockId, setActiveMockId] = useState('')
  const [mockMessage, setMockMessage] = useState('')
  const [emailTestMessage, setEmailTestMessage] = useState('')
  const [mockAnswers, setMockAnswers] = useState<Record<string, string>>({})
  const [selectedForgeAsset, setSelectedForgeAsset] = useState<ForgeAsset | null>(null)

  const dbUserQuery = useQuery({
    queryKey: ['exam_command_user', clerkUserId],
    enabled: !!clerkUserId,
    queryFn: async () => {
      const userId = await getUserId(clerkUserId)
      return userId
    },
  })
  const dbUserId = dbUserQuery.data || ''

  const examsQuery = useQuery({
    queryKey: ['exam_command_exams', dbUserId],
    enabled: !!dbUserId,
    queryFn: async () => {
      const { data, error } = await supabase.from('exams').select('*').eq('user_id', dbUserId).order('exam_date', { ascending: true })
      if (error) throw error
      return (data || []) as ExamProfile[]
    },
  })

  const exams = examsQuery.data || []
  const activeExam = exams.find((exam) => exam.id === activeExamId) || exams[0]
  const examId = activeExam?.id || ''

  const topicsQuery = useQuery({
    queryKey: ['exam_topics', examId, dbUserId],
    enabled: !!examId && !!dbUserId,
    queryFn: async () => {
      const { data, error } = await supabase.from('exam_topics').select('*').eq('exam_id', examId).eq('user_id', dbUserId).order('created_at', { ascending: true })
      if (error) throw error
      return (data || []) as ExamTopic[]
    },
  })

  const mocksQuery = useQuery({
    queryKey: ['exam_mock_attempts', examId, dbUserId],
    enabled: !!examId && !!dbUserId,
    queryFn: async () => {
      const { data, error } = await supabase.from('exam_mock_attempts').select('*').eq('exam_id', examId).eq('user_id', dbUserId).order('scheduled_date', { ascending: true })
      if (error) throw error
      return (data || []) as MockAttempt[]
    },
  })

  const readinessQuery = useQuery({
    queryKey: ['exam_readiness', examId],
    enabled: !!examId,
    queryFn: async () => {
      const { data, error } = await supabase.from('readiness_snapshots').select('*').eq('exam_id', examId).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (error) throw error
      return data as ReadinessSnapshot | null
    },
  })

  const recommendationsQuery = useQuery({
    queryKey: ['exam_recommendations', dbUserId],
    enabled: !!dbUserId,
    queryFn: async () => {
      const { data, error } = await supabase.from('recommendations').select('*').eq('user_id', dbUserId).eq('target_date', todayString).order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as Recommendation[]
    },
  })

  const notificationsQuery = useQuery({
    queryKey: ['exam_notifications', dbUserId],
    enabled: !!dbUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', dbUserId)
        .lte('trigger_time', new Date().toISOString())
        .order('trigger_time', { ascending: false })
        .limit(8)
      if (error) throw error
      return data || []
    },
    refetchInterval: 60000,
  })

  const forgeAssetsQuery = useQuery({
    queryKey: ['exam_forge_assets', examId, dbUserId],
    enabled: !!examId && !!dbUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exam_forge_assets')
        .select('*')
        .eq('exam_id', examId)
        .eq('user_id', dbUserId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as ForgeAsset[]
    },
  })

  const examTasksQuery = useQuery({
    queryKey: ['exam_command_tasks', examId, dbUserId],
    enabled: !!examId && !!dbUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_ai_tasks')
        .select('id,title,task_type,target_date,priority,status,metadata')
        .eq('user_id', dbUserId)
        .eq('metadata->>examId', examId)
        .order('target_date', { ascending: true })
      if (error) throw error
      return (data || []) as ExamTask[]
    },
  })

  const topics = topicsQuery.data || []
  const mocks = mocksQuery.data || []
  const savedForgeAssets = forgeAssetsQuery.data || []
  const examTasks = examTasksQuery.data || []
  const readiness = readinessQuery.data
  const completedTopics = topics.filter((topic) => topic.status === 'Completed')
  const revisionTopics = topics.filter((topic) => topic.status === 'Needs Revision')
  const weakTopics = [...topics].sort((a, b) => topicScore(a) - topicScore(b)).slice(0, 5)
  const highYieldTopics = [...topics].sort((a, b) => b.pyq_frequency - a.pyq_frequency || (b.difficulty === 'Hard' ? 1 : 0) - (a.difficulty === 'Hard' ? 1 : 0)).slice(0, 6)
  const mockAverage = mocks.filter((mock) => mock.attempt_score !== null).length
    ? Math.round(mocks.filter((mock) => mock.attempt_score !== null).reduce((sum, mock) => sum + Number(mock.attempt_score || 0), 0) / mocks.filter((mock) => mock.attempt_score !== null).length)
    : 0
  const topicCompletion = topics.length ? Math.round((completedTopics.length / topics.length) * 100) : 0
  const revisionConfidence = topics.length ? Math.round((topics.filter((topic) => topic.status === 'Completed' && topic.mastery_score >= 60).length / topics.length) * 100) : 0
  const subjectReadiness = topics.length ? Math.round(topics.reduce((sum, topic) => sum + topicScore(topic), 0) / topics.length) : 0
  const overallReadiness = readiness?.readiness_score ?? clamp(Math.round(subjectReadiness * 0.45 + revisionConfidence * 0.25 + mockAverage * 0.3))
  const daysRemaining = daysUntil(activeExam?.exam_date)
  const risk = riskLevel(overallReadiness, daysRemaining)
  const warRoomActive = !!activeExam && daysRemaining <= 7
  const todayTasks = examTasks.filter((task) => task.target_date <= todayString)
  const generatedRecommendations = activeExam ? [
    weakTopics[0]
      ? `Repair ${weakTopics[0].title}, currently your lowest-readiness topic at ${topicScore(weakTopics[0])}%.`
      : `Add syllabus topics for ${activeExam.subject} to activate weak-topic recommendations.`,
    mocks.some((mock) => mock.attempt_score === null)
      ? `Attempt ${mocks.find((mock) => mock.attempt_score === null)?.title} before the next revision cycle.`
      : mockAverage
        ? `Your mock average is ${mockAverage}%. ${mockAverage < 75 ? 'Schedule another timed paper and review incorrect answers.' : 'Maintain performance with one timed paper this week.'}`
        : `Schedule the first ${activeExam.subject} mock test to establish a performance baseline.`,
    `${daysRemaining} day(s) remain. Complete ${Math.max(1, Math.ceil(topics.filter((topic) => topic.status !== 'Completed').length / Math.max(daysRemaining, 1)))} pending topic(s) per day to finish the syllabus.`,
  ] : []

  const createExamMutation = useMutation({
    mutationFn: async () => {
      if (!newExam.subject.trim()) throw new Error('Subject is required.')
      const userId = await getUserId(clerkUserId)
      const token = await getToken()
      const examDateTime = new Date(`${newExam.examDate}T${newExam.examTime}:00`)
      if (Number.isNaN(examDateTime.getTime()) || examDateTime <= new Date()) {
        throw new Error('Choose a valid exam date and time in the future.')
      }

      const loggedInEmail = user?.primaryEmailAddress?.emailAddress
      const studentName = user?.fullName || loggedInEmail || 'Student'
      if (loggedInEmail) {
        const { error: profileError } = await supabase
          .from('users')
          .update({ email: loggedInEmail })
          .eq('id', userId)
        if (profileError) throw profileError
      }
      
      const response = await fetch(`${apiBaseUrl}/exam`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subject: newExam.subject.trim(),
          examDate: examDateTime.toISOString(),
          prepLevel: newExam.prepLevel,
          syllabusCompletion: 0,
          emailReminderEnabled: newExam.emailReminderEnabled,
          emailReminderMinutes: newExam.emailReminderMinutes,
          examTime: newExam.examTime,
        })
      })
      if (!response.ok) throw new Error('Failed to generate AI Strategy from backend.')
      const orchestrated = await response.json()

      const { data: exam, error } = await supabase.from('exams').insert({
        id: orchestrated.exam.id,
        user_id: userId,
        clerk_user_id: clerkUserId,
        full_name: studentName,
        email: loggedInEmail,
        subject: orchestrated.exam.subject,
        subject_name: orchestrated.exam.subject,
        exam_date: orchestrated.exam.examDate,
        exam_time: newExam.examTime,
        prep_level: orchestrated.exam.prepLevel,
        syllabus_completion: orchestrated.exam.syllabusCompletion,
        university: newExam.university.trim(),
        available_hours_per_day: newExam.hoursPerDay,
        difficulty_level: newExam.difficulty,
        credits_weightage: newExam.weightage,
        email_reminder_enabled: newExam.emailReminderEnabled,
        email_reminder_minutes: newExam.emailReminderMinutes,
        reminder_type: `${newExam.emailReminderMinutes}_minutes`,
        reminder_enabled: newExam.emailReminderEnabled,
        reminder_trigger_at: newExam.emailReminderEnabled
          ? new Date(examDateTime.getTime() - newExam.emailReminderMinutes * 60 * 1000).toISOString()
          : null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
      }).select('*').single()
      if (error) throw error

      const created = exam as ExamProfile

      if (newExam.emailReminderEnabled) {
        const examTime = new Date(created.exam_date)
        const triggerTime = new Date(examTime.getTime() - newExam.emailReminderMinutes * 60 * 1000)
        if (triggerTime <= new Date()) {
          throw new Error('Choose a reminder time that occurs before the exam and is still in the future.')
        }

        const { error: reminderError } = await supabase.from('notifications').insert({
          user_id: userId,
          user: clerkUserId,
          clerk_user_id: clerkUserId,
          exam_id: created.id,
          title: `Exam Reminder: ${created.subject}`,
          message: `${created.subject} exam begins ${examTime.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}.`,
          type: 'exam_reminder',
          trigger_time: triggerTime.toISOString(),
          is_read: false,
          email_sent: false,
          delivery_channel: 'email',
          priority: 'critical',
          delivery_status: 'scheduled',
          email_subject: `LEGATRIXON Exam Reminder - ${created.subject}`,
          email_body: [
            `Hello ${studentName},`,
            '',
            'This is a reminder that your upcoming examination is approaching.',
            '',
            'Subject:',
            created.subject,
            '',
            'Date:',
            examTime.toLocaleDateString(),
            '',
            'Time:',
            examTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
            '',
            'Recommended Action:',
            '',
            '• Review final notes',
            '• Complete revision checklist',
            '• Attempt one mock test',
            '• Revise important judgments and case laws',
            '',
            'Best of luck.',
            '',
            'Team LEGATRIXON™',
            '',
            'Powered by N-CYPHER Pvt. Ltd.',
          ].join('\n'),
        })
        if (reminderError) throw reminderError
      }
      
      const topics = newExam.topics.split('\n').flatMap((line) => line.split(',')).map((topic) => topic.trim()).filter(Boolean)
      if (topics.length) {
        await supabase.from('exam_topics').insert(topics.map((topic, index) => ({
          user_id: userId,
          exam_id: created.id,
          title: topic,
          status: 'Not Started',
          difficulty: index < 2 || /basic|fundamental|judicial|emergency|article|section/i.test(topic) ? 'Hard' : 'Medium',
          pyq_frequency: Math.max(1, 5 - (index % 5)),
        })))
      }

      if (orchestrated.mockTests && orchestrated.mockTests.length) {
        await supabase.from('exam_mock_attempts').insert(orchestrated.mockTests.map((mock: any, index: number) => ({
          id: mock.id,
          user_id: userId,
          exam_id: created.id,
          paper_type: paperTypes[index % paperTypes.length] || 'University Style Paper',
          title: mock.title,
          scheduled_date: mock.date.split('T')[0],
          attempt_score: mock.score,
        })))
      }

      if (orchestrated.roadmap) {
        await supabase.from('roadmaps').insert({
          id: orchestrated.roadmap.id,
          exam_id: created.id,
          data: orchestrated.roadmap.data,
        })
      }

      if (orchestrated.revisionPlan) {
        await supabase.from('revision_plans').insert({
          id: orchestrated.revisionPlan.id,
          exam_id: created.id,
          data: orchestrated.revisionPlan.data,
        })
      }

      if (orchestrated.readiness) {
        const snap = orchestrated.readiness
        await supabase.from('readiness_snapshots').insert({
          id: snap.id,
          exam_id: created.id,
          syllabus_completion: snap.syllabusCompletion,
          mock_scores_avg: snap.mockScoresAvg,
          study_hours_total: snap.studyHoursTotal,
          revision_progress: snap.revisionProgress,
          habit_compliance: snap.habitCompliance,
          readiness_score: snap.readinessScore,
          expected_7_days: snap.expected7Days,
          expected_14_days: snap.expected14Days,
          expected_30_days: snap.expected30Days,
        })
      }

      if (orchestrated.calendarEvents && orchestrated.calendarEvents.length) {
        const creatorName = user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Student';
        await supabase.from('calendar_events').insert(orchestrated.calendarEvents.map((evt: any) => ({
          id: evt.id,
          user_id: userId,
          exam_id: created.id,
          title: evt.title,
          description: evt.description || '',
          event_date: evt.eventDate,
          event_time: evt.eventTime,
          subject: evt.subject,
          event_type: evt.eventType,
          priority: evt.priority || 'Medium',
          category: evt.category || evt.eventType,
          is_synced: evt.isSynced || false,
          google_event_id: evt.googleEventId || null,
          created_by: creatorName,
          clerk_user_id: clerkUserId,
          event_created_at: new Date().toISOString()
        })))
      }

      if (orchestrated.notifications && orchestrated.notifications.length) {
        await supabase.from('notifications').insert(orchestrated.notifications.map((n: any) => ({
          id: n.id,
          user_id: userId,
          user: clerkUserId,
          title: n.title,
          message: n.message,
          type: n.type || 'alert',
          trigger_time: n.triggerTime || new Date().toISOString(),
          is_read: n.isRead || false,
          sent_at: new Date().toISOString(),
          delivery_status: 'sent'
        })))
      }

      const taskRows = [
        ...topics.slice(0, 3).map((topic, index) => ({
          user_id: userId,
          title: `Repair weak topic: ${topic}`,
          task_type: 'study',
          target_date: addDays(todayString, index),
          priority: index === 0 ? 'Critical' : 'High',
          status: 'pending',
          metadata: { examId: created.id, source: 'Exam Command Center' },
        })),
        {
          user_id: userId,
          title: `Complete one ${created.subject} revision block`,
          task_type: 'revision',
          target_date: todayString,
          priority: 'High',
          status: 'pending',
          metadata: { examId: created.id, source: 'Exam Command Center' },
        },
      ]
      if (taskRows.length) {
        const { error: taskError } = await supabase.from('academic_ai_tasks').insert(taskRows)
        if (taskError) throw taskError
      }

      return created
    },
    onSuccess: (exam) => {
      setActiveExamId(exam.id)
      setShowCreateExam(false)
      setNewExam({
        subject: '',
        examDate: addDays(todayString, 30),
        examTime: '09:30',
        university: '',
        hoursPerDay: 3,
        difficulty: 'Medium',
        weightage: 4,
        prepLevel: 'Intermediate',
        topics: '',
        emailReminderEnabled: true,
        emailReminderMinutes: 1440,
      })
      
      eventBus.dispatch(EVENTS.EXAM_STRATEGY_GENERATED, exam)

      queryClient.invalidateQueries({ queryKey: ['exam_command_exams'] })
      queryClient.invalidateQueries({ queryKey: ['academic_navigator_exams'] })
      queryClient.invalidateQueries({ queryKey: ['exams'] })
      queryClient.invalidateQueries({ queryKey: ['exam_topics'] })
      queryClient.invalidateQueries({ queryKey: ['exam_mock_attempts'] })
      queryClient.invalidateQueries({ queryKey: ['exam_notifications'] })
      queryClient.invalidateQueries({ queryKey: ['calendar_events'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const addTopicMutation = useMutation({
    mutationFn: async () => {
      if (!activeExam || !newTopic.title.trim()) throw new Error('Select an exam and enter a topic.')
      const userId = await getUserId(clerkUserId)
      const { error } = await supabase.from('exam_topics').insert({
        user_id: userId,
        exam_id: activeExam.id,
        title: newTopic.title.trim(),
        difficulty: newTopic.difficulty,
        pyq_frequency: newTopic.pyqFrequency,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setNewTopic({ title: '', difficulty: 'Medium', pyqFrequency: 1 })
      eventBus.dispatch(EVENTS.TASK_COMPLETED)
      queryClient.invalidateQueries({ queryKey: ['exam_topics', examId] })
    },
  })

  const updateTopicMutation = useMutation({
    mutationFn: async ({ topic, patch }: { topic: ExamTopic; patch: Partial<ExamTopic> }) => {
      const userId = await getUserId(clerkUserId)
      const { error } = await supabase.from('exam_topics').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', topic.id).eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () => {
      eventBus.dispatch(EVENTS.TASK_COMPLETED)
      queryClient.invalidateQueries({ queryKey: ['exam_topics', examId] })
    },
  })

  const updateMockMutation = useMutation({
    mutationFn: async (mock: MockAttempt) => {
      setMockMessage('')
      const userId = await getUserId(clerkUserId)
      const { error } = await supabase.from('exam_mock_attempts').update({
        paper_type: mockEntry.paperType,
        attempt_score: mockEntry.score,
        time_taken_minutes: mockEntry.timeTaken,
        accuracy: mockEntry.accuracy,
        updated_at: new Date().toISOString(),
      }).eq('id', mock.id).eq('user_id', userId)
      if (error) throw error

      const attemptedScores = mocks
        .filter((item) => item.id !== mock.id && item.attempt_score !== null)
        .map((item) => Number(item.attempt_score))
      attemptedScores.push(mockEntry.score)
      const nextMockAverage = Math.round(attemptedScores.reduce((sum, score) => sum + score, 0) / attemptedScores.length)
      const nextReadiness = clamp(Math.round(subjectReadiness * 0.45 + revisionConfidence * 0.25 + nextMockAverage * 0.3))
      const { error: snapshotError } = await supabase.from('readiness_snapshots').insert({
        exam_id: mock.exam_id,
        syllabus_completion: topicCompletion,
        mock_scores_avg: nextMockAverage,
        study_hours_total: readiness?.study_hours_total || 0,
        revision_progress: revisionConfidence,
        habit_compliance: readiness?.habit_compliance || 0,
        readiness_score: nextReadiness,
        expected_7_days: clamp(nextReadiness + 8),
        expected_14_days: clamp(nextReadiness + 15),
        expected_30_days: clamp(nextReadiness + 25),
      })
      if (snapshotError) throw snapshotError

      ;(window as any).logUserActivity?.('Exam Command Center', 'Completed Mock Test', {
        examId: mock.exam_id,
        paperType: mockEntry.paperType,
        score: mockEntry.score,
        accuracy: mockEntry.accuracy,
      })
    },
    onSuccess: () => {
      setMockMessage('Mock attempt saved. Readiness and mock performance have been recalculated.')
      setActiveMockId('')
      eventBus.dispatch(EVENTS.MOCK_TEST_SUBMITTED)
      queryClient.invalidateQueries({ queryKey: ['exam_mock_attempts', examId] })
      queryClient.invalidateQueries({ queryKey: ['exam_readiness', examId] })
    },
    onError: (error) => {
      setMockMessage(error instanceof Error ? error.message : 'Unable to save the mock attempt.')
    },
  })

  const scheduleMockMutation = useMutation({
    mutationFn: async () => {
      setMockMessage('')
      if (!activeExam) throw new Error('Create or select an exam first.')
      const userId = await getUserId(clerkUserId)
      const scheduledDate = addDays(todayString, Math.max(1, Math.min(7, Math.ceil(Math.max(daysRemaining, 1) / 3))))
      const { data, error } = await supabase.from('exam_mock_attempts').insert({
        user_id: userId,
        exam_id: activeExam.id,
        paper_type: mockEntry.paperType,
        title: `${activeExam.subject} - ${mockEntry.paperType}`,
        scheduled_date: scheduledDate,
      }).select('*').single()
      if (error) throw error
      return data as MockAttempt
    },
    onSuccess: (mock) => {
      setActiveMockId(mock.id)
      setMockMessage(`${mock.paper_type} scheduled for ${mock.scheduled_date}. Enter your score, time, and accuracy, then save the attempt.`)
      queryClient.invalidateQueries({ queryKey: ['exam_mock_attempts', examId] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Unable to generate the mock test.'
      setMockMessage(
        message.includes('exam_mock_attempts')
          ? 'Supabase table exam_mock_attempts is missing. Run the updated Academic Navigator migration in Supabase SQL Editor, then refresh this page.'
          : message
      )
    },
  })

  const generateMockPaperMutation = useMutation({
    mutationFn: async (mock: MockAttempt) => {
      if (!activeExam || !topics.length) throw new Error('Add at least one exam topic before generating a paper.')
      setMockMessage('')
      const response = await fetch(`${apiBaseUrl}/exam/mock-paper/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({
          subject: activeExam.subject,
          paperType: mock.paper_type,
          topics: topics.map((topic) => ({
            title: topic.title,
            difficulty: topic.difficulty,
            pyqFrequency: topic.pyq_frequency,
          })),
        }),
      })
      if (!response.ok) throw new Error(await getApiError(response, 'Unable to generate the mock paper.'))
      const paper = await response.json()
      const userId = await getUserId(clerkUserId)
      const { data, error } = await supabase.from('exam_mock_attempts').update({
        title: paper.title || mock.title,
        questions: paper.questions,
        instructions: paper.instructions || [],
        max_marks: Number(paper.maxMarks || 0),
        time_taken_minutes: Number(paper.durationMinutes || mock.time_taken_minutes || 180),
        status: 'in_progress',
        updated_at: new Date().toISOString(),
      }).eq('id', mock.id).eq('user_id', userId).select('*').single()
      if (error) throw error
      return data as MockAttempt
    },
    onSuccess: (mock) => {
      setActiveMockId(mock.id)
      setMockAnswers(mock.responses || {})
      setMockMessage('Mock paper generated. Your answers can now be saved as a draft or submitted for evaluation.')
      queryClient.invalidateQueries({ queryKey: ['exam_mock_attempts', examId] })
    },
    onError: (error) => setMockMessage(error instanceof Error ? error.message : 'Unable to generate the mock paper.'),
  })

  const saveMockDraftMutation = useMutation({
    mutationFn: async (mock: MockAttempt) => {
      const userId = await getUserId(clerkUserId)
      const { error } = await supabase.from('exam_mock_attempts').update({
        responses: mockAnswers,
        status: 'in_progress',
        updated_at: new Date().toISOString(),
      }).eq('id', mock.id).eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () => {
      setMockMessage('Draft answers saved in Supabase.')
      queryClient.invalidateQueries({ queryKey: ['exam_mock_attempts', examId] })
    },
    onError: (error) => setMockMessage(error instanceof Error ? error.message : 'Unable to save draft answers.'),
  })

  const submitMockPaperMutation = useMutation({
    mutationFn: async (mock: MockAttempt) => {
      if (!activeExam) throw new Error('No active exam selected.')
      setMockMessage('')
      const response = await fetch(`${apiBaseUrl}/exam/mock-paper/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({
          subject: activeExam.subject,
          paperType: mock.paper_type,
          questions: mock.questions,
          answers: mockAnswers,
        }),
      })
      if (!response.ok) throw new Error(await getApiError(response, 'Unable to evaluate the mock paper.'))
      const evaluation = await response.json()
      const userId = await getUserId(clerkUserId)
      const percentage = clamp(Math.round(Number(evaluation.percentage || 0)))
      const { error } = await supabase.from('exam_mock_attempts').update({
        responses: mockAnswers,
        evaluation,
        attempt_score: percentage,
        accuracy: percentage,
        status: 'submitted',
        updated_at: new Date().toISOString(),
      }).eq('id', mock.id).eq('user_id', userId)
      if (error) throw error
      return percentage
    },
    onSuccess: (percentage) => {
      setMockMessage(`Mock submitted and evaluated: ${percentage}%.`)
      eventBus.dispatch(EVENTS.MOCK_TEST_SUBMITTED)
      queryClient.invalidateQueries({ queryKey: ['exam_mock_attempts', examId] })
    },
    onError: (error) => setMockMessage(error instanceof Error ? error.message : 'Unable to submit the mock paper.'),
  })

  const forgeMutation = useMutation({
    mutationFn: async ({ topic, assetType }: { topic: ExamTopic; assetType: ForgeAssetType }) => {
      const userId = await getUserId(clerkUserId)
      const response = await fetch(`${apiBaseUrl}/exam/doubt-solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({
          question: `Create a ${assetType} for the exam topic "${topic.title}" in "${activeExam?.subject}". Use a concise exam-oriented structure, include relevant legal authorities only when supported, and provide answer-writing guidance.`,
        }),
      })
      if (!response.ok) throw new Error('Smart Study Forge generation failed.')
      const generated = await response.json()
      const { data, error } = await supabase.from('exam_forge_assets').insert({
        user_id: userId,
        exam_id: topic.exam_id,
        topic_id: topic.id,
        asset_type: assetType,
        title: `${assetType}: ${topic.title}`,
        content: {
          generated_content: generated.answer,
          citations: generated.citations || [],
        },
      }).select('*').single()
      if (error) throw error
      await supabase.from('notifications').insert({
        user_id: userId,
        user: clerkUserId,
        title: `Smart Study Forge Asset Ready`,
        message: `${assetType} generated for ${topic.title}.`,
        type: 'info',
        trigger_time: new Date().toISOString(),
        sent_at: new Date().toISOString(),
        delivery_status: 'sent'
      })
      return data as ForgeAsset
    },
    onSuccess: (asset) => {
      setSelectedForgeAsset(asset)
      queryClient.invalidateQueries({ queryKey: ['exam_forge_assets', examId] })
      queryClient.invalidateQueries({ queryKey: ['exam_notifications'] })
    },
  })

  const toggleExamTaskMutation = useMutation({
    mutationFn: async (task: ExamTask) => {
      const userId = await getUserId(clerkUserId)
      const { error } = await supabase
        .from('academic_ai_tasks')
        .update({
          status: task.status === 'completed' ? 'pending' : 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.id)
        .eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () => {
      eventBus.dispatch(EVENTS.TASK_COMPLETED)
      queryClient.invalidateQueries({ queryKey: ['exam_command_tasks', examId] })
    },
  })

  const generateExamTasksMutation = useMutation({
    mutationFn: async () => {
      if (!activeExam) throw new Error('Create or select an exam first.')
      const userId = await getUserId(clerkUserId)
      const pendingMock = mocks.find((mock) => mock.attempt_score === null)
      const rows: Array<{
        user_id: string
        title: string
        task_type: ExamTask['task_type']
        target_date: string
        priority: ExamTask['priority']
        status: ExamTask['status']
        metadata: ExamTask['metadata']
      }> = []
      if (weakTopics[0]) {
        rows.push({
          user_id: userId,
          title: `Repair weak topic: ${weakTopics[0].title}`,
          task_type: 'study',
          target_date: todayString,
          priority: 'Critical',
          status: 'pending',
          metadata: { examId: activeExam.id, source: 'Exam Command Center' },
        })
      }
      rows.push({
          user_id: userId,
          title: `Complete one ${activeExam.subject} revision block`,
          task_type: 'revision',
          target_date: todayString,
          priority: 'High',
          status: 'pending',
          metadata: { examId: activeExam.id, source: 'Exam Command Center' },
      })
      if (pendingMock) {
        rows.push({
          user_id: userId,
          title: `Attempt mock: ${pendingMock.title}`,
          task_type: 'daily_target',
          target_date: todayString,
          priority: 'High',
          status: 'pending',
          metadata: { examId: activeExam.id, source: 'Exam Command Center' },
        })
      }
      const { error } = await supabase.from('academic_ai_tasks').insert(rows)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exam_command_tasks', examId] }),
  })

  const saveRecommendationsMutation = useMutation({
    mutationFn: async () => {
      if (!activeExam) throw new Error('Create or select an exam first.')
      const userId = await getUserId(clerkUserId)
      await supabase.from('recommendations').delete().eq('user_id', userId).eq('target_date', todayString)
      const { error } = await supabase.from('recommendations').insert(
        generatedRecommendations.map((content) => ({ user_id: userId, content, target_date: todayString }))
      )
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exam_recommendations', dbUserId] }),
  })

  const askMentor = async (topic?: ExamTopic) => {
    const question = topic
      ? `Explain ${topic.title} for ${activeExam?.subject} exam preparation. Include high-yield cases, likely questions, and answer-writing strategy.`
      : mentorQuestion
    if (!question.trim()) return
    setMentorReply('LexMentor is analyzing exam strategy, topic risk, and legal authorities...')
    try {
      const response = await fetch(`${apiBaseUrl}/exam/doubt-solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({ question }),
      })
      if (!response.ok) throw new Error('AI mentor unavailable.')
      const data = await response.json()
      setMentorReply(data.answer || 'LexMentor returned no answer.')
      setMentorQuestion('')
    } catch {
      setMentorReply('LexMentor could not connect to the backend. Keep the server running on port 4000.')
    }
  }

  const syncGoogleCalendar = async () => {
    const userId = await getUserId(clerkUserId)
    await supabase.from('notifications').insert({
      user_id: userId,
      user: clerkUserId,
      title: 'Google Calendar Sync Requested',
      message: 'Study sessions, revisions, mock tests, and exam dates are queued for calendar sync.',
      type: 'info',
      trigger_time: new Date().toISOString(),
      sent_at: new Date().toISOString(),
      delivery_status: 'sent'
    })
    queryClient.invalidateQueries({ queryKey: ['exam_notifications'] })
  }

  const sendExamReminderTestEmail = async () => {
    setEmailTestMessage('Sending test email...')
    try {
      const response = await fetch(`${apiBaseUrl}/exam/notifications/test-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await getToken()}` },
      })
      if (!response.ok) throw new Error(await getApiError(response, 'Unable to send the test email.'))
      const result = await response.json()
      setEmailTestMessage(`Test email sent from ${result.sender} to ${result.recipient}.`)
    } catch (error) {
      setEmailTestMessage(error instanceof Error ? error.message : 'Unable to send the test email.')
    }
  }

  const chartData = topics.slice(0, 8).map((topic) => {
    const titleText = topic.title || '';
    return {
      topic: titleText.length > 14 ? `${titleText.slice(0, 14)}...` : titleText,
      Readiness: topicScore(topic),
      PYQ: (topic.pyq_frequency || 0) * 15,
    };
  })

  return (
    <div className="exam-cmd-container">
      <header className="exam-cmd-header">
        <div className="exam-cmd-title-group">
          <h2>Exam Command Center™</h2>
          <p>AI-powered legal exam strategy, readiness prediction, mock testing, and last-mile revision war room</p>
        </div>
        <div className="exam-cmd-header-actions">
          <button type="button" className="exam-cmd-primary-btn" onClick={() => setShowCreateExam(!showCreateExam)}><Swords size={14} /> Create Exam</button>
          <button type="button" className="exam-cmd-ghost-btn" onClick={syncGoogleCalendar}><CalendarDays size={14} /> Google Sync</button>
        </div>
      </header>

      {showCreateExam && (
        <form className="exam-cmd-create-panel" onSubmit={(event) => { event.preventDefault(); createExamMutation.mutate() }}>
          <input placeholder="Subject Name" value={newExam.subject} onChange={(event) => setNewExam({ ...newExam, subject: event.target.value })} required />
          <input placeholder="University" value={newExam.university} onChange={(event) => setNewExam({ ...newExam, university: event.target.value })} />
          <input type="date" value={newExam.examDate} onChange={(event) => setNewExam({ ...newExam, examDate: event.target.value })} />
          <input type="time" value={newExam.examTime} onChange={(event) => setNewExam({ ...newExam, examTime: event.target.value })} aria-label="Exam time" required />
          <input type="number" min="0" step="0.5" value={newExam.hoursPerDay} onChange={(event) => setNewExam({ ...newExam, hoursPerDay: Number(event.target.value) })} placeholder="Hours / day" />
          <select value={newExam.difficulty} onChange={(event) => setNewExam({ ...newExam, difficulty: event.target.value as Difficulty })}><option>Easy</option><option>Medium</option><option>Hard</option></select>
          <input type="number" min="0" value={newExam.weightage} onChange={(event) => setNewExam({ ...newExam, weightage: Number(event.target.value) })} placeholder="Credits / Weightage" />
          <select value={newExam.prepLevel} onChange={(event) => setNewExam({ ...newExam, prepLevel: event.target.value as PrepLevel })}><option>Beginner</option><option>Intermediate</option><option>Expert</option></select>
          <label className="exam-cmd-reminder-toggle">
            <input type="checkbox" checked={newExam.emailReminderEnabled} onChange={(event) => setNewExam({ ...newExam, emailReminderEnabled: event.target.checked })} />
            <span>Email exam reminder</span>
          </label>
          <select
            value={newExam.emailReminderMinutes}
            disabled={!newExam.emailReminderEnabled}
            onChange={(event) => setNewExam({ ...newExam, emailReminderMinutes: Number(event.target.value) })}
            aria-label="Email reminder time"
          >
            <option value={43200}>30 days before</option>
            <option value={21600}>15 days before</option>
            <option value={10080}>7 days before</option>
            <option value={4320}>3 days before</option>
            <option value={1440}>1 day before</option>
            <option value={720}>12 hours before</option>
            <option value={60}>1 hour before</option>
            <option value={5}>5 minutes before (testing)</option>
            <option value={2}>2 minutes before (testing)</option>
            <option value={1}>1 minute before (testing)</option>
          </select>
          <button type="button" className="exam-cmd-ghost-btn" onClick={sendExamReminderTestEmail}>Send Test Email</button>
          <textarea placeholder="Syllabus topics. Use commas or new lines." value={newExam.topics} onChange={(event) => setNewExam({ ...newExam, topics: event.target.value })} />
          <button type="submit" className="exam-cmd-primary-btn" disabled={createExamMutation.isPending}>{createExamMutation.isPending ? 'Generating Strategy...' : 'Generate AI Exam Strategy'}</button>
          {emailTestMessage && <p className="exam-cmd-email-test-message">{emailTestMessage}</p>}
        </form>
      )}

      <section className="exam-cmd-dashboard-grid">
        <article className="exam-cmd-mission-card">
          <span className="exam-cmd-kicker">Mission Control</span>
          <h3>{activeExam?.subject || 'No Exam Selected'}</h3>
          <p>{activeExam ? `${activeExam.university || 'University'} · ${daysRemaining} days remaining · ${activeExam.available_hours_per_day || 0}h/day` : 'Create an exam to activate readiness intelligence.'}</p>
          <select value={activeExam?.id || ''} onChange={(event) => setActiveExamId(event.target.value)}>
            {exams.map((exam) => {
              let dateStr = 'No Date';
              if (exam.exam_date) {
                const parsed = new Date(exam.exam_date);
                if (!isNaN(parsed.getTime())) {
                  dateStr = parsed.toLocaleDateString();
                }
              }
              return <option key={exam.id} value={exam.id}>{exam.subject} · {dateStr}</option>
            })}
          </select>
        </article>
        {[
          { label: 'AI Readiness Score™', value: overallReadiness, icon: <Award size={16} /> },
          { label: 'Subject Readiness', value: subjectReadiness, icon: <BookMarked size={16} /> },
          { label: 'Revision Confidence', value: revisionConfidence, icon: <RefreshCcw size={16} /> },
          { label: 'Mock Performance', value: mockAverage, icon: <Timer size={16} /> },
        ].map(({ label, value, icon }) => (
          <article key={label} className="exam-cmd-score-card">
            <span>{icon}{label}</span>
            <strong>{value}%</strong>
            <div className="exam-cmd-bar-container"><div className="exam-cmd-bar-value" style={{ width: `${value}%`, background: Number(value) < 50 ? '#e85d5d' : Number(value) < 75 ? 'var(--gold)' : '#42c98f' }} /></div>
          </article>
        ))}
        <article className={`exam-cmd-risk-card risk-${risk.toLowerCase()}`}>
          <span>Risk Level</span>
          <strong>{risk}</strong>
          <small>Predicted Performance: {predictedMarks(overallReadiness)}</small>
        </article>
      </section>





      <section className="exam-cmd-panel">
        <h3 className="exam-cmd-panel-title"><CalendarDays size={15} /> Exam Calendar</h3>
        <AcademicNavigator variant="exam" />
      </section>

      <section className="exam-cmd-main-layout">
        <div className="exam-cmd-left-col">
          <section className="exam-cmd-panel">
            <h3 className="exam-cmd-panel-title"><Layers size={15} /> Topic Management</h3>
            <form className="exam-cmd-topic-form" onSubmit={(event) => { event.preventDefault(); addTopicMutation.mutate() }}>
              <div className="exam-cmd-input-group">
                <label className="exam-cmd-field-label">Topic Name</label>
                <input placeholder="Enter topic name..." value={newTopic.title} onChange={(event) => setNewTopic({ ...newTopic, title: event.target.value })} />
              </div>
              <div className="exam-cmd-input-group">
                <label className="exam-cmd-field-label">Difficulty</label>
                <select value={newTopic.difficulty} onChange={(event) => setNewTopic({ ...newTopic, difficulty: event.target.value as Difficulty })}><option>Easy</option><option>Medium</option><option>Hard</option></select>
              </div>
              <div className="exam-cmd-input-group">
                <label className="exam-cmd-field-label">PYQ Frequency</label>
                <input type="number" min="0" value={newTopic.pyqFrequency} onChange={(event) => setNewTopic({ ...newTopic, pyqFrequency: Number(event.target.value) })} />
              </div>
              <button type="submit" className="exam-cmd-ghost-btn" style={{ height: '39px', marginBottom: '0px' }}>Add Topic</button>
            </form>
            <div className="exam-cmd-topic-list">
              {topics.length > 0 && (
                <div className="exam-cmd-topic-list-header">
                  <span>Topic Details</span>
                  <span>Status</span>
                  <span>Quiz Score</span>
                  <span>Flashcard Score</span>
                  <span>Mastery Score</span>
                </div>
              )}
              {topics.map((topic) => {
                const tags = highYieldTags(topic)
                return (
                  <article key={topic.id} className="exam-cmd-topic-card">
                    <div>
                      <strong>{topic.title}</strong>
                      <small>{topic.difficulty} · PYQ x{topic.pyq_frequency} · {tags.articles} · {tags.cases}</small>
                    </div>
                    <select value={topic.status} onChange={(event) => updateTopicMutation.mutate({ topic, patch: { status: event.target.value as TopicStatus } })}>
                      {statusOptions.map((status) => <option key={status}>{status}</option>)}
                    </select>
                    <input type="number" min="0" max="100" value={topic.quiz_score} onChange={(event) => updateTopicMutation.mutate({ topic, patch: { quiz_score: Number(event.target.value) } })} title="Quiz Score" />
                    <input type="number" min="0" max="100" value={topic.flashcard_score} onChange={(event) => updateTopicMutation.mutate({ topic, patch: { flashcard_score: Number(event.target.value) } })} title="Flashcard Score" />
                    <input type="number" min="0" max="100" value={topic.mastery_score} onChange={(event) => updateTopicMutation.mutate({ topic, patch: { mastery_score: Number(event.target.value) } })} title="Mastery Score" />

                  </article>
                )
              })}
              {!topics.length && <p className="exam-cmd-muted">Add syllabus topics to generate priorities, weak areas, and revision schedules.</p>}
            </div>
          </section>

          <section className="exam-cmd-row-grid-2">
            <div className="exam-cmd-panel">
              <h3 className="exam-cmd-panel-title"><Target size={15} /> High-Yield Topic Engine™</h3>
              <div className="exam-cmd-yield-list">
                {highYieldTopics.slice(0, 3).map((topic, index) => {
                  const tags = highYieldTags(topic)
                  return <article key={topic.id}><strong>Priority {index + 1}: {topic.title}</strong><span>{tags.articles}</span><span>{tags.cases}</span></article>
                })}
                {!highYieldTopics.length && <p className="exam-cmd-muted">High-yield ranking activates after topics are added.</p>}
              </div>
            </div>

            <div className="exam-cmd-panel">
              <h3 className="exam-cmd-panel-title"><RefreshCcw size={15} /> Smart Revision Engine™</h3>
              <div className="exam-cmd-revision-list">
                {['Revision 1', 'Revision 2', 'Final Revision', 'Rapid Revision'].map((stage, index) => {
                  const topic = weakTopics[index] || topics[index]
                  return <article key={stage}><strong>{stage}</strong><span>{topic ? topic.title : 'Awaiting topic signal'}</span><small>{topic ? `${topic.difficulty} · score ${topicScore(topic)}%` : 'No data yet'}</small></article>
                })}
              </div>
            </div>
          </section>

          <section className="exam-cmd-panel">
            <h3 className="exam-cmd-panel-title"><Play size={15} /> Mock Test Center™</h3>
            <div className="exam-cmd-mock-grid">
              {mocks.map((mock) => (
                <article key={mock.id} className={`exam-cmd-mock-card ${activeMockId === mock.id ? 'selected' : ''}`}>
                  <strong>{mock.title}</strong>
                  <span>{mock.paper_type} · {mock.scheduled_date}</span>
                  <small>Score {mock.attempt_score ?? 'Pending'} · Time {mock.time_taken_minutes ?? '-'} min · Accuracy {mock.accuracy ?? '-'}%</small>
                  <button type="button" className="exam-cmd-mini-btn" disabled={generateMockPaperMutation.isPending} onClick={() => {
                    setMockMessage('')
                    if (mock.questions?.length) {
                      setActiveMockId(mock.id)
                      setMockAnswers(mock.responses || {})
                    } else {
                      generateMockPaperMutation.mutate(mock)
                    }
                  }}>
                    {generateMockPaperMutation.isPending && generateMockPaperMutation.variables?.id === mock.id
                      ? 'Generating Paper...'
                      : mock.questions?.length
                        ? mock.status === 'submitted' ? 'Open Results' : 'Open Mock Test'
                        : 'Generate Paper'}
                  </button>
                  {activeMockId === mock.id && !!mock.questions?.length && (
                    <div className="exam-cmd-mock-paper">
                      {!!mock.instructions?.length && (
                        <div className="exam-cmd-mock-instructions">
                          <strong>Instructions</strong>
                          {mock.instructions.map((instruction) => <span key={instruction}>{instruction}</span>)}
                        </div>
                      )}
                      {mock.questions.map((question, index) => {
                        const feedback = mock.evaluation?.questionFeedback?.find((item) => item.questionId === question.id)
                        return (
                          <article key={question.id} className="exam-cmd-mock-question">
                            <div>
                              <strong>Question {index + 1}</strong>
                              <span>{question.topic} · {question.marks} marks</span>
                            </div>
                            <p>{question.question}</p>
                            <textarea
                              value={mockAnswers[question.id] || ''}
                              readOnly={mock.status === 'submitted'}
                              onChange={(event) => setMockAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                              placeholder="Write your answer here..."
                            />
                            {feedback && <small>{feedback.awardedMarks}/{feedback.maxMarks}: {feedback.feedback}</small>}
                          </article>
                        )
                      })}
                      {mock.status === 'submitted' && mock.evaluation?.feedback && (
                        <div className="exam-cmd-mock-evaluation">
                          <strong>Evaluation: {mock.evaluation.percentage}%</strong>
                          <p>{mock.evaluation.feedback}</p>
                        </div>
                      )}
                      <div className="exam-cmd-inline-attempt-actions">
                        {mock.status !== 'submitted' && (
                          <>
                            <button type="button" className="exam-cmd-ghost-btn" disabled={saveMockDraftMutation.isPending} onClick={() => saveMockDraftMutation.mutate(mock)}>
                              {saveMockDraftMutation.isPending ? 'Saving...' : 'Save Draft'}
                            </button>
                            <button type="button" className="exam-cmd-primary-btn" disabled={submitMockPaperMutation.isPending} onClick={() => submitMockPaperMutation.mutate(mock)}>
                              {submitMockPaperMutation.isPending ? 'Evaluating...' : 'Submit Mock'}
                            </button>
                          </>
                        )}
                        <button type="button" className="exam-cmd-ghost-btn" onClick={() => setActiveMockId('')}>Close</button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
              {!mocks.length && <p className="exam-cmd-muted">No mock is scheduled for this exam yet. Choose a paper type below and generate one.</p>}
            </div>
            {!activeMockId && <div className="exam-cmd-mock-entry">
              <select value={mockEntry.paperType} onChange={(event) => setMockEntry({ ...mockEntry, paperType: event.target.value as PaperType })}>{paperTypes.map((type) => <option key={type}>{type}</option>)}</select>
              <button type="button" className="exam-cmd-primary-btn" disabled={!activeExam || scheduleMockMutation.isPending} onClick={() => scheduleMockMutation.mutate()}>
                {scheduleMockMutation.isPending ? 'Generating...' : 'Generate Mock'}
              </button>
            </div>}
            {mockMessage && <p className={`exam-cmd-mock-message ${scheduleMockMutation.isError || generateMockPaperMutation.isError || saveMockDraftMutation.isError || submitMockPaperMutation.isError ? 'error' : 'success'}`}>{mockMessage}</p>}
          </section>
        </div>
      </section>

      <section className="exam-cmd-bottom-grid">
        <div className="exam-cmd-panel">
          <h3 className="exam-cmd-panel-title"><LineChart size={15} /> Performance Analytics</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="topic" stroke="var(--text-soft)" fontSize={11} />
              <YAxis stroke="var(--text-soft)" fontSize={11} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Readiness" fill="#f5c14f" />
              <Bar dataKey="PYQ" fill="#42c98f" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="exam-cmd-panel">
          <h3 className="exam-cmd-panel-title"><Sparkles size={15} /> Smart Study Forge Integration</h3>
          <div className="exam-cmd-forge-grid">
            {weakTopics.slice(0, 3).map((topic) => (
              <article key={topic.id}>
                <strong>{topic.title}</strong>
                {forgeAssets.map((assetType) => {
                  const savedAsset = savedForgeAssets.find((asset) => asset.topic_id === topic.id && asset.asset_type === assetType)
                  const isGenerating = forgeMutation.isPending &&
                    forgeMutation.variables?.topic.id === topic.id &&
                    forgeMutation.variables?.assetType === assetType
                  return (
                    <button key={assetType} type="button" disabled={isGenerating} onClick={() => savedAsset ? setSelectedForgeAsset(savedAsset) : forgeMutation.mutate({ topic, assetType })}>
                      {isGenerating ? `Generating ${assetType}...` : savedAsset ? `Open ${assetType}` : `Generate ${assetType}`}
                    </button>
                  )
                })}
              </article>
            ))}
            {!weakTopics.length && <p className="exam-cmd-muted">Weak topics will appear here for notes, flashcards, MCQs, and summaries.</p>}
          </div>
          {selectedForgeAsset && (
            <article className="exam-cmd-forge-output">
              <div>
                <strong>{selectedForgeAsset.title}</strong>
                <button type="button" className="exam-cmd-mini-btn" onClick={() => setSelectedForgeAsset(null)}>Close</button>
              </div>
              <p>{selectedForgeAsset.content?.generated_content || 'This saved asset has no generated content.'}</p>
              {!!selectedForgeAsset.content?.citations?.length && <small>Sources: {selectedForgeAsset.content.citations.map((citation) => citation.title).filter(Boolean).join(', ')}</small>}
            </article>
          )}
        </div>

        <div className="exam-cmd-panel">
          <h3 className="exam-cmd-panel-title"><Flame size={15} /> Today's Exam Tasks</h3>
          <div className="exam-cmd-checklist">
            {todayTasks.map((task) => (
              <label key={task.id} className={`exam-cmd-checklist-item ${task.status === 'completed' ? 'completed' : ''}`}>
                <input type="checkbox" checked={task.status === 'completed'} onChange={() => toggleExamTaskMutation.mutate(task)} />
                {task.title}
              </label>
            ))}
            {!todayTasks.length && (
              <button type="button" className="exam-cmd-ghost-btn" disabled={!activeExam || generateExamTasksMutation.isPending} onClick={() => generateExamTasksMutation.mutate()}>
                {generateExamTasksMutation.isPending ? 'Generating...' : "Generate Today's Tasks"}
              </button>
            )}
          </div>
          <h3 className="exam-cmd-panel-title"><TrendingUp size={15} /> Daily Recommendations</h3>
          <div className="exam-cmd-recommendations">
            {(recommendationsQuery.data || []).slice(0, 4).map((rec) => <span key={rec.id}>{rec.content}</span>)}
            {!recommendationsQuery.data?.length && generatedRecommendations.map((content) => <span key={content}>{content}</span>)}
            {!activeExam && <span>Create an exam to generate recommendations.</span>}
            {activeExam && (
              <button type="button" className="exam-cmd-ghost-btn" disabled={saveRecommendationsMutation.isPending} onClick={() => saveRecommendationsMutation.mutate()}>
                <RefreshCcw size={13} /> {saveRecommendationsMutation.isPending ? 'Saving...' : 'Refresh Recommendations'}
              </button>
            )}
          </div>
        </div>

        <div className="exam-cmd-panel exam-cmd-ai-coach-panel">
          <h3 className="exam-cmd-panel-title"><Sparkles size={15} /> LexMentor AI Exam Coach</h3>
          <div className="exam-cmd-ai-dialogue-box">
            {mentorReply}
          </div>
          <div className="exam-cmd-ai-coach-input-wrap">
            <input
              type="text"
              className="exam-cmd-ai-input"
              value={mentorQuestion}
              onChange={(e) => setMentorQuestion(e.target.value)}
              placeholder="Ask a doubt or exam strategy..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  askMentor()
                }
              }}
            />
            <button
              type="button"
              className="exam-cmd-ai-btn"
              onClick={() => askMentor()}
            >
              Ask
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

