import { Body, Controller, Get, Param, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { AdminRoleGuard } from '../../guards/admin-role.guard';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(ClerkAuthGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('dashboard')
  async dashboard(@Req() req: any) {
    return this.settings.getDashboard(req.user);
  }

  @Post('activity')
  async logActivity(@Req() req: any, @Body() body: { module: string; action: string; metadata?: Record<string, unknown> }) {
    return this.settings.log({
      userId: req.user.id,
      module: body.module,
      action: body.action,
      metadata: body.metadata || {},
    });
  }

  @Post('notifications')
  async updateNotifications(@Req() req: any, @Body() body: any) {
    return this.settings.updateNotificationPreferences(req.user.id, body);
  }

  @Post('danger/account-deletion')
  async requestAccountDeletion(@Req() req: any, @Body() body: { reason?: string }) {
    return this.settings.requestDeletion(req.user.id, body.reason);
  }

  @Post('danger/soft-delete')
  async softDelete(@Req() req: any, @Body() body: { confirmation?: string }) {
    return this.settings.softDelete(req.user.id, body.confirmation);
  }

  @Post('danger/logout-all-devices')
  async logoutAllDevices(@Req() req: any) {
    return this.settings.logoutAllDevices(req.user.id);
  }

  @Post('danger/data-removal-request')
  async dataRemovalRequest(@Req() req: any) {
    return this.settings.requestDataRemoval(req.user.id);
  }

  @Post('danger/permanent-delete')
  async permanentDelete(@Req() req: any, @Body() body: { confirmation?: string }) {
    return this.settings.permanentlyDelete(req.user.id, body.confirmation);
  }

  @Get('export/:kind/:format')
  async exportData(@Req() req: any, @Res() res: any, @Param('kind') kind: string, @Param('format') format: string) {
    const file = await this.settings.exportData(req.user, kind, format);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    return res.send(file.buffer);
  }

  @Post('feedback')
  async createFeedback(@Req() req: any, @Body() body: any) {
    return this.settings.createFeedback(req.user.id, body);
  }

  @Get('feedback/my')
  async getFeedbacks(@Req() req: any) {
    return this.settings.getFeedbacks(req.user.id);
  }

  @Get('feedback/community')
  async getCommunityFeatures() {
    return this.settings.getCommunityFeatures();
  }

  @Post('feedback/:id/vote')
  async voteFeature(@Req() req: any, @Param('id') id: string) {
    return this.settings.voteFeature(req.user.id, id);
  }

  @Get('feedback/admin')
  @UseGuards(AdminRoleGuard)
  async getAdminFeedbacks() {
    return this.settings.getAdminFeedbacks();
  }

  @Put('feedback/:id/status')
  @UseGuards(AdminRoleGuard)
  async updateFeedbackStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.settings.updateFeedbackStatus(id, body.status);
  }

  @Post('notifications/fcm-token')
  async registerFcmToken(@Req() req: any, @Body() body: { fcmToken: string }) {
    return this.settings.updateFcmToken(req.user.id, body.fcmToken);
  }

  @Post('subscription/upgrade')
  async upgradeSubscription(@Req() req: any, @Body() body: { planName: string }) {
    return this.settings.upgradeSubscription(req.user.id, body.planName);
  }

  @Post('security/password-change')
  async simulatePasswordChange(@Req() req: any) {
    return this.settings.simulatePasswordChange(req.user.id);
  }

  @Post('notifications/test')
  async triggerTestNotification(@Req() req: any, @Body() body: { type: 'email' | 'browser' }) {
    return this.settings.triggerTestNotification(req.user.id, body.type);
  }

  @Get('profile')
  async getProfile(@Req() req: any) {
    return this.settings.getProfile(req.user.id);
  }

  @Get('ai-provider-onboarding')
  async getAiProviderOnboarding(@Req() req: any) {
    return this.settings.getAiProviderOnboarding(req.user);
  }

  @Post('ai-provider-onboarding/complete')
  async completeAiProviderOnboarding(@Req() req: any) {
    return this.settings.completeAiProviderOnboarding(req.user);
  }

  @Put('profile')
  async updateProfile(@Req() req: any, @Body() body: any) {
    return this.settings.updateProfile(req.user.id, body);
  }

  @Post('login')
  async login(@Req() req: any, @Body() body: { email: string }) {
    return this.settings.recordLogin(req.user.id, body.email || req.user.email, req);
  }

  @Post('logout')
  async logout(@Req() req: any) {
    return this.settings.recordLogout(req.user.id);
  }
}
