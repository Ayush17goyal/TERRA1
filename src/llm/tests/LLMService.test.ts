import { z } from 'zod';
import { OpenAIClient } from '../client/OpenAIClient';
import { LLMService } from '../services/LLMService';
import { PromptExecutor } from '../prompts/PromptExecutor';
import type { RuntimeDecisionPacket } from '../types';

function packet(): RuntimeDecisionPacket {
  return {
    requestId: 'req-1',
    interactionId: 'int-1',
    studentId: 'student-1',
    intent: 'learning',
    teachingStrategy: 'teach',
    promptRequest: {
      userMessage: 'Explain definitions.',
      intent: 'learning',
      teachingStrategy: 'teach',
      student: { level: 'beginner' },
    },
    cachePolicy: { allowPromptCache: false, allowResponseCache: false },
  };
}

export async function testGenerateResponseUsesResponsesAPI(): Promise<void> {
  let capturedBody = '';
  const client = new OpenAIClient({
    apiKey: 'test-key',
    fetchFn: async (_url, init) => {
      capturedBody = String(init?.body);
      return new Response(JSON.stringify({
        model: 'gpt-test',
        output_text: 'Definitions control statutory meaning.',
        usage: { input_tokens: 100, output_tokens: 8, total_tokens: 108 },
      }), { status: 200 });
    },
  });
  const service = new LLMService({ client, promptExecutor: new PromptExecutor(), defaultModel: 'gpt-test' });
  const response = await service.generateExplanation(packet());

  assert(response.text.includes('Definitions'), 'Expected text response.');
  assert(capturedBody.includes('/responses') === false, 'Body should not contain URL.');
  assert(JSON.parse(capturedBody).input.includes('current_user_message'), 'Expected assembled prompt input.');
}

export async function testGenerateStructuredResponseValidatesWithZod(): Promise<void> {
  const schema = z.object({ answer: z.string() });
  const client = new OpenAIClient({
    apiKey: 'test-key',
    fetchFn: async () => new Response(JSON.stringify({
      model: 'gpt-test',
      output_text: '{"answer":"ok"}',
      usage: { input_tokens: 50, output_tokens: 5, total_tokens: 55 },
    }), { status: 200 }),
  });
  const service = new LLMService({ client, defaultModel: 'gpt-test' });
  const response = await service.generateStructuredResponse(packet(), {
    name: 'answer_schema',
    jsonSchema: {
      type: 'object',
      properties: { answer: { type: 'string' } },
      required: ['answer'],
      additionalProperties: false,
    },
    zodSchema: schema,
  });

  assert(response.parsed.answer === 'ok', 'Expected parsed structured response.');
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
