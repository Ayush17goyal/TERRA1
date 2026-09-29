"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FallbackMetricsService = void 0;
const common_1 = require("@nestjs/common");
let FallbackMetricsService = class FallbackMetricsService {
    constructor() {
        this.metrics = {
            totalRequests: 0,
            level1Hits: 0,
            level2Hits: 0,
            level3Hits: 0,
            level4Hits: 0,
            level5Hits: 0,
            level6Hits: 0,
        };
        this.failuresByModel = {};
    }
    incrementRequest() {
        this.metrics.totalRequests++;
    }
    incrementHit(level) {
        const key = `level${level}Hits`;
        this.metrics[key]++;
    }
    recordFailure(model) {
        this.failuresByModel[model] = (this.failuresByModel[model] || 0) + 1;
    }
    getMetrics() {
        return {
            ...this.metrics,
            failuresByModel: this.failuresByModel,
        };
    }
};
exports.FallbackMetricsService = FallbackMetricsService;
exports.FallbackMetricsService = FallbackMetricsService = __decorate([
    (0, common_1.Injectable)()
], FallbackMetricsService);
//# sourceMappingURL=fallback-metrics.service.js.map