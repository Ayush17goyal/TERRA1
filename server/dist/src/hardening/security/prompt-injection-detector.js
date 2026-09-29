"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectPromptInjection = detectPromptInjection;
const rules = [
    { name: 'ignore_previous_instructions', severity: 'warning', pattern: /ignore\s+(all\s+)?previous\s+instructions/i },
    { name: 'reveal_system_prompt', severity: 'error', pattern: /reveal|print|show[\s\S]{0,40}(system|developer|hidden)\s+(prompt|instructions)/i },
    { name: 'role_takeover', severity: 'warning', pattern: /you\s+are\s+now\s+(system|developer|admin|dan)/i },
    { name: 'tool_exfiltration', severity: 'error', pattern: /call\s+.*tool[\s\S]{0,80}(secret|token|key|credential)/i },
];
function detectPromptInjection(input) {
    return rules.flatMap((rule) => {
        const match = rule.pattern.exec(input);
        return match ? [{ pattern: rule.name, severity: rule.severity, index: match.index }] : [];
    });
}
//# sourceMappingURL=prompt-injection-detector.js.map