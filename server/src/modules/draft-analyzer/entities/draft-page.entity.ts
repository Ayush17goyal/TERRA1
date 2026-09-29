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

@Entity('draft_analyzer_pages')
@Index(['draftId', 'pageNumber'], { unique: true })
export class DraftPage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'draft_id' })
  draftId: string;

  @ManyToOne(() => Draft, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'draft_id' })
  draft: Draft;

  @Column({ name: 'page_number' })
  pageNumber: number;

  /** Page width in points (1pt = 1/72 inch). */
  @Column({ name: 'width_pt', type: 'float', default: 0 })
  widthPt: number;

  /** Page height in points. */
  @Column({ name: 'height_pt', type: 'float', default: 0 })
  heightPt: number;

  /** Full concatenated text of the page. */
  @Column({ name: 'raw_text', type: 'text', nullable: true })
  rawText: string;

  /** Number of text blocks stored for this page. */
  @Column({ name: 'block_count', default: 0 })
  blockCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
