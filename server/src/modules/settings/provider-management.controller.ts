import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { AdminRoleGuard } from '../../guards/admin-role.guard';
import { ProviderManagementService } from './provider-management.service';

@Controller('admin/providers')
@UseGuards(ClerkAuthGuard, AdminRoleGuard)
export class ProviderManagementController {
  constructor(private readonly providers: ProviderManagementService) {}

  @Get()
  async dashboard() {
    return this.providers.getAdminDashboard();
  }

  @Post('keys')
  async saveKey(
    @Req() req: any,
    @Body() body: {
      providerKey: string;
      apiKey: string;
      label?: string;
      activate?: boolean;
      priority?: number;
      testBeforeActivate?: boolean;
    },
  ) {
    return this.providers.saveKey({
      ...body,
      createdBy: req.user?.email || req.user?.id || 'admin',
    });
  }

  @Post('keys/:id/test')
  async testKey(@Param('id') id: string) {
    return this.providers.testKey(id);
  }

  @Post('keys/:id/activate')
  async activateKey(@Param('id') id: string) {
    return this.providers.setKeyActive(id);
  }

  @Post('keys/:id/disable')
  async disableKey(@Param('id') id: string) {
    return this.providers.disableKey(id);
  }

  @Post(':providerKey/enable')
  async enableProvider(@Param('providerKey') providerKey: string) {
    return this.providers.setProviderEnabled(providerKey, true);
  }

  @Post(':providerKey/disable')
  async disableProvider(@Param('providerKey') providerKey: string) {
    return this.providers.setProviderEnabled(providerKey, false);
  }
}
