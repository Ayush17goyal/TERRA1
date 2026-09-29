"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SectionExtractionStage = void 0;
const common_1 = require("@nestjs/common");
const crypto = require("crypto");
const SECTION_TYPE_BY_DOC_TYPE = {
    bare_act: 'statutory_provision',
    case_compilation: 'case_paragraph',
    notes: 'notes_block',
    textbook: 'notes_block',
    unknown: 'unclassified',
};
let SectionExtractionStage = class SectionExtractionStage {
    extract(doc, tree) {
        const flattened = this.flatten(tree.root);
        const defaultSectionType = SECTION_TYPE_BY_DOC_TYPE[tree.documentType];
        const sections = [];
        const bodyBySection = new Map();
        const orphanedText = [];
        let offset = 0;
        for (const block of doc.blocks) {
            const blockStart = offset;
            offset += block.text.length + 1;
            const isHeadingLine = flattened.some((f) => f.node.startOffset === blockStart);
            if (isHeadingLine)
                continue;
            const active = this.findActiveNode(flattened, blockStart);
            if (!active) {
                orphanedText.push(block.text);
                continue;
            }
            const list = bodyBySection.get(active.node.id) || [];
            list.push(block.text);
            bodyBySection.set(active.node.id, list);
        }
        for (const { node, hierarchyPath } of flattened) {
            const text = (bodyBySection.get(node.id) || []).join('\n\n');
            const confidence = node.confidence * (text.length > 0 ? 1 : 0.5);
            sections.push({
                id: node.id,
                treeNodeId: node.id,
                hierarchyPath,
                sectionType: defaultSectionType,
                text: text || node.title,
                confidence,
                needsReview: confidence < 0.4,
            });
        }
        if (orphanedText.length > 0) {
            sections.unshift({
                id: crypto.randomUUID(),
                treeNodeId: null,
                hierarchyPath: '(unclassified)',
                sectionType: 'unclassified',
                text: orphanedText.join('\n\n'),
                confidence: 0.2,
                needsReview: true,
            });
        }
        return sections;
    }
    flatten(nodes, parentPath = '') {
        const result = [];
        for (const node of nodes) {
            const path = parentPath ? `${parentPath} > ${node.title}` : node.title;
            result.push({ node, hierarchyPath: path });
            result.push(...this.flatten(node.children, path));
        }
        return result.sort((a, b) => a.node.startOffset - b.node.startOffset);
    }
    findActiveNode(flattened, blockStart) {
        let active = null;
        for (const entry of flattened) {
            if (entry.node.startOffset <= blockStart) {
                active = entry;
            }
            else {
                break;
            }
        }
        return active;
    }
};
exports.SectionExtractionStage = SectionExtractionStage;
exports.SectionExtractionStage = SectionExtractionStage = __decorate([
    (0, common_1.Injectable)()
], SectionExtractionStage);
//# sourceMappingURL=section-extraction.stage.js.map