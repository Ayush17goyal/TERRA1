import { Body, Controller, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { CitationStyle, MemorialDepth, MemorialSide } from './memorial.types';
import { MemorialWorkflowService } from './memorial-workflow.service';

interface MemorialWorkflowBody {
  propositionText?: string;
  side?: MemorialSide;
  sourceName?: string;
  depth?: MemorialDepth;
  citationStyle?: CitationStyle;
  preferredModel?: string;
  selectedSources?: string | string[];
  competitionRulesText?: string;
  maxPages?: string | number;
  maxWords?: string | number;
  qualityThreshold?: string | number;
  allowUnverifiedAuthorities?: string | boolean;
  userId?: string;
}

@Controller('memorial-workflow')
export class MemorialWorkflowController {
  constructor(private readonly workflow: MemorialWorkflowService) {}

  @Post('blueprint')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'file', maxCount: 1 },
    { name: 'references', maxCount: 12 },
  ]))
  async blueprint(@UploadedFiles() files: { file?: any[]; references?: any[] }, @Body() body: MemorialWorkflowBody) {
    return this.workflow.extractBlueprint(this.toInput(files?.file?.[0], files?.references || [], body));
  }

  @Post('run')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'file', maxCount: 1 },
    { name: 'references', maxCount: 12 },
  ]))
  async run(@UploadedFiles() files: { file?: any[]; references?: any[] }, @Body() body: MemorialWorkflowBody) {
    return this.workflow.run(this.toInput(files?.file?.[0], files?.references || [], body));
  }

  private toInput(file: any, referenceFiles: any[], body: MemorialWorkflowBody) {
    return {
      file,
      referenceFiles,
      propositionText: body.propositionText,
      side: body.side || 'both',
      sourceName: body.sourceName,
      depth: body.depth || 'exhaustive',
      citationStyle: body.citationStyle || 'bluebook',
      preferredModel: body.preferredModel,
      selectedSources: this.parseStringArray(body.selectedSources),
      competitionRulesText: body.competitionRulesText,
      maxPages: this.parseOptionalNumber(body.maxPages),
      maxWords: this.parseOptionalNumber(body.maxWords),
      qualityThreshold: this.parseOptionalNumber(body.qualityThreshold) || 92,
      allowUnverifiedAuthorities: body.allowUnverifiedAuthorities === true || String(body.allowUnverifiedAuthorities).toLowerCase() === 'true',
      userId: body.userId,
    };
  }

  private parseStringArray(value?: string | string[]) {
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {}
    return String(value).split(',').map((item) => item.trim()).filter(Boolean);
  }

  private parseOptionalNumber(value?: string | number) {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
}
