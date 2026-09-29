import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LiveDraftingSession } from './live-session.entity';

const MEET_LINK_PATTERN = /^https:\/\/meet\.google\.com\/[a-z0-9-]+$/i;

interface ScheduleDto {
  title: string;
  description?: string;
  instructor?: string;
  scheduledAt: string;
  endAt: string;
  meetLink: string;
  courseId?: string;
}

@Injectable()
export class LiveSessionService {
  constructor(
    @InjectRepository(LiveDraftingSession)
    private readonly repo: Repository<LiveDraftingSession>,
  ) {}

  private validateSchedule(dto: Partial<ScheduleDto>) {
    if (!dto.title?.trim()) throw new BadRequestException('Title is required.');
    if (!dto.scheduledAt) throw new BadRequestException('Start time is required.');
    if (!dto.endAt) throw new BadRequestException('End time is required.');
    if (!dto.meetLink?.trim()) throw new BadRequestException('Google Meet link is required.');
    if (!MEET_LINK_PATTERN.test(dto.meetLink.trim())) {
      throw new BadRequestException('Google Meet link must look like https://meet.google.com/abc-defg-hij');
    }
    const start = new Date(dto.scheduledAt);
    const end = new Date(dto.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid start or end time.');
    }
    if (end <= start) {
      throw new BadRequestException('End time must be after start time.');
    }
  }

  async scheduleLiveClass(dto: ScheduleDto): Promise<LiveDraftingSession> {
    this.validateSchedule(dto);

    const session = this.repo.create({
      title: dto.title.trim(),
      description: dto.description ?? null,
      instructor: dto.instructor ?? null,
      scheduledAt: new Date(dto.scheduledAt),
      endAt: new Date(dto.endAt),
      meetLink: dto.meetLink.trim(),
      courseId: dto.courseId ?? null,
      status: 'scheduled',
    });

    return this.repo.save(session);
  }

  async updateLiveClass(id: string, dto: Partial<ScheduleDto>): Promise<LiveDraftingSession> {
    const session = await this.getSessionOrThrow(id);

    this.validateSchedule({
      title: dto.title ?? session.title,
      scheduledAt: dto.scheduledAt ?? session.scheduledAt.toISOString(),
      endAt: dto.endAt ?? session.endAt?.toISOString(),
      meetLink: dto.meetLink ?? session.meetLink,
    });

    Object.assign(session, {
      title: dto.title?.trim() ?? session.title,
      description: dto.description ?? session.description,
      instructor: dto.instructor ?? session.instructor,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : session.scheduledAt,
      endAt: dto.endAt ? new Date(dto.endAt) : session.endAt,
      meetLink: dto.meetLink?.trim() ?? session.meetLink,
      courseId: dto.courseId ?? session.courseId,
    });

    return this.repo.save(session);
  }

  async cancelSession(id: string): Promise<LiveDraftingSession> {
    const session = await this.getSessionOrThrow(id);
    session.status = 'cancelled';
    return this.repo.save(session);
  }

  async deleteSession(id: string): Promise<{ ok: boolean }> {
    const session = await this.getSessionOrThrow(id);
    await this.repo.remove(session);
    return { ok: true };
  }

  async getSessionOrThrow(id: string): Promise<LiveDraftingSession> {
    const session = await this.repo.findOne({ where: { id } });
    if (!session) throw new NotFoundException('Live session not found');
    return session;
  }

  private computeLiveState(session: LiveDraftingSession): 'upcoming' | 'live' | 'ended' | 'cancelled' {
    if (session.status === 'cancelled') return 'cancelled';
    const now = Date.now();
    const start = new Date(session.scheduledAt).getTime();
    const end = session.endAt ? new Date(session.endAt).getTime() : start;
    if (now < start) return 'upcoming';
    if (now > end) return 'ended';
    return 'live';
  }

  private serializeForStudent(session: LiveDraftingSession) {
    return {
      id: session.id,
      title: session.title,
      description: session.description,
      instructor: session.instructor,
      scheduledAt: session.scheduledAt,
      endAt: session.endAt,
      courseId: session.courseId,
      status: session.status,
      liveState: this.computeLiveState(session),
      createdAt: session.createdAt,
    };
  }

  private serializeForAdmin(session: LiveDraftingSession) {
    return {
      ...this.serializeForStudent(session),
      meetLink: session.meetLink,
    };
  }

  async listSessions() {
    const sessions = await this.repo.find({ order: { scheduledAt: 'DESC' } });
    return sessions.map((s) => this.serializeForStudent(s));
  }

  async adminListSessions() {
    const sessions = await this.repo.find({ order: { scheduledAt: 'DESC' } });
    return sessions.map((s) => this.serializeForAdmin(s));
  }

  async getMeetLink(sessionId: string, _userId: string): Promise<{ meetLink: string }> {
    const session = await this.repo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('This class has been removed.');
    if (session.status === 'cancelled') throw new NotFoundException('This class has been cancelled.');

    const now = Date.now();
    const start = new Date(session.scheduledAt).getTime();
    const end = session.endAt ? new Date(session.endAt).getTime() : start;

    if (now < start) throw new ForbiddenException('This class has not started yet.');
    if (now > end) throw new ForbiddenException('This class has ended.');

    // Enrollment/plan gating hook: masterclasses are open to any authenticated
    // student for now. Add a purchase/plan check here later without touching callers.
    if (!session.meetLink) throw new NotFoundException('Meeting link unavailable.');

    return { meetLink: session.meetLink };
  }
}
