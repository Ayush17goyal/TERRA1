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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductionHealthController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const axios_1 = require("axios");
const supabase_service_1 = require("../../modules/settings/supabase.service");
const qdrant_service_1 = require("../../modules/retrieval/qdrant.service");
const environment_1 = require("../config/environment");
const metrics_1 = require("../observability/metrics");
let ProductionHealthController = class ProductionHealthController {
    constructor(dataSource, supabaseService, qdrantService) {
        this.dataSource = dataSource;
        this.supabaseService = supabaseService;
        this.qdrantService = qdrantService;
        this.env = (0, environment_1.loadEnvironment)();
    }
    live() { return { status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() }; }
    async ready() {
        const checks = {};
        await this.check('database', checks, async () => this.dataSource.query('SELECT 1'));
        await this.check('supabase', checks, async () => {
            if (!this.supabaseService.isConfigured())
                return 'not_configured';
            const key = this.supabaseService.getServiceRoleKey();
            if (!key)
                return 'missing_service_role_key';
            await axios_1.default.get(`${this.supabaseService.supabaseUrl}/rest/v1/`, { headers: this.supabaseService.getHeaders(), timeout: 3000 }).catch((error) => { if (error.response?.status === 404)
                return undefined; throw error; });
            return 'ok';
        });
        await this.check('qdrant', checks, async () => { if (!process.env.QDRANT_URL)
            return 'not_configured'; await this.qdrantService.getClient().getCollections(); return 'ok'; });
        await this.check('openai', checks, async () => (this.env.OPENAI_API_KEY || this.env.OPENROUTER_API_KEY ? 'configured' : 'not_configured'));
        await this.check('redis', checks, async () => (this.env.REDIS_URL ? 'configured' : 'not_configured'));
        await this.check('virusScan', checks, async () => (this.env.VIRUS_SCAN_MODE === 'required' ? 'required' : this.env.VIRUS_SCAN_MODE));
        const unhealthy = Object.values(checks).some((check) => check.status === 'unhealthy');
        return { status: unhealthy ? 'degraded' : 'ready', timestamp: new Date().toISOString(), checks };
    }
    async metrics(res) { res.setHeader('Content-Type', (0, metrics_1.metricsContentType)()); res.send(await (0, metrics_1.renderMetrics)()); }
    async check(name, checks, fn) {
        const start = Date.now();
        try {
            const result = await Promise.race([fn(), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))]);
            checks[name] = { status: typeof result === 'string' ? result : 'healthy', latencyMs: Date.now() - start };
        }
        catch (error) {
            checks[name] = { status: 'unhealthy', latencyMs: Date.now() - start, message: error.message };
        }
    }
};
exports.ProductionHealthController = ProductionHealthController;
__decorate([
    (0, common_1.Get)('health/live'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProductionHealthController.prototype, "live", null);
__decorate([
    (0, common_1.Get)('health/ready'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProductionHealthController.prototype, "ready", null);
__decorate([
    (0, common_1.Get)('metrics'),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProductionHealthController.prototype, "metrics", null);
exports.ProductionHealthController = ProductionHealthController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource, supabase_service_1.SupabaseService, qdrant_service_1.QdrantService])
], ProductionHealthController);
//# sourceMappingURL=production-health.controller.js.map