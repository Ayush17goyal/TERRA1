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
exports.JudgmentReport = exports.ResearchDocument = exports.ResearchAsset = exports.SavedReport = exports.ResearchNote = exports.ResearchSource = exports.ResearchReport = exports.ResearchQuery = exports.ResearchUser = void 0;
const typeorm_1 = require("typeorm");
let ResearchUser = class ResearchUser {
};
exports.ResearchUser = ResearchUser;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ResearchUser.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], ResearchUser.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'full_name', nullable: true }),
    __metadata("design:type", String)
], ResearchUser.prototype, "fullName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'avatar_url', nullable: true }),
    __metadata("design:type", String)
], ResearchUser.prototype, "avatarUrl", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ResearchUser.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], ResearchUser.prototype, "updatedAt", void 0);
exports.ResearchUser = ResearchUser = __decorate([
    (0, typeorm_1.Entity)('users')
], ResearchUser);
let ResearchQuery = class ResearchQuery {
};
exports.ResearchQuery = ResearchQuery;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ResearchQuery.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], ResearchQuery.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ResearchQuery.prototype, "topic", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'research_mode' }),
    __metadata("design:type", String)
], ResearchQuery.prototype, "researchMode", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'pending' }),
    __metadata("design:type", String)
], ResearchQuery.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ResearchQuery.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], ResearchQuery.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => ResearchUser),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", ResearchUser)
], ResearchQuery.prototype, "user", void 0);
exports.ResearchQuery = ResearchQuery = __decorate([
    (0, typeorm_1.Entity)('research_queries')
], ResearchQuery);
let ResearchReport = class ResearchReport {
};
exports.ResearchReport = ResearchReport;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ResearchReport.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'query_id', type: 'uuid' }),
    __metadata("design:type", String)
], ResearchReport.prototype, "queryId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], ResearchReport.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ResearchReport.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ResearchReport.prototype, "summary", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'research_outline', nullable: true }),
    __metadata("design:type", Object)
], ResearchReport.prototype, "researchOutline", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'research_mode' }),
    __metadata("design:type", String)
], ResearchReport.prototype, "researchMode", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ResearchReport.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], ResearchReport.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => ResearchQuery),
    (0, typeorm_1.JoinColumn)({ name: 'query_id' }),
    __metadata("design:type", ResearchQuery)
], ResearchReport.prototype, "query", void 0);
exports.ResearchReport = ResearchReport = __decorate([
    (0, typeorm_1.Entity)('research_reports')
], ResearchReport);
let ResearchSource = class ResearchSource {
};
exports.ResearchSource = ResearchSource;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ResearchSource.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'report_id', type: 'uuid' }),
    __metadata("design:type", String)
], ResearchSource.prototype, "reportId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'source_type' }),
    __metadata("design:type", String)
], ResearchSource.prototype, "sourceType", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ResearchSource.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ResearchSource.prototype, "citation", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ResearchSource.prototype, "court", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', nullable: true }),
    __metadata("design:type", Number)
], ResearchSource.prototype, "year", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ResearchSource.prototype, "summary", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'source_url', nullable: true }),
    __metadata("design:type", String)
], ResearchSource.prototype, "sourceUrl", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], ResearchSource.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ResearchSource.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => ResearchReport, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'report_id' }),
    __metadata("design:type", ResearchReport)
], ResearchSource.prototype, "report", void 0);
exports.ResearchSource = ResearchSource = __decorate([
    (0, typeorm_1.Entity)('research_sources')
], ResearchSource);
let ResearchNote = class ResearchNote {
};
exports.ResearchNote = ResearchNote;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ResearchNote.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'report_id', type: 'uuid' }),
    __metadata("design:type", String)
], ResearchNote.prototype, "reportId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], ResearchNote.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ResearchNote.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], ResearchNote.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ResearchNote.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], ResearchNote.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => ResearchReport, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'report_id' }),
    __metadata("design:type", ResearchReport)
], ResearchNote.prototype, "report", void 0);
exports.ResearchNote = ResearchNote = __decorate([
    (0, typeorm_1.Entity)('research_notes')
], ResearchNote);
let SavedReport = class SavedReport {
};
exports.SavedReport = SavedReport;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], SavedReport.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], SavedReport.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'report_id', type: 'uuid' }),
    __metadata("design:type", String)
], SavedReport.prototype, "reportId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], SavedReport.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => ResearchReport, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'report_id' }),
    __metadata("design:type", ResearchReport)
], SavedReport.prototype, "report", void 0);
exports.SavedReport = SavedReport = __decorate([
    (0, typeorm_1.Entity)('saved_reports'),
    (0, typeorm_1.Unique)(['userId', 'reportId'])
], SavedReport);
let ResearchAsset = class ResearchAsset {
};
exports.ResearchAsset = ResearchAsset;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ResearchAsset.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'report_id', type: 'uuid' }),
    __metadata("design:type", String)
], ResearchAsset.prototype, "reportId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'asset_type' }),
    __metadata("design:type", String)
], ResearchAsset.prototype, "assetType", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'asset_data', nullable: true }),
    __metadata("design:type", Object)
], ResearchAsset.prototype, "assetData", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ResearchAsset.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => ResearchReport, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'report_id' }),
    __metadata("design:type", ResearchReport)
], ResearchAsset.prototype, "report", void 0);
exports.ResearchAsset = ResearchAsset = __decorate([
    (0, typeorm_1.Entity)('research_assets')
], ResearchAsset);
let ResearchDocument = class ResearchDocument {
};
exports.ResearchDocument = ResearchDocument;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ResearchDocument.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'query_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], ResearchDocument.prototype, "queryId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], ResearchDocument.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ResearchDocument.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ResearchDocument.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'doc_category' }),
    __metadata("design:type", String)
], ResearchDocument.prototype, "docCategory", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ResearchDocument.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'Processing' }),
    __metadata("design:type", String)
], ResearchDocument.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ResearchDocument.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => ResearchQuery, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'query_id' }),
    __metadata("design:type", ResearchQuery)
], ResearchDocument.prototype, "query", void 0);
exports.ResearchDocument = ResearchDocument = __decorate([
    (0, typeorm_1.Entity)('research_documents')
], ResearchDocument);
let JudgmentReport = class JudgmentReport {
};
exports.JudgmentReport = JudgmentReport;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], JudgmentReport.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], JudgmentReport.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'research_topic', type: 'text' }),
    __metadata("design:type", String)
], JudgmentReport.prototype, "researchTopic", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'case_name', type: 'text', nullable: true }),
    __metadata("design:type", String)
], JudgmentReport.prototype, "caseName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], JudgmentReport.prototype, "citation", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], JudgmentReport.prototype, "court", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], JudgmentReport.prototype, "judge", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], JudgmentReport.prototype, "facts", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], JudgmentReport.prototype, "issues", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], JudgmentReport.prototype, "holdings", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ratio_decidendi', type: 'text', nullable: true }),
    __metadata("design:type", String)
], JudgmentReport.prototype, "ratioDecidendi", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'obiter_dicta', type: 'text', nullable: true }),
    __metadata("design:type", String)
], JudgmentReport.prototype, "obiterDicta", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'relief_granted', type: 'text', nullable: true }),
    __metadata("design:type", String)
], JudgmentReport.prototype, "reliefGranted", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'impact_analysis', type: 'text', nullable: true }),
    __metadata("design:type", String)
], JudgmentReport.prototype, "impactAnalysis", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'research_matrix', nullable: true }),
    __metadata("design:type", Object)
], JudgmentReport.prototype, "researchMatrix", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'generated_report', type: 'text' }),
    __metadata("design:type", String)
], JudgmentReport.prototype, "generatedReport", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'file_name', type: 'text', nullable: true }),
    __metadata("design:type", String)
], JudgmentReport.prototype, "fileName", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], JudgmentReport.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], JudgmentReport.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], JudgmentReport.prototype, "updatedAt", void 0);
exports.JudgmentReport = JudgmentReport = __decorate([
    (0, typeorm_1.Entity)('judgment_reports')
], JudgmentReport);
//# sourceMappingURL=research.entities.js.map