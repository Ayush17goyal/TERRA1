import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Draft } from './draft.entity';

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

@Entity('draft_analyzer_review_findings')
@Index(['draftId', 'page', 'line'])
export class DraftReviewFinding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'draft_id' })
  draftId: string;

  @ManyToOne(() => Draft, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'draft_id' })
  draft: Draft;

  /** 1-based page number. */
  @Column()
  page: number;

  /** 1-based line number within the page. */
  @Column()
  line: number;

  /** Verbatim text from the document that triggered the finding. */
  @Column({ name: 'exact_text', type: 'text' })
  exactText: string;

  @Column()
  severity: FindingSeverity;

  /** Short title of the issue (≤ 15 words). */
  @Column({ type: 'text' })
  issue: string;

  /** Detailed legal basis citing statutes / precedents. */
  @Column({ name: 'legal_reasoning', type: 'text' })
  legalReasoning: string;

  /** Specific actionable suggestion (no rewrite of document text). */
  @Column({ type: 'text' })
  suggestion: string;

  /** AI confidence in this finding, 0.0–1.0. */
  @Column({ name: 'confidence_score', type: 'float' })
  confidenceScore: number;

  /**
   * Structured category for the finding — set by the AI review panel.
   * Replaces keyword-based guessing in the frontend.
   */
  @Column({ nullable: true })
  category: string | null;

  /**
   * How to render this finding in the PDF viewer.
   * underline = exact defective text; highlight = ambiguous/risky; comment_marker = missing clause; sidebar_only = no PDF annotation
   */
  @Column({ name: 'annotation_type', nullable: true })
  annotationType: string | null;

  /**
   * The minimum exact text span responsible for the issue (verbatim from document).
   * null for comment_marker and sidebar_only findings.
   */
  @Column({ name: 'evidence_text', type: 'text', nullable: true })
  evidenceText: string | null;

  /**
   * Verbatim text from the document near where a missing clause should be inserted.
   * Only used for comment_marker findings.
   */
  @Column({ name: 'nearby_text', type: 'text', nullable: true })
  nearbyText: string | null;

  /** 1-based paragraph number on the page. */
  @Column({ name: 'paragraph_number', nullable: true })
  paragraphNumber: number | null;

  /** Which LLM batch/call produced this finding. */
  @Column({ name: 'batch_index', default: 0 })
  batchIndex: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
