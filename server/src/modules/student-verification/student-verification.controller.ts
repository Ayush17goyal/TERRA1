import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { StudentVerificationService } from './student-verification.service';

@Controller('student-verification')
@UseGuards(ClerkAuthGuard)
export class StudentVerificationController {
  constructor(private readonly service: StudentVerificationService) {}

  @Post('submit')
  @UseInterceptors(AnyFilesInterceptor())
  async submitVerification(
    @Req() req: any,
    @Body() body: any,
    @UploadedFiles() files: any[],
  ) {
    const userId = req.user.id;
    return this.service.submitRequest(userId, body, files || []);
  }

  @Get('status')
  async getStatus(@Req() req: any) {
    const userId = req.user.id;
    const request = await this.service.getRequestByUser(userId);
    if (!request) {
      return { status: 'unsubmitted' };
    }
    return request;
  }

  @Get('admin/list')
  async listAllRequests(@Req() req: any) {
    this.enforceAdmin(req);
    return this.service.getAdminList();
  }

  @Get('admin/analytics')
  async getAnalytics(@Req() req: any) {
    this.enforceAdmin(req);
    return this.service.getAnalytics();
  }

  @Post('admin/:id/approve')
  async approveRequest(@Req() req: any, @Param('id') id: string) {
    this.enforceAdmin(req);
    return this.service.approveRequest(id, req.user.id);
  }

  @Post('admin/:id/reject')
  async rejectRequest(@Req() req: any, @Param('id') id: string, @Body('reason') reason: string) {
    this.enforceAdmin(req);
    return this.service.rejectRequest(id, req.user.id, reason || 'Incomplete academic documents.');
  }

  @Get('documents/:id')
  async getDocument(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    // Both admins and owners can view the document
    const isUserAdmin = this.isAdmin(req);
    
    const { buffer, fileName, mimeType } = await this.service.getDocumentFile(id);
    
    // If not admin, check if user owns this document
    if (!isUserAdmin) {
      const request = await this.service.getRequestByUser(req.user.id);
      if (!request) throw new ForbiddenException('Access denied');
      const docs = await this.service.getDocumentsForRequest(request.id);
      const ownsDoc = docs.some(d => d.id === id);
      if (!ownsDoc) throw new ForbiddenException('Access denied');
    }

    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    res.send(buffer);
  }

  private isAdmin(req: any): boolean {
    const email = req.user.email;
    const isMock = req.user.id === 'mock_clerk_id_123';
    return email === 'admin@legatrixon.com' || email === 'legatrixon2026@gmail.com' || req.user.role === 'admin' || isMock;
  }

  private enforceAdmin(req: any) {
    if (!this.isAdmin(req)) {
      throw new ForbiddenException('Admin access privileges required.');
    }
  }
}
