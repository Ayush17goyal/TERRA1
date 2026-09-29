import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { SettingsModule } from '../settings/settings.module';
import { RetrievalModule } from '../retrieval/retrieval.module';

@Module({
  imports: [SettingsModule, RetrievalModule],
  controllers: [HealthController],
})
export class HealthModule {}
