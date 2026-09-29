"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentVerificationModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const student_verification_controller_1 = require("./student-verification.controller");
const student_verification_service_1 = require("./student-verification.service");
const student_verification_entities_1 = require("./student-verification.entities");
let StudentVerificationModule = class StudentVerificationModule {
};
exports.StudentVerificationModule = StudentVerificationModule;
exports.StudentVerificationModule = StudentVerificationModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                student_verification_entities_1.VerificationRequest,
                student_verification_entities_1.VerificationDocument,
                student_verification_entities_1.VerificationAuditLog,
            ]),
        ],
        controllers: [student_verification_controller_1.StudentVerificationController],
        providers: [student_verification_service_1.StudentVerificationService],
        exports: [student_verification_service_1.StudentVerificationService],
    })
], StudentVerificationModule);
//# sourceMappingURL=student-verification.module.js.map