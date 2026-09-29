import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarEvent, Exam, MockTest, ReadinessSnapshot } from '../exam/exam.entities';
import { NotebookDocument } from '../notebook/notebook.entity';
import {
  ResearchAsset,
  ResearchDocument,
  ResearchNote,
  ResearchQuery,
  ResearchReport,
  ResearchSource,
  ResearchUser,
  SavedReport,
} from '../research/research.entities';
import {
  AccountDeletionRequest,
  UserAchievement,
  UserActivityLog,
  UserNotificationPreference,
  UserSettingsProfile,
  UserSubscription,
  UserFeedback,
  NotificationLog,
} from './settings.entities';
import { UserApiKey, UserByokUsageMetric } from './byok.entity';
import { AiCreditTransaction, AiPlanEntitlement, UserAiCreditBalance } from './credit.entity';
import {
  AiProvider,
  AiProviderAlert,
  AiProviderFailure,
  AiProviderKey,
  AiProviderUsageMetric,
} from './provider-management.entity';
import { SettingsController } from './settings.controller';
import { ByokController } from './byok.controller';
import { ProviderManagementController } from './provider-management.controller';
import { SettingsService } from './settings.service';
import { ByokService } from './byok.service';
import { CreditService } from './credit.service';
import { ProviderManagementService } from './provider-management.service';
import { ClerkAccountService } from './clerk-account.service';
import { SupabaseService } from './supabase.service';
import { ExamModule } from '../exam/exam.module';
import { AdminRoleGuard } from '../../guards/admin-role.guard';

@Global()
@Module({
  imports: [
    ExamModule,
    TypeOrmModule.forFeature([
      UserActivityLog,
      UserSettingsProfile,
      UserSubscription,
      UserNotificationPreference,
      UserAchievement,
      AccountDeletionRequest,
      UserFeedback,
      NotificationLog,
      Exam,

      MockTest,
      CalendarEvent,
      ReadinessSnapshot,
      NotebookDocument,
      ResearchUser,
      ResearchQuery,
      ResearchReport,
      ResearchSource,
      ResearchNote,
      SavedReport,
      ResearchAsset,
      ResearchDocument,
      UserApiKey,
      UserByokUsageMetric,
      AiPlanEntitlement,
      UserAiCreditBalance,
      AiCreditTransaction,
      AiProvider,
      AiProviderKey,
      AiProviderFailure,
      AiProviderAlert,
      AiProviderUsageMetric,
    ]),
  ],
  controllers: [SettingsController, ByokController, ProviderManagementController],
  providers: [SettingsService, ByokService, CreditService, ProviderManagementService, ClerkAccountService, SupabaseService, AdminRoleGuard],
  exports: [SettingsService, ByokService, CreditService, ProviderManagementService, SupabaseService],
})
export class SettingsModule {}
