"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SizeBoundsGate = void 0;
const common_1 = require("@nestjs/common");
const document_engine_constants_1 = require("../document-engine.constants");
let SizeBoundsGate = class SizeBoundsGate {
    checkMinimumContent(doc) {
        const totalChars = doc.blocks.reduce((sum, b) => sum + b.text.length, 0);
        if (totalChars < document_engine_constants_1.MIN_EXTRACTABLE_CHARACTERS) {
            return {
                passed: false,
                reason: 'insufficient_extractable_content',
                metadata: { extractedCharacters: totalChars, minimumRequired: document_engine_constants_1.MIN_EXTRACTABLE_CHARACTERS },
            };
        }
        return { passed: true, metadata: { extractedCharacters: totalChars } };
    }
};
exports.SizeBoundsGate = SizeBoundsGate;
exports.SizeBoundsGate = SizeBoundsGate = __decorate([
    (0, common_1.Injectable)()
], SizeBoundsGate);
//# sourceMappingURL=size-bounds.gate.js.map