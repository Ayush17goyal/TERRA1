import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AdminRoleGuard } from '../../guards/admin-role.guard';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { LegalIntelligenceService } from './legal-intelligence.service';

@Controller('legal-intelligence')
@UseGuards(ClerkAuthGuard)
export class LegalIntelligenceController {
  constructor(private readonly service: LegalIntelligenceService) {}

  @Post('authority-verification')
  verifyAuthority(@Req() req: any, @Body() body: any) {
    return this.service.verifyAuthority(req.user.id, body);
  }

  @Post('research-guide')
  createResearchGuide(@Req() req: any, @Body('proposition') proposition: string) {
    return this.service.createResearchGuide(req.user.id, proposition);
  }

  @Post('drafting/check')
  checkDraft(@Req() req: any, @Body() body: any) {
    return this.service.checkDraft(req.user.id, body);
  }

  @Post('bare-act/explain')
  explainBareAct(@Req() req: any, @Body() body: any) {
    return this.service.explainBareAct(req.user.id, body);
  }

  @Post('bare-act/simplify')
  simplifyBareAct(@Req() req: any, @Body() body: any) {
    return this.service.simplifyBareAct(req.user.id, body);
  }

  @Post('bare-act/professor-chat')
  professorChat(@Req() req: any, @Body() body: any) {
    return this.service.professorChat(req.user.id, body);
  }

  @Post('bare-act/intelligence-studio')
  analyzeBareActIntelligence(@Req() req: any, @Body() body: any) {
    if (!body.provisionText?.trim()) throw new BadRequestException('provisionText is required');
    return this.service.analyzeBareActIntelligence(req.user.id, body);
  }

  @Post('bare-act/professor-teach')
  professorTeach(@Req() req: any, @Body() body: any) {
    if (!body.provisionText?.trim()) throw new BadRequestException('provisionText is required');
    return this.service.professorTeach(req.user.id, body);
  }

  @Post('bare-act/ai-bar')
  bareActAiBar(@Req() req: any, @Body() body: any) {
    if (!body.provisionText?.trim()) throw new BadRequestException('provisionText is required');
    return this.service.bareActAiBar(req.user.id, body);
  }

  @Post('bare-act/how-to-write')
  howToWriteBareAct(@Req() req: any, @Body() body: any) {
    if (!body.provisionText?.trim()) throw new BadRequestException('provisionText is required');
    return this.service.howToWriteBareAct(req.user.id, body);
  }

  @Get('drafting/courses')
  listCourses() {
    return this.service.listCourses();
  }

  @Post('drafting/admin/courses')
  @UseGuards(ClerkAuthGuard, AdminRoleGuard)
  upsertCourse(@Body() body: any) {
    return this.service.upsertCourse(body);
  }

  @Delete('drafting/admin/courses/:id')
  @UseGuards(ClerkAuthGuard, AdminRoleGuard)
  deleteCourse(@Param('id') id: string) {
    return this.service.deleteCourse(id);
  }

  @Post('case-simulator/analyze')
  analyzeCaseReasoning(@Req() req: any, @Body() body: any) {
    return this.service.analyzeCaseReasoning(req.user.id, body);
  }

  @Post('research-mentor/intro')
  researchMentorIntro(@Req() req: any, @Body('topic') topic: string) {
    if (!topic?.trim()) throw new BadRequestException('Topic is required');
    return this.service.researchMentorIntro(req.user.id, topic.trim());
  }

  @Post('research-mentor/step')
  researchMentorStep(@Req() req: any, @Body() body: any) {
    const topic = String(body.topic || '').trim();
    const stepNumber = Number(body.stepNumber || 1);
    if (!topic) throw new BadRequestException('Topic is required');
    return this.service.researchMentorStep(req.user.id, topic, stepNumber);
  }

  @Post('research-mentor/generate')
  researchMentorGenerate(@Req() req: any, @Body('topic') topic: string) {
    if (!topic?.trim()) throw new BadRequestException('Topic is required');
    return this.service.researchMentorGenerate(req.user.id, topic.trim());
  }

  @Post('research-mentor/session/start')
  async researchMentorSessionStart(@Req() req: any, @Body('topic') topic: string) {
    if (!topic?.trim()) throw new BadRequestException('Topic is required');
    return this.service.researchMentorSessionStart(req.user.id, topic.trim());
  }

  @Get('research-mentor/session/:id')
  async researchMentorSessionGet(@Req() req: any, @Param('id') id: string) {
    const session = await this.service.researchMentorSessionGet(req.user.id, id);
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  @Post('research-assistant/conduct')
  async conductResearchAssistant(@Req() req: any, @Body('question') question: string) {
    if (!question?.trim()) throw new BadRequestException('Question is required');
    return this.service.conductResearchAssistant(req.user.id, question.trim());
  }

  @Get('bare-act/conversations')
  async getConversations(@Req() req: any) {
    return this.service.getConversations(req.user.id);
  }

  @Post('bare-act/conversations')
  async saveConversation(@Req() req: any, @Body() body: any) {
    return this.service.saveConversation(req.user.id, body);
  }

  @Post('bare-act/messages')
  async saveMessage(@Req() req: any, @Body() body: any) {
    return this.service.saveMessage(req.user.id, body);
  }

  @Delete('bare-act/conversations/:id')
  async deleteConversation(@Req() req: any, @Param('id') id: string) {
    return this.service.deleteConversation(req.user.id, id);
  }

  @Get('bare-act/conversations/:id/messages')
  async getMessages(@Req() req: any, @Param('id') id: string) {
    return this.service.getMessages(req.user.id, id);
  }

  @Post('bare-act/conversations/:id/rename')
  async renameConversation(@Req() req: any, @Param('id') id: string, @Body('title') title: string) {
    return this.service.renameConversation(req.user.id, id, title);
  }
}


