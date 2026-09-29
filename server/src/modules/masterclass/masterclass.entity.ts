import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('masterclass_courses')
export class MasterclassCourse {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() title: string;
  @Column('text', { nullable: true }) description: string;
  @Column({ default: 'draft' }) status: string;
  @Column({ nullable: true }) difficulty: string;
  @Column({ nullable: true }) category: string;
  @Column({ nullable: true }) thumbnailUrl: string;
  @Column({ nullable: true }) instructor: string;
  @Column({ nullable: true }) duration: string;
  @Column({ default: false }) isFree: boolean;
  @Column('text', { nullable: true }) takeawaysJson: string;
  @Column('text', { nullable: true }) assignment: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('masterclass_lessons')
export class MasterclassLesson {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() courseId: string;
  @Column() title: string;
  @Column('text', { nullable: true }) description: string;
  @Column({ nullable: true }) videoUrl: string;
  @Column({ nullable: true }) duration: string;
  @Column({ default: 0 }) sortOrder: number;
  @Column({ default: false }) isPreview: boolean;
  @Column('text', { nullable: true }) attachmentsJson: string;
  @CreateDateColumn() createdAt: Date;
}

@Entity('masterclass_enrollments')
export class MasterclassEnrollment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() courseId: string;
  @Column() userId: string;
  @CreateDateColumn() enrolledAt: Date;
}

@Entity('masterclass_lesson_progress')
export class MasterclassLessonProgress {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() userId: string;
  @Column() lessonId: string;
  @Column() courseId: string;
  @Column({ default: false }) completed: boolean;
  @Column({ default: 0 }) lastPosition: number;
  @Column({ nullable: true }) completedAt: string;
  @UpdateDateColumn() updatedAt: Date;
}
