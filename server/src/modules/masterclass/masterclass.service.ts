import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MasterclassCourse,
  MasterclassLesson,
  MasterclassEnrollment,
  MasterclassLessonProgress,
} from './masterclass.entity';

@Injectable()
export class MasterclassService {
  constructor(
    @InjectRepository(MasterclassCourse)
    private readonly courseRepo: Repository<MasterclassCourse>,
    @InjectRepository(MasterclassLesson)
    private readonly lessonRepo: Repository<MasterclassLesson>,
    @InjectRepository(MasterclassEnrollment)
    private readonly enrollRepo: Repository<MasterclassEnrollment>,
    @InjectRepository(MasterclassLessonProgress)
    private readonly progressRepo: Repository<MasterclassLessonProgress>,
  ) {}

  // ── Admin: Course CRUD ────────────────────────────────────────────────────

  async adminListCourses() {
    const courses = await this.courseRepo.find({ order: { createdAt: 'DESC' } });
    return courses.map((c) => this.serializeCourse(c));
  }

  async adminCreateCourse(dto: any) {
    const course = this.courseRepo.create({
      title: dto.title,
      description: dto.description,
      difficulty: dto.difficulty ?? 'Intermediate',
      category: dto.category ?? 'Contract Drafting',
      thumbnailUrl: dto.thumbnailUrl,
      instructor: dto.instructor ?? 'The Founder',
      duration: dto.duration,
      isFree: dto.isFree ?? true,
      takeawaysJson: dto.takeaways ? JSON.stringify(dto.takeaways) : null,
      assignment: dto.assignment,
      status: 'draft',
    });
    const saved = await this.courseRepo.save(course);
    return this.serializeCourse(saved);
  }

  async adminUpdateCourse(id: string, dto: any) {
    const course = await this.courseRepo.findOne({ where: { id } });
    if (!course) throw new NotFoundException('Course not found');
    Object.assign(course, {
      title: dto.title ?? course.title,
      description: dto.description ?? course.description,
      difficulty: dto.difficulty ?? course.difficulty,
      category: dto.category ?? course.category,
      thumbnailUrl: dto.thumbnailUrl ?? course.thumbnailUrl,
      instructor: dto.instructor ?? course.instructor,
      duration: dto.duration ?? course.duration,
      isFree: dto.isFree ?? course.isFree,
      takeawaysJson: dto.takeaways ? JSON.stringify(dto.takeaways) : course.takeawaysJson,
      assignment: dto.assignment ?? course.assignment,
    });
    const saved = await this.courseRepo.save(course);
    return this.serializeCourse(saved);
  }

  async adminDeleteCourse(id: string) {
    const course = await this.courseRepo.findOne({ where: { id } });
    if (!course) throw new NotFoundException('Course not found');
    await this.lessonRepo.delete({ courseId: id });
    await this.courseRepo.remove(course);
    return { ok: true };
  }

  async adminPublishCourse(id: string, publish: boolean) {
    const course = await this.courseRepo.findOne({ where: { id } });
    if (!course) throw new NotFoundException('Course not found');
    course.status = publish ? 'published' : 'draft';
    const saved = await this.courseRepo.save(course);
    return this.serializeCourse(saved);
  }

  // ── Admin: Lesson CRUD ────────────────────────────────────────────────────

  async adminListLessons(courseId: string) {
    const lessons = await this.lessonRepo.find({ where: { courseId }, order: { sortOrder: 'ASC' } });
    return lessons.map((l) => this.serializeLesson(l));
  }

  async adminCreateLesson(courseId: string, dto: any) {
    const count = await this.lessonRepo.count({ where: { courseId } });
    const lesson = this.lessonRepo.create({
      courseId,
      title: dto.title,
      description: dto.description,
      videoUrl: dto.videoUrl,
      duration: dto.duration,
      sortOrder: dto.sortOrder ?? count,
      isPreview: dto.isPreview ?? false,
      attachmentsJson: dto.attachments ? JSON.stringify(dto.attachments) : null,
    });
    const saved = await this.lessonRepo.save(lesson);
    return this.serializeLesson(saved);
  }

  async adminUpdateLesson(id: string, dto: any) {
    const lesson = await this.lessonRepo.findOne({ where: { id } });
    if (!lesson) throw new NotFoundException('Lesson not found');
    Object.assign(lesson, {
      title: dto.title ?? lesson.title,
      description: dto.description ?? lesson.description,
      videoUrl: dto.videoUrl ?? lesson.videoUrl,
      duration: dto.duration ?? lesson.duration,
      sortOrder: dto.sortOrder ?? lesson.sortOrder,
      isPreview: dto.isPreview ?? lesson.isPreview,
      attachmentsJson: dto.attachments ? JSON.stringify(dto.attachments) : lesson.attachmentsJson,
    });
    const saved = await this.lessonRepo.save(lesson);
    return this.serializeLesson(saved);
  }

  async adminDeleteLesson(id: string) {
    const lesson = await this.lessonRepo.findOne({ where: { id } });
    if (!lesson) throw new NotFoundException('Lesson not found');
    await this.lessonRepo.remove(lesson);
    return { ok: true };
  }

  // ── Student: Course List ──────────────────────────────────────────────────

  async studentListCourses() {
    const courses = await this.courseRepo.find({
      where: { status: 'published' },
      order: { createdAt: 'DESC' },
    });
    return courses.map((c) => this.serializeCourse(c));
  }

  async studentGetCourseWithLessons(courseId: string) {
    const course = await this.courseRepo.findOne({ where: { id: courseId, status: 'published' } });
    if (!course) throw new NotFoundException('Course not found');
    const lessons = await this.lessonRepo.find({ where: { courseId }, order: { sortOrder: 'ASC' } });
    return {
      ...this.serializeCourse(course),
      lessons: lessons.map((l) => this.serializeLesson(l)),
    };
  }

  // ── Student: Enroll ───────────────────────────────────────────────────────

  async enroll(courseId: string, userId: string) {
    const existing = await this.enrollRepo.findOne({ where: { courseId, userId } });
    if (existing) return existing;
    const enrollment = this.enrollRepo.create({ courseId, userId });
    return this.enrollRepo.save(enrollment);
  }

  async getEnrollment(courseId: string, userId: string) {
    return this.enrollRepo.findOne({ where: { courseId, userId } });
  }

  // ── Student: Progress ─────────────────────────────────────────────────────

  async updateProgress(userId: string, lessonId: string, courseId: string, dto: any) {
    let progress = await this.progressRepo.findOne({ where: { userId, lessonId } });
    if (!progress) {
      progress = this.progressRepo.create({ userId, lessonId, courseId });
    }
    if (dto.completed !== undefined) {
      progress.completed = dto.completed;
      if (dto.completed && !progress.completedAt) {
        progress.completedAt = new Date().toISOString();
      }
    }
    if (dto.lastPosition !== undefined) progress.lastPosition = dto.lastPosition;
    return this.progressRepo.save(progress);
  }

  // ── Serializers ───────────────────────────────────────────────────────────

  private serializeCourse(c: MasterclassCourse) {
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      status: c.status,
      difficulty: c.difficulty,
      category: c.category,
      thumbnailUrl: c.thumbnailUrl,
      instructor: c.instructor,
      duration: c.duration,
      isFree: c.isFree,
      takeaways: c.takeawaysJson ? JSON.parse(c.takeawaysJson) : [],
      assignment: c.assignment,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  private serializeLesson(l: MasterclassLesson) {
    return {
      id: l.id,
      courseId: l.courseId,
      title: l.title,
      description: l.description,
      videoUrl: l.videoUrl,
      duration: l.duration,
      sortOrder: l.sortOrder,
      isPreview: l.isPreview,
      attachments: l.attachmentsJson ? JSON.parse(l.attachmentsJson) : [],
      createdAt: l.createdAt,
    };
  }
}
