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
exports.CommandCenterAccessGuard = exports.AllowWithoutCommandCenterAccess = exports.ALLOW_WITHOUT_COMMAND_CENTER_ACCESS = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const feature_entitlement_service_1 = require("../modules/settings/feature-entitlement.service");
exports.ALLOW_WITHOUT_COMMAND_CENTER_ACCESS = 'allowWithoutCommandCenterAccess';
const AllowWithoutCommandCenterAccess = () => (0, common_1.SetMetadata)(exports.ALLOW_WITHOUT_COMMAND_CENTER_ACCESS, true);
exports.AllowWithoutCommandCenterAccess = AllowWithoutCommandCenterAccess;
let CommandCenterAccessGuard = class CommandCenterAccessGuard {
    constructor(reflector, entitlements) {
        this.reflector = reflector;
        this.entitlements = entitlements;
    }
    canActivate(context) {
        const isSharedRoute = this.reflector.getAllAndOverride(exports.ALLOW_WITHOUT_COMMAND_CENTER_ACCESS, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isSharedRoute)
            return true;
        const request = context.switchToHttp().getRequest();
        const decision = this.entitlements.getLegalResearchCommandCenterAccess(request.user);
        if (decision.allowed)
            return true;
        throw new common_1.ForbiddenException({
            code: 'FEATURE_LOCKED',
            feature: 'LEGAL_RESEARCH_COMMAND_CENTER',
            message: 'The Legal Research Command Center is not currently available for this account.',
        });
    }
};
exports.CommandCenterAccessGuard = CommandCenterAccessGuard;
exports.CommandCenterAccessGuard = CommandCenterAccessGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        feature_entitlement_service_1.FeatureEntitlementService])
], CommandCenterAccessGuard);
//# sourceMappingURL=command-center-access.guard.js.map