"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptInjectionGate = void 0;
const common_1 = require("@nestjs/common");
let PromptInjectionGate = class PromptInjectionGate {
    sanitizeForPrompt(text) {
        return text
            .replace(/```/g, '```')
            .replace(/\b(ignore|disregard)\s+(?:(?:all|previous|prior|above)\s+){1,3}(instructions?|prompts?)\b/gi, '[redacted-instruction-like-text]')
            .replace(/\b(system|developer|assistant|tool)\s*:\s*/gi, '[redacted-role]: ')
            .slice(0, 8000);
    }
    validateClassifierOutput(output, allowedValues, valueField) {
        const value = output[valueField];
        if (typeof value !== 'string' || !allowedValues.includes(value))
            return false;
        if (typeof output.confidence === 'number' && (output.confidence < 0 || output.confidence > 1))
            return false;
        return true;
    }
};
exports.PromptInjectionGate = PromptInjectionGate;
exports.PromptInjectionGate = PromptInjectionGate = __decorate([
    (0, common_1.Injectable)()
], PromptInjectionGate);
//# sourceMappingURL=prompt-injection.gate.js.map