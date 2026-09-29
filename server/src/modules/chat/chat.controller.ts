import { Controller, Post, Get, Delete, Param, Body, UseGuards, Req, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { GuideBotService } from './guidebot.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';

@Controller('chat')
@UseGuards(ClerkAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly guideBotService: GuideBotService,
  ) {}

  @Post('message')
  async sendMessage(
    @Body() body: {
      sessionId: string;
      message: string;
      depth: string;
      references?: Array<{ id: string; content: string }>;
    },
    @Req() req: any,
  ) {
    return this.chatService.sendMessage(req.user.id, body.sessionId, body.message, body.depth, body.references);
  }

  @Post('guidebot/message')
  async sendGuideBotMessage(
    @Body() body: {
      sessionId: string;
      message: string;
    },
    @Req() req: any,
  ) {
    return this.guideBotService.sendMessage(req.user.id, body.sessionId, body.message);
  }

  @Post('guidebot/stt')
  @UseInterceptors(FileInterceptor('file'))
  async speechToText(
    @UploadedFile() file: any,
  ) {
    if (!file) {
      throw new Error('No audio file provided.');
    }
    const text = await this.guideBotService.transcribeAudio(file.buffer, file.originalname || 'audio.webm');
    return { text };
  }

  @Post('guidebot/tts')
  async textToSpeech(
    @Body() body: { text: string },
    @Res() res: Response,
  ) {
    const audioBuffer = await this.guideBotService.textToSpeech(body.text);
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
    });
    res.end(audioBuffer);
  }

  @Get('guidebot/history/:sessionId')
  async getGuideBotHistory(@Param('sessionId') sessionId: string, @Req() req: any) {
    return this.guideBotService.getHistory(req.user.id, sessionId);
  }

  @Delete('guidebot/history/:sessionId')
  async clearGuideBotSession(@Param('sessionId') sessionId: string, @Req() req: any) {
    return this.guideBotService.clearSession(req.user.id, sessionId);
  }

  @Get('history/:sessionId')
  async getHistory(@Param('sessionId') sessionId: string, @Req() req: any) {
    return this.chatService.getHistory(req.user.id, sessionId);
  }

  @Delete('history/:sessionId')
  async clearSession(@Param('sessionId') sessionId: string, @Req() req: any) {
    return this.chatService.clearSession(req.user.id, sessionId);
  }

  @Get('fallback-metrics')
  async getFallbackMetrics() {
    return this.chatService.getFallbackMetrics();
  }

  @Get('token-analytics')
  async getTokenAnalytics() {
    return this.chatService.getTokenAnalytics();
  }

  @Get('cache-analytics')
  async getCacheAnalytics() {
    return this.chatService.getCacheAnalytics();
  }

  @Post('search')
  async vectorSearch(@Body() body: { query: string }) {
    return this.chatService.search(body.query);
  }

  @Get('citations/:messageId')
  async getCitations(@Param('messageId') messageId: string, @Req() req: any) {
    return this.chatService.getCitations(req.user.id, messageId);
  }
}

