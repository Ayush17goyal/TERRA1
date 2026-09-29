import { Controller, Get, Header, Res } from '@nestjs/common';
import { DataSource } from 'typeorm';
import axios from 'axios';
import type { Response } from 'express';
import { SupabaseService } from '../../modules/settings/supabase.service';
import { QdrantService } from '../../modules/retrieval/qdrant.service';
import { loadEnvironment } from '../config/environment';
import { metricsContentType, renderMetrics } from '../observability/metrics';

@Controller()
export class ProductionHealthController {
  private readonly env = loadEnvironment();
  constructor(private readonly dataSource: DataSource, private readonly supabaseService: SupabaseService, private readonly qdrantService: QdrantService) {}
  @Get('health/live') live() { return { status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() }; }
  @Get('health/ready') async ready() {
    const checks: Record<string, { status: string; latencyMs?: number; message?: string }> = {};
    await this.check('database', checks, async () => this.dataSource.query('SELECT 1'));
    await this.check('supabase', checks, async () => {
      if (!this.supabaseService.isConfigured()) return 'not_configured';
      const key = this.supabaseService.getServiceRoleKey();
      if (!key) return 'missing_service_role_key';
      await axios.get(`${this.supabaseService.supabaseUrl}/rest/v1/`, { headers: this.supabaseService.getHeaders(), timeout: 3000 }).catch((error) => { if (error.response?.status === 404) return undefined; throw error; });
      return 'ok';
    });
    await this.check('qdrant', checks, async () => { if (!process.env.QDRANT_URL) return 'not_configured'; await this.qdrantService.getClient().getCollections(); return 'ok'; });
    await this.check('openai', checks, async () => (this.env.OPENAI_API_KEY || this.env.OPENROUTER_API_KEY ? 'configured' : 'not_configured'));
    await this.check('redis', checks, async () => (this.env.REDIS_URL ? 'configured' : 'not_configured'));
    await this.check('virusScan', checks, async () => (this.env.VIRUS_SCAN_MODE === 'required' ? 'required' : this.env.VIRUS_SCAN_MODE));
    const unhealthy = Object.values(checks).some((check) => check.status === 'unhealthy');
    return { status: unhealthy ? 'degraded' : 'ready', timestamp: new Date().toISOString(), checks };
  }
  @Get('metrics') @Header('Cache-Control', 'no-store') async metrics(@Res() res: Response) { res.setHeader('Content-Type', metricsContentType()); res.send(await renderMetrics()); }
  private async check(name: string, checks: Record<string, any>, fn: () => Promise<any>) {
    const start = Date.now();
    try { const result = await Promise.race([fn(), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))]); checks[name] = { status: typeof result === 'string' ? result : 'healthy', latencyMs: Date.now() - start }; }
    catch (error: any) { checks[name] = { status: 'unhealthy', latencyMs: Date.now() - start, message: error.message }; }
  }
}