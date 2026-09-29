"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FounderSecurityModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const founder_security_controller_1 = require("./founder-security.controller");
const founder_security_entities_1 = require("./founder-security.entities");
const founder_security_service_1 = require("./founder-security.service");
const admin_role_guard_1 = require("../../guards/admin-role.guard");
let FounderSecurityModule = class FounderSecurityModule {
};
exports.FounderSecurityModule = FounderSecurityModule;
exports.FounderSecurityModule = FounderSecurityModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([founder_security_entities_1.FounderSecuritySettings, founder_security_entities_1.FounderSecurityEvent, founder_security_entities_1.AdminAccountLock])],
        controllers: [founder_security_controller_1.FounderSecurityController, founder_security_controller_1.SecurityTestController],
        providers: [founder_security_service_1.FounderSecurityService, admin_role_guard_1.AdminRoleGuard],
        exports: [founder_security_service_1.FounderSecurityService],
    })
], FounderSecurityModule);
//# sourceMappingURL=founder-security.module.js.map