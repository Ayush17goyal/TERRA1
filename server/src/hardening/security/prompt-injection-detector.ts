export interface PromptInjectionFinding { pattern: string; severity: 'warning' | 'error'; index: number }

const rules: Array<{ name: string; severity: 'warning' | 'error'; pattern: RegExp }> = [
  { name: 'ignore_previous_instructions', severity: 'warning', pattern: /ignore\s+(all\s+)?previous\s+instructions/i },
  { name: 'reveal_system_prompt', severity: 'error', pattern: /reveal|print|show[\s\S]{0,40}(system|developer|hidden)\s+(prompt|instructions)/i },
  { name: 'role_takeover', severity: 'warning', pattern: /you\s+are\s+now\s+(system|developer|admin|dan)/i },
  { name: 'tool_exfiltration', severity: 'error', pattern: /call\s+.*tool[\s\S]{0,80}(secret|token|key|credential)/i },
];

export function detectPromptInjection(input: string): PromptInjectionFinding[] {
  return rules.flatMap((rule) => {
    const match = rule.pattern.exec(input);
    return match ? [{ pattern: rule.name, severity: rule.severity, index: match.index }] : [];
  });
}