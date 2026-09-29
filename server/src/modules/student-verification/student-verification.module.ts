import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentVerificationController } from './student-verification.controller';
import { StudentVerificationService } from './student-verification.service';
import {
  VerificationRequest,
  VerificationDocument,
  VerificationAuditLog,
} from './student-verification.entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VerificationRequest,
      VerificationDocument,
      VerificationAuditLog,
    ]),
  ],
  controllers: [StudentVerificationController],
  providers: [StudentVerificationService],
  exports: [StudentVerificationService],
})
export class StudentVerificationModule {}
