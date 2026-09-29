import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { UserActivityLog } from '../settings/settings.entities';
import { ResearchNote, ResearchQuery } from '../research/research.entities';
import {
  Exam,
  Roadmap,
  RevisionPlan,
  MockTest,
  CalendarEvent,
  ReadinessSnapshot,
  Recommendation,
} from './exam.entities';
import { AiMockTest } from '../learning-workspace/learning-workspace.entities';
import { GoogleCalendarService } from './google-calendar.service';
import { NotificationService } from './notification.service';
import { BgeM3Provider } from '../retrieval/bge-m3.provider';
import { QdrantService } from '../retrieval/qdrant.service';
import {
  LegalDomainClassifierService,
  LEXMENTOR_REJECTION_RESPONSE,
} from '../legal-domain/legal-domain-classifier.service';
import { NotebookService } from '../notebook/notebook.service';

@Injectable()
export class ExamService {
  private readonly logger = new Logger(ExamService.name);

  constructor(
    @InjectRepository(Exam)
    private readonly examRepository: Repository<Exam>,
    @InjectRepository(Roadmap)
    private readonly roadmapRepository: Repository<Roadmap>,
    @InjectRepository(RevisionPlan)
    private readonly revisionPlanRepository: Repository<RevisionPlan>,
    @InjectRepository(MockTest)
    private readonly mockTestRepository: Repository<MockTest>,
    @InjectRepository(CalendarEvent)
    private readonly calendarEventRepository: Repository<CalendarEvent>,
    @InjectRepository(ReadinessSnapshot)
    private readonly readinessRepository: Repository<ReadinessSnapshot>,
    @InjectRepository(Recommendation)
    private readonly recommendationRepository: Repository<Recommendation>,
    @InjectRepository(AiMockTest)
    private readonly aiMockTestRepository: Repository<AiMockTest>,

    private readonly googleCalendarService: GoogleCalendarService,
    private readonly notificationService: NotificationService,
    private readonly bgeM3Provider: BgeM3Provider,
    private readonly qdrantService: QdrantService,
    private readonly legalClassifier: LegalDomainClassifierService,
    private readonly entityManager: EntityManager,
    private readonly notebookService: NotebookService,
  ) {}

  /**
   * Helper to retrieve OpenAI Client dynamically
   */
  private getOpenAIClient() {
    const openAiKey = process.env.OPENAI_API_KEY;
    if (openAiKey && openAiKey !== 'sk_openai_key_placeholder') {
      const { OpenAI } = require('openai');
      return new OpenAI({ apiKey: openAiKey });
    }
    return null;
  }

  private async generateJsonWithProviderFallback(systemPrompt: string, payload: unknown) {
    const providers = [
      process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes('placeholder') && {
        name: 'Gemini',
        apiKey: process.env.GEMINI_API_KEY,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
        model: 'gemini-2.5-flash',
        jsonMode: true,
      },
      process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('placeholder') && {
        name: 'OpenAI',
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: undefined,
        model: 'gpt-4o-mini',
        jsonMode: true,
      },
      process.env.DEEPSEEK_API_KEY && !process.env.DEEPSEEK_API_KEY.includes('placeholder') && {
        name: 'DeepSeek',
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: 'https://integrate.api.nvidia.com/v1',
        model: 'deepseek-ai/deepseek-r1',
        jsonMode: false,
      },
    ].filter(Boolean) as Array<{
      name: string;
      apiKey: string;
      baseURL?: string;
      model: string;
      jsonMode: boolean;
    }>;

    if (!providers.length) {
      const missingKeys = [];
      const geminiKey = process.env.GEMINI_API_KEY;
      const openaiKey = process.env.OPENAI_API_KEY;
      const deepseekKey = process.env.DEEPSEEK_API_KEY;
      const openrouterKey = process.env.OPENROUTER_API_KEY;
      if (!geminiKey || geminiKey.includes('placeholder')) missingKeys.push('GEMINI_API_KEY');
      if (!openaiKey || openaiKey.includes('placeholder')) missingKeys.push('OPENAI_API_KEY');
      if (!deepseekKey || deepseekKey.includes('placeholder')) missingKeys.push('DEEPSEEK_API_KEY');
      if (!openrouterKey || openrouterKey.includes('placeholder')) missingKeys.push('OPENROUTER_API_KEY');
      throw new BadRequestException(
        `AI provider is not configured correctly. Please check API key settings. Missing env variables: ${missingKeys.join(', ')}`
      );
    }

    const errors: string[] = [];
    for (const provider of providers) {
      try {
        const { OpenAI } = require('openai');
        const client = new OpenAI({ apiKey: provider.apiKey, baseURL: provider.baseURL });
        const response = await client.chat.completions.create({
          model: provider.model,
          max_tokens: 16000,
          response_format: provider.jsonMode ? { type: 'json_object' } : undefined,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(payload) },
          ],
        });
        let content = response.choices[0]?.message?.content || '';
        if (content.includes('```json')) content = content.split('```json')[1].split('```')[0].trim();
        else if (content.includes('```')) content = content.split('```')[1].split('```')[0].trim();
        content = this.cleanJsonString(content);
        try {
          return JSON.parse(content);
        } catch (jsonErr) {
          const match = content.match(/\{[\s\S]*\}/);
          if (!match) {
            this.logger.error(`Raw content failed JSON parsing (no braces match): ${content}`);
            throw new Error('Provider returned non-JSON content.');
          }
          try {
            return JSON.parse(match[0]);
          } catch (matchErr) {
            this.logger.error(`Raw content match failed JSON parsing: ${match[0]}`);
            throw matchErr;
          }
        }
      } catch (error) {
        const message = error?.response?.data?.error?.message || error?.message || String(error);
        errors.push(`${provider.name}: ${message}`);
        this.logger.warn(`Mock-paper provider ${provider.name} failed: ${message}`);
      }
    }

    const missingKeys = [];
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!geminiKey || geminiKey.includes('placeholder')) missingKeys.push('GEMINI_API_KEY');
    if (!openaiKey || openaiKey.includes('placeholder')) missingKeys.push('OPENAI_API_KEY');
    if (!deepseekKey || deepseekKey.includes('placeholder')) missingKeys.push('DEEPSEEK_API_KEY');
    if (!openrouterKey || openrouterKey.includes('placeholder')) missingKeys.push('OPENROUTER_API_KEY');
    throw new BadRequestException(
      `AI provider is not configured correctly. Please check API key settings. Missing env variables: ${missingKeys.join(', ')}. Errors: ${errors.join(' | ')}`
    );
  }

  async generateMockPaper(input: {
    subject: string;
    paperType: string;
    topics: Array<{ title: string; difficulty?: string; pyqFrequency?: number }>;
  }) {
    if (!input.subject?.trim() || !input.topics?.length) {
      throw new Error('A subject and at least one saved exam topic are required.');
    }

    const paper = await this.generateJsonWithProviderFallback(
      `Generate a rigorous legal examination paper. Return JSON only:
{"title":"string","instructions":["string"],"durationMinutes":number,"maxMarks":number,"questions":[{"id":"q1","question":"string","marks":number,"topic":"string","answerGuidance":["string"]}]}
Questions must be answerable, specific to the supplied syllabus, and appropriate for the requested paper type. Do not include fabricated citations or case names.`,
      input,
    );
    if (!Array.isArray(paper.questions) || !paper.questions.length) {
      throw new Error('AI returned an invalid mock paper.');
    }
    return paper;
  }

  async evaluateMockPaper(input: {
    subject: string;
    paperType: string;
    questions: any[];
    answers: Record<string, string>;
  }) {
    const evaluation = await this.generateJsonWithProviderFallback(
      `Evaluate a legal exam attempt against the supplied questions and guidance. Return JSON only:
{"score":number,"maxMarks":number,"percentage":number,"feedback":"string","questionFeedback":[{"questionId":"string","awardedMarks":number,"maxMarks":number,"feedback":"string"}],"weakTopics":["string"]}
Award zero for unanswered questions. Do not invent authorities that are not present in the student's answer or question.`,
      input,
    );
    if (!Number.isFinite(Number(evaluation.percentage))) {
      throw new Error('AI returned an invalid mock evaluation.');
    }
    return evaluation;
  }

  /**
   * Parse natural language input (AI Calendar Assistant)
   * e.g., "My Constitutional Law exam is on July 20."
   */
  async parseCalendarAssistantInput(userId: string, input: string): Promise<Exam> {
    this.logger.log(`AI Calendar Assistant parsing query: "${input}"`);

    let subject = 'Constitutional Law';
    let examDate = new Date();
    examDate.setDate(examDate.getDate() + 30); // Default 30 days out
    let prepLevel: 'Beginner' | 'Intermediate' | 'Expert' = 'Intermediate';
    let syllabusCompletion = 30;

    const openai = this.getOpenAIClient();
    if (openai) {
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are an AI Calendar Assistant. Parse the student's text to detect:
1. Exam subject (e.g. Constitutional Law, Criminal Law, Jurisprudence, Contracts, etc.)
2. Exam date (YYYY-MM-DD format). The current year is 2026.
3. Preparation level (either Beginner, Intermediate, or Expert)
4. Syllabus completion percentage (number 0-100)
Respond ONLY with a JSON object. Example:
{"subject":"Constitutional Law","examDate":"2026-07-20","prepLevel":"Beginner","syllabusCompletion":20}`
            },
            {
              role: 'user',
              content: input
            }
          ],
          response_format: { type: 'json_object' }
        });

        const data = JSON.parse(response.choices[0].message.content);
        if (data.subject) subject = data.subject;
        if (data.examDate) examDate = new Date(data.examDate);
        if (data.prepLevel) prepLevel = data.prepLevel;
        if (data.syllabusCompletion !== undefined) syllabusCompletion = data.syllabusCompletion;
      } catch (err) {
        this.logger.error(`Failed to parse via LLM: ${err.message}. Falling back to default extraction rules.`);
      }
    } else {
      // Basic regex fallback
      const text = input.toLowerCase();
      if (text.includes('criminal')) subject = 'Criminal Law';
      else if (text.includes('contract')) subject = 'Contract Law';
      else if (text.includes('jurisprudence')) subject = 'Jurisprudence';

      const dateMatch = text.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d+/i) || text.match(/\d{4}-\d{2}-\d{2}/);
      if (dateMatch) {
        const parsedDate = new Date(dateMatch[0]);
        if (!isNaN(parsedDate.getTime())) {
          examDate = parsedDate;
          if (examDate.getFullYear() < 2026) {
            examDate.setFullYear(2026);
          }
        }
      }
    }

    return this.createExam(userId, {
      subject,
      examDate,
      prepLevel,
      syllabusCompletion
    });
  }

  /**
   * Core Exam Orchestration
   * Trigger: Exam Creation -> Roadmap -> Revision Plan -> Mock Test -> Calendar Events -> Sync Google Calendar -> Readiness Snapshots -> Recommendations
   */
  async createExam(
    userId: string,
    dto: {
      subject: string;
      examDate: Date;
      prepLevel: 'Beginner' | 'Intermediate' | 'Expert';
      syllabusCompletion: number;
      emailReminderEnabled?: boolean;
      emailReminderMinutes?: number;
      examTime?: string;
      clerkUserId?: string;
      fullName?: string;
      email?: string;
    }
  ): Promise<Exam> {
    this.logger.log(`Triggering Core AI Orchestration for subject: ${dto.subject}`);

    // 1. Create Exam Profile
    const exam = new Exam();
    exam.userId = userId;
    exam.clerkUserId = dto.clerkUserId || userId;
    exam.fullName = dto.fullName || 'Student';
    exam.email = dto.email || '';
    exam.subject = dto.subject;
    exam.subjectName = dto.subject;
    exam.examDate = dto.examDate;
    exam.examTime = dto.examTime || '';
    exam.prepLevel = dto.prepLevel;
    exam.syllabusCompletion = dto.syllabusCompletion;
    exam.emailReminderEnabled = Boolean(dto.emailReminderEnabled);
    exam.emailReminderMinutes = dto.emailReminderMinutes ?? 1440;

    exam.reminderEnabled = Boolean(dto.emailReminderEnabled);
    exam.reminderType = dto.emailReminderMinutes ? `${dto.emailReminderMinutes}_minutes` : '1440_minutes';
    exam.reminderTriggerAt = dto.emailReminderEnabled && dto.emailReminderMinutes
      ? new Date(dto.examDate.getTime() - dto.emailReminderMinutes * 60 * 1000)
      : null;
    exam.reminderSentAt = null;
    exam.timezone = 'Asia/Kolkata';

    const savedExam = await this.examRepository.save(exam);

    // 2. Generate Roadmap (AI generated study roadmap)
    const roadmap = new Roadmap();
    roadmap.examId = savedExam.id;
    roadmap.data = await this.generateRoadmapData(savedExam);
    await this.roadmapRepository.save(roadmap);

    // 3. Generate Revision Plan (AI generated revision sessions)
    const revisionPlan = new RevisionPlan();
    revisionPlan.examId = savedExam.id;
    revisionPlan.data = await this.generateRevisionPlanData(savedExam, roadmap.data);
    await this.revisionPlanRepository.save(revisionPlan);

    // 4. Generate Mock Tests
    const mockTests = await this.generateMockTests(savedExam);

    // 5. Create Calendar Events
    const calendarEvents = await this.generateCalendarEvents(savedExam, roadmap.data, revisionPlan.data, mockTests, dto.examTime);

    // 6. Sync to Google Calendar
    for (const event of calendarEvents) {
      const gEventId = await this.googleCalendarService.createGoogleEvent(userId, {
        title: event.title,
        date: event.eventDate,
        time: event.eventTime,
        subject: event.subject,
        description: `LEGATRIXON AI Auto-Scheduled ${event.eventType} session.`,
        priority: event.priority,
        category: event.category,
        moduleSource: event.moduleSource,
        reminderMinutes: event.eventType === 'exam' ? savedExam.emailReminderMinutes : undefined,
      });

      if (gEventId) {
        event.googleEventId = gEventId;
        event.isSynced = true;
        await this.calendarEventRepository.save(event);
      }
    }

    // 7. Generate Readiness Snapshot
    await this.calculateAndSaveReadiness(savedExam.id);

    // 8. Generate Initial Recommendations
    await this.generateDailyRecommendations(userId, savedExam);

    // 9. Trigger Notifications
    await this.notificationService.createNotification(
      userId,
      `Exam Profile Created: ${savedExam.subject}`,
      `Successfully generated roadmap, daily schedule, and synchronized calendar events.`
    );

    return savedExam;
  }

  /**
   * Generates custom roadmap milestones using OpenAI with fallback values
   */
  private async generateRoadmapData(exam: Exam): Promise<any> {
    const defaultRoadmap = {
      phases: [
        { name: 'Phase 1: Conceptual Core', days: 10, description: 'Master fundamental provisions, bare act vocabulary, and landmark doctrines.' },
        { name: 'Phase 2: Precedent Matrix', days: 10, description: 'Analyze major judicial rulings, ratios, and conflicting bench perspectives.' },
        { name: 'Phase 3: Revision & Practice', days: 10, description: 'Mock tests, essay outlines, and simulated oral viva practice.' },
      ],
      plans: {
        '30': `30-Day Plan: Master basic concepts, read bare acts of ${exam.subject}, and build foundational summary notes.`,
        '14': `14-Day Plan: Focus on Case Law Precedents, organize leading judgments, and do active recall flashcards.`,
        '7': `7-Day Plan: Rapid revision sprint. Solve prior years university papers and review difficult subjects.`,
        '3': `3-Day Plan: Attempt mock tests under exam conditions. Repair weak areas and outline essay arguments.`,
        '1': `1-Day Plan: Review key statutory provisions, memory tricks, and checklist. Get full rest.`
      }
    };

    const openai = this.getOpenAIClient();
    if (!openai) return defaultRoadmap;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a legal education advisor. Outline a 3-phase study roadmap and add a "plans" object containing specific sub-plans for "30", "14", "7", "3", and "1" days before the exam. Respond ONLY with a JSON object containing a "phases" array (each phase with "name", "days" duration, and detailed "description") and a "plans" object (mapping "30", "14", "7", "3", "1" to concise strategy text).'
          },
          {
            role: 'user',
            content: `Subject: ${exam.subject}, Prep Level: ${exam.prepLevel}, Syllabus Complete: ${exam.syllabusCompletion}%`
          }
        ],
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0].message.content);
    } catch {
      return defaultRoadmap;
    }
  }

  /**
   * Generates a revision schedule plan
   */
  private async generateRevisionPlanData(exam: Exam, roadmapData: any): Promise<any> {
    const defaultPlan = {
      topics: [
        { name: 'Core Statutory Definitions', durationMins: 90, priority: 'High' },
        { name: 'Landmark Judicial Precedents', durationMins: 120, priority: 'High' },
        { name: 'Procedural Validity Checks', durationMins: 90, priority: 'Medium' }
      ]
    };

    const openai = this.getOpenAIClient();
    if (!openai) return defaultPlan;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Outline a revision plan list of specific topics to study. Respond ONLY with a JSON object containing a "topics" array. Each topic must have "name", "durationMins", and "priority".'
          },
          {
            role: 'user',
            content: `Subject: ${exam.subject}, Prep Level: ${exam.prepLevel}. Roadmap: ${JSON.stringify(roadmapData)}`
          }
        ],
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0].message.content);
    } catch {
      return defaultPlan;
    }
  }

  /**
   * Generates mock tests to attempt in the roadmap
   */
  private async generateMockTests(exam: Exam): Promise<MockTest[]> {
    const mockTests: MockTest[] = [];
    const testTitles = [
      'Mock Arena: Multiple Choice Statutory Quiz',
      'Mock Arena: Essay Answer Outline Review',
      'Mock Arena: Comprehensive Peer Exam Sim'
    ];

    for (let i = 0; i < 3; i++) {
      const test = new MockTest();
      test.examId = exam.id;
      test.subject = exam.subject;
      test.title = testTitles[i];
      test.score = null;
      test.totalQuestions = 20;

      const testDate = new Date();
      testDate.setDate(testDate.getDate() + (i + 1) * 7);
      test.date = testDate;
      test.weakSubjects = i === 0 ? ['Procedural Rules'] : [];

      const savedTest = await this.mockTestRepository.save(test);
      mockTests.push(savedTest);
    }

    return mockTests;
  }

  /**
   * Creates local calendar events based on roadmap, revision, and mock test schedules
   */
  private async generateCalendarEvents(
    exam: Exam,
    roadmap: any,
    revisionPlan: any,
    mockTests: MockTest[],
    examTime?: string,
  ): Promise<CalendarEvent[]> {
    const events: CalendarEvent[] = [];

    // Add Exam date itself
    const examEvent = new CalendarEvent();
    examEvent.userId = exam.userId;
    examEvent.examId = exam.id;
    examEvent.title = `Final Exam: ${exam.subject}`;
    examEvent.eventDate = exam.examDate.toISOString().split('T')[0];
    examEvent.eventTime = examTime || exam.examDate.toISOString().slice(11, 16);
    examEvent.subject = exam.subject;
    examEvent.eventType = 'exam';
    events.push(await this.calendarEventRepository.save(examEvent));

    // Add Mock Tests
    for (const test of mockTests) {
      const testEvent = new CalendarEvent();
      testEvent.userId = exam.userId;
      testEvent.examId = exam.id;
      testEvent.title = test.title;
      testEvent.eventDate = test.date.toISOString().split('T')[0];
      testEvent.eventTime = '10:00';
      testEvent.subject = exam.subject;
      testEvent.eventType = 'research';
      events.push(await this.calendarEventRepository.save(testEvent));
    }

    // Add study and revision slots
    const revisionTopics = revisionPlan.topics || [];
    for (let i = 0; i < Math.min(3, revisionTopics.length); i++) {
      const revEvent = new CalendarEvent();
      revEvent.userId = exam.userId;
      revEvent.examId = exam.id;
      revEvent.title = `Revision Session: ${revisionTopics[i].name}`;

      const revDate = new Date();
      revDate.setDate(revDate.getDate() + (i + 1) * 2);

      revEvent.eventDate = revDate.toISOString().split('T')[0];
      revEvent.eventTime = '16:00';
      revEvent.subject = exam.subject;
      revEvent.eventType = 'revision';
      events.push(await this.calendarEventRepository.save(revEvent));
    }

    return events;
  }

  /**
   * Calculate current readiness and predictions (7, 14, 30 days out)
   */
  async calculateAndSaveReadiness(examId: string): Promise<ReadinessSnapshot> {
    const exam = await this.examRepository.findOne({ where: { id: examId } });
    if (!exam) throw new Error('Exam not found.');

    const mockTests = await this.mockTestRepository.find({ where: { examId } });
    const completedMocks = mockTests.filter(t => t.score !== null);
    const mockScoresAvg = completedMocks.length > 0
      ? completedMocks.reduce((sum, t) => sum + t.score, 0) / completedMocks.length
      : 65; // Default peer starting baseline

    const syllabusCompletion = exam.syllabusCompletion;
    const studyHoursTotal = completedMocks.length * 4 + 12; // Derived focus hours
    const revisionProgress = syllabusCompletion > 10 ? syllabusCompletion - 10 : 0;
    const habitCompliance = exam.prepLevel === 'Expert' ? 85 : exam.prepLevel === 'Intermediate' ? 70 : 50;

    // Predictive Analytics Math Formula
    const readinessScore = Math.round(
      (syllabusCompletion * 0.40) +
      (mockScoresAvg * 0.30) +
      (revisionProgress * 0.15) +
      (habitCompliance * 0.15)
    );

    const expected7Days = Math.min(100, readinessScore + Math.round(habitCompliance * 0.10));
    const expected14Days = Math.min(100, readinessScore + Math.round(habitCompliance * 0.18));
    const expected30Days = Math.min(100, readinessScore + Math.round(habitCompliance * 0.35));

    const snapshot = new ReadinessSnapshot();
    snapshot.examId = examId;
    snapshot.syllabusCompletion = syllabusCompletion;
    snapshot.mockScoresAvg = mockScoresAvg;
    snapshot.studyHoursTotal = studyHoursTotal;
    snapshot.revisionProgress = revisionProgress;
    snapshot.habitCompliance = habitCompliance;
    snapshot.readinessScore = readinessScore;
    snapshot.expected7Days = expected7Days;
    snapshot.expected14Days = expected14Days;
    snapshot.expected30Days = expected30Days;

    return this.readinessRepository.save(snapshot);
  }

  /**
   * Retrieve active readiness metrics for Exam CommandCenter
   */
  async getReadinessSnapshot(examId: string): Promise<ReadinessSnapshot | null> {
    return this.readinessRepository.findOne({
      where: { examId },
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * Daily Recommendation Engine Generator
   */
  async generateDailyRecommendations(userId: string, exam: Exam) {
    const list = [
      `Focus on ${exam.subject} syllabus coverage today. Read the bare acts carefully.`,
      `Revise Case Law: review the ratio decidendi of landmark judgments in ${exam.subject}.`,
      `Schedule a 15-minute quick mock test on key definitions to test active recall.`
    ];

    for (const text of list) {
      const rec = new Recommendation();
      rec.userId = userId;
      rec.content = text;
      rec.targetDate = new Date().toISOString().split('T')[0];
      await this.recommendationRepository.save(rec);
    }
  }

  async getRecommendations(userId: string): Promise<Recommendation[]> {
    const targetDate = new Date().toISOString().split('T')[0];
    return this.recommendationRepository.find({ where: { userId, targetDate } });
  }

  /**
   * RAG Query doubt solver pipeline
   * Pipeline: Question -> BGE-M3 dense embeddings -> Qdrant retrieval -> Judgment contexts -> OpenAI -> Answer
   */
  async solveLegalDoubt(userId: string, question: string): Promise<{ answer: string; citations: any[] }> {
    if (!this.legalClassifier.isLegalQuery(question)) {
      return { answer: LEXMENTOR_REJECTION_RESPONSE, citations: [] };
    }

    this.logger.log(`AI Doubt Solver RAG pipeline triggered: "${question}"`);

    // 1. Generate BGE-M3 Dense Embedding vector
    const vector = await this.bgeM3Provider.generateEmbedding(question);

    // 2. Retrieve matched segments from Qdrant acts/judgments collections
    const matchedPoints = [];
    const client = this.qdrantService.getClient();

    try {
      const searchRes = await client.search('judgments', {
        vector,
        limit: 3,
        with_payload: true,
      });
      matchedPoints.push(...searchRes);
    } catch (err) {
      this.logger.warn(`Qdrant retrieval search failed: ${err.message}. Running fallback database.`);
    }

    // 3. Compile context summaries
    let contextStr = '';
    const citations = [];

    if (matchedPoints.length > 0) {
      matchedPoints.forEach((point, idx) => {
        contextStr += `[Source ${idx+1}] Text snippet: ${point.payload?.text || ''}\n`;
        citations.push({
          id: idx + 1,
          title: point.payload?.title || 'Constitutional Law Precedent Reference',
          text: point.payload?.text || '',
        });
      });
    } else {
      // High-precision fallback context if Qdrant is empty
      contextStr = `Material facts of Kesavananda Bharati (1973): Parliament can amend Part III but cannot destroy the basic structure.
Material facts of Maneka Gandhi (1978): Article 21's procedure must be fair, just, and reasonable. Golden Triangle holds Articles 14, 19, and 21 are mutually inclusive.`;
      citations.push({
        id: 1,
        title: 'Kesavananda Bharati v. State of Kerala (1973) 4 SCC 225',
        text: 'The Basic Structure doctrine checks Parliamentary power under Article 368.',
      }, {
        id: 2,
        title: 'Maneka Gandhi v. Union of India (1978) 1 SCC 248',
        text: 'Procedure established by law under Article 21 must be fair, just, and reasonable.',
      });
    }

    // 4. OpenAI grounded reasoning response
    let answer = `Based on the retrieval context, Article 21 and the basic structure doctrine limit arbitrary state actions. The Supreme Court in Maneka Gandhi (1978) held that procedure established by law must be fair, just, and reasonable [Source 2]. Additionally, Kesavananda Bharati (1973) established that the basic structure cannot be destroyed [Source 1].`;

    const openai = this.getOpenAIClient();
    if (openai) {
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a legal expert tutor. Answer the student question using only the retrieved contexts. You MUST cite references like [Source 1], [Source 2] matching your sources. Never answer legal questions without retrieval context.'
            },
            {
              role: 'user',
              content: `Question: ${question}\n\nRetrieval Context:\n${contextStr}`
            }
          ]
        });
        answer = response.choices[0].message.content;
      } catch (err) {
        this.logger.error(`Failed to generate RAG response: ${err.message}`);
      }
    }

    return { answer, citations };
  }

  /**
   * Aggregates and returns the full orchestrated payload after creating an exam
   */
  async createExamAndFetchAll(
    userId: string,
    dto: {
      subject: string;
      examDate: Date;
      prepLevel: 'Beginner' | 'Intermediate' | 'Expert';
      syllabusCompletion: number;
      emailReminderEnabled?: boolean;
      emailReminderMinutes?: number;
      examTime?: string;
      clerkUserId?: string;
      fullName?: string;
      email?: string;
    }
  ) {
    const exam = await this.createExam(userId, dto);

    const roadmap = await this.roadmapRepository.findOne({ where: { examId: exam.id } });
    const revisionPlan = await this.revisionPlanRepository.findOne({ where: { examId: exam.id } });
    const mockTests = await this.mockTestRepository.find({ where: { examId: exam.id } });
    const calendarEvents = await this.calendarEventRepository.find({ where: { examId: exam.id } });
    const readiness = await this.getReadinessSnapshot(exam.id);
    const recommendations = await this.getRecommendations(userId);
    const notifications = await this.notificationService.getTriggeredNotifications(userId);

    return {
      exam,
      roadmap,
      revisionPlan,
      mockTests,
      calendarEvents,
      readiness,
      recommendations,
      notifications
    };
  }

  /**
   * Generates custom strategy prompts using OpenAI or dynamic DB fallbacks
   */
  async generateStrategyForMode(userId: string, mode: string): Promise<string> {
    const exams = await this.examRepository.find({ where: { userId } });
    const events = await this.calendarEventRepository.find({ where: { userId } });
    const examIds = exams.map(e => e.id);
    let mockTests = [];
    if (examIds.length > 0) {
      mockTests = await this.mockTestRepository.find({
        where: examIds.map(id => ({ examId: id }))
      });
    }

    const analytics = await this.calculateAnalytics(userId);

    const openai = this.getOpenAIClient();
    if (openai) {
      try {
        let modeDescription = '';
        if (mode === 'roadmap') {
          modeDescription = 'a Weekly Roadmap showing specific topic blocks and study milestones leading up to their exams.';
        } else if (mode === 'revision') {
          modeDescription = 'a Revision Plan focusing on consolidating notes, landmark judgments, and key case laws.';
        } else if (mode === 'priority') {
          modeDescription = 'Priority Suggestions listing what high-priority tasks and weak subjects to focus on first based on current scores.';
        } else {
          modeDescription = 'a Daily Study Plan outlining how many minutes to study, what topics to target, and how to structure their day.';
        }

        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are LexMentor AI, a calendar-driven legal academic supervisor. Generate ${modeDescription}
Use clear, encouraging, professional, and structured GitHub-flavored markdown with bullet points and bold text.
DO NOT use generic placeholders. Reference their actual exams, mock test average, and calendar events provided.
Keep the output concise (around 100-200 words) so it fits beautifully in the dashboard suggestions box.`
            },
            {
              role: 'user',
              content: `User Data:
- Active Exams: ${JSON.stringify(exams.map(e => ({ subject: e.subject, date: e.examDate, prep: e.prepLevel, syllabus: e.syllabusCompletion })))}
- Calendar Events: ${JSON.stringify(events.map(e => ({ title: e.title, date: e.eventDate, type: e.eventType })))}
- Mock Tests: ${JSON.stringify(mockTests.map(m => ({ title: m.title, score: m.score })))}
- Current Scores: Productivity: ${analytics.productivityScore}%, Consistency: ${analytics.consistencyScore}%, Streak: ${analytics.streak} days, Exam Readiness: ${analytics.examReadiness}%`
            }
          ]
        });

        return response.choices[0].message.content;
      } catch (err) {
        this.logger.error(`Failed to generate LexMentor strategy via OpenAI: ${err.message}`);
      }
    }

    // Fallback generator using actual records
    const urgentExam = exams[0];
    const baseText = urgentExam
      ? `### LexMentor AI™ Study Strategy
**Next Critical Exam**: ${urgentExam.subject} on ${urgentExam.examDate.toISOString().split('T')[0]} (Prep Level: ${urgentExam.prepLevel}, Syllabus: ${urgentExam.syllabusCompletion}%).`
      : `### LexMentor AI™ Study Strategy
No active exams scheduled. Add an exam profile in the Exam Command Center to kickstart your customized study roadmap.`;

    if (mode === 'roadmap') {
      return `${baseText}

#### Weekly Roadmap Milestones:
1. **Days 1-3**: Complete fundamental readings and basic statutory provisions.
2. **Days 4-5**: Master landmark case laws and draft conceptual issue checklists.
3. **Days 6-7**: Attempt a timed simulated paper or diagnostic mock test.
- *Active Streak*: Keep your ${analytics.streak}-day streak alive!`;
    }

    if (mode === 'revision') {
      const pendingMocksCount = mockTests.filter(m => m.score === null).length;
      return `${baseText}

#### SMART Revision Slots:
- **Case Law Consolidation**: Revise ratio decidendi and bench perspectives.
- **Bare Act Memorization**: Drill core statutory rules and procedural validations.
- **Practice Simulators**: You have ${pendingMocksCount} mock tests ready to attempt to boost your ${analytics.examReadiness}% readiness.`;
    }

    if (mode === 'priority') {
      return `${baseText}

#### Action Priorities:
- **Mastery Target**: Improve your current Mastery Score of ${analytics.masteryScore}%.
- **Study Compliance**: Secure your study calendar slots. Consistency is at ${analytics.consistencyScore}%.
- **Weak Topics**: Target subjects with mock scores below 75% first to optimize readiness.`;
    }

    // Default: daily study plan
    return `${baseText}

#### Daily Action Plan:
- **90-Minute Focus Session**: Protect morning study blocks for bare act readings.
- **Active Recall**: Log a flashcard or judgment mastery session today.
- **Log Daily Activity**: Keep logging study hours to maintain productivity (${analytics.productivityScore}%).`;
  }

  /**
   * Calculated Analytics Engine
   */
  async calculateAnalytics(userId: string) {
    const exams = await this.examRepository.find({ where: { userId } });
    const calendarEvents = await this.calendarEventRepository.find({ where: { userId } });
    const examIds = exams.map(e => e.id);

    // 1. Productivity Score: (mock tests * 15) + (study events * 10) + (activity logs * 2), capped at 100
    let completedMockTestsCount = 0;
    if (examIds.length > 0) {
      completedMockTestsCount = await this.mockTestRepository.createQueryBuilder('m')
        .where('m.exam_id IN (:...examIds)', { examIds })
        .andWhere('m.score IS NOT NULL')
        .getCount();
    }

    const studyEventsCount = calendarEvents.filter(e => e.eventType === 'study').length;

    const activityLogsCount = await this.entityManager.getRepository(UserActivityLog).count({
      where: { userId }
    });

    const productivityScore = Math.min(100, (completedMockTestsCount * 15) + (studyEventsCount * 10) + (activityLogsCount * 2));

    // 2. Consistency Score & Streak from last 60 days
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    sixtyDaysAgo.setHours(0, 0, 0, 0);

    const recentLogs = await this.entityManager.getRepository(UserActivityLog)
      .createQueryBuilder('log')
      .where('log.user_id = :userId', { userId })
      .andWhere('log.created_at >= :sixtyDaysAgo', { sixtyDaysAgo })
      .getMany();

    const recentEvents = await this.calendarEventRepository
      .createQueryBuilder('e')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.created_at >= :sixtyDaysAgo', { sixtyDaysAgo })
      .getMany();

    const activeDates = new Set<string>();
    recentLogs.forEach(log => {
      activeDates.add(log.createdAt.toISOString().split('T')[0]);
    });
    recentEvents.forEach(e => {
      if (e.createdAt) {
        activeDates.add(e.createdAt.toISOString().split('T')[0]);
      }
      if (e.eventDate) {
        activeDates.add(e.eventDate);
      }
    });

    // Consistency over last 14 days
    let activeDays14 = 0;
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      if (activeDates.has(dateStr)) {
        activeDays14++;
      }
    }
    const consistencyScore = Math.round((activeDays14 / 14) * 100);

    // Streak count
    let streak = 0;
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (activeDates.has(todayStr) || activeDates.has(yesterdayStr)) {
      let streakDate = new Date();
      if (!activeDates.has(todayStr)) {
        streakDate.setDate(streakDate.getDate() - 1);
      }
      while (true) {
        const dateStr = streakDate.toISOString().split('T')[0];
        if (activeDates.has(dateStr)) {
          streak++;
          streakDate.setDate(streakDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // 3. Exam Readiness
    let examReadiness = 0;
    if (exams.length > 0) {
      const syllabusAvg = exams.reduce((sum, e) => sum + e.syllabusCompletion, 0) / exams.length;
      let mockScoresAvg = 65;
      if (examIds.length > 0) {
        const completedMocks = await this.mockTestRepository.createQueryBuilder('m')
          .where('m.exam_id IN (:...examIds)', { examIds })
          .andWhere('m.score IS NOT NULL')
          .getMany();
        if (completedMocks.length > 0) {
          mockScoresAvg = completedMocks.reduce((sum, m) => sum + m.score, 0) / completedMocks.length;
        }
      }
      examReadiness = Math.round((syllabusAvg + mockScoresAvg) / 2);
    }

    // 4. Revision Confidence: revision events * 15, capped at 100
    const revisionEventsCount = calendarEvents.filter(e => e.eventType === 'revision').length;
    const revisionConfidence = Math.min(100, revisionEventsCount * 15);

    // 5. Research Progress: research events & assets
    const researchNotesCount = await this.entityManager.getRepository(ResearchNote).count({
      where: { userId }
    });
    const researchQueriesCount = await this.entityManager.getRepository(ResearchQuery).count({
      where: { userId }
    });
    const researchEventsCount = calendarEvents.filter(e => e.eventType === 'research').length;
    const researchProgress = Math.min(100, (researchEventsCount * 20) + (researchNotesCount * 10) + (researchQueriesCount * 5));

    // 6. Moot readiness (helper)
    const mootEventsCount = calendarEvents.filter(e => e.eventType === 'moot').length;
    const mootReadiness = Math.min(100, mootEventsCount * 25);

    // 7. Mastery Score: weighted average
    const masteryScore = Math.round(
      (productivityScore * 0.20) +
      (consistencyScore * 0.20) +
      (examReadiness * 0.30) +
      (revisionConfidence * 0.15) +
      (researchProgress * 0.15)
    );

    return {
      productivityScore,
      consistencyScore,
      streak,
      examReadiness,
      revisionConfidence,
      researchProgress,
      mootReadiness,
      masteryScore
    };
  }

  async getStudyLibraryStats(userId: string) {
    const documents = await this.notebookService.listAll(userId);

    const documentsIndexed = documents.length;

    // Extract unique topics from tags and legal concepts
    const topics = new Set<string>();
    documents.forEach(doc => {
      if (doc.tags && Array.isArray(doc.tags)) {
        doc.tags.forEach(t => {
          if (t && !['Ingested', 'PDF', 'DOCX', 'PPTX', 'TXT', 'MD', 'ZIP'].includes(t)) {
            topics.add(t);
          }
        });
      }
      if (doc.legalMetadata) {
        if (Array.isArray(doc.legalMetadata.legalConcepts)) {
          doc.legalMetadata.legalConcepts.forEach(c => topics.add(c));
        }
        if (Array.isArray(doc.legalMetadata.statutes)) {
          doc.legalMetadata.statutes.forEach(s => topics.add(s));
        }
      }
    });

    const topicsIdentified = Array.from(topics);

    // Extract units from the text of syllabus or notes
    const units = new Set<string>();
    const unitRegex = /\b(Unit\s+([IVXLCDM]+|\d+)|Chapter\s+(\d+))\b/gi;
    documents.forEach(doc => {
      if (doc.extractedText) {
        let match;
        const sampleText = doc.extractedText.substring(0, 10000);
        while ((match = unitRegex.exec(sampleText)) !== null) {
          units.add(match[1]);
          if (units.size >= 15) break;
        }
      }
    });

    const unitsDetected = Array.from(units);

    // Counts by documentType
    const previousYearPapersCount = documents.filter(d => d.documentType === 'Previous Year Papers').length;
    const teacherNotesCount = documents.filter(d => d.documentType === 'Teacher Notes').length;

    // Calculate a dynamic coverage score
    let score = 0;
    const docTypes = documents.map(d => d.documentType);
    if (docTypes.includes('Syllabus')) score += 25;
    if (docTypes.includes('Notes') || docTypes.includes('User Notes')) score += 20;
    if (docTypes.includes('Teacher Notes')) score += 20;
    if (docTypes.includes('Previous Year Papers')) score += 20;
    if (docTypes.some(t => ['Books', 'Reference Material', 'Research Paper'].includes(t))) score += 15;
    const coverageScore = Math.min(100, score || (documents.length * 10));

    // Last updated
    let lastUpdated = null;
    if (documents.length > 0) {
      const dates = documents.map(d => new Date(d.uploadedAt).getTime()).filter(Boolean);
      if (dates.length > 0) {
        lastUpdated = new Date(Math.max(...dates)).toISOString();
      }
    }

    return {
      documentsIndexed,
      topicsIdentified: topicsIdentified.length,
      unitsDetected: unitsDetected.length,
      previousYearPapersCount,
      teacherNotesCount,
      coverageScore,
      lastUpdated,
    };
  }

  private detectMockTestTemplate(prompt: string): string {
    const normalized = String(prompt || '').toLowerCase();
    if (/full\s*semester|semester\s*paper/.test(normalized)) return 'Full Semester Paper';
    if (/unit\s*wise|unit\s*[-:]?\s*\d+|unit\s+[ivxlcdm]+\b/.test(normalized)) return 'Unit Wise Test';
    if (/pyq|previous\s*year/.test(normalized)) return 'PYQ Style Paper';
    if (/teacher\s*style|teacher\s*pattern/.test(normalized)) return 'Teacher Style Paper';
    if (/50\s*marks?|fifty\s*marks?/.test(normalized)) return '50 Marks Exam';
    if (/important\s+questions?|high\s*probability|probable/.test(normalized)) return 'Important Questions';
    if (/difficult|advanced|analytical|application\s*based/.test(normalized)) return 'Difficult Practice Test';
    if (/revision|revise|quick\s*test/.test(normalized)) return 'Revision Test';
    return 'AI Prompt';
  }

  private extractRequestedUnitLabel(prompt: string): string | null {
    const match = String(prompt || '').match(/\bunit\s*(?:-|:)?\s*([0-9]+|[ivxlcdm]+)\b/i);
    return match ? match[1].toLowerCase() : null;
  }

  private requestedUnitExists(prompt: string, documents: any[], chunks: any[]): boolean {
    const unit = this.extractRequestedUnitLabel(prompt);
    if (!unit) return true;
    const escapedUnit = unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const unitPattern = new RegExp(`\\bunit\\s*(?:-|:)?\\s*${escapedUnit}\\b`, 'i');
    const haystack = [
      ...documents.map((doc: any) => `${doc.name || ''} ${doc.documentType || ''} ${doc.extractedText || ''}`),
      ...chunks.map((chunk: any) => `${chunk.documentName || ''} ${chunk.section || ''} ${this.chunkText(chunk)}`),
    ].join(' ');
    return unitPattern.test(haystack);
  }

  private buildQuestionTemplateRules(template: string, prompt: string): string {
    const requestedUnit = this.extractRequestedUnitLabel(prompt);
    const unitRule = requestedUnit
      ? `The user requested Unit ${requestedUnit.toUpperCase()}. Generate questions only if the provided chunks explicitly identify or substantively belong to Unit ${requestedUnit.toUpperCase()}; otherwise return the failure JSON.`
      : 'If no unit is requested, infer the best-supported unit/topic from uploaded chunk headings, sections, and repeated concepts.';

    const common = `
QUESTION SOURCE RULES:
- Every question must be derived from actual readable chunk content supplied in CONTEXT CHUNKS.
- Never write a question about a filename, document title, upload status, or missing material.
- Never use question text like 'Discuss legal issues arising from filename.pdf', 'Discuss uploaded material', or any filename-based generic question.
- Every question must have a genuine legal topic, doctrine, provision, issue, case principle, statutory rule, or analytical theme found in a source chunk.
- Use source chunks as evidence, not decoration: the question must be answerable from the cited chunk plus nearby provided chunks.
`;

    const byTemplate: Record<string, string> = {
      'Full Semester Paper': `
TEMPLATE: Full Semester Paper.
- Build a complete semester-style paper with proper sections.
- Mix short, medium, and long descriptive questions.
- Use Section A for short questions, Section B for medium questions, Section C for long analytical questions.
- Total marks should follow the user prompt or uploaded exam pattern; otherwise use a professional 70-100 mark structure supported by the chunks.
`,
      'Unit Wise Test': `
TEMPLATE: Unit Wise Test.
- ${unitRule}
- Focus tightly on that unit/topic and do not drift into unrelated chunks.
- Include a balanced mix of conceptual, doctrinal, and analytical questions from the unit.
`,
      'PYQ Style Paper': `
TEMPLATE: PYQ Style Paper.
- Resemble previous-year style in framing and marks distribution only when uploaded PYQs or exam papers are present.
- Do not claim any question is an actual PYQ unless the source chunk itself contains previous-year questions.
- If no PYQ/exam-pattern chunks are present, create a PYQ-style university paper from uploaded substantive material and label it as style-based, not actual PYQ.
`,
      'Teacher Style Paper': `
TEMPLATE: Teacher Style Paper.
- Create a balanced descriptive and analytical paper.
- Prefer teacher notes/class notes/PPT patterns when those chunks exist.
- Include conceptual, explanation, critique, and application questions.
`,
      '50 Marks Exam': `
TEMPLATE: 50 Marks Exam.
- Total marks must be approximately 50.
- Include proper sections and at least one long-answer section.
- Prefer a structure such as short questions plus 10-mark medium answers plus one or more 20-mark long answers, depending on source coverage.
`,
      'Important Questions': `
TEMPLATE: Important Questions.
- Generate high-probability exam questions from repeated/key concepts, recurring headings, provisions, doctrines, cases, or issues in the uploaded chunks.
- Do not invent importance; base importance on recurrence, headings, syllabus language, teacher emphasis, PYQ overlap, or dense source coverage.
`,
      'Difficult Practice Test': `
TEMPLATE: Difficult Practice Test.
- Generate analytical, critical, comparative, and application-based questions.
- Use problem-style or evaluative framing only where the uploaded material supports it.
- Avoid easy recall questions unless needed as a smaller section.
`,
      'Revision Test': `
TEMPLATE: Revision Test.
- Generate concise exam revision-style questions.
- Focus on active recall, key distinctions, provisions, doctrines, and short analytical prompts.
- Keep sections efficient and revision-friendly while still grounded in chunks.
`,
      'AI Prompt': `
TEMPLATE: AI Prompt Bar.
- Respect the user's instruction exactly where it is supported by uploaded chunks.
- If the user asks for a specific unit/topic/style not found in the uploaded material, return the failure JSON instead of substituting another topic.
- Still follow all strict grounding rules and source citation requirements.
`,
    };

    return `${common}\n${byTemplate[template] || byTemplate['AI Prompt']}`;
  }

  private findQuestionGroundingChunk(question: any, chunks: any[], fallbackIndex: number) {
    const grounding = question?.grounding || {};
    const wanted = String(grounding.sourceChunk || grounding.chunkId || grounding.chunkIndex || '').toLowerCase();
    const wantedDoc = String(grounding.sourceDocument || grounding.documentName || '').toLowerCase();
    const wantedSnippet = String(grounding.snippet || '').replace(/\s+/g, ' ').trim().toLowerCase();

    const byId = chunks.find((chunk: any, idx: number) => {
      const ids = [chunk.id, chunk.chunkId, chunk.chunkIndex, `chunk_${idx + 1}`].map((value) => String(value || '').toLowerCase());
      return wanted && ids.includes(wanted);
    });
    if (byId) return byId;

    const bySnippet = wantedSnippet.length >= 40
      ? chunks.find((chunk: any) => this.chunkText(chunk).toLowerCase().includes(wantedSnippet.slice(0, 120)))
      : null;
    if (bySnippet) return bySnippet;

    const byDoc = wantedDoc
      ? chunks.find((chunk: any) => String(chunk.documentName || chunk.payload?.document_name || '').toLowerCase() === wantedDoc)
      : null;
    return byDoc || chunks[fallbackIndex % chunks.length];
  }

  private hasQuestionSourceOverlap(questionText: string, sourceText: string): boolean {
    const questionTerms = String(questionText || '').toLowerCase().match(/\b[a-z][a-z]{4,}\b/g) || [];
    const legalTerms = questionTerms.filter((term) => !['discuss', 'examine', 'critically', 'analyse', 'analyze', 'explain', 'legal', 'question', 'answer'].includes(term));
    if (legalTerms.length === 0) return false;
    const sourceLower = String(sourceText || '').toLowerCase();
    const overlap = legalTerms.filter((term) => sourceLower.includes(term)).length;
    return overlap >= Math.min(3, legalTerms.length);
  }
  async generateGroundedMockTest(
    userId: string,
    prompt: string,
    docId?: string,
    settings?: {
      libraryOnly?: boolean;
      strictGrounding?: boolean;
      noExternalKnowledge?: boolean;
      noInternetKnowledge?: boolean;
      noModelAssumptions?: boolean;
      priorityOrder?: string[];
      analyzeSources?: string[];
      requiredQuestionGrounding?: {
        sourceDocument?: boolean;
        sourcePage?: boolean;
        sourceChunk?: boolean;
      };
      insufficientMaterialMessage?: string;
      answerDepth?: string;
      answerDetailLevel?: string;
    }
  ) {
    const insufficientMessage = settings?.insufficientMaterialMessage || 'Insufficient study material found for this topic.';
    const mockTemplate = this.detectMockTestTemplate(prompt);
    const templateQuestionRules = this.buildQuestionTemplateRules(mockTemplate, prompt);
    const priorityOrder = settings?.priorityOrder || [
      'Teacher Notes',
      'Previous Year Papers',
      'Exam Pattern',
      'Syllabus',
      'Class Notes',
      'PPT Slides',
      'Reference Material',
    ];

    const documents = await this.notebookService.listAll(userId);
    const examPapers = documents.filter(d =>
      ['Previous Year Papers', 'Previous Year Paper', 'Sample Paper', 'Sample Papers', 'Exam Pattern'].includes(d.documentType) ||
      /question\s*paper|pyq|exam\s*paper|sample\s*paper|exam\s*pattern/i.test(d.name)
    );

    let examPapersText = '';
    for (const paper of examPapers) {
      if (paper.extractedText) {
        examPapersText += `--- Document Name: ${paper.name} ---\n${paper.extractedText.slice(0, 10000)}\n\n`;
      }
    }

    let examPatternAnalysis: any = null;
    if (examPapersText) {
      const analysisSystemPrompt = `You are the EXAM INTELLIGENCE™ Question Paper Analyzer.
Analyze the provided exam question paper text and extract its exact structure and style.
Return ONLY a JSON object matching this schema:
{
  "hasPattern": true,
  "marksDistribution": "Description of marks distribution (e.g., 6 marks, 10 marks, 20 marks)",
  "questionPattern": "e.g., Analytical, descriptive, PCS-J, problem-solving, or essay-based",
  "sectionStructure": "Description of sections (e.g., Section A has short answers, Section B has long answers)",
  "difficultyLevel": "AI inferred difficulty (e.g., High, Medium, Low)",
  "questionStyle": "Specific stylistic rules (e.g., discuss landmark judgments, describe constitutional challenges)",
  "universityFormat": "e.g., University of Delhi LLB end semester style",
  "numberOfQuestions": number,
  "repeatedTopics": ["topic 1", "topic 2"]
}`;
      try {
        const analysisResult = await this.generateJsonWithProviderFallback(analysisSystemPrompt, { examPapersText });
        if (analysisResult && analysisResult.hasPattern) {
          examPatternAnalysis = analysisResult;
        }
      } catch (err) {
        this.logger.warn(`Failed to analyze question papers: ${err.message}`);
      }
    }

    let patternPromptSection = '';
    if (examPatternAnalysis) {
      patternPromptSection = `
EXAM PATTERN TO MATCH EXACTLY (Extracted from uploaded question papers):
- Section Structure: ${examPatternAnalysis.sectionStructure || 'N/A'}
- Marks Distribution: ${examPatternAnalysis.marksDistribution || 'N/A'}
- Question Pattern/Style: ${examPatternAnalysis.questionPattern || 'N/A'}
- Question Style Details: ${examPatternAnalysis.questionStyle || 'N/A'}
- Difficulty Level: ${examPatternAnalysis.difficultyLevel || 'N/A'}
- University Format: ${examPatternAnalysis.universityFormat || 'N/A'}
- Approximate Number of Questions: ${examPatternAnalysis.numberOfQuestions || 'N/A'}
- Repeated/Crucial Topics: ${(examPatternAnalysis.repeatedTopics || []).join(', ') || 'N/A'}

You MUST generate the mock test questions matching this exact format, marks, and styling as closely as possible.

Question generation only: infer the section structure, marks distribution, and question style from the uploaded paper. Do not generate model answers in this call.
`;
    } else {
      patternPromptSection = `
NO QUESTION PAPERS UPLOADED. Generate a standard college/university level descriptive Mock Test:
- Use a suitable college-level marking scheme containing combinations of 5, 10, 15, and 20 mark descriptive questions where supported by the uploaded material.
- Questions should ask for definition, legal framework, source-backed analysis, application, and conclusion.
- Do not generate model answers in this call.
- Ensure the difficulty is appropriate for law school/university students.
`;
    }

    const targetDocs = docId && docId !== 'all'
      ? documents.filter(d => d.id === docId)
      : documents;

    if (targetDocs.some(d => d.status === 'Extraction Failed' || d.status === 'Failed')) {
      return {
        success: false,
        message: 'This file does not contain enough readable legal text for grounded mock test generation. Please upload a clearer PDF, DOCX, text notes, bare act material, judgment PDF, or paste notes manually.',
        questions: []
      };
    }

    const totalWords = targetDocs.reduce((sum, d) => sum + (d.wordCount || 0), 0);
    if (totalWords < 800) {
      return {
        success: false,
        message: 'This file does not contain enough readable legal text for grounded mock test generation. Please upload a clearer PDF, DOCX, text notes, bare act material, judgment PDF, or paste notes manually.',
        questions: []
      };
    }

    const requestedDepth = this.normalizeAnswerDepthKey(settings?.answerDepth || settings?.answerDetailLevel || 'detailed');
    if (requestedDepth === 'detailed' && totalWords < 3000) {
      return {
        success: false,
        message: 'This file does not contain enough readable legal text for grounded mock test generation. Please upload a clearer PDF, DOCX, text notes, bare act material, judgment PDF, or paste notes manually.',
        questions: []
      };
    }

    const searchQuery = `${prompt}. Use only uploaded study material. Prioritize: ${priorityOrder.join(', ')}.`;
    const searchRes = await this.notebookService.searchWorkspace(userId, searchQuery, 'hybrid', docId || 'all', 18);
    const chunks = (searchRes?.matchingChunks || []).filter((chunk: any) => this.isUsableExamSourceText(this.chunkText(chunk)));
    const questionSourceWordCount = this.countAnswerWords(chunks.map((chunk: any) => this.chunkText(chunk)).join(' '));

    if (chunks.length === 0 || questionSourceWordCount < 800) {
      return {
        success: false,
        message: 'This file does not contain enough readable legal text for grounded mock test generation. Please upload a clearer PDF, DOCX, text notes, bare act material, judgment PDF, or paste notes manually.',
        questions: []
      };
    }

    const requestedUnit = this.extractRequestedUnitLabel(prompt);
    if (requestedUnit && !this.requestedUnitExists(prompt, documents, chunks)) {
      return {
        success: false,
        message: `Unit ${requestedUnit.toUpperCase()} was not found in the readable uploaded material. Please upload Unit ${requestedUnit.toUpperCase()} notes/PDF/DOCX/text material or paste the relevant unit notes manually.`,
        questions: []
      };
    }

    const questionPrompt = `You are the LEGATRIXON Personal AI Exam Preparation Workspace mock-test generator.

CORE FLOW:
UPLOAD ONCE -> BUILD STUDY LIBRARY -> GENERATE UNLIMITED MOCK TESTS.

STRICT GROUNDING RULES:
1. Generate questions ONLY from the provided uploaded study-library chunks.
2. Do not use internet knowledge, model memory, or outside facts.
3. If the requested topic, unit, paper style, marks pattern, or concept is not supported by the provided chunks, return exactly: { "success": false, "message": "${insufficientMessage}", "questions": [] }.
4. Every generated question must originate from a specific uploaded chunk and must include source document, source page, and source chunk.
5. Prefer sources in this order: ${priorityOrder.join(' -> ')}.
6. Analyze uploaded Teacher Notes, Class Notes, PPT Slides, Books, Previous Year Papers, Sample Papers, Exam Pattern, Syllabus, Assignments, Question Banks, and Reference Documents when they are present in the provided chunks.
7. Infer question count, total marks, difficulty, question mix, units, and topics from the user's command plus uploaded evidence. These are not form fields.
8. Do not generate filler questions to meet a count. Generate only questions that are well-supported by uploaded material.
9. CRITICAL: Never use unescaped double quotes (") inside any JSON string values (such as titles, messages, questions, snippets, etc.). Use single quotes (') instead for all quoted text, statutory names, or citations. Double quotes must ONLY be used for JSON syntax boundaries.

DESCRIPTIVE QUESTION RULES:
1. Avoid MCQs, one-line questions, true/false, fill in the blanks, or very short recall-based questions.
2. Generate descriptive essay-style questions suitable for law school and university examinations. Questions themselves must be substantive and multi-part where appropriate.
3. Do NOT generate model answers in this call. Generate the paper/questions only.
4. Set 'section' to 'A' for lower marks (e.g. 5 or 6 marks), 'B' for medium marks (e.g. 10 or 15 marks), and 'C' for higher marks (e.g. 20 marks/judiciary).
5. Set 'type' to 'descriptive'.

SELECTED TEMPLATE: ${mockTemplate}
${templateQuestionRules}

${patternPromptSection}

You must respond ONLY with a JSON object conforming to one of these structures:

Failure:
{
  "success": false,
  "message": "${insufficientMessage}",
  "questions": []
}

Success:
{
  "success": true,
  "title": "A precise title for the mock test",
  "subject": "The exam subject inferred from uploaded material",
  "difficulty": "AI inferred from uploaded material and command",
  "totalMarks": number,
  "timeMinutes": number,
  "sourceCoverage": [
    { "unit": "Unit or topic name", "percentage": number }
  ],
  "instructions": ["All questions are grounded in uploaded study materials.", "No external knowledge was used."],
  "questions": [
    {
      "id": "q_1",
      "section": "A" | "B" | "C",
      "type": "descriptive",
      "question": "Descriptive, analytical exam question text",
      "marks": number,
      "grounding": {
        "sourceDocument": "Exact uploaded document name",
        "documentName": "Exact uploaded document name",
        "sourcePage": number,
        "pageNumber": number,
        "sourceChunk": "chunk index/id from the provided context",
        "snippet": "Direct text snippet from the uploaded chunk used to make this question",
        "topic": "Topic name",
        "unit": "Unit name if available",
        "confidenceScore": number
      }
    }
  ]
}`;

    const contextPayload = chunks.map((chunk, idx) => ({
      sourceChunk: chunk.id || chunk.chunkId || chunk.chunkIndex || `chunk_${idx + 1}`,
      index: idx + 1,
      documentName: chunk.documentName || 'Unknown Document',
      pageNumber: chunk.pageNumber || chunk.payload?.page_number || chunk.payload?.pageNumber || 1,
      section: chunk.section || chunk.payload?.section || null,
      content: this.chunkText(chunk)
    }));

    try {
      const response = await this.generateJsonWithProviderFallback(questionPrompt, {
        prompt,
        selectedTemplate: mockTemplate,
        templateQuestionRules,
        groundingPriority: priorityOrder,
        chunks: contextPayload
      });

      if (response?.success === false || !Array.isArray(response?.questions) || response.questions.length === 0) {
        return {
          success: false,
          message: response?.message || 'The selected study material is insufficient or too thin to generate a professional legal question paper. Please upload clearer and more detailed PDF/DOCX/text notes, bare acts, or judgment materials.',
          questions: []
        };
      }

      const forbiddenQuestion = /(insufficient|uploaded material|uploaded study material|uploaded study materials|filename\.pdf|\.pdf\b|\.docx\b|generic fallback|no content|not enough details|placeholder|arising from the uploaded|legal issues arising from|document\s+name|file\s+name)/i;
      const questionShells = response.questions.map((question: any, idx: number) => {
        const questionText = String(question.question || '').replace(/\s+/g, ' ').trim();
        const groundingChunk = this.findQuestionGroundingChunk(question, chunks, idx);
        const sourceText = this.chunkText(groundingChunk);
        if (!questionText || forbiddenQuestion.test(questionText) || !sourceText || !this.hasQuestionSourceOverlap(questionText, sourceText)) {
          throw new Error('Generated question was not sufficiently grounded in an extracted readable source chunk.');
        }

        const chunkId = groundingChunk.id || groundingChunk.chunkId || groundingChunk.chunkIndex || `chunk_${idx + 1}`;
        const documentName = groundingChunk.documentName || groundingChunk.payload?.document_name || groundingChunk.payload?.title || 'Uploaded Study Library';
        const pageNumber = groundingChunk.pageNumber || groundingChunk.payload?.page_number || groundingChunk.payload?.pageNumber || 1;
        const grounding = question.grounding || {};
        return {
          ...question,
          id: question.id || `q_${idx + 1}`,
          type: 'descriptive',
          template: mockTemplate,
          question: questionText,
          grounding: {
            ...grounding,
            sourceDocument: documentName,
            documentName,
            sourcePage: pageNumber,
            pageNumber,
            sourceChunk: chunkId,
            snippet: sourceText.slice(0, 700),
            confidenceScore: Math.max(Number(grounding.confidenceScore || 0.75), 0.75),
          },
        };
      });

      const answerDepth = this.normalizeAnswerDepthKey(settings?.answerDepth || settings?.answerDetailLevel || 'detailed');
      const questions = [];
      for (const question of questionShells) {
        const answer = await this.generateGroundedModelAnswerForQuestion(userId, prompt, question, docId, answerDepth, insufficientMessage)
          .catch((error) => {
            this.logger.warn(`Skipping model answer for ${question.id}: ${error.message}`);
            if (error.message?.includes('AI provider') || error.message?.includes('API key') || error.message?.includes('configured correctly')) {
              throw error;
            }
            const sourceChunks = question.grounding?.sourceChunks || (question.grounding ? [{
              chunkId: question.grounding.sourceChunk,
              documentName: question.grounding.documentName || question.grounding.sourceDocument,
              pageNumber: question.grounding.pageNumber || question.grounding.sourcePage,
              excerpt: question.grounding.snippet || '',
            }].filter((chunk) => chunk.excerpt) : []);
            return this.buildInsufficientAnswer(
              question,
              'Unable to generate grounded long answer because the uploaded material does not contain enough readable legal text. Please upload clearer notes, bare act material, textbook extracts, judgments, or paste text manually.',
              sourceChunks,
            );
          });
        questions.push({ ...question, ...answer });
      }

      const docIdsUsed = docId && docId !== 'all' ? [docId] : documents.map(d => d.id);

      // Save to AiMockTest table
      const newTest = this.aiMockTestRepository.create({
        userId,
        topic: response.subject || response.title || prompt,
        difficulty: response.difficulty || 'AI inferred from uploaded material',
        questionType: 'descriptive',
        questionCount: questions.length,
        mode: 'interactive',
        sourceIds: docIdsUsed,
        questions,
        scoreReport: {
          totalMarks: response.totalMarks || questions.reduce((sum: number, q: any) => sum + Number(q.marks || 0), 0),
          scoringRule: 'Grounded university style descriptive mock test with separately generated source-backed model answers.',
        },
        weakAreas: [],
      });
      const savedTest = await this.aiMockTestRepository.save(newTest);

      return {
        id: savedTest.id,
        success: true,
        title: response.title || savedTest.topic,
        subject: response.subject || savedTest.topic,
        difficulty: savedTest.difficulty,
        totalMarks: savedTest.scoreReport.totalMarks,
        timeMinutes: response.timeMinutes || Math.max(30, questions.length * 10),
        sourceCoverage: response.sourceCoverage || [],
        instructions: response.instructions || ['All questions are grounded in uploaded study materials.', 'No external knowledge was used.'],
        questions: savedTest.questions
      };
    } catch (error) {
      this.logger.error(`Failed to generate grounded mock test: ${error.message}`);
      return {
        success: false,
        message: error?.message?.includes('grounded')
          ? 'The model attempted to generate a question that was not grounded in readable uploaded chunks. Please upload clearer or more topic-specific legal material.'
          : (error.message || 'Could not generate grounded mock test.'),
        questions: []
      };
    }
  }

  private readonly answerDepthConfig = {
    short: {
      label: 'Short Answer',
      minWords: 300,
      maxWords: 500,
      maxTokens: 1200,
    },
    medium: {
      label: 'Medium Answer',
      minWords: 700,
      maxWords: 1000,
      maxTokens: 2500,
    },
    long: {
      label: 'Long Answer',
      minWords: 1200,
      maxWords: 1600,
      maxTokens: 4000,
    },
    detailed: {
      label: '3-4 Page Detailed Answer',
      minWords: 1700,
      maxWords: 2200,
      maxTokens: 6500,
    },
  } as const;

  private normalizeAnswerDepthKey(selectedDepth: any): keyof ExamService['answerDepthConfig'] {
    const depth = String(selectedDepth || '').toLowerCase();
    if (depth === 'short' || depth.includes('short')) return 'short';
    if (depth === 'medium' || depth.includes('medium')) return 'medium';
    if (depth === 'detailed' || depth.includes('detailed') || depth.includes('3-4') || depth.includes('page')) return 'detailed';
    if (depth === 'long' || depth.includes('long')) return 'long';
    return 'detailed';
  }

  private getAnswerLengthByMarks(marks: number, selectedDepth: keyof ExamService['answerDepthConfig']) {
    if (selectedDepth !== 'detailed') {
      const config = this.answerDepthConfig[selectedDepth];
      return {
        minWords: config.minWords,
        maxWords: config.maxWords,
        label: `${config.minWords}-${config.maxWords} words`,
        maxTokens: config.maxTokens,
        depth: selectedDepth,
      };
    }

    const numericMarks = Number(marks || 0);
    if (numericMarks <= 5) return { minWords: 300, maxWords: 600, label: '300-600 words', maxTokens: 1800, depth: 'detailed' as const };
    if (numericMarks <= 10) return { minWords: 900, maxWords: 1300, label: '900-1300 words', maxTokens: 4200, depth: 'detailed' as const };
    if (numericMarks <= 15) return { minWords: 1300, maxWords: 1700, label: '1300-1700 words', maxTokens: 5200, depth: 'detailed' as const };
    return { minWords: 1700, maxWords: 2200, label: '1700-2200 words', maxTokens: 6500, depth: 'detailed' as const };
  }

  private countWords(text: string) {
    return String(text || '').trim().split(/\s+/).filter(Boolean).length;
  }

  private answerLengthRange(marks: number, depth: keyof ExamService['answerDepthConfig']) {
    const config = this.getAnswerLengthByMarks(marks, depth);
    return {
      min: config.minWords,
      max: config.maxWords,
      label: config.label,
      maxTokens: config.maxTokens,
      depth: config.depth,
    };
  }

  private countAnswerWords(text: string) {
    return this.countWords(text);
  }
  private chunkText(chunk: any) {
    const cleaned = String(chunk?.rawExcerpt || chunk?.summary || chunk?.text || chunk?.content || chunk?.payload?.text || chunk?.payload?.chunk_text || chunk?.payload?.content || '').replace(/\s+/g, ' ').trim();
    const badChars = (cleaned.match(/[\uFFFD\x00-\x08\x0E-\x1F]/g) || []).length;
    const pdfNoise = (cleaned.match(/\b(?:obj|endobj|stream|endstream|xref|trailer|FlateDecode|startxref)\b/g) || []).length;
    if (badChars / Math.max(1, cleaned.length) > 0.01 || pdfNoise > 8) return '';
    return cleaned;
  }

  private isUsableExamSourceText(text: string) {
    const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
    if (cleaned.length < 450) return false;
    const badChars = (cleaned.match(/[\uFFFD\x00-\x08\x0E-\x1F]/g) || []).length;
    const alphaWords = (cleaned.match(/\b[A-Za-z][A-Za-z]{2,}\b/g) || []).length;
    const sentenceSignals = (cleaned.match(/[.!?]\s+[A-Z0-9]/g) || []).length;
    const pdfNoise = (cleaned.match(/\b(?:obj|endobj|stream|endstream|xref|trailer|FlateDecode|startxref)\b/g) || []).length;
    const fallbackNoise = /(uploaded material is insufficient|does not contain sufficient information|discuss legal issues arising from filename|ocr pending|text extraction and indexing pending|insufficient study material found)/i.test(cleaned);
    return !fallbackNoise && badChars / Math.max(1, cleaned.length) < 0.01 && alphaWords >= 80 && sentenceSignals >= 3 && pdfNoise < 12;
  }

  private sourceChunksForAnswer(chunks: any[]) {
    return chunks
      .map((chunk, idx) => ({
        sourceChunk: chunk.id || chunk.chunkId || chunk.chunkIndex || `chunk_${idx + 1}`,
        chunkId: chunk.id || chunk.chunkId || chunk.chunkIndex || `chunk_${idx + 1}`,
        documentName: chunk.documentName || chunk.payload?.name || chunk.payload?.document_name || chunk.payload?.title || 'Uploaded Study Library',
        pageNumber: chunk.pageNumber || chunk.payload?.page_number || chunk.payload?.pageNumber || 1,
        section: chunk.section || chunk.payload?.section || null,
        excerpt: this.chunkText(chunk).slice(0, 900),
      }))
      .filter((chunk) => chunk.excerpt.length > 0);
  }

  private supportedLegalReferences(sourceText: string, values: any[], pattern: RegExp) {
    const source = String(sourceText || '');
    const found = new Set((source.match(pattern) || []).map((item) => item.toLowerCase()));
    return (Array.isArray(values) ? values : [])
      .map((value) => String(value || '').trim())
      .filter((value) => value && found.has(value.toLowerCase()));
  }
  private buildInsufficientAnswer(question: any, warning: string, sourceChunks: any[] = []) {
    return {
      modelAnswer: '',
      wordCount: 0,
      answerWordCount: 0,
      answerDepth: 'insufficient_source',
      answerLengthTarget: '',
      insufficientMaterialWarning: warning,
      answerGenerationStatus: 'Insufficient Source Material',
      sourceChunks,
      importantJudgments: [],
      relevantArticles: [],
      relevantSections: [],
      grounding: {
        ...(question.grounding || {}),
        sourceChunks,
        sourceChunk: sourceChunks[0]?.chunkId || question.grounding?.sourceChunk,
        snippet: sourceChunks[0]?.excerpt || question.grounding?.snippet,
      },
    };
  }

  private hasDiverseRetrievedContext(sourceChunks: any[]): boolean {
    if (sourceChunks.length <= 1) return true;
    const chunkIds = new Set(sourceChunks.map((chunk) => String(chunk.chunkId || chunk.sourceChunk || '').toLowerCase()).filter(Boolean));
    const hasOnlyLocalOne = chunkIds.size === 1 && chunkIds.has('local_chunk_1');
    return !hasOnlyLocalOne;
  }

  private extractSourceLegalConcepts(sourceText: string) {
    const source = String(sourceText || '').replace(/\s+/g, ' ');
    const concepts = new Set<string>();
    const patterns = [
      /\bArticle\s+\d+[A-Z]?(?:\([^)]+\))?/gi,
      /\bSection\s+\d+[A-Z]?(?:\([^)]+\))?/gi,
      /\b[A-Z][A-Za-z.&() ]+\s+v(?:s\.?|ersus)?\s+[A-Z][A-Za-z.&() ]+(?:\s*\(\d{4}\))?/g,
      /\b(?:Constitution|Code|Act|Rules|Doctrine|Principle|Right|Duty|Liability|Jurisdiction|Remedy|Writ|Contract|Tort|Evidence|Procedure|Offence|Mens rea|Actus reus|Negligence|Consideration|Estoppel|Res judicata|Natural justice|Judicial review)\b(?:\s+(?:of|under|against|and)\s+[A-Za-z][A-Za-z]+)?/gi,
    ];
    patterns.forEach((pattern) => {
      const matches = source.match(pattern) || [];
      matches.forEach((match) => {
        const cleaned = match.replace(/\s+/g, ' ').trim();
        if (cleaned.length >= 4 && cleaned.length <= 120) concepts.add(cleaned.toLowerCase());
      });
    });

    const capitalizedPhrases = source.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,5}\b/g) || [];
    capitalizedPhrases.slice(0, 80).forEach((phrase) => {
      const cleaned = phrase.replace(/\s+/g, ' ').trim();
      if (!/^(Source|File|Page|Chunk|Text|Uploaded Study Material)$/i.test(cleaned)) concepts.add(cleaned.toLowerCase());
    });
    return Array.from(concepts);
  }

  private hasExcessiveRepetition(modelAnswer: string) {
    const sentences = String(modelAnswer || '').split(/(?<=[.!?])\s+/).map((sentence) => sentence.replace(/\s+/g, ' ').trim().toLowerCase()).filter((sentence) => sentence.length > 35);
    if (sentences.length >= 8) {
      const repeated = sentences.length - new Set(sentences).size;
      if (repeated / sentences.length > 0.18) return true;
    }
    const words = String(modelAnswer || '').toLowerCase().match(/\b[a-z][a-z]{3,}\b/g) || [];
    if (words.length < 80) return false;
    const trigrams: string[] = [];
    for (let i = 0; i < words.length - 2; i += 1) trigrams.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    const counts = new Map<string, number>();
    trigrams.forEach((gram) => counts.set(gram, (counts.get(gram) || 0) + 1));
    return Array.from(counts.values()).some((count) => count >= 5);
  }

  private hasUnsupportedLegalReferences(modelAnswer: string, sourceText: string) {
    const source = String(sourceText || '').toLowerCase();
    const answer = String(modelAnswer || '');
    const referencePatterns = [
      /\b[A-Z][A-Za-z.&() ]+\s+v(?:s\.?|ersus)?\s+[A-Z][A-Za-z.&() ]+(?:\s*\(\d{4}\))?/g,
      /\bArticle\s+\d+[A-Z]?(?:\([^)]+\))?/gi,
      /\bSection\s+\d+[A-Z]?(?:\([^)]+\))?/gi,
      /\b\d{4}\s+\(?\d+\)?\s+(?:SCC|AIR|SCR|CriLJ|All|Bom|Cal|Mad|Del)\b/gi,
    ];
    for (const pattern of referencePatterns) {
      const refs = answer.match(pattern) || [];
      for (const ref of refs) {
        const normalized = ref.replace(/\s+/g, ' ').trim().toLowerCase();
        if (normalized.length > 4 && !source.includes(normalized)) return true;
      }
    }
    return false;
  }

  private validateGeneratedAnswerQuality(
    modelAnswer: string,
    sourceText: string,
    range: { min: number; max: number },
    sourceChunks: any[] = [],
    question: any = {},
  ) {
    const warningMessage = 'Unable to generate grounded long answer because the uploaded material does not contain enough readable legal text. Please upload clearer notes, bare act material, textbook extracts, judgments, or paste text manually.';
    const answer = String(modelAnswer || '').trim();
    const forbidden = /(INSUFFICIENT_GROUNDED_MATERIAL|uploaded material is insufficient|does not contain sufficient information|not enough information|discuss legal issues arising from filename|filename\.pdf|professional framework|present question requires examination of|no clean statutory provision|source limitation|limitations? of (?:the )?source|generic fallback|locally generated fallback|cannot answer|no information|text does not mention|not mentioned in the provided|insufficient context|not provided in the context|context does not contain|the provided material only|available material does not|in absence of specific|framework for answering)/i;
    if (!answer || forbidden.test(answer)) {
      return { ok: false, reason: warningMessage };
    }

    const filenameSignals = /(\b[\w -]+\.(?:pdf|docx|doc|txt)\b|filename\.pdf|file\s+name|document\s+name|uploaded\s+file)/i;
    const questionText = String(question?.question || question?.topic || '');
    if (filenameSignals.test(answer) || filenameSignals.test(questionText)) {
      return { ok: false, reason: warningMessage };
    }

    const wordCount = this.countAnswerWords(answer);
    const minWithTolerance = Math.round(range.min * 0.85);
    if (wordCount < minWithTolerance) {
      return { ok: false, reason: `Generated answer is ${wordCount} words, below the required ${range.min} word minimum.` };
    }
    if (wordCount > Math.round(range.max * 1.30)) {
      return { ok: false, reason: `Generated answer is ${wordCount} words, above the required ${range.max} word maximum.` };
    }

    const usableChunkCount = sourceChunks.filter((chunk) => this.countAnswerWords(chunk?.excerpt || this.chunkText(chunk)) >= 40).length;
    if (usableChunkCount < 1) {
      return { ok: false, reason: warningMessage };
    }

    const warningWords = (answer.match(/\b(?:insufficient|missing|unavailable|not provided|not mentioned|cannot answer|unable to generate|source limitation|uploaded material)\b/gi) || []).length;
    if (warningWords / Math.max(1, wordCount) > 0.025) {
      return { ok: false, reason: warningMessage };
    }

    const genericTemplateWords = (answer.match(/\b(?:framework|template|approach|structure|placeholder|generic|in general|broadly speaking|students should write|answer may be written)\b/gi) || []).length;
    if (genericTemplateWords / Math.max(1, wordCount) > 0.02) {
      return { ok: false, reason: warningMessage };
    }

    if (this.hasExcessiveRepetition(answer)) {
      return { ok: false, reason: 'Generated answer was excessively repetitive and was not accepted as a final model answer.' };
    }

    if (this.hasUnsupportedLegalReferences(answer, sourceText)) {
      return { ok: false, reason: warningMessage };
    }

    const chunkTextCombined = String(sourceText || '').toLowerCase();
    const answerTerms = Array.from(new Set(answer.toLowerCase().match(/\b[a-z][a-z]{5,}\b/g) || []));
    const overlap = answerTerms.filter((term) => chunkTextCombined.includes(term)).length;
    if (answerTerms.length >= 30 && overlap / answerTerms.length < 0.15) {
      return { ok: false, reason: warningMessage };
    }

    const sourceConcepts = this.extractSourceLegalConcepts(sourceText);
    const answerLower = answer.toLowerCase();
    const conceptHits = sourceConcepts.filter((concept) => answerLower.includes(concept)).length;
    const requiredConceptHits = Math.min(3, Math.max(1, Math.floor(sourceConcepts.length * 0.08)));
    if (sourceConcepts.length >= 3 && conceptHits < requiredConceptHits) {
      return { ok: false, reason: warningMessage };
    }

    return { ok: true, reason: '' };
  }

  private async generateGroundedModelAnswerForQuestion(
    userId: string,
    paperPrompt: string,
    question: any,
    docId: string | undefined,
    answerDepth: keyof ExamService['answerDepthConfig'],
    insufficientMessage: string,
  ) {
    const marks = Number(question.marks || 10);
    const range = this.answerLengthRange(marks, answerDepth);
    const detailedMode = range.depth === 'detailed';
    const topK = detailedMode ? 15 : 8;
    const query = `${paperPrompt}\n${question.question}\n${question.topic || ''}`;
    const searchRes = await this.notebookService.searchWorkspace(userId, query, 'hybrid', docId || 'all', topK);
    const chunks = (searchRes?.matchingChunks || []).filter((chunk: any) => this.isUsableExamSourceText(this.chunkText(chunk)));
    
    if (!chunks.length) {
      throw new BadRequestException('Unable to generate grounded long answer because the uploaded material does not contain enough readable legal text. Please upload clearer notes, bare act material, textbook extracts, judgments, or paste text manually.');
    }

    const verifiedChunks = await this.retrieveVerifiedLegalSources(query, detailedMode ? 6 : 4);
    const allChunks = [...chunks, ...verifiedChunks];
    const sourceChunks = this.sourceChunksForAnswer(allChunks).slice(0, detailedMode ? 15 : 12);
    const userSourceChunks = this.sourceChunksForAnswer(chunks).slice(0, topK);
    const sourceText = allChunks.map((chunk) => this.chunkText(chunk)).filter(Boolean).join('\n\n');
    const userSourceText = chunks.map((chunk) => this.chunkText(chunk)).filter(Boolean).join('\n\n');
    const sourceWordCount = this.countAnswerWords(userSourceText);
    const warnings: string[] = [];

    const minimumSourceWords = Math.max(700, Math.floor(range.min * 0.75));
    if (sourceWordCount < minimumSourceWords || !this.hasDiverseRetrievedContext(userSourceChunks)) {
      throw new BadRequestException('Unable to generate grounded long answer because the uploaded material does not contain enough readable legal text. Please upload clearer notes, bare act material, textbook extracts, judgments, or paste text manually.');
    }

    const schema = `{
      "modelAnswer": "Full legal subjective answer in markdown headings and paragraphs",
      "importantJudgments": ["Only case names/citations explicitly present in provided chunks"],
      "relevantArticles": ["Only Article references explicitly present in provided chunks"],
      "relevantSections": ["Only Section references explicitly present in provided chunks"],
      "insufficientMaterialWarning": "Warning text or empty string"
    }`;
    const retrievedContext = sourceChunks.map((chunk, index) => [
      `Source ${index + 1}`,
      `File: ${chunk.documentName || 'Uploaded Study Material'}`,
      `Page: ${chunk.pageNumber || 1}`,
      `Chunk: ${chunk.chunkId || chunk.sourceChunk || `chunk_${index + 1}`}`,
      `Text: ${chunk.excerpt || ''}`,
    ].join('\n')).join('\n\n');

    const answerPrompt = `You are LEGATRIXON AI, an expert Indian legal exam answer generator for law students, university exams, and judiciary mains preparation.

Generate a real, detailed, professional subjective legal exam answer strictly grounded in retrieved uploaded material.

Rules:
- Answer the actual legal question.
- Do not use filename as topic.
- Do not write generic fallback frameworks.
- Follow required word count.
- Use formal legal language.
- Use headings and subheadings.
- Include legal principles from source.
- Include statutory provisions only if present in source.
- Include case laws/judgments only if present in source.
- Do not invent fake cases, judgments, citations, sections, articles, doctrines, courts, years, or facts.
- Avoid repetition and filler.
- Make the answer useful for law students and judiciary aspirants.

Structure:
1. Introduction
2. Background and Context
3. Legal Issues
4. Relevant Statutory Framework / Legal Principles
5. Detailed Explanation
6. Case Laws and Judgments, only if present in source
7. Critical Analysis
8. Application / Exam-Relevant Discussion
9. Important Points for Answer Writing
10. Conclusion
11. Source Grounding

If source material is insufficient, do not generate a long answer. Return a warning only.

---
SYSTEM CONTEXT FOR GENERATION:
Question: ${question.question}
Marks: ${marks}
Required word range: ${range.min} to ${range.max} words
Retrieved uploaded material:
${retrievedContext}

CRITICAL JSON REQUIREMENT:
You must output ONLY valid JSON matching this schema: ${schema}
If source material is insufficient, set "modelAnswer" exactly to "INSUFFICIENT_GROUNDED_MATERIAL". Use single quotes inside string values to avoid breaking JSON.`;
    let generated: any = {};
    if (allChunks.length) {
      generated = await this.generateJsonWithProviderFallback(answerPrompt, {
        question,
        requiredWordRange: range,
        sourceChunks,
      }).catch((error) => {
        this.logger.warn(`Grounded answer generation failed for ${question.id}: ${error.message}`);
        throw new BadRequestException('Could not generate a professional grounded model answer from the uploaded chunks. No fallback answer was created. Please retry or upload clearer material.');
      });
    }

    let modelAnswer = String(generated.modelAnswer || '').trim();
    let quality = this.validateGeneratedAnswerQuality(modelAnswer, sourceText, range, sourceChunks, question);

    if (!quality.ok) {
      const retryPrompt = `${answerPrompt}\n\nQUALITY CHECK FAILED: ${quality.reason}\n\nRegenerate the answer once from scratch. The new answer must pass these checks:\n- It must answer the actual legal question, not the filename or uploaded document name.\n- It must mention concrete legal concepts, provisions, principles, doctrines, or cases that appear in the retrieved source.\n- It must not contain warning paragraphs, source limitation paragraphs, generic frameworks, or template advice.\n- It must not invent citations, cases, sections, articles, judges, courts, years, doctrines, or facts.\n- It must avoid repetitive filler and stay within ${range.min}-${range.max} words.\n- If the source cannot support a real answer, return JSON with modelAnswer exactly 'INSUFFICIENT_GROUNDED_MATERIAL'.`;
      const retry = await this.generateJsonWithProviderFallback(retryPrompt, {
        question,
        failedQualityReason: quality.reason,
        previousRejectedAnswer: modelAnswer.slice(0, 1500),
        requiredWordRange: range,
        sourceChunks,
      }).catch((error) => {
        this.logger.warn(`Grounded answer quality retry failed for ${question.id}: ${error.message}`);
        return {};
      });
      const retryAnswer = String(retry?.modelAnswer || '').trim();
      const retryQuality = this.validateGeneratedAnswerQuality(retryAnswer, sourceText, range, sourceChunks, question);
      if (retryAnswer && retryQuality.ok) {
        generated = { ...generated, ...retry };
        modelAnswer = retryAnswer;
        quality = retryQuality;
      } else {
        this.logger.warn(`Grounded answer rejected after retry for ${question.id}: ${retryQuality.reason || quality.reason}`);
      }
    }

    let wordCount = this.countAnswerWords(modelAnswer);

    if (allChunks.length && wordCount < range.min && sourceWordCount >= Math.max(1000, Math.floor(range.min * 1.1))) {
      const expandPrompt = `${answerPrompt}\n\nThe previous answer was ${wordCount} words, which is below the required ${range.min}-${range.max} words. Expand it using the same required structure and only the uploaded material and verified source context. Add deeper legal explanation, critical analysis, application, exam-oriented important points, and source grounding. Do not use generic filler or repeat sentences. Do not invent unsupported citations or use warning/source limitation paragraphs.`;
      const expanded = await this.generateJsonWithProviderFallback(expandPrompt, {
        question,
        previousAnswer: modelAnswer,
        requiredWordRange: range,
        sourceChunks,
      }).catch((error) => {
        this.logger.warn(`Grounded answer expansion failed for ${question.id}: ${error.message}`);
        return {};
      });
      if (expanded?.modelAnswer) {
        const expandedAnswer = String(expanded.modelAnswer).trim();
        const expandedQuality = this.validateGeneratedAnswerQuality(expandedAnswer, sourceText, range, sourceChunks, question);
        if (expandedAnswer && (expandedQuality.ok || expandedQuality.reason.includes('below the required'))) {
          generated = { ...generated, ...expanded };
          modelAnswer = expandedAnswer;
          wordCount = this.countAnswerWords(modelAnswer);
        }
      }
    }

    // Smart truncation: if answer is slightly over max (within 30%), truncate to max instead of rejecting
    if (wordCount > range.max && wordCount <= Math.round(range.max * 1.30)) {
      const sentences = modelAnswer.split(/((?<=[.!?])\s+)/);
      let truncated = '';
      let truncatedWordCount = 0;
      for (const sentence of sentences) {
        const nextCount = truncatedWordCount + this.countAnswerWords(sentence);
        if (nextCount > range.max && truncatedWordCount >= range.min) break;
        truncated += sentence;
        truncatedWordCount = nextCount;
      }
      if (truncatedWordCount >= range.min) {
        modelAnswer = truncated.trim();
        wordCount = this.countAnswerWords(modelAnswer);
        this.logger.log(`Smart truncation applied for ${question.id}: trimmed to ${wordCount} words (target: ${range.min}-${range.max}).`);
      }
    }

    quality = this.validateGeneratedAnswerQuality(modelAnswer, sourceText, range, sourceChunks, question);
    if (!quality.ok) {
      throw new BadRequestException(quality.reason || 'Unable to generate grounded long answer because the uploaded material does not contain enough readable legal text. Please upload clearer notes, bare act material, textbook extracts, judgments, or paste text manually.');
    }

    return {
      modelAnswer,
      wordCount,
      answerWordCount: wordCount,
      answerDepth: range.depth,
      answerLengthTarget: `${range.min}-${range.max} words`,
      insufficientMaterialWarning: warnings.length ? Array.from(new Set(warnings)).join(' ') : '',
      sourceChunks,
      importantJudgments: this.supportedLegalReferences(sourceText, generated.importantJudgments, /\b[A-Z][A-Za-z.&() ]+\s+v(?:s\.?|ersus)?\s+[A-Z][A-Za-z.&() ]+(?:\s*\(\d{4}\))?/g),
      relevantArticles: this.supportedLegalReferences(sourceText, generated.relevantArticles, /\bArticle\s+\d+[A-Z]?(?:\([^)]+\))?/gi),
      relevantSections: this.supportedLegalReferences(sourceText, generated.relevantSections, /\bSection\s+\d+[A-Z]?(?:\([^)]+\))?/gi),
      grounding: {
        ...(question.grounding || {}),
        sourceChunks,
        sourceChunk: sourceChunks[0]?.chunkId || question.grounding?.sourceChunk,
        snippet: sourceChunks[0]?.excerpt || question.grounding?.snippet,
      },
    };
  }
  async regenerateGroundedMockAnswer(userId: string, body: { prompt?: string; question: any; docId?: string; answerDepth?: string; insufficientMaterialMessage?: string }) {
    if (!body?.question?.question) {
      throw new Error('Question text is required to regenerate a model answer.');
    }
    return this.generateGroundedModelAnswerForQuestion(
      userId,
      String(body.prompt || body.question.topic || body.question.question || 'Mock test answer'),
      body.question,
      body.docId || undefined,
      this.normalizeAnswerDepthKey(body.answerDepth || 'detailed'),
      String(body.insufficientMaterialMessage || 'Insufficient study material found for this topic.'),
    );
  }
  async generatePredictedAnalysis(userId: string) {
    const documents = await this.notebookService.listAll(userId);
    if (documents.length === 0) {
      return {
        success: false,
        message: 'Your Study Library is empty. Please upload syllabus, previous year papers, or study notes first.'
      };
    }

    // Retrieve relevant overview/weightage chunks from the library
    const searchRes = await this.notebookService.searchWorkspace(userId, 'syllabus important questions exam weightage PYQ trends', 'hybrid', 'all', 20);
    const chunks = (searchRes?.matchingChunks || []).filter((chunk: any) => this.isUsableExamSourceText(this.chunkText(chunk)));

    const systemPrompt = `You are the EXAM INTELLIGENCE™ Predicted Analysis Engine.
Analyze the provided document chunks from the student's Study Library (containing syllabus, notes, papers, patterns, etc.) and generate a comprehensive prediction and diagnostic analysis for their exams.
STRICT RULE: All predictions, topics, weightages, and analysis must be derived ONLY from the provided chunks. Do not assume or hallucinate.

You must respond ONLY with a JSON object conforming exactly to this structure:
{
  "predictedImportantQuestions": [
    { "question": "Question text", "reason": "Why this is predicted based on study material", "groundedIn": "Document name and page" }
  ],
  "highWeightageTopics": [
    { "topic": "Topic Name", "weightagePercent": number, "reasoning": "Why this has high weightage" }
  ],
  "weakTopicAnalysis": [
    { "topic": "Topic Name", "scorePercent": number, "gapDescription": "What concept/revision is lacking", "recommendation": "Study suggestion" }
  ],
  "examReadinessScore": number, // an overall score 0-100 derived from the context
  "smartRevisionPlanner": [
    { "day": number, "focusArea": "Revision Focus Area", "tasks": ["Task 1", "Task 2"] }
  ],
  "topicWeightageAnalysis": [
    { "topic": "Topic Name", "marksAllocated": number, "frequencyInPYQs": number }
  ],
  "teacherPatternAnalysis": [
    { "pattern": "Teacher preference/pattern observed", "description": "Analysis of what teacher emphasizes", "evidenceInMaterial": "Direct reference from materials" }
  ],
  "previousYearTrendAnalysis": [
    { "trend": "Observed Year-over-Year trend", "yearOverYearChanges": "Comparison of topics over past years", "likelyFocusThisYear": "Likely focus area this year" }
  ]
}`;

    const contextPayload = chunks.map((chunk, idx) => ({
      index: idx + 1,
      documentName: chunk.documentName || 'Unknown Document',
      pageNumber: chunk.pageNumber || chunk.payload?.page_number || chunk.payload?.pageNumber || 1,
      content: this.chunkText(chunk)
    }));

    try {
      const response = await this.generateJsonWithProviderFallback(systemPrompt, {
        chunks: contextPayload
      });
      return {
        success: true,
        ...response
      };
    } catch (error) {
      this.logger.error(`Failed to generate predicted exam analysis: ${error.message}`);
      throw error;
    }
  }

  private async retrieveVerifiedLegalSources(query: string, limit = 5): Promise<any[]> {
    const qdrantClient = this.qdrantService.getClient();
    if (!qdrantClient) return [];
    try {
      const vector = await this.generateQueryVector(query);
      const collections = ['acts', 'constitution', 'bare_acts', 'supreme_court_cases', 'judgments'];
      const results: any[] = [];
      for (const col of collections) {
        try {
          const hits = await qdrantClient.search(col, {
            vector,
            limit: 2,
            with_payload: true,
          });
          if (hits && hits.length) {
            results.push(...hits.map((hit: any) => ({
              id: hit.id,
              score: hit.score,
              payload: {
                ...hit.payload,
                collection: col,
                isVerifiedSource: true,
              }
            })));
          }
        } catch (e) {
          // Skip if collection doesn't exist
        }
      }
      return results.slice(0, limit);
    } catch (err) {
      this.logger.warn(`Could not retrieve verified legal sources: ${err.message}`);
      return [];
    }
  }

  private async generateQueryVector(query: string) {
    try {
      if (this.bgeM3Provider?.isAvailable()) {
        return await this.bgeM3Provider.generateEmbedding(query);
      }
      this.logger.warn(`BgeM3Provider is not available. Using deterministic fallback.`);
      return this.generateDeterministicVector(query, 1024);
    } catch (err: any) {
      this.logger.warn(`Query embedding failed: ${err.message}. Using deterministic fallback.`);
      return this.generateDeterministicVector(query, 1024);
    }
  }

  private generateDeterministicVector(text: string, size: number) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    const random = () => {
      hash = (hash * 1664525 + 1013904223) % 4294967296;
      return hash / 4294967296;
    };
    const vector = new Array(size);
    let sum = 0;
    for (let i = 0; i < size; i++) {
      const value = random() * 2 - 1;
      vector[i] = value;
      sum += value * value;
    }
    const magnitude = Math.sqrt(sum) || 1;
    return vector.map((value) => value / magnitude);
  }

  private cleanJsonString(str: string): string {
    let result = '';
    let inString = false;
    let escaped = false;
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (escaped) {
        result += char;
        escaped = false;
        continue;
      }
      if (char === '\\') {
        result += char;
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        result += char;
        continue;
      }
      if (inString) {
        if (char === '\n') {
          result += '\\n';
        } else if (char === '\r') {
          result += '\\r';
        } else if (char === '\t') {
          result += '\\t';
        } else {
          const code = char.charCodeAt(0);
          if (code < 32) {
            // Skip non-printable control characters
          } else {
            result += char;
          }
        }
      } else {
        result += char;
      }
    }
    return result;
  }
}



















