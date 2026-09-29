import { Controller, Post, Get, Param, Body, UseGuards, Req, Put, Res } from '@nestjs/common';
import { ContractService } from './contract.service';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { AdminRoleGuard } from '../../guards/admin-role.guard';
import { SettingsService } from '../settings/settings.service';
import { Response } from 'express';

@Controller('contracts')
export class ContractController {
  constructor(
    private readonly contractService: ContractService,
    private readonly settings: SettingsService,
  ) {}

  @Get('active')
  async getActiveConfig() {
    return this.contractService.getActiveConfig();
  }

  @Get('download-pdf')
  async downloadPdf(@Res() res: Response) {
    const config = await this.contractService.getActiveConfig();
    return this.contractService.generatePdf(config.contractContent, config.contractVersion, res);
  }

  @Get('acceptance-status')
  @UseGuards(ClerkAuthGuard)
  async getAcceptanceStatus(@Req() req: any) {
    const config = await this.contractService.getActiveConfig();
    return this.contractService.getAcceptanceStatus(req.user.id, config.contractVersion);
  }

  @Post('accept')
  @UseGuards(ClerkAuthGuard)
  async acceptContract(
    @Req() req: any,
    @Body() body: { contractVersion: string; email?: string }
  ) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const email = body.email || req.user.email || '';

    const result = await this.contractService.recordAcceptance(
      req.user.id,
      email,
      ipAddress,
      userAgent,
      body.contractVersion
    );

    await this.settings.log({
      userId: req.user.id,
      module: 'IP & Contract Compliance',
      action: 'Accepted Contract',
      metadata: { contractVersion: body.contractVersion, email, ipAddress, userAgent },
    });

    return result;
  }

  @Put('admin/config')
  @UseGuards(ClerkAuthGuard, AdminRoleGuard)
  async updateConfig(
    @Req() req: any,
    @Body() body: { contractVersion: string; contractContent: string }
  ) {
    const result = await this.contractService.updateConfig(
      body.contractVersion,
      body.contractContent
    );

    await this.settings.log({
      userId: req.user.id,
      module: 'IP & Contract Compliance',
      action: 'Updated Contract Config',
      metadata: { contractVersion: body.contractVersion },
    });

    return result;
  }

  @Get('admin/acceptances')
  @UseGuards(ClerkAuthGuard, AdminRoleGuard)
  async getAdminAcceptances() {
    return this.contractService.getAllAcceptances();
  }

  // Preserved original endpoints

  @Post('review')
  @UseGuards(ClerkAuthGuard)
  async reviewContract(@Body() body: { fileName: string; fileUrl: string }, @Req() req: any) {
    const result = await this.contractService.review(req.user.id, body.fileName, body.fileUrl);
    await this.settings.log({
      userId: req.user.id,
      module: 'Compliance Copilot',
      action: 'Reviewed Contract',
      metadata: { contractId: result.contractId, fileName: body.fileName, riskScore: result.overallRiskScore },
    });
    await this.settings.log({
      userId: req.user.id,
      module: 'Compliance Copilot',
      action: 'Generated Risk Report',
      metadata: { contractId: result.contractId, riskScore: result.overallRiskScore },
    });
    return result;
  }

  @Get(':id/risks')
  @UseGuards(ClerkAuthGuard)
  async getRisks(@Param('id') id: string) {
    return this.contractService.getRisks(id);
  }

  @Post(':id/clauses')
  @UseGuards(ClerkAuthGuard)
  async generateClauseRecommendations(@Param('id') id: string, @Body() body: { clauseTitle: string }) {
    return this.contractService.recommendClause(id, body.clauseTitle);
  }
}
