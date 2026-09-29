import { Module } from '@nestjs/common';
import { LegalDomainClassifierService } from './legal-domain-classifier.service';

@Module({
  providers: [LegalDomainClassifierService],
  exports: [LegalDomainClassifierService],
})
export class LegalDomainModule {}
