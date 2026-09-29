import { Module } from '@nestjs/common';
import { SettingsModule } from '../modules/settings/settings.module';
import { RetrievalModule } from '../modules/retrieval/retrieval.module';
import { ProductionHealthController } from './health/production-health.controller';
import { AuditLoggerService } from './security/audit-logger.service';
import { VirusScannerService } from './security/virus-scanner.service';

@Module({
  imports: [SettingsModule, RetrievalModule],
  controllers: [ProductionHealthController],
  providers: [AuditLoggerService, VirusScannerService],
  exports: [AuditLoggerService, VirusScannerService],
})
export class HardeningModule {}