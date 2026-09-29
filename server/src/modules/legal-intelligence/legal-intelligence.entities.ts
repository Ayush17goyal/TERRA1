import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('legal_authority_verifications')
export class LegalAuthorityVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'text' })
  query: string;

  @Column({ type: 'text', nullable: true })
  answer: string;

  @Column('simple-json', { default: '{}' })
  result: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('legal_research_guides')
export class LegalResearchGuideSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'text' })
  proposition: string;

  @Column('simple-json', { default: '{}' })
  roadmap: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('drafting_academy_courses')
export class DraftingAcademyCourse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  category: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: 'Draft Template' })
  contentType: string;

  @Column({ nullable: true })
  resourceUrl: string;

  @Column({ default: 'draft' })
  status: string;

  @Column('simple-json', { default: '{}' })
  metadata: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('drafting_academy_checks')
export class DraftingAcademyCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ nullable: true })
  fileName: string;

  @Column({ default: 'Pasted Text' })
  inputType: string;

  @Column({ type: 'text' })
  draftText: string;

  @Column('simple-json', { default: '{}' })
  result: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('research_mentor_sessions')
export class ResearchMentorSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'text' })
  topic: string;

  @Column('simple-json')
  sessionData: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('case_simulation_sessions')
export class CaseSimulationSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'case_name', type: 'text', nullable: true })
  caseName: string;

  @Column({ name: 'custom_scenario', type: 'text', nullable: true })
  customScenario: string;

  @Column({ name: 'practice_mode', default: 'Landmark Case Practice' })
  practiceMode: string;

  @Column('simple-json', { name: 'retrieved_data', default: '{}' })
  retrievedData: any;

  @Column('simple-json', { name: 'student_answers', default: '{}' })
  studentAnswers: any;

  @Column('simple-json', { name: 'evaluation_result', nullable: true })
  evaluationResult: any;

  @Column({ default: 'retrieved' }) // 'retrieved' | 'evaluated'
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

