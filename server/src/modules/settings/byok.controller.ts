import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { ByokService } from './byok.service';

@Controller('settings/byok')
@UseGuards(ClerkAuthGuard)
export class ByokController {
  constructor(private readonly byok: ByokService) {}

  /**
   * POST /settings/byok/keys
   * Save or update an API key for a provider.
   * Body: { provider: 'openai' | 'gemini' | 'groq', apiKey: string }
   */
  @Post('keys')
  async saveKey(@Req() req: any, @Body() body: { provider: string; apiKey: string }) {
    return this.byok.saveKey(req.user.id, body.provider, body.apiKey);
  }

  /**
   * DELETE /settings/byok/keys/:provider
   * Remove a stored API key for a provider.
   */
  @Delete('keys/:provider')
  async deleteKey(@Req() req: any, @Param('provider') provider: string) {
    return this.byok.deleteKey(req.user.id, provider);
  }

  /**
   * GET /settings/byok/keys
   * List all configured providers (never exposes raw keys).
   */
  @Get('keys')
  async listKeys(@Req() req: any) {
    return this.byok.listKeys(req.user.id);
  }

  /**
   * GET /settings/byok/usage
   * Get BYOK usage metrics for the current user.
   */
  @Get('usage')
  async getUsage(@Req() req: any) {
    return this.byok.getUsageMetrics(req.user.id);
  }

  /**
   * GET /settings/byok/status
   * Return safe provider status metadata for every supported provider.
   */
  @Get('status')
  async getStatus(@Req() req: any) {
    const keys = await this.byok.listKeys(req.user.id);
    return {
      providers: ['groq', 'gemini', 'openai'].map((provider) => {
        const configured = keys.find((key) => key.provider === provider);
        return configured || {
          provider,
          status: 'Not Configured',
          lastVerifiedAt: null,
          fingerprint: null,
        };
      }),
    };
  }
}
