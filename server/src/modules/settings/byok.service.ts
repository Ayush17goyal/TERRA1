import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { UserApiKey, UserByokUsageMetric } from './byok.entity';

const SUPPORTED_PROVIDERS = ['openai', 'gemini', 'groq'] as const;
type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];
type ProviderStatus = 'Connected' | 'Invalid Key' | 'Rate Limited' | 'Not Configured';

const PROVIDER_VALIDATION: Record<SupportedProvider, { url: string; model: string; baseURL?: string }> = {
  openai: {
    url: 'https://api.openai.com/v1/models',
    model: 'gpt-4o-mini',
  },
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-flash',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/models',
    model: 'llama-3.3-70b-versatile',
    baseURL: 'https://api.groq.com/openai/v1',
  },
};

@Injectable()
export class ByokService {
  private readonly logger = new Logger(ByokService.name);
  private readonly algorithm = 'aes-256-gcm';

  constructor(
    @InjectRepository(UserApiKey)
    private readonly apiKeyRepo: Repository<UserApiKey>,
    @InjectRepository(UserByokUsageMetric)
    private readonly usageRepo: Repository<UserByokUsageMetric>,
  ) {}

  private getEncryptionKey(): Buffer {
    const envKey = process.env.BYOK_ENCRYPTION_KEY;
    const isHexKey = Boolean(envKey && /^[a-f0-9]{64}$/i.test(envKey));

    if (!isHexKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('BYOK_ENCRYPTION_KEY must be a 64-character hex key in production.');
      }

      this.logger.warn('BYOK_ENCRYPTION_KEY is not a 64-character hex key. Using a development-only derived key.');
      return crypto.scryptSync('legatrixon-byok-default-passphrase', 'salt', 32);
    }

    return Buffer.from(envKey!, 'hex');
  }

  private encrypt(plainText: string): { encrypted: string; iv: string; tag: string } {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');
    return { encrypted, iv: iv.toString('hex'), tag };
  }

  private decrypt(encrypted: string, ivHex: string, tagHex: string): string {
    const key = this.getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private isSupportedProvider(provider: string): provider is SupportedProvider {
    return SUPPORTED_PROVIDERS.includes(provider as SupportedProvider);
  }

  private fingerprint(provider: SupportedProvider, apiKey: string): string {
    return crypto.createHash('sha256').update(`${provider}:${apiKey.trim()}`).digest('hex').slice(0, 12);
  }

  sanitizeError(error: any): string {
    const raw = error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || String(error || '');
    return String(raw)
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
      .replace(/sk-proj-[A-Za-z0-9._-]+/gi, '[REDACTED_OPENAI_KEY]')
      .replace(/sk-[A-Za-z0-9._-]+/gi, '[REDACTED_OPENAI_KEY]')
      .replace(/gsk_[A-Za-z0-9._-]+/gi, '[REDACTED_GROQ_KEY]')
      .replace(/AIza[A-Za-z0-9._-]+/gi, '[REDACTED_GEMINI_KEY]')
      .slice(0, 180);
  }

  classifyProviderError(error: any): ProviderStatus {
    const status = error?.status || error?.response?.status;
    const message = this.sanitizeError(error).toLowerCase();

    if (status === 401 || status === 403) return 'Invalid Key';
    if (status === 402 || status === 429 || /rate|quota|billing|credit|payment|balance/.test(message)) {
      return 'Rate Limited';
    }

    return 'Not Configured';
  }

  private async validateKeyWithProvider(provider: SupportedProvider, apiKey: string): Promise<ProviderStatus> {
    try {
      const config = PROVIDER_VALIDATION[provider];
      const { default: axios } = await import('axios');
      const response = await axios.get(config.url, {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 8000,
      });

      return response.status === 200 ? 'Connected' : 'Not Configured';
    } catch (error: any) {
      const status = this.classifyProviderError(error);
      this.logger.warn(`BYOK validation failed for provider=${provider}; status=${status}.`);
      return status;
    }
  }

  async saveKey(
    userId: string,
    provider: string,
    apiKey: string,
  ): Promise<{ provider: string; status: string; lastVerifiedAt: Date | null; fingerprint: string }> {
    if (!this.isSupportedProvider(provider)) {
      throw new BadRequestException(`Unsupported provider "${provider}". Supported: ${SUPPORTED_PROVIDERS.join(', ')}`);
    }

    const trimmedKey = apiKey?.trim();
    if (!trimmedKey || trimmedKey.length < 8) {
      throw new BadRequestException('API key is too short to be valid.');
    }

    const validationStatus = await this.validateKeyWithProvider(provider, trimmedKey);
    const { encrypted, iv, tag } = this.encrypt(trimmedKey);
    const keyFingerprint = this.fingerprint(provider, trimmedKey);

    let record = await this.apiKeyRepo.findOne({ where: { userId, provider } });
    if (record) {
      record.apiKeyEncrypted = encrypted;
      record.encryptionIv = iv;
      record.encryptionTag = tag;
      record.keyFingerprint = keyFingerprint;
      record.status = validationStatus;
      record.lastVerifiedAt = validationStatus === 'Connected' ? new Date() : null;
    } else {
      record = this.apiKeyRepo.create({
        userId,
        provider,
        apiKeyEncrypted: encrypted,
        encryptionIv: iv,
        encryptionTag: tag,
        keyFingerprint,
        status: validationStatus,
        lastVerifiedAt: validationStatus === 'Connected' ? new Date() : null,
      });
    }

    const saved = await this.apiKeyRepo.save(record);
    this.logger.log(`BYOK key metadata saved for provider=${provider}; status=${saved.status}.`);

    return {
      provider: saved.provider,
      status: saved.status,
      lastVerifiedAt: saved.lastVerifiedAt,
      fingerprint: saved.keyFingerprint,
    };
  }

  async deleteKey(userId: string, provider: string): Promise<{ deleted: boolean }> {
    const result = await this.apiKeyRepo.delete({ userId, provider });
    return { deleted: (result.affected ?? 0) > 0 };
  }

  async listKeys(
    userId: string,
  ): Promise<Array<{ provider: string; status: string; lastVerifiedAt: Date | null; fingerprint: string | null }>> {
    const keys = await this.apiKeyRepo.find({ where: { userId } });
    return keys.map((key) => ({
      provider: key.provider,
      status: key.status,
      lastVerifiedAt: key.lastVerifiedAt,
      fingerprint: key.keyFingerprint || null,
    }));
  }

  async getDecryptedKey(userId: string, provider: SupportedProvider): Promise<string | null> {
    if (!userId) return null;

    const record = await this.apiKeyRepo.findOne({ where: { userId, provider } });
    if (!record || record.status === 'Invalid Key' || record.status === 'Rate Limited') return null;

    try {
      return this.decrypt(record.apiKeyEncrypted, record.encryptionIv, record.encryptionTag);
    } catch (error) {
      this.logger.error(`Failed to decrypt BYOK key for provider=${provider}: ${(error as Error).message}`);
      return null;
    }
  }

  async getAnyDecryptedKey(
    userId: string,
  ): Promise<{ apiKey: string; provider: SupportedProvider; baseURL?: string; model: string } | null> {
    if (!userId) return null;

    const priorityOrder: SupportedProvider[] = ['gemini', 'openai', 'groq'];
    for (const provider of priorityOrder) {
      const key = await this.getDecryptedKey(userId, provider);
      if (!key) continue;

      const config = PROVIDER_VALIDATION[provider];
      return {
        apiKey: key,
        provider,
        baseURL: config.baseURL,
        model: config.model,
      };
    }

    return null;
  }

  async updateProviderStatus(userId: string, provider: string, status: ProviderStatus): Promise<void> {
    if (!userId || !this.isSupportedProvider(provider)) return;

    const record = await this.apiKeyRepo.findOne({ where: { userId, provider } });
    if (!record) return;

    record.status = status;
    if (status === 'Connected') record.lastVerifiedAt = new Date();
    await this.apiKeyRepo.save(record);
  }

  async trackUsage(userId: string, usedUserKey: boolean): Promise<void> {
    if (!userId) return;

    let metric = await this.usageRepo.findOne({ where: { userId } });
    if (!metric) metric = this.usageRepo.create({ userId });

    if (usedUserKey) {
      metric.requestsUserKeys = (metric.requestsUserKeys || 0) + 1;
    } else {
      metric.requestsLegatrixonKeys = (metric.requestsLegatrixonKeys || 0) + 1;
    }

    await this.usageRepo.save(metric);
  }

  async incrementCacheHit(userId: string): Promise<void> {
    if (!userId) return;

    let metric = await this.usageRepo.findOne({ where: { userId } });
    if (!metric) metric = this.usageRepo.create({ userId });

    metric.cacheHits = (metric.cacheHits || 0) + 1;
    metric.estimatedApiCallsSaved = (metric.estimatedApiCallsSaved || 0) + 1;
    await this.usageRepo.save(metric);
  }

  async getUsageMetrics(userId: string) {
    const metric = await this.usageRepo.findOne({ where: { userId } });
    if (!metric) {
      return {
        requestsUserKeys: 0,
        requestsLegatrixonKeys: 0,
        cacheHits: 0,
        estimatedApiCallsSaved: 0,
      };
    }

    return {
      requestsUserKeys: metric.requestsUserKeys,
      requestsLegatrixonKeys: metric.requestsLegatrixonKeys,
      cacheHits: metric.cacheHits,
      estimatedApiCallsSaved: metric.estimatedApiCallsSaved,
    };
  }
}
