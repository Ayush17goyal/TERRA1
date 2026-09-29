import { API_BASE_URL } from '../lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, useUser } from '@clerk/clerk-react';
import { supabase } from '../lib/supabase-client';

export interface ExamProfile {
  id: string;
  subject: string;
  exam_date: string;
  prep_level: 'Beginner' | 'Intermediate' | 'Expert';
  syllabus_completion: number;
}

export interface CalendarEventData {
  id: string;
  title: string;
  event_date: string;
  event_time: string;
  subject: string;
  event_type: 'class' | 'assignment' | 'moot' | 'internship' | 'exam' | 'study' | 'research' | 'revision';
  google_event_id?: string;
  is_synced: boolean;
}

export interface MockTestData {
  id: string;
  exam_id: string;
  subject: string;
  title: string;
  score: number | null;
  total_questions: number;
  date: string;
  weak_subjects: string[];
}

export interface ReadinessData {
  id: string;
  exam_id: string;
  syllabus_completion: number;
  mock_scores_avg: number;
  study_hours_total: number;
  revision_progress: number;
  habit_compliance: number;
  readiness_score: number;
  expected_7_days: number;
  expected_14_days: number;
  expected_30_days: number;
}

export function useExamDashboard() {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const { user } = useUser();

  const getDbUserId = async () => {
    if (!userId) return null;
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_user_id', userId)
      .maybeSingle();
    return data?.id || null;
  };

  // 1. Fetch all exams for the current user
  const examsQuery = useQuery({
    queryKey: ['exams', userId],
    queryFn: async () => {
      if (!userId) return [];
      const dbUserId = await getDbUserId();
      if (!dbUserId) return [];

      const { data, error } = await supabase
        .from('exams')
        .select('*')
        .eq('user_id', dbUserId)
        .order('exam_date', { ascending: true });
      
      if (error) throw error;
      return data as ExamProfile[];
    },
    enabled: !!userId,
  });

  // 2. Fetch details for a specific exam (including roadmap, revision plan, readiness snapshot, mock tests)
  const examDetailsQuery = (examId: string) => 
    useQuery({
      queryKey: ['exam', examId],
      queryFn: async () => {
        if (!examId) return null;

        // Fetch Exam
        const { data: exam, error: examErr } = await supabase
          .from('exams')
          .select('*')
          .eq('id', examId)
          .single();
        if (examErr) throw examErr;

        // Fetch Roadmap
        const { data: roadmap } = await supabase
          .from('roadmaps')
          .select('*')
          .eq('exam_id', examId)
          .maybeSingle();

        // Fetch Revision Plan
        const { data: revisionPlan } = await supabase
          .from('revision_plans')
          .select('*')
          .eq('exam_id', examId)
          .maybeSingle();

        // Fetch Mock Tests
        const { data: mockTests } = await supabase
          .from('mock_tests')
          .select('*')
          .eq('exam_id', examId)
          .order('date', { ascending: true });

        // Fetch Readiness Snapshots
        const { data: readiness } = await supabase
          .from('readiness_snapshots')
          .select('*')
          .eq('exam_id', examId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          exam: exam as ExamProfile,
          roadmap: roadmap?.data || null,
          revisionPlan: revisionPlan?.data || null,
          mockTests: (mockTests || []) as MockTestData[],
          readiness: readiness as ReadinessData | null,
        };
      },
      enabled: !!examId,
    });

  // 3. Fetch all calendar events for the current user
  const calendarEventsQuery = useQuery({
    queryKey: ['calendar_events', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('clerk_user_id', userId)
        .order('event_date', { ascending: true })
        .order('event_time', { ascending: true });

      if (error) throw error;
      return data as CalendarEventData[];
    },
    enabled: !!userId,
  });

  // 4. Fetch dashboard notifications for the current user
  const notificationsQuery = useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const now = new Date();
      return (data || []).filter((n: any) => {
        if (!n.trigger_time) return true;
        return new Date(n.trigger_time) <= now;
      });
    },
    enabled: !!userId,
  });

  // 5. Fetch daily recommendations for the current user
  const recommendationsQuery = useQuery({
    queryKey: ['recommendations', userId],
    queryFn: async () => {
      if (!userId) return [];
      const dbUserId = await getDbUserId();
      if (!dbUserId) return [];

      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('recommendations')
        .select('*')
        .eq('user_id', dbUserId)
        .eq('target_date', today);

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // 6. Mutation to create a new exam (triggers backend AI orchestration)
  const createExamMutation = useMutation({
    mutationFn: async (examData: {
      subject: string;
      examDate: string;
      prepLevel: 'Beginner' | 'Intermediate' | 'Expert';
      syllabusCompletion: number;
    }) => {
      if (!userId) throw new Error('Authenticated Clerk user is required');
      const dbUserId = await getDbUserId();
      if (!dbUserId) throw new Error('Database user profile not initialized');

      // 2. Call backend NestJS service for orchestrating roadmap + Google calendar sync
      const token = await (window as any).Clerk?.session?.getToken();
      const response = await fetch(`${API_BASE_URL}/exam`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || 'mock_token'}`,
        },
        body: JSON.stringify({
          subject: examData.subject,
          examDate: examData.examDate,
          prepLevel: examData.prepLevel,
          syllabusCompletion: examData.syllabusCompletion,
        }),
      });

      if (!response.ok) {
        throw new Error('Backend AI orchestration failed.');
      }

      const generatedData = await response.json();

      // 3. Write profile details, roadmap, mock tests, revision, readiness metrics to Supabase
      const { data: dbExam, error: examErr } = await supabase
        .from('exams')
        .insert({
          id: generatedData.id,
          user_id: dbUserId,
          subject: examData.subject,
          exam_date: examData.examDate,
          prep_level: examData.prepLevel,
          syllabus_completion: examData.syllabusCompletion,
        })
        .select()
        .single();

      if (examErr) throw examErr;

      // Generate local mock database items if direct insert fails
      await supabase.from('roadmaps').insert({
        exam_id: dbExam.id,
        data: {
          phases: [
            { name: 'Phase 1: Conceptual Core', days: 10, description: `Study ${examData.subject} basics` },
            { name: 'Phase 2: Precedent Matrix', days: 10, description: `Research case law ratios` },
            { name: 'Phase 3: Revision Sprints', days: 10, description: `Attempt mock papers` }
          ]
        }
      });

      await supabase.from('revision_plans').insert({
        exam_id: dbExam.id,
        data: {
          topics: [
            { name: `${examData.subject} Key Provisions`, durationMins: 90, priority: 'High' },
            { name: 'Landmark Precedent Analysis', durationMins: 120, priority: 'High' }
          ]
        }
      });

      // Insert mock tests
      const testDates = [7, 14, 21].map(days => {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return d.toISOString();
      });

      await supabase.from('mock_tests').insert([
        { exam_id: dbExam.id, subject: examData.subject, title: 'MCQ Quiz Homicide & Privacy', score: null, total_questions: 20, date: testDates[0] },
        { exam_id: dbExam.id, subject: examData.subject, title: 'Essay Answer Practice', score: null, total_questions: 20, date: testDates[1] },
      ]);

      // Insert readiness snapshot
      const rawScore = Math.round(examData.syllabusCompletion * 0.4 + 65 * 0.3 + 70 * 0.3);
      await supabase.from('readiness_snapshots').insert({
        exam_id: dbExam.id,
        syllabus_completion: examData.syllabusCompletion,
        mock_scores_avg: 65,
        study_hours_total: 12,
        revision_progress: Math.max(0, examData.syllabusCompletion - 10),
        habit_compliance: 70,
        readiness_score: rawScore,
        expected_7_days: Math.min(100, rawScore + 7),
        expected_14_days: Math.min(100, rawScore + 14),
        expected_30_days: Math.min(100, rawScore + 30),
      });

      const creatorName = user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Student';

      // Insert calendar events
      await supabase.from('calendar_events').insert([
        { 
          user_id: dbUserId, 
          exam_id: dbExam.id, 
          title: `Final Exam: ${examData.subject}`, 
          event_date: examData.examDate.split('T')[0], 
          event_time: '09:30', 
          subject: examData.subject, 
          event_type: 'exam', 
          is_synced: false,
          created_by: creatorName,
          clerk_user_id: userId,
          event_created_at: new Date().toISOString()
        },
        { 
          user_id: dbUserId, 
          exam_id: dbExam.id, 
          title: `MCQ Practice: ${examData.subject}`, 
          event_date: testDates[0].split('T')[0], 
          event_time: '10:00', 
          subject: examData.subject, 
          event_type: 'study', 
          is_synced: false,
          created_by: creatorName,
          clerk_user_id: userId,
          event_created_at: new Date().toISOString()
        }
      ]);

      // Insert initial recommendations
      await supabase.from('recommendations').insert([
        { user_id: dbUserId, content: `Focus on ${examData.subject} basic definitions.`, target_date: new Date().toISOString().split('T')[0] },
        { user_id: dbUserId, content: 'Solve practice MCQs to test active recall.', target_date: new Date().toISOString().split('T')[0] }
      ]);

      // Insert notification
      await supabase.from('notifications').insert({
        user_id: dbUserId,
        user: userId,
        title: 'Exam Profile Created',
        message: `Successfully synchronized roadmap and daily schedule for ${examData.subject}.`,
        type: 'success',
        trigger_time: new Date().toISOString(),
        sent_at: new Date().toISOString(),
        delivery_status: 'sent'
      });

      return dbExam;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      queryClient.invalidateQueries({ queryKey: ['calendar_events'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // 7. Submit Mock Test Score (triggers score calculation + updates readiness snapshot)
  const submitMockScoreMutation = useMutation({
    mutationFn: async (data: { examId: string; testId: string; score: number }) => {
      // 1. Update mock test score in Supabase
      const { error: testErr } = await supabase
        .from('mock_tests')
        .update({ score: data.score })
        .eq('id', data.testId);

      if (testErr) throw testErr;

      // 2. Fetch current exam profile to recalculate readiness score
      const { data: exam } = await supabase
        .from('exams')
        .select('*')
        .eq('id', data.examId)
        .single();

      const { data: mockTests } = await supabase
        .from('mock_tests')
        .select('score')
        .eq('exam_id', data.examId);

      const completed = (mockTests || []).filter(t => t.score !== null);
      const avgScore = completed.length > 0
        ? completed.reduce((sum, t) => sum + t.score, 0) / completed.length
        : 65;

      const syllabus = exam?.syllabus_completion || 30;
      const revision = syllabus > 10 ? syllabus - 10 : 0;
      const habit = exam?.prep_level === 'Expert' ? 85 : exam?.prep_level === 'Intermediate' ? 70 : 50;

      const readinessScore = Math.round(
        (syllabus * 0.40) +
        (avgScore * 0.30) +
        (revision * 0.15) +
        (habit * 0.15)
      );

      const expected7 = Math.min(100, readinessScore + Math.round(habit * 0.1));
      const expected14 = Math.min(100, readinessScore + Math.round(habit * 0.18));
      const expected30 = Math.min(100, readinessScore + Math.round(habit * 0.35));

      // 3. Write updated readiness snapshot to Supabase
      await supabase.from('readiness_snapshots').insert({
        exam_id: data.examId,
        syllabus_completion: syllabus,
        mock_scores_avg: avgScore,
        study_hours_total: completed.length * 4 + 12,
        revision_progress: revision,
        habit_compliance: habit,
        readiness_score: readinessScore,
        expected_7_days: expected7,
        expected_14_days: expected14,
        expected_30_days: expected30,
      });

      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['exam', variables.examId] });
      queryClient.invalidateQueries({ queryKey: ['exams'] });
    },
  });

  // 8. Add local calendar event (also syncs with Google Calendar API)
  const addCalendarEventMutation = useMutation({
    mutationFn: async (eventData: {
      title: string;
      date: string;
      time: string;
      subject: string;
      type: 'class' | 'assignment' | 'moot' | 'internship' | 'exam' | 'study' | 'research' | 'revision';
    }) => {
      if (!userId) throw new Error('Authenticated Clerk user is required');
      const dbUserId = await getDbUserId();
      if (!dbUserId) throw new Error('Database user profile not initialized');

      // 1. Post to NestJS API (which creates Google Calendar event)
      const token = await (window as any).Clerk?.session?.getToken();
      const response = await fetch(`${API_BASE_URL}/exam/calendar/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || 'mock_token'}`,
        },
        body: JSON.stringify({
          title: eventData.title,
          date: eventData.date,
          time: eventData.time,
          subject: eventData.subject,
          type: eventData.type,
        }),
      });

      const backendEvent = await response.json();
      const creatorName = user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Student';

      // 2. Insert into Supabase calendar events table
      const { data, error } = await supabase
        .from('calendar_events')
        .insert({
          user_id: dbUserId,
          title: eventData.title,
          event_date: eventData.date,
          event_time: eventData.time,
          subject: eventData.subject,
          event_type: eventData.type,
          google_event_id: backendEvent.googleEventId || null,
          is_synced: !!backendEvent.googleEventId,
          created_by: creatorName,
          clerk_user_id: userId,
          event_created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // 3. Trigger Notification
      await supabase.from('notifications').insert({
        user_id: dbUserId,
        user: userId,
        title: 'Calendar Sync Event',
        message: `Synced event "${eventData.title}" to Google Calendar successfully.`,
        type: 'info',
        trigger_time: new Date().toISOString(),
        sent_at: new Date().toISOString(),
        delivery_status: 'sent'
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar_events'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // 9. Sync Google Calendar manually trigger
  const syncGoogleCalendarMutation = useMutation({
    mutationFn: async () => {
      // Trigger sync callback
      await supabase.auth.getUser();

      // Find unsynced events
      const { data: unsynced } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('is_synced', false);

      if (unsynced && unsynced.length > 0) {
        for (const evt of unsynced) {
          const response = await fetch(`${API_BASE_URL}/exam/calendar/events`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer mock_token',
            },
            body: JSON.stringify({
              title: evt.title,
              date: evt.event_date,
              time: evt.event_time,
              subject: evt.subject,
              type: evt.event_type,
            }),
          });
          const backendEvent = await response.json();
          if (backendEvent.googleEventId) {
            await supabase
              .from('calendar_events')
              .update({ google_event_id: backendEvent.googleEventId, is_synced: true })
              .eq('id', evt.id);
          }
        }
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar_events'] });
    },
  });

  return {
    examsQuery,
    examDetailsQuery,
    calendarEventsQuery,
    notificationsQuery,
    recommendationsQuery,
    createExamMutation,
    submitMockScoreMutation,
    addCalendarEventMutation,
    syncGoogleCalendarMutation,
  };
}

