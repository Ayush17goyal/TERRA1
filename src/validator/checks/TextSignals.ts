export function hasHeading(text: string, heading: string): boolean {
  const pattern = new RegExp(`(^|\\n)\\s{0,3}(#{1,6}\\s*)?${escapeRegExp(heading)}\\s*:?\\s*(\\n|$)`, 'i');
  return pattern.test(text);
}

export function hasAnyHeading(text: string, headings: string[]): boolean {
  return headings.some((heading) => hasHeading(text, heading));
}

export function containsAny(text: string, patterns: RegExp[]): RegExp | undefined {
  return patterns.find((pattern) => pattern.test(text));
}

export function countMatches(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
