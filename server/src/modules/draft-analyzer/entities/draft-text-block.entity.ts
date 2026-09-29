import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { DraftPage } from './draft-page.entity';

export type BlockType = 'paragraph' | 'line';

@Entity('draft_analyzer_text_blocks')
@Index(['draftId', 'pageNumber', 'blockIndex'])
export class DraftTextBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'draft_id' })
  draftId: string;

  @Column({ name: 'page_id' })
  pageId: string;

  @ManyToOne(() => DraftPage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'page_id' })
  page: DraftPage;

  @Column({ name: 'page_number' })
  pageNumber: number;

  /** 'paragraph' = aggregated block | 'line' = individual line within paragraph */
  @Column({ name: 'block_type' })
  blockType: BlockType;

  /** Sequential index of this block on the page (across all block_types). */
  @Column({ name: 'block_index' })
  blockIndex: number;

  /** Which paragraph this block belongs to (0-based). */
  @Column({ name: 'paragraph_index' })
  paragraphIndex: number;

  /**
   * Which line within the paragraph (0-based).
   * NULL for paragraph-level blocks.
   */
  @Column({ name: 'line_index', nullable: true, type: 'int' })
  lineIndex: number | null;

  @Column({ name: 'text_content', type: 'text' })
  textContent: string;

  /** X coordinate of the top-left corner, in points from page left edge. */
  @Column({ name: 'x', type: 'float', default: 0 })
  x: number;

  /** Y coordinate of the top-left corner, in points from page top edge. */
  @Column({ name: 'y', type: 'float', default: 0 })
  y: number;

  /** Bounding box width in points. */
  @Column({ name: 'width', type: 'float', default: 0 })
  width: number;

  /** Bounding box height in points. */
  @Column({ name: 'height', type: 'float', default: 0 })
  height: number;

  /** Dominant font size in points. NULL when unavailable (DOCX line-level, TXT). */
  @Column({ name: 'font_size', type: 'float', nullable: true })
  fontSize: number | null;

  /** Font family / PostScript name as reported by the file. */
  @Column({ name: 'font_name', nullable: true })
  fontName: string | null;

  @Column({ name: 'is_bold', default: false })
  isBold: boolean;

  @Column({ name: 'is_italic', default: false })
  isItalic: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
