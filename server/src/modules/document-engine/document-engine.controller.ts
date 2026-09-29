import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { DocumentEngineService } from './document-engine.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { MAX_UPLOAD_BYTES } from './document-engine.constants';

@Controller('document-engine')
@UseGuards(ClerkAuthGuard)
export class DocumentEngineController {
  constructor(private readonly documentEngineService: DocumentEngineService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async upload(@UploadedFile() file: any, @Body() body: UploadDocumentDto, @Req() req: any) {
    return this.documentEngineService.submit(req.user.id, file, body.documentTypeHint);
  }

  @Get('documents')
  async list(@Req() req: any) {
    return this.documentEngineService.listForUser(req.user.id);
  }

  @Get('documents/:id/status')
  async status(@Param('id') id: string, @Req() req: any) {
    return this.documentEngineService.getStatus(req.user.id, id);
  }

  @Get('documents/:id')
  async record(@Param('id') id: string, @Req() req: any) {
    return this.documentEngineService.getKnowledgeRecord(req.user.id, id);
  }
}
