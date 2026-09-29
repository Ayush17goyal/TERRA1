import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunityMessage } from './community.entity';
import { CommunityController } from './community.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CommunityMessage])],
  controllers: [CommunityController],
})
export class CommunityModule {}
