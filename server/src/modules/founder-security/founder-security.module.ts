import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FounderSecurityController, SecurityTestController } from './founder-security.controller';
import { FounderSecurityEvent, FounderSecuritySettings, AdminAccountLock } from './founder-security.entities';
import { FounderSecurityService } from './founder-security.service';
import { AdminRoleGuard } from '../../guards/admin-role.guard';

@Module({
  imports: [TypeOrmModule.forFeature([FounderSecuritySettings, FounderSecurityEvent, AdminAccountLock])],
  controllers: [FounderSecurityController, SecurityTestController],
  providers: [FounderSecurityService, AdminRoleGuard],
  exports: [FounderSecurityService],
})
export class FounderSecurityModule {}
