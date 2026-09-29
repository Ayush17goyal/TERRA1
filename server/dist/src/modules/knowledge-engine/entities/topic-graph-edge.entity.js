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
exports.TopicGraphEdgeEntity = void 0;
const typeorm_1 = require("typeorm");
let TopicGraphEdgeEntity = class TopicGraphEdgeEntity {
};
exports.TopicGraphEdgeEntity = TopicGraphEdgeEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], TopicGraphEdgeEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], TopicGraphEdgeEntity.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'source_tku_id' }),
    __metadata("design:type", String)
], TopicGraphEdgeEntity.prototype, "sourceTkuId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'target_tku_id' }),
    __metadata("design:type", String)
], TopicGraphEdgeEntity.prototype, "targetTkuId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], TopicGraphEdgeEntity.prototype, "relation", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', default: 0.5 }),
    __metadata("design:type", Number)
], TopicGraphEdgeEntity.prototype, "strength", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], TopicGraphEdgeEntity.prototype, "references", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], TopicGraphEdgeEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], TopicGraphEdgeEntity.prototype, "updatedAt", void 0);
exports.TopicGraphEdgeEntity = TopicGraphEdgeEntity = __decorate([
    (0, typeorm_1.Entity)('topic_graph_edges'),
    (0, typeorm_1.Index)(['userId', 'sourceTkuId', 'targetTkuId', 'relation'], { unique: true })
], TopicGraphEdgeEntity);
//# sourceMappingURL=topic-graph-edge.entity.js.map