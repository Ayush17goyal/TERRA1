import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('community_messages')
export class CommunityMessage {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() userName: string;
  @Column('text') text: string;
  @Column({ nullable: true }) topic: string;
  @CreateDateColumn() createdAt: Date;
}
