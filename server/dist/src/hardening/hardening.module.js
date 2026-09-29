"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HardeningModule = void 0;
const common_1 = require("@nestjs/common");
const settings_module_1 = require("../modules/settings/settings.module");
const retrieval_module_1 = require("../modules/retrieval/retrieval.module");
const production_health_controller_1 = require("./health/production-health.controller");
const audit_logger_service_1 = require("./security/audit-logger.service");
const virus_scanner_service_1 = require("./security/virus-scanner.service");
let HardeningModule = class HardeningModule {
};
exports.HardeningModule = HardeningModule;
exports.HardeningModule = HardeningModule = __decorate([
    (0, common_1.Module)({
        imports: [settings_module_1.SettingsModule, retrieval_module_1.RetrievalModule],
        controllers: [production_health_controller_1.ProductionHealthController],
        providers: [audit_logger_service_1.AuditLoggerService, virus_scanner_service_1.VirusScannerService],
        exports: [audit_logger_service_1.AuditLoggerService, virus_scanner_service_1.VirusScannerService],
    })
], HardeningModule);
//# sourceMappingURL=hardening.module.js.map