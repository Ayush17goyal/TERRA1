import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DraftingSession } from './entities/drafting-session.entity';
import { ACADEMY_TOTAL_LESSONS } from './academy-curriculum';
import {
  DRAFTING_LESSON_CATALOG,
  DraftingLesson,
  TOTAL_DRAFTING_LESSONS,
  getLessonByIndex,
} from './lesson-catalog';

export interface DraftingSessionView {
  id: string;
  topic: string;
  status: DraftingSession['status'];
  currentLesson: DraftingLesson;
  completedLessons: number[];
  totalLessons: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class DraftingWorkflowEngineService {
  constructor(
    @InjectRepository(DraftingSession)
    private readonly sessions: Repository<DraftingSession>,
  ) {}

  async createSession(userId: string, topic: string): Promise<DraftingSessionView> {
    const trimmedTopic = (topic || '').trim();
    if (!trimmedTopic) {
      throw new BadRequestException('A legislative topic is required to start a drafting session.');
    }

    const session = this.sessions.create({
      userId,
      topic: trimmedTopic,
      currentLessonIndex: 0,
      completedLessons: [],
      status: 'in_progress',
    });

    const saved = await this.sessions.save(session);
    return this.toView(saved);
  }

  async listSessions(userId: string): Promise<DraftingSessionView[]> {
    const rows = await this.sessions.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
    return rows.map((row) => this.toView(row));
  }

  async resumeSession(userId: string, sessionId: string): Promise<DraftingSessionView> {
    const session = await this.loadOwnedSession(userId, sessionId);
    return this.toView(session);
  }

  async advance(userId: string, sessionId: string): Promise<DraftingSessionView> {
    const session = await this.loadOwnedSession(userId, sessionId);

    const completed = new Set(session.completedLessons);
    completed.add(session.currentLessonIndex);
    session.completedLessons = Array.from(completed).sort((a, b) => a - b);

    const isLastLesson = session.currentLessonIndex >= TOTAL_DRAFTING_LESSONS - 1;
    if (isLastLesson) {
      session.status = 'completed';
    } else {
      session.currentLessonIndex += 1;
      session.status = 'in_progress';
    }

    const saved = await this.sessions.save(session);
    return this.toView(saved);
  }

  async goBack(userId: string, sessionId: string): Promise<DraftingSessionView> {
    const session = await this.loadOwnedSession(userId, sessionId);

    if (session.currentLessonIndex === 0) {
      return this.toView(session);
    }

    session.currentLessonIndex -= 1;
    session.status = 'in_progress';

    const saved = await this.sessions.save(session);
    return this.toView(saved);
  }

  async goToLesson(userId: string, sessionId: string, lessonIndex: number): Promise<DraftingSessionView> {
    const session = await this.loadOwnedSession(userId, sessionId);

    if (!Number.isInteger(lessonIndex) || lessonIndex < 0 || lessonIndex >= TOTAL_DRAFTING_LESSONS) {
      throw new BadRequestException(`lessonIndex must be between 0 and ${TOTAL_DRAFTING_LESSONS - 1}.`);
    }

    const highestUnlocked = session.completedLessons.length
      ? Math.max(...session.completedLessons) + 1
      : session.currentLessonIndex;

    if (lessonIndex > highestUnlocked) {
      throw new BadRequestException('Cannot skip ahead to a lesson that has not been unlocked yet.');
    }

    session.currentLessonIndex = lessonIndex;
    session.status = 'in_progress';

    const saved = await this.sessions.save(session);
    return this.toView(saved);
  }

  async getAcademyState(userId: string) {
    const session = await this.getOrCreateAcademySession(userId);
    return {
      state: session.academyState || {},
      version: session.stateVersion || 0,
      updatedAt: session.updatedAt,
      lastActivityAt: session.lastActivityAt,
    };
  }

  async syncAcademyState(userId: string, input: any) {
    const session = await this.getOrCreateAcademySession(userId);
    const incoming = input?.state;
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      throw new BadRequestException('A valid academy state object is required.');
    }
    const serialized = JSON.stringify(incoming);
    if (serialized.length > 2_000_000) {
      throw new BadRequestException('Academy state exceeds the 2 MB safety limit.');
    }
    const incomingVersion = Number(input?.version || 0);
    if (incomingVersion < (session.stateVersion || 0)) {
      return { conflict: true, state: session.academyState || {}, version: session.stateVersion, updatedAt: session.updatedAt };
    }
    this.validateAcademyState(incoming);
    session.academyState = incoming;
    session.stateVersion = (session.stateVersion || 0) + 1;
    session.lastActivityAt = new Date();
    const saved = await this.sessions.save(session);
    return { conflict: false, state: saved.academyState, version: saved.stateVersion, updatedAt: saved.updatedAt };
  }

  private validateAcademyState(state: any) {
    const current = Number(state.current || 0);
    const completed = Array.isArray(state.completedLessons) ? state.completedLessons : [];
    if (!Number.isInteger(current) || current < 0 || current >= ACADEMY_TOTAL_LESSONS) {
      throw new BadRequestException('Invalid current lesson.');
    }
    if (completed.some((value: unknown) => !Number.isInteger(value) || Number(value) < 0 || Number(value) >= ACADEMY_TOTAL_LESSONS)) {
      throw new BadRequestException('Invalid completed lesson list.');
    }
    const ordered: number[] = Array.from(new Set<number>(completed.map((value: unknown) => Number(value)))).sort((a, b) => a - b);
    if (ordered.some((value, index) => value !== index)) {
      throw new BadRequestException('Completed lessons must form a contiguous journey from lesson 1.');
    }
    const unlocked = ordered.length ? Math.min(ACADEMY_TOTAL_LESSONS - 1, ordered.length) : 0;
    if (current > unlocked) {
      throw new BadRequestException('Cannot unlock a lesson before completing the previous lesson.');
    }
  }

  private async getOrCreateAcademySession(userId: string) {
    let session = await this.sessions.findOne({ where: { userId, topic: '__LEGISLATIVE_DRAFTING_ACADEMY__' } });
    if (!session) {
      session = this.sessions.create({
        userId,
        topic: '__LEGISLATIVE_DRAFTING_ACADEMY__',
        currentLessonIndex: 0,
        completedLessons: [],
        status: 'in_progress',
        academyState: {},
        stateVersion: 0,
        lastActivityAt: new Date(),
      });
      session = await this.sessions.save(session);
    }
    return session;
  }
  private async loadOwnedSession(userId: string, sessionId: string): Promise<DraftingSession> {
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Drafting session not found.');
    }
    if (session.userId !== userId) {
      throw new ForbiddenException('This drafting session does not belong to the current user.');
    }
    return session;
  }

  private toView(session: DraftingSession): DraftingSessionView {
    return {
      id: session.id,
      topic: session.topic,
      status: session.status,
      currentLesson: getLessonByIndex(session.currentLessonIndex),
      completedLessons: session.completedLessons,
      totalLessons: TOTAL_DRAFTING_LESSONS,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  getLessonCatalog(): DraftingLesson[] {
    return DRAFTING_LESSON_CATALOG;
  }
}
