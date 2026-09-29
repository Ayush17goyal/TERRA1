import { Controller, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { LegalRetrievalService } from './legal-retrieval.service';

@Controller('api/v1/retrieval')
export class RetrievalController {
  constructor(private readonly legalRetrievalService: LegalRetrievalService) {}

  @Get('search')
  @HttpCode(HttpStatus.OK)
  async search(
    @Query('query') query: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 5;
    return this.legalRetrievalService.retrieveLegalContext(query, limitNum);
  }
}
