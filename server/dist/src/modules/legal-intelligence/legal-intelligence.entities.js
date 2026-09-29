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
exports.CaseSimulationSession = exports.ResearchMentorSession = exports.DraftingAcademyCheck = exports.DraftingAcademyCourse = exports.LegalResearchGuideSession = exports.LegalAuthorityVerification = void 0;
const typeorm_1 = require("typeorm");
let LegalAuthorityVerification = class LegalAuthorityVerification {
};
exports.LegalAuthorityVerification = LegalAuthorityVerification;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], LegalAuthorityVerification.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], LegalAuthorityVerification.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], LegalAuthorityVerification.prototype, "query", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], LegalAuthorityVerification.prototype, "answer", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '{}' }),
    __metadata("design:type", Object)
], LegalAuthorityVerification.prototype, "result", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], LegalAuthorityVerification.prototype, "createdAt", void 0);
exports.LegalAuthorityVerification = LegalAuthorityVerification = __decorate([
    (0, typeorm_1.Entity)('legal_authority_verifications')
], LegalAuthorityVerification);
let LegalResearchGuideSession = class LegalResearchGuideSession {
};
exports.LegalResearchGuideSession = LegalResearchGuideSession;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], LegalResearchGuideSession.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], LegalResearchGuideSession.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], LegalResearchGuideSession.prototype, "proposition", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '{}' }),
    __metadata("design:type", Object)
], LegalResearchGuideSession.prototype, "roadmap", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], LegalResearchGuideSession.prototype, "createdAt", void 0);
exports.LegalResearchGuideSession = LegalResearchGuideSession = __decorate([
    (0, typeorm_1.Entity)('legal_research_guides')
], LegalResearchGuideSession);
let DraftingAcademyCourse = class DraftingAcademyCourse {
};
exports.DraftingAcademyCourse = DraftingAcademyCourse;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], DraftingAcademyCourse.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DraftingAcademyCourse.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DraftingAcademyCourse.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], DraftingAcademyCourse.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'Draft Template' }),
    __metadata("design:type", String)
], DraftingAcademyCourse.prototype, "contentType", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DraftingAcademyCourse.prototype, "resourceUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'draft' }),
    __metadata("design:type", String)
], DraftingAcademyCourse.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '{}' }),
    __metadata("design:type", Object)
], DraftingAcademyCourse.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], DraftingAcademyCourse.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], DraftingAcademyCourse.prototype, "updatedAt", void 0);
exports.DraftingAcademyCourse = DraftingAcademyCourse = __decorate([
    (0, typeorm_1.Entity)('drafting_academy_courses')
], DraftingAcademyCourse);
let DraftingAcademyCheck = class DraftingAcademyCheck {
};
exports.DraftingAcademyCheck = DraftingAcademyCheck;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], DraftingAcademyCheck.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], DraftingAcademyCheck.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DraftingAcademyCheck.prototype, "fileName", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'Pasted Text' }),
    __metadata("design:type", String)
], DraftingAcademyCheck.prototype, "inputType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], DraftingAcademyCheck.prototype, "draftText", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '{}' }),
    __metadata("design:type", Object)
], DraftingAcademyCheck.prototype, "result", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], DraftingAcademyCheck.prototype, "createdAt", void 0);
exports.DraftingAcademyCheck = DraftingAcademyCheck = __decorate([
    (0, typeorm_1.Entity)('drafting_academy_checks')
], DraftingAcademyCheck);
let ResearchMentorSession = class ResearchMentorSession {
};
exports.ResearchMentorSession = ResearchMentorSession;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ResearchMentorSession.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], ResearchMentorSession.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], ResearchMentorSession.prototype, "topic", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json'),
    __metadata("design:type", Object)
], ResearchMentorSession.prototype, "sessionData", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ResearchMentorSession.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], ResearchMentorSession.prototype, "updatedAt", void 0);
exports.ResearchMentorSession = ResearchMentorSession = __decorate([
    (0, typeorm_1.Entity)('research_mentor_sessions')
], ResearchMentorSession);
let CaseSimulationSession = class CaseSimulationSession {
};
exports.CaseSimulationSession = CaseSimulationSession;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], CaseSimulationSession.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], CaseSimulationSession.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'case_name', type: 'text', nullable: true }),
    __metadata("design:type", String)
], CaseSimulationSession.prototype, "caseName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'custom_scenario', type: 'text', nullable: true }),
    __metadata("design:type", String)
], CaseSimulationSession.prototype, "customScenario", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'practice_mode', default: 'Landmark Case Practice' }),
    __metadata("design:type", String)
], CaseSimulationSession.prototype, "practiceMode", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'retrieved_data', default: '{}' }),
    __metadata("design:type", Object)
], CaseSimulationSession.prototype, "retrievedData", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'student_answers', default: '{}' }),
    __metadata("design:type", Object)
], CaseSimulationSession.prototype, "studentAnswers", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'evaluation_result', nullable: true }),
    __metadata("design:type", Object)
], CaseSimulationSession.prototype, "evaluationResult", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'retrieved' }),
    __metadata("design:type", String)
], CaseSimulationSession.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], CaseSimulationSession.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], CaseSimulationSession.prototype, "updatedAt", void 0);
exports.CaseSimulationSession = CaseSimulationSession = __decorate([
    (0, typeorm_1.Entity)('case_simulation_sessions')
], CaseSimulationSession);
//# sourceMappingURL=legal-intelligence.entities.js.map