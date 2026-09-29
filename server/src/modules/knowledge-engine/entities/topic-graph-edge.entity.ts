import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { SourceReference } from '../knowledge-engine.types';

export type TopicGraphRelation = 'parent_child' | 'related' | 'case_links' | 'provision_links' | 'example_links';

@Entity('topic_graph_edges')
@Index(['userId', 'sourceTkuId', 'targetTkuId', 'relation'], { unique: true })
export class TopicGraphEdgeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'source_tku_id' })
  sourceTkuId: string;

  @Column({ name: 'target_tku_id' })
  targetTkuId: string;

  @Column({ type: 'varchar' })
  relation: TopicGraphRelation;

  @Column({ type: 'float', default: 0.5 })
  strength: number;

  @Column('simple-json', { default: '[]' })
  references: SourceReference[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
