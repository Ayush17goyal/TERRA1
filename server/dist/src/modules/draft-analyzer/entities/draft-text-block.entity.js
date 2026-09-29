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
exports.DraftTextBlock = void 0;
const typeorm_1 = require("typeorm");
const draft_page_entity_1 = require("./draft-page.entity");
let DraftTextBlock = class DraftTextBlock {
};
exports.DraftTextBlock = DraftTextBlock;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], DraftTextBlock.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'draft_id' }),
    __metadata("design:type", String)
], DraftTextBlock.prototype, "draftId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'page_id' }),
    __metadata("design:type", String)
], DraftTextBlock.prototype, "pageId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => draft_page_entity_1.DraftPage, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'page_id' }),
    __metadata("design:type", draft_page_entity_1.DraftPage)
], DraftTextBlock.prototype, "page", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'page_number' }),
    __metadata("design:type", Number)
], DraftTextBlock.prototype, "pageNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'block_type' }),
    __metadata("design:type", String)
], DraftTextBlock.prototype, "blockType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'block_index' }),
    __metadata("design:type", Number)
], DraftTextBlock.prototype, "blockIndex", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'paragraph_index' }),
    __metadata("design:type", Number)
], DraftTextBlock.prototype, "paragraphIndex", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'line_index', nullable: true, type: 'int' }),
    __metadata("design:type", Number)
], DraftTextBlock.prototype, "lineIndex", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'text_content', type: 'text' }),
    __metadata("design:type", String)
], DraftTextBlock.prototype, "textContent", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'x', type: 'float', default: 0 }),
    __metadata("design:type", Number)
], DraftTextBlock.prototype, "x", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'y', type: 'float', default: 0 }),
    __metadata("design:type", Number)
], DraftTextBlock.prototype, "y", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'width', type: 'float', default: 0 }),
    __metadata("design:type", Number)
], DraftTextBlock.prototype, "width", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'height', type: 'float', default: 0 }),
    __metadata("design:type", Number)
], DraftTextBlock.prototype, "height", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'font_size', type: 'float', nullable: true }),
    __metadata("design:type", Number)
], DraftTextBlock.prototype, "fontSize", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'font_name', nullable: true }),
    __metadata("design:type", String)
], DraftTextBlock.prototype, "fontName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_bold', default: false }),
    __metadata("design:type", Boolean)
], DraftTextBlock.prototype, "isBold", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_italic', default: false }),
    __metadata("design:type", Boolean)
], DraftTextBlock.prototype, "isItalic", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], DraftTextBlock.prototype, "createdAt", void 0);
exports.DraftTextBlock = DraftTextBlock = __decorate([
    (0, typeorm_1.Entity)('draft_analyzer_text_blocks'),
    (0, typeorm_1.Index)(['draftId', 'pageNumber', 'blockIndex'])
], DraftTextBlock);
//# sourceMappingURL=draft-text-block.entity.js.map