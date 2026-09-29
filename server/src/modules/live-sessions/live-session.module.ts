import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LiveDraftingSession } from './live-session.entity';
import { LiveSessionService } from './live-session.service';
import { LiveSessionController } from './live-session.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LiveDraftingSession])],
  providers: [LiveSessionService],
  controllers: [LiveSessionController],
})
export class LiveSessionModule {}
