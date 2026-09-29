"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MasterclassModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const masterclass_entity_1 = require("./masterclass.entity");
const masterclass_service_1 = require("./masterclass.service");
const masterclass_controller_1 = require("./masterclass.controller");
let MasterclassModule = class MasterclassModule {
};
exports.MasterclassModule = MasterclassModule;
exports.MasterclassModule = MasterclassModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                masterclass_entity_1.MasterclassCourse,
                masterclass_entity_1.MasterclassLesson,
                masterclass_entity_1.MasterclassEnrollment,
                masterclass_entity_1.MasterclassLessonProgress,
            ]),
        ],
        providers: [masterclass_service_1.MasterclassService],
        controllers: [masterclass_controller_1.MasterclassController],
        exports: [masterclass_service_1.MasterclassService],
    })
], MasterclassModule);
//# sourceMappingURL=masterclass.module.js.map