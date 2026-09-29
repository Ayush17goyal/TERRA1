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
exports.DraftPage = void 0;
const typeorm_1 = require("typeorm");
const draft_entity_1 = require("./draft.entity");
let DraftPage = class DraftPage {
};
exports.DraftPage = DraftPage;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], DraftPage.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'draft_id' }),
    __metadata("design:type", String)
], DraftPage.prototype, "draftId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => draft_entity_1.Draft, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'draft_id' }),
    __metadata("design:type", draft_entity_1.Draft)
], DraftPage.prototype, "draft", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'page_number' }),
    __metadata("design:type", Number)
], DraftPage.prototype, "pageNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'width_pt', type: 'float', default: 0 }),
    __metadata("design:type", Number)
], DraftPage.prototype, "widthPt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'height_pt', type: 'float', default: 0 }),
    __metadata("design:type", Number)
], DraftPage.prototype, "heightPt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'raw_text', type: 'text', nullable: true }),
    __metadata("design:type", String)
], DraftPage.prototype, "rawText", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'block_count', default: 0 }),
    __metadata("design:type", Number)
], DraftPage.prototype, "blockCount", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], DraftPage.prototype, "createdAt", void 0);
exports.DraftPage = DraftPage = __decorate([
    (0, typeorm_1.Entity)('draft_analyzer_pages'),
    (0, typeorm_1.Index)(['draftId', 'pageNumber'], { unique: true })
], DraftPage);
//# sourceMappingURL=draft-page.entity.js.map