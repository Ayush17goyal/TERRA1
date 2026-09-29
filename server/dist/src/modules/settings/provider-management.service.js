"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ProviderManagementService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderManagementService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const axios_1 = require("axios");
const crypto = require("crypto");
const net = require("net");
const tls = require("tls");
const os = require("os");
const typeorm_2 = require("typeorm");
const provider_management_entity_1 = require("./provider-management.entity");
const ADMIN_ALERT_EMAIL = 'legatrixon2026@gmail.com';
const PROVIDERS = {
    gemini: {
        displayName: 'Gemini',
        priority: 10,
        testUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
        auth: 'gemini-query',
    },
    openai: {
        displayName: 'OpenAI',
        priority: 20,
        testUrl: 'https://api.openai.com/v1/models',
        auth: 'bearer',
    },
    groq: {
        displayName: 'Groq',
        priority: 30,
        testUrl: 'https://api.groq.com/openai/v1/models',
        auth: 'bearer',
    },
    deepseek: {
        displayName: 'DeepSeek',
        priority: 40,
        testUrl: 'https://api.deepseek.com/models',
        auth: 'bearer',
    },
    openrouter: {
        displayName: 'OpenRouter',
        priority: 50,
        testUrl: 'https://openrouter.ai/api/v1/models',
        auth: 'bearer',
    },
};
let ProviderManagementService = ProviderManagementService_1 = class ProviderManagementService {
    constructor(providerRepo, keyRepo, failureRepo, alertRepo, usageRepo) {
        this.providerRepo = providerRepo;
        this.keyRepo = keyRepo;
        this.failureRepo = failureRepo;
        this.alertRepo = alertRepo;
        this.usageRepo = usageRepo;
        this.logger = new common_1.Logger(ProviderManagementService_1.name);
        this.algorithm = 'aes-256-gcm';
        this.keyCache = new Map();
    }
    getClientOrigin() {
        const explicitOrigin = process.env.CLIENT_ORIGIN || process.env.CLIENT_ORIGINS?.split(',')[0];
        const origin = explicitOrigin?.trim().replace(/\/+$/, '');
        if (origin)
            return origin;
        if (process.env.NODE_ENV === 'production') {
            throw new Error('CLIENT_ORIGINS must be configured in production for admin links.');
        }
        return 'http://localhost:5173';
    }
    async onModuleInit() {
        await this.ensureProviders();
    }
    async getAdminDashboard() {
        await this.ensureProviders();
        const providers = await this.providerRepo.find({ order: { priority: 'ASC' } });
        const keys = await this.keyRepo.find({ order: { providerKey: 'ASC', priority: 'ASC', createdAt: 'DESC' } });
        const alerts = await this.alertRepo.find({ order: { createdAt: 'DESC' }, take: 30 });
        const failures = await this.failureRepo.find({ order: { createdAt: 'DESC' }, take: 30 });
        const metrics = await this.usageRepo.find({ order: { createdAt: 'DESC' }, take: 100 });
        return {
            providers: providers.map((provider) => {
                const providerKeys = keys.filter((key) => key.providerKey === provider.providerKey);
                const activeKey = providerKeys.find((key) => key.isActive);
                return {
                    providerKey: provider.providerKey,
                    displayName: provider.displayName,
                    enabled: provider.enabled,
                    priority: provider.priority,
                    status: provider.status,
                    lastSuccessAt: provider.lastSuccessAt,
                    lastFailureAt: provider.lastFailureAt,
                    lastFailureReason: provider.lastFailureReason,
                    activeKeyFingerprint: activeKey?.fingerprint || null,
                    backupKeyCount: providerKeys.filter((key) => !key.isActive && key.status !== 'disabled').length,
                    keys: providerKeys.map((key) => this.serializeKey(key)),
                };
            }),
            alerts,
            failures,
            metrics,
            summary: {
                healthy: providers.filter((provider) => provider.status === 'healthy').length,
                degraded: providers.filter((provider) => provider.status !== 'healthy').length,
                openAlerts: alerts.filter((alert) => alert.status === 'open').length,
                managedKeys: keys.length,
            },
        };
    }
    async saveKey(input) {
        const providerKey = this.assertProvider(input.providerKey);
        const apiKey = input.apiKey?.trim();
        if (!apiKey || apiKey.length < 8)
            throw new common_1.BadRequestException('API key is too short.');
        await this.ensureProviders();
        const test = input.testBeforeActivate === false ? { ok: true, status: 'not_tested', message: 'Validation skipped.' } : await this.testRawKey(providerKey, apiKey);
        if (input.activate && !test.ok) {
            throw new common_1.BadRequestException(`Key validation failed: ${test.message}`);
        }
        const encrypted = this.encrypt(apiKey);
        const fingerprint = this.fingerprint(providerKey, apiKey);
        const key = this.keyRepo.create({
            providerKey,
            label: input.label || `${PROVIDERS[providerKey].displayName} key`,
            encryptedKey: encrypted.encrypted,
            encryptionIv: encrypted.iv,
            encryptionTag: encrypted.tag,
            fingerprint,
            status: input.activate ? 'active' : test.ok ? 'backup' : 'invalid',
            priority: input.priority ?? 100,
            isActive: Boolean(input.activate),
            lastTestedAt: new Date(),
            lastSuccessAt: test.ok ? new Date() : null,
            lastFailureAt: test.ok ? null : new Date(),
            lastFailureReason: test.ok ? null : test.message,
            createdBy: input.createdBy || null,
        });
        if (input.activate) {
            await this.keyRepo.update({ providerKey }, { isActive: false, status: 'backup' });
            await this.alertRepo.update({ providerKey, status: 'open' }, { status: 'resolved', resolvedAt: new Date() });
        }
        const saved = await this.keyRepo.save(key);
        await this.providerRepo.update({ providerKey }, {
            enabled: true,
            status: test.ok ? 'healthy' : 'degraded',
            lastSuccessAt: test.ok ? new Date() : undefined,
            lastFailureAt: test.ok ? undefined : new Date(),
            lastFailureReason: test.ok ? null : test.message,
        });
        this.invalidate(providerKey);
        return { key: this.serializeKey(saved), test };
    }
    async testKey(keyId) {
        const key = await this.keyRepo.findOne({ where: { id: keyId } });
        if (!key)
            throw new common_1.BadRequestException('Provider key not found.');
        const apiKey = this.decrypt(key.encryptedKey, key.encryptionIv, key.encryptionTag);
        const test = await this.testRawKey(this.assertProvider(key.providerKey), apiKey);
        key.lastTestedAt = new Date();
        key.status = test.ok ? (key.isActive ? 'active' : 'backup') : 'invalid';
        key.lastSuccessAt = test.ok ? new Date() : key.lastSuccessAt;
        key.lastFailureAt = test.ok ? key.lastFailureAt : new Date();
        key.lastFailureReason = test.ok ? null : test.message;
        await this.keyRepo.save(key);
        this.invalidate(key.providerKey);
        return { key: this.serializeKey(key), test };
    }
    async setProviderEnabled(providerKeyInput, enabled) {
        const providerKey = this.assertProvider(providerKeyInput);
        const provider = await this.providerRepo.findOne({ where: { providerKey } });
        if (!provider)
            throw new common_1.BadRequestException('Provider not found.');
        provider.enabled = enabled;
        provider.status = enabled ? 'healthy' : 'disabled';
        await this.providerRepo.save(provider);
        this.invalidate(providerKey);
        return provider;
    }
    async setKeyActive(keyId) {
        const key = await this.keyRepo.findOne({ where: { id: keyId } });
        if (!key)
            throw new common_1.BadRequestException('Provider key not found.');
        await this.keyRepo.update({ providerKey: key.providerKey }, { isActive: false, status: 'backup' });
        key.isActive = true;
        key.status = 'active';
        await this.keyRepo.save(key);
        await this.providerRepo.update({ providerKey: key.providerKey }, { enabled: true, status: 'healthy' });
        await this.alertRepo.update({ providerKey: key.providerKey, status: 'open' }, { status: 'resolved', resolvedAt: new Date() });
        this.invalidate(key.providerKey);
        return this.serializeKey(key);
    }
    async disableKey(keyId) {
        const key = await this.keyRepo.findOne({ where: { id: keyId } });
        if (!key)
            throw new common_1.BadRequestException('Provider key not found.');
        key.isActive = false;
        key.status = 'disabled';
        await this.keyRepo.save(key);
        this.invalidate(key.providerKey);
        return this.serializeKey(key);
    }
    async getActiveApiKey(providerKeyInput) {
        const providerKey = this.assertProvider(providerKeyInput);
        const provider = await this.providerRepo.findOne({ where: { providerKey } });
        if (!provider || !provider.enabled || provider.status === 'disabled')
            return null;
        const cached = this.keyCache.get(providerKey);
        if (cached && cached.expiresAt > Date.now()) {
            return { apiKey: cached.value, keyId: cached.keyId, fingerprint: cached.fingerprint };
        }
        const key = await this.keyRepo.findOne({
            where: { providerKey, isActive: true },
            order: { priority: 'ASC', createdAt: 'DESC' },
        }) || await this.keyRepo.findOne({
            where: { providerKey, status: 'backup' },
            order: { priority: 'ASC', createdAt: 'DESC' },
        });
        if (!key || key.status === 'disabled' || key.status === 'invalid')
            return null;
        const apiKey = this.decrypt(key.encryptedKey, key.encryptionIv, key.encryptionTag);
        this.keyCache.set(providerKey, { value: apiKey, expiresAt: Date.now() + 60_000, keyId: key.id, fingerprint: key.fingerprint });
        return { apiKey, keyId: key.id, fingerprint: key.fingerprint };
    }
    async recordSuccess(providerKeyInput, keyId, moduleKey, latencyMs, promptTokens = 0, completionTokens = 0) {
        const providerKey = this.assertProvider(providerKeyInput);
        await this.providerRepo.update({ providerKey }, { status: 'healthy', lastSuccessAt: new Date(), lastFailureReason: null });
        if (keyId)
            await this.keyRepo.update({ id: keyId }, { status: 'active', lastSuccessAt: new Date(), lastFailureReason: null });
        await this.incrementUsage(providerKey, keyId, moduleKey, true, latencyMs, promptTokens, completionTokens);
    }
    async recordFailure(providerKeyInput, keyId, error, moduleKey, model) {
        const providerKey = this.assertProvider(providerKeyInput);
        const classified = this.classifyError(error);
        const key = keyId ? await this.keyRepo.findOne({ where: { id: keyId } }) : null;
        await this.failureRepo.save(this.failureRepo.create({
            providerKey,
            keyFingerprint: key?.fingerprint || null,
            httpStatus: classified.httpStatus,
            failureType: classified.failureType,
            safeMessage: classified.safeMessage,
            requestModule: moduleKey || null,
            model: model || null,
        }));
        const providerStatus = this.statusFromFailure(classified.failureType);
        await this.providerRepo.update({ providerKey }, {
            status: providerStatus,
            lastFailureAt: new Date(),
            lastFailureReason: classified.safeMessage,
        });
        if (key) {
            key.status = providerStatus;
            key.isActive = false;
            key.lastFailureAt = new Date();
            key.lastFailureReason = classified.safeMessage;
            await this.keyRepo.save(key);
        }
        await this.incrementUsage(providerKey, keyId, moduleKey, false);
        this.invalidate(providerKey);
        await this.promoteBackupKey(providerKey);
        await this.createAlert(providerKey, classified.failureType, classified.safeMessage);
    }
    classifyError(error) {
        const httpStatus = error?.status || error?.response?.status || null;
        const safeMessage = this.sanitizeError(error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || String(error || 'Provider failure'));
        const lower = safeMessage.toLowerCase();
        if (httpStatus === 401 || httpStatus === 403 || /invalid|unauthorized|forbidden|api key/.test(lower)) {
            return { httpStatus, failureType: 'invalid_key', safeMessage };
        }
        if (httpStatus === 402 || /quota|billing|payment|credit|balance|exhausted/.test(lower)) {
            return { httpStatus, failureType: /billing|payment|balance/.test(lower) ? 'billing' : 'quota', safeMessage };
        }
        if (httpStatus === 429 || /rate limit|too many/.test(lower)) {
            return { httpStatus, failureType: 'rate_limit', safeMessage };
        }
        if (/timeout|timed out|etimedout|econnaborted/.test(lower)) {
            return { httpStatus, failureType: 'timeout', safeMessage };
        }
        return { httpStatus, failureType: 'provider_error', safeMessage };
    }
    sanitizeError(value) {
        return String(value || '')
            .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
            .replace(/sk-proj-[A-Za-z0-9._-]+/gi, '[REDACTED_OPENAI_KEY]')
            .replace(/sk-[A-Za-z0-9._-]+/gi, '[REDACTED_OPENAI_KEY]')
            .replace(/gsk_[A-Za-z0-9._-]+/gi, '[REDACTED_GROQ_KEY]')
            .replace(/AIza[A-Za-z0-9._-]+/gi, '[REDACTED_GEMINI_KEY]')
            .slice(0, 240);
    }
    async ensureProviders() {
        for (const [providerKey, config] of Object.entries(PROVIDERS)) {
            const existing = await this.providerRepo.findOne({ where: { providerKey } });
            if (existing)
                continue;
            await this.providerRepo.save(this.providerRepo.create({
                providerKey,
                displayName: config.displayName,
                enabled: true,
                priority: config.priority,
                status: 'healthy',
            }));
        }
    }
    assertProvider(providerKey) {
        const normalized = String(providerKey || '').toLowerCase();
        if (!Object.prototype.hasOwnProperty.call(PROVIDERS, normalized)) {
            throw new common_1.BadRequestException(`Unsupported provider "${providerKey}".`);
        }
        return normalized;
    }
    async testRawKey(providerKey, apiKey) {
        try {
            const config = PROVIDERS[providerKey];
            const url = config.auth === 'gemini-query' ? `${config.testUrl}?key=${encodeURIComponent(apiKey)}` : config.testUrl;
            const headers = config.auth === 'bearer' ? { Authorization: `Bearer ${apiKey}` } : undefined;
            const response = await axios_1.default.get(url, { headers, timeout: 8000 });
            return { ok: response.status >= 200 && response.status < 300, status: 'connected', message: 'Key validated successfully.' };
        }
        catch (error) {
            const classified = this.classifyError(error);
            return { ok: false, status: classified.failureType, message: classified.safeMessage };
        }
    }
    getEncryptionKey() {
        const envKey = process.env.PROVIDER_KEY_ENCRYPTION_KEY || process.env.BYOK_ENCRYPTION_KEY;
        if (envKey && /^[a-f0-9]{64}$/i.test(envKey))
            return Buffer.from(envKey, 'hex');
        if (process.env.NODE_ENV === 'production')
            throw new Error('PROVIDER_KEY_ENCRYPTION_KEY must be a 64-character hex key in production.');
        this.logger.warn('PROVIDER_KEY_ENCRYPTION_KEY is not configured. Using development-only derived key.');
        return crypto.scryptSync('legatrixon-provider-key-default-passphrase', 'provider-salt', 32);
    }
    encrypt(plainText) {
        const key = this.getEncryptionKey();
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.algorithm, key, iv);
        let encrypted = cipher.update(plainText, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return { encrypted, iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex') };
    }
    decrypt(encrypted, ivHex, tagHex) {
        const decipher = crypto.createDecipheriv(this.algorithm, this.getEncryptionKey(), Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    fingerprint(providerKey, apiKey) {
        return crypto.createHash('sha256').update(`${providerKey}:${apiKey.trim()}`).digest('hex').slice(0, 12);
    }
    serializeKey(key) {
        return {
            id: key.id,
            providerKey: key.providerKey,
            label: key.label,
            fingerprint: key.fingerprint,
            status: key.status,
            priority: key.priority,
            isActive: key.isActive,
            lastTestedAt: key.lastTestedAt,
            lastSuccessAt: key.lastSuccessAt,
            lastFailureAt: key.lastFailureAt,
            lastFailureReason: key.lastFailureReason,
            createdBy: key.createdBy,
            createdAt: key.createdAt,
            updatedAt: key.updatedAt,
        };
    }
    invalidate(providerKey) {
        this.keyCache.delete(providerKey);
    }
    statusFromFailure(failureType) {
        if (failureType === 'invalid_key')
            return 'invalid_key';
        if (failureType === 'quota')
            return 'quota_exhausted';
        if (failureType === 'billing')
            return 'billing_exhausted';
        if (failureType === 'rate_limit')
            return 'rate_limited';
        if (failureType === 'timeout')
            return 'degraded';
        return 'degraded';
    }
    async promoteBackupKey(providerKey) {
        const backup = await this.keyRepo.findOne({
            where: { providerKey, status: 'backup' },
            order: { priority: 'ASC', createdAt: 'DESC' },
        });
        if (!backup)
            return;
        await this.keyRepo.update({ providerKey }, { isActive: false });
        backup.isActive = true;
        backup.status = 'active';
        await this.keyRepo.save(backup);
        await this.providerRepo.update({ providerKey }, { enabled: true, status: 'healthy' });
        this.invalidate(providerKey);
    }
    async createAlert(providerKey, failureType, safeMessage) {
        let title = `LEGATRIXON AI Provider Alert: ${PROVIDERS[providerKey].displayName} ${failureType.replace(/_/g, ' ')}`;
        let message = `Provider: ${PROVIDERS[providerKey].displayName}\nFailure: ${failureType}\nMessage: ${safeMessage}\nRuntime rotation has been attempted. Check Founder Portal for replacement/testing.`;
        if (failureType === 'quota' || failureType === 'billing' || failureType === 'rate_limit') {
            title = `LEGATRIXON AI Provider: ${PROVIDERS[providerKey].displayName} ki limit hit ho gayi h place new API key`;
            message = `AI Provider key limit hit ho gayi h. Please place a new API key in the Admin Portal to restore normal operations.\n\nProvider: ${PROVIDERS[providerKey].displayName}\nFailure Type: ${failureType}\nError Details: ${safeMessage}`;
        }
        const cooldownTime = new Date(Date.now() - 30 * 60 * 1000);
        const recentAlert = await this.alertRepo.findOne({
            where: {
                providerKey,
                alertType: failureType,
                createdAt: (0, typeorm_2.MoreThanOrEqual)(cooldownTime),
            },
        });
        const shouldSendEmail = !recentAlert;
        const alert = await this.alertRepo.save(this.alertRepo.create({
            providerKey,
            severity: failureType === 'timeout' || failureType === 'provider_error' ? 'warning' : 'critical',
            alertType: failureType,
            title,
            message,
            status: 'open',
            emailSent: false,
            emailSentAt: null,
        }));
        if (shouldSendEmail) {
            try {
                await this.sendProviderAlertEmail(ADMIN_ALERT_EMAIL, title, message, providerKey, failureType);
                alert.emailSent = true;
                alert.emailSentAt = new Date();
                await this.alertRepo.save(alert);
            }
            catch (error) {
                this.logger.warn(`Provider alert email failed: ${error.message}`);
            }
        }
        else {
            this.logger.log(`Deduplicated provider alert email for ${providerKey} - ${failureType} within cooldown period.`);
        }
    }
    async incrementUsage(providerKey, keyId, moduleKey, success, latencyMs = 0, promptTokens = 0, completionTokens = 0) {
        const key = keyId ? await this.keyRepo.findOne({ where: { id: keyId } }) : null;
        const metric = this.usageRepo.create({
            providerKey,
            keyFingerprint: key?.fingerprint || null,
            moduleKey: moduleKey || null,
            requestCount: 1,
            successCount: success ? 1 : 0,
            failureCount: success ? 0 : 1,
            rateLimitCount: 0,
            quotaFailureCount: 0,
            avgLatencyMs: latencyMs,
            tokensPrompt: promptTokens,
            tokensCompletion: completionTokens,
            estimatedCost: 0,
            windowStart: new Date(),
            windowEnd: new Date(),
        });
        await this.usageRepo.save(metric);
    }
    getPhysicalIpAddress() {
        const interfaces = os.networkInterfaces();
        const keys = Object.keys(interfaces).sort((a, b) => {
            const nameA = a.toLowerCase();
            const nameB = b.toLowerCase();
            const isPriA = nameA.includes('wi-fi') || nameA.includes('wifi') || nameA.includes('ethernet') || nameA.includes('wlan') || nameA.includes('lan') || nameA.includes('wireless');
            const isPriB = nameB.includes('wi-fi') || nameB.includes('wifi') || nameB.includes('ethernet') || nameB.includes('wlan') || nameB.includes('lan') || nameB.includes('wireless');
            if (isPriA && !isPriB)
                return -1;
            if (!isPriA && isPriB)
                return 1;
            return 0;
        });
        for (const name of keys) {
            const nameLower = name.toLowerCase();
            if (nameLower.includes('virtual') ||
                nameLower.includes('vbox') ||
                nameLower.includes('vmware') ||
                nameLower.includes('virtualbox') ||
                nameLower.includes('host-only') ||
                nameLower.includes('loopback') ||
                nameLower.includes('wsl') ||
                nameLower.includes('vethernet') ||
                nameLower.includes('pseudo')) {
                continue;
            }
            for (const netInterface of interfaces[name] || []) {
                if (netInterface.family === 'IPv4' &&
                    !netInterface.internal &&
                    !netInterface.address.startsWith('127.') &&
                    !netInterface.address.startsWith('169.254')) {
                    return netInterface.address;
                }
            }
        }
        for (const name of Object.keys(interfaces)) {
            for (const netInterface of interfaces[name] || []) {
                if (netInterface.family === 'IPv4' && !netInterface.internal && !netInterface.address.startsWith('127.')) {
                    return netInterface.address;
                }
            }
        }
        return 'localhost';
    }
    async sendProviderAlertEmail(toEmail, title, message, providerKey, failureType) {
        const host = process.env.SMTP_HOST;
        const port = Number(process.env.SMTP_PORT || 587);
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;
        const from = process.env.SECURITY_EMAIL_FROM || user || 'legatrixon2026@gmail.com';
        if (!host || !user || !pass) {
            throw new Error('SMTP_HOST, SMTP_USER, and SMTP_PASS are required for provider alert email delivery.');
        }
        const displayName = PROVIDERS[providerKey]?.displayName || providerKey;
        const severity = failureType === 'timeout' || failureType === 'provider_error' ? 'WARNING' : 'CRITICAL';
        let gradient = 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)';
        let glowColor = 'rgba(168, 85, 247, 0.4)';
        let color = '#a855f7';
        let severityColor = '#a855f7';
        if (failureType === 'quota' || failureType === 'billing') {
            gradient = 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)';
            glowColor = 'rgba(239, 68, 68, 0.4)';
            color = '#ef4444';
            severityColor = '#ef4444';
        }
        else if (failureType === 'rate_limit') {
            gradient = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
            glowColor = 'rgba(245, 158, 11, 0.4)';
            color = '#f59e0b';
            severityColor = '#f59e0b';
        }
        else if (severity === 'WARNING') {
            gradient = 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)';
            glowColor = 'rgba(249, 115, 22, 0.4)';
            color = '#f97316';
            severityColor = '#f97316';
        }
        const safeTitle = this.escapeHtml(title);
        const safeMessage = this.escapeHtml(message).replace(/\n/g, '<br>');
        const time = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }) + ' (IST)';
        const adminUrl = `${this.getClientOrigin()}/admin?tab=AI%20Models`;
        const devUrlLocal = adminUrl;
        const prodUrlLocal = adminUrl;
        const devUrlIp = adminUrl;
        const prodUrlIp = adminUrl;
        const htmlBody = `
<div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; border: 1px solid #1e293b; border-radius: 20px; background-color: #0b0f19; color: #f8fafc; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.6);">
  <div style="text-align: center; margin-bottom: 28px; border-bottom: 1px solid #1e293b; padding-bottom: 20px;">
    <span style="display: inline-block; width: 44px; height: 44px; border-radius: 50%; background: ${gradient}; margin-bottom: 12px; box-shadow: 0 0 20px ${glowColor};"></span>
    <h2 style="color: #f8fafc; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">LEGATRIXON AI Shield</h2>
    <p style="color: ${color}; margin: 6px 0 0; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;">AI Provider Alert Dispatch</p>
  </div>
  
  <div style="padding: 20px; background-color: rgba(22, 30, 49, 0.7); border: 1px solid #1e293b; border-radius: 14px; margin-bottom: 24px;">
    <h3 style="margin-top: 0; color: #f8fafc; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #1e293b; padding-bottom: 8px;">Alert Diagnostics</h3>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 13px; color: #cbd5e1; line-height: 1.8;">
      <tr>
        <td style="padding: 6px 0; font-weight: 600; color: #94a3b8; width: 140px;">PROVIDER:</td>
        <td style="padding: 6px 0; font-weight: 700; color: #f8fafc;">${displayName}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-weight: 600; color: #94a3b8;">ALERT TYPE:</td>
        <td style="padding: 6px 0; font-weight: 700; color: ${color}; text-transform: uppercase; font-size: 12px; letter-spacing: 0.03em;">${failureType.replace(/_/g, ' ')}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-weight: 600; color: #94a3b8;">SEVERITY:</td>
        <td style="padding: 6px 0; font-weight: 700; color: ${severityColor}; text-transform: uppercase; font-size: 12px;">${severity}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-weight: 600; color: #94a3b8;">TIMESTAMP:</td>
        <td style="padding: 6px 0; color: #f8fafc;">${time}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-weight: 600; color: #94a3b8; vertical-align: top;">DIAGNOSTIC MSG:</td>
        <td style="padding: 6px 0; font-family: monospace; font-size: 12px; color: #fda4af; word-break: break-word;">${safeMessage}</td>
      </tr>
    </table>
  </div>

  <div style="padding: 16px; background-color: rgba(30, 41, 59, 0.3); border-left: 4px solid #3b82f6; border-radius: 0 12px 12px 0; margin-bottom: 28px;">
    <h4 style="margin: 0 0 4px; color: #f8fafc; font-size: 13px; font-weight: 700;">Rotational Failover Triggered</h4>
    <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">The server has automatically attempted to switch to an active backup key. However, you should update the provider settings to restore full operational capacity.</p>
  </div>
  
  <p style="color: #cbd5e1; font-size: 13px; line-height: 1.6; margin-bottom: 24px; text-align: center;">
    Access the Admin Console to rotate, add, or test provider keys:
  </p>

  <p style="color: #94a3b8; font-size: 11px; line-height: 1.5; margin-bottom: 10px; text-align: center; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">
    Option 1: If accessing from local machine (PC)
  </p>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" width="220" bgcolor="#1e293b" style="border-radius: 8px; border: 1px solid #334155;">
              <a href="${devUrlLocal}" target="_blank" style="display: inline-block; padding: 12px 16px; color: #fbbf24; text-decoration: none; font-weight: 700; font-family: sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">VITE DEV PORTAL (5173)</a>
            </td>
            <td width="16"></td>
            <td align="center" width="220" bgcolor="#1e293b" style="border-radius: 8px; border: 1px solid #334155;">
              <a href="${prodUrlLocal}" target="_blank" style="display: inline-block; padding: 12px 16px; color: #38bdf8; text-decoration: none; font-weight: 700; font-family: sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">PROD PORTAL</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <p style="color: #94a3b8; font-size: 11px; line-height: 1.5; margin-bottom: 10px; text-align: center; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">
    Option 2: If accessing from Mobile Phone (Same Wi-Fi network)
  </p>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" width="220" bgcolor="#1e293b" style="border-radius: 8px; border: 1px solid #334155;">
              <a href="${devUrlIp}" target="_blank" style="display: inline-block; padding: 12px 16px; color: #fbbf24; text-decoration: none; font-weight: 700; font-family: sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">VITE DEV (MOBILE)</a>
            </td>
            <td width="16"></td>
            <td align="center" width="220" bgcolor="#1e293b" style="border-radius: 8px; border: 1px solid #334155;">
              <a href="${prodUrlIp}" target="_blank" style="display: inline-block; padding: 12px 16px; color: #38bdf8; text-decoration: none; font-weight: 700; font-family: sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">PROD (MOBILE)</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  
  <div style="text-align: center; font-size: 11px; color: #475569; border-top: 1px solid #1e293b; padding-top: 16px; line-height: 1.4;">
    <strong>Security Warning:</strong> This is an automated diagnostic system dispatch from your LEGATRIXON instance. Raw API credentials are never sent over email.
  </div>
</div>`;
        const rawMessage = [
            `From: LEGATRIXON <${from}>`,
            `To: ${toEmail}`,
            `Subject: ${title}`,
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=utf-8',
            '',
            htmlBody,
        ].join('\r\n');
        await this.sendSmtp({ host, port, user, pass, from, to: [toEmail], rawMessage });
    }
    escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    sendSmtp(config) {
        return new Promise((resolve, reject) => {
            const secure = config.port === 465;
            const socket = secure
                ? tls.connect(config.port, config.host, { servername: config.host })
                : net.connect(config.port, config.host);
            let buffer = '';
            let step = 0;
            let settled = false;
            let tlsActive = secure;
            let upgradedSocket = null;
            const fail = (error) => {
                if (settled)
                    return;
                settled = true;
                socket.destroy();
                if (upgradedSocket)
                    upgradedSocket.destroy();
                reject(error);
            };
            const send = (line) => {
                const activeSock = upgradedSocket || socket;
                activeSock.write(`${line}\r\n`);
            };
            const expectedCodes = (currentStep, isTls) => {
                if (currentStep === 0)
                    return ['220'];
                if (currentStep === 1)
                    return ['250'];
                if (currentStep === 2)
                    return isTls ? ['334'] : ['220'];
                if (currentStep === 3)
                    return ['334'];
                if (currentStep === 4)
                    return ['235'];
                if (currentStep === 5)
                    return ['250'];
                const recipientIndex = currentStep - 6;
                if (recipientIndex <= config.to.length - 1)
                    return ['250'];
                if (recipientIndex === config.to.length)
                    return ['354'];
                if (recipientIndex === config.to.length + 1)
                    return ['250'];
                return ['221'];
            };
            const continueFlow = (line) => {
                const code = line.slice(0, 3);
                const expected = expectedCodes(step, tlsActive);
                if (!expected.includes(code))
                    return fail(new Error(`SMTP error at step ${step}: ${line}`));
                const currentStep = step++;
                switch (currentStep) {
                    case 0:
                        send(`EHLO ${config.host}`);
                        break;
                    case 1:
                        send(tlsActive ? 'AUTH LOGIN' : 'STARTTLS');
                        break;
                    case 2:
                        if (tlsActive) {
                            send(Buffer.from(config.user).toString('base64'));
                        }
                        else {
                            const upgraded = tls.connect({ socket, servername: config.host }, () => {
                                buffer = '';
                                tlsActive = true;
                                step = 1;
                                send(`EHLO ${config.host}`);
                            });
                            socket.removeAllListeners('data');
                            upgraded.on('data', onData);
                            upgraded.on('error', fail);
                            upgradedSocket = upgraded;
                        }
                        break;
                    case 3:
                        send(Buffer.from(config.pass).toString('base64'));
                        break;
                    case 4:
                        send(`MAIL FROM:<${config.from}>`);
                        break;
                    case 5:
                        send(`RCPT TO:<${config.to[0]}>`);
                        break;
                    default: {
                        const recipientIndex = currentStep - 6;
                        if (recipientIndex < config.to.length - 1) {
                            send(`RCPT TO:<${config.to[recipientIndex + 1]}>`);
                        }
                        else if (recipientIndex === config.to.length - 1) {
                            send('DATA');
                        }
                        else if (recipientIndex === config.to.length) {
                            send(config.rawMessage + '\r\n.');
                        }
                        else {
                            send('QUIT');
                            if (!settled) {
                                settled = true;
                                resolve();
                            }
                        }
                    }
                }
            };
            const onData = (data) => {
                buffer += data.toString('utf8');
                const lines = buffer.split(/\r?\n/).filter(Boolean);
                const last = lines[lines.length - 1];
                if (!last || /^\d{3}-/.test(last))
                    return;
                buffer = '';
                continueFlow(last);
            };
            socket.setTimeout(15000, () => fail(new Error('SMTP delivery timed out.')));
            socket.on('data', onData);
            socket.on('error', fail);
        });
    }
};
exports.ProviderManagementService = ProviderManagementService;
exports.ProviderManagementService = ProviderManagementService = ProviderManagementService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(provider_management_entity_1.AiProvider)),
    __param(1, (0, typeorm_1.InjectRepository)(provider_management_entity_1.AiProviderKey)),
    __param(2, (0, typeorm_1.InjectRepository)(provider_management_entity_1.AiProviderFailure)),
    __param(3, (0, typeorm_1.InjectRepository)(provider_management_entity_1.AiProviderAlert)),
    __param(4, (0, typeorm_1.InjectRepository)(provider_management_entity_1.AiProviderUsageMetric)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], ProviderManagementService);
//# sourceMappingURL=provider-management.service.js.map