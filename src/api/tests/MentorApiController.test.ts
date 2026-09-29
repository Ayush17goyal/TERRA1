import { MentorApiController } from '../controllers/MentorApiController';
import { ApiMiddleware } from '../middleware/ApiMiddleware';
import { SupabaseAuth } from '../auth/SupabaseAuth';
import { MentorApiService } from '../services/MentorApiService';
import type { ApiRequestContext } from '../types';

class MockAuthClient {
  auth = {
    getUser: async () => ({
      data: { user: { id: 'student-1', email: 's@example.com', app_metadata: { roles: ['student'] } } },
    }),
  };
}

class MockMentorApiService extends MentorApiService {
  async runAI(context: ApiRequestContext) {
    return {
      validation: {
        response: { text: 'Because definitions control statutory meaning.\n\n**Next action**\nRevise one definition.' },
        telemetry: { action: 'approve' },
      },
      llm: {
        usage: { totalTokens: 12 },
        cost: { estimatedCostUsd: 0 },
      },
      retrieval: {
        items: [],
        usedTokens: 0,
      },
      packet: {
        studentId: context.user?.id,
      },
    } as never;
  }
}

export async function testChatEndpointReturnsValidatedResponse(): Promise<void> {
  const controller = new MentorApiController({
    middleware: new ApiMiddleware({ auth: new SupabaseAuth(new MockAuthClient()) }),
    service: new MockMentorApiService(),
  });
  const response = await controller.chat(new Request('https://legatrixon.test/api/chat', {
    method: 'POST',
    headers: { authorization: 'Bearer test', 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'Explain definitions.', studentLevel: 'beginner' }),
  }));
  const payload = await response.json();
  assert(response.status === 200, 'Expected HTTP 200.');
  assert(payload.ok === true, 'Expected success payload.');
  assert(payload.data.text.includes('definitions'), 'Expected response text.');
}

export async function testDocumentUploadDispatchShape(): Promise<void> {
  const controller = new MentorApiController({
    middleware: new ApiMiddleware({ auth: new SupabaseAuth(new MockAuthClient()) }),
  });
  const response = await controller.documentsUpload(new Request('https://legatrixon.test/api/documents/upload', {
    method: 'POST',
    headers: { authorization: 'Bearer test', 'content-type': 'application/json' },
    body: JSON.stringify({ fileName: 'act.pdf', mimeType: 'application/pdf', contentBase64: 'ZmFrZQ==', documentType: 'bare_act' }),
  }));
  const payload = await response.json();
  assert(response.status === 201, 'Expected upload creation status.');
  assert(Boolean(payload.data.documentId), 'Expected document id.');
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}
