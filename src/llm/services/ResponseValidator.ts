import type { z } from 'zod';

export class ResponseValidator {
  validateJSON<T>(schema: z.ZodType<T>, value: unknown): T {
    return schema.parse(value);
  }

  validateText(text: string): string {
    if (!text.trim()) {
      throw new Error('LLM response text is empty.');
    }
    return text;
  }
}
