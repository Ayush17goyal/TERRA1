import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SupabaseService } from '../settings/supabase.service';
import { QdrantService } from '../retrieval/qdrant.service';
import axios from 'axios';

type HealthCheck = {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'configured' | 'not_configured' | 'unknown';
  message?: string;
};

@Controller()
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly supabaseService: SupabaseService,
    private readonly qdrantService: QdrantService,
  ) {}

  @Get('health')
  async getHealth() {
    return this.checkAll();
  }

  @Get('api/health')
  async getApiHealth() {
    return this.checkAll();
  }

  private async checkAll() {
    const checks: Record<string, HealthCheck> = {
      database: { status: 'unknown' },
      supabase: { status: 'unknown' },
      qdrant: { status: 'unknown' },
      redis: { status: process.env.REDIS_URL ? 'configured' : 'not_configured' },
      openrouter: { status: process.env.OPENROUTER_API_KEY ? 'configured' : 'not_configured' },
      openai: { status: process.env.OPENAI_API_KEY ? 'configured' : 'not_configured' },
    };

    try {
      await this.withTimeout(this.dataSource.query('SELECT 1'), 3000);
      checks.database = { status: 'healthy' };
    } catch (err: any) {
      checks.database = { status: 'unhealthy', message: err.message };
    }

    if (this.supabaseService.isConfigured()) {
      const serviceKey = this.supabaseService.getServiceRoleKey();
      if (!serviceKey) {
        checks.supabase = { status: 'configured', message: 'SUPABASE_SERVICE_ROLE_KEY is not set' };
      } else {
        try {
          const response = await axios.get(`${this.supabaseService.supabaseUrl}/rest/v1/users?limit=1`, {
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
            },
            timeout: 5000,
          });
          checks.supabase = { status: 'healthy', message: `REST API responded ${response.status}` };
        } catch (err: any) {
          checks.supabase = {
            status: 'degraded',
            message: err.response?.data?.message || err.message,
          };
        }
      }
    } else {
      checks.supabase = { status: 'not_configured' };
    }

    if (process.env.QDRANT_URL) {
      try {
        const qdrantClient = this.qdrantService.getClient();
        await this.withTimeout(qdrantClient.getCollections(), 5000);
        checks.qdrant = { status: 'healthy' };
      } catch (err: any) {
        checks.qdrant = { status: 'degraded', message: err.message };
      }
    } else {
      checks.qdrant = { status: 'not_configured' };
    }

    const isDegraded = Object.values(checks).some((check) => check.status === 'unhealthy' || check.status === 'degraded');

    return {
      status: isDegraded ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      checks,
    };
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeout: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeout);
    }
  }
}
