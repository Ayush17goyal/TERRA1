import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { KnowledgeEngineService } from './knowledge-engine.service';

@Controller('document-engine/library')
@UseGuards(ClerkAuthGuard)
export class KnowledgeEngineController {
  constructor(private readonly knowledgeEngine: KnowledgeEngineService) {}

  @Get()
  async library(@Req() req: any) {
    return this.knowledgeEngine.getLibrary(req.user.id);
  }

  @Get('topics')
  async topics(@Req() req: any) {
    return this.knowledgeEngine.listTopics(req.user.id);
  }

  @Get('topics/:id')
  async topic(@Param('id') id: string, @Req() req: any) {
    return this.knowledgeEngine.getTopic(req.user.id, id);
  }

  @Get('graph')
  async graph(@Req() req: any) {
    return this.knowledgeEngine.getTopicGraph(req.user.id);
  }
}
