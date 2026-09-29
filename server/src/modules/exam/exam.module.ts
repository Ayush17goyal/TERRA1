import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Exam,
  Roadmap,
  RevisionPlan,
  MockTest,
  CalendarEvent,
  Notification,
  ReadinessSnapshot,
  GoogleOAuthToken,
  Recommendation,
} from './exam.entities';
import { AiMockTest } from '../learning-workspace/learning-workspace.entities';
import { ExamController } from './exam.controller';
import { ExamService } from './exam.service';
import { GoogleCalendarService } from './google-calendar.service';
import { NotificationService } from './notification.service';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { LegalDomainModule } from '../legal-domain/legal-domain.module';
import { ChatModule } from '../chat/chat.module';
import { NotebookModule } from '../notebook/notebook.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Exam,
      Roadmap,
      RevisionPlan,
      MockTest,
      CalendarEvent,
      Notification,
      ReadinessSnapshot,
      GoogleOAuthToken,
      Recommendation,
      AiMockTest,
    ]),
    RetrievalModule,
    LegalDomainModule,
    ChatModule,
    NotebookModule,
  ],
  controllers: [ExamController],
  providers: [ExamService, GoogleCalendarService, NotificationService],
  exports: [ExamService, GoogleCalendarService, NotificationService],
})
export class ExamModule {}
