import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterAiProviderService } from '../chat/openrouter-ai-provider.service';
import { MemorialWorkflowOptions } from './memorial.types';

@Injectable()
export class MemorialAiService {
  private readonly logger = new Logger(MemorialAiService.name);

  constructor(private readonly aiProvider: OpenRouterAiProviderService) {}

  async json<T>(params: {
    system: string;
    prompt: string;
    options: MemorialWorkflowOptions;
    maxTokens?: number;
    temperature?: number;
    stage: string;
  }): Promise<T> {
    const result = await this.aiProvider.complete({
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.prompt },
      ],
      temperature: params.temperature ?? 0.1,
      maxTokens: params.maxTokens ?? 5000,
      timeoutMs: 90_000,
      preferredModel: params.options.preferredModel || 'Gemini',
      module: 'memorial',
      jsonMode: true,
      userId: params.options.userId,
    });

    try {
      return this.parseJson<T>(result.content);
    } catch (error: any) {
      this.logger.warn(`${params.stage} returned malformed JSON. Attempting repair: ${error?.message || error}`);
      const repair = await this.aiProvider.complete({
        messages: [
          {
            role: 'system',
            content: 'Repair the supplied malformed JSON. Return only one valid JSON object. Do not add or remove substantive information.',
          },
          { role: 'user', content: result.content.slice(0, 60_000) },
        ],
        temperature: 0,
        maxTokens: params.maxTokens ?? 5000,
        timeoutMs: 90_000,
        preferredModel: params.options.preferredModel || 'Gemini',
        module: 'memorial',
        jsonMode: true,
        userId: params.options.userId,
      });
      return this.parseJson<T>(repair.content);
    }
  }

  private parseJson<T>(content: string): T {
    const cleaned = String(content || '')
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    const candidate = first >= 0 && last > first ? cleaned.slice(first, last + 1) : cleaned;
    return JSON.parse(candidate) as T;
  }
}
