"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveSessionModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const live_session_entity_1 = require("./live-session.entity");
const live_session_service_1 = require("./live-session.service");
const live_session_controller_1 = require("./live-session.controller");
let LiveSessionModule = class LiveSessionModule {
};
exports.LiveSessionModule = LiveSessionModule;
exports.LiveSessionModule = LiveSessionModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([live_session_entity_1.LiveDraftingSession])],
        providers: [live_session_service_1.LiveSessionService],
        controllers: [live_session_controller_1.LiveSessionController],
    })
], LiveSessionModule);
//# sourceMappingURL=live-session.module.js.map