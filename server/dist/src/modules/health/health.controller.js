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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const supabase_service_1 = require("../settings/supabase.service");
const qdrant_service_1 = require("../retrieval/qdrant.service");
const axios_1 = require("axios");
let HealthController = class HealthController {
    constructor(dataSource, supabaseService, qdrantService) {
        this.dataSource = dataSource;
        this.supabaseService = supabaseService;
        this.qdrantService = qdrantService;
    }
    async getHealth() {
        return this.checkAll();
    }
    async getApiHealth() {
        return this.checkAll();
    }
    async checkAll() {
        const checks = {
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
        }
        catch (err) {
            checks.database = { status: 'unhealthy', message: err.message };
        }
        if (this.supabaseService.isConfigured()) {
            const serviceKey = this.supabaseService.getServiceRoleKey();
            if (!serviceKey) {
                checks.supabase = { status: 'configured', message: 'SUPABASE_SERVICE_ROLE_KEY is not set' };
            }
            else {
                try {
                    const response = await axios_1.default.get(`${this.supabaseService.supabaseUrl}/rest/v1/users?limit=1`, {
                        headers: {
                            apikey: serviceKey,
                            Authorization: `Bearer ${serviceKey}`,
                        },
                        timeout: 5000,
                    });
                    checks.supabase = { status: 'healthy', message: `REST API responded ${response.status}` };
                }
                catch (err) {
                    checks.supabase = {
                        status: 'degraded',
                        message: err.response?.data?.message || err.message,
                    };
                }
            }
        }
        else {
            checks.supabase = { status: 'not_configured' };
        }
        if (process.env.QDRANT_URL) {
            try {
                const qdrantClient = this.qdrantService.getClient();
                await this.withTimeout(qdrantClient.getCollections(), 5000);
                checks.qdrant = { status: 'healthy' };
            }
            catch (err) {
                checks.qdrant = { status: 'degraded', message: err.message };
            }
        }
        else {
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
    async withTimeout(promise, timeoutMs) {
        let timeout;
        const timeoutPromise = new Promise((_, reject) => {
            timeout = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
        });
        try {
            return await Promise.race([promise, timeoutPromise]);
        }
        finally {
            clearTimeout(timeout);
        }
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "getHealth", null);
__decorate([
    (0, common_1.Get)('api/health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "getApiHealth", null);
exports.HealthController = HealthController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        supabase_service_1.SupabaseService,
        qdrant_service_1.QdrantService])
], HealthController);
//# sourceMappingURL=health.controller.js.map