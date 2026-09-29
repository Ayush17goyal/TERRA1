import { describe, expect, it } from 'vitest';
import { acceptedDocument, detectFileKind, extractBareActStructure, readableBytes } from '../../features/documents/utils/documentUtils';
import { moduleFormSchema, settingsSchema } from '../../features/admin/validators/admin.validators';

describe('Utilities and validators', () => {
  it('detects legal document file types and extracts Bare Act structure', () => {
    expect(detectFileKind('act.pdf', 'application/pdf')).toBe('pdf');
    expect(detectFileKind('notes.md', 'text/markdown')).toBe('markdown');
    expect(acceptedDocument(new File(['x'], 'draft.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))).toBe(true);
    expect(readableBytes(2048)).toBe('2.0 KB');
    const nodes = extractBareActStructure('Example Act\nPreamble\nSection 1. Short title\nSection 2. Definitions\nSchedule I');
    expect(nodes.map((node) => node.type)).toEqual(expect.arrayContaining(['preamble', 'section', 'schedule']));
  });

  it('validates admin curriculum and AI settings boundaries', () => {
    expect(moduleFormSchema.parse({ title: 'Foundations', description: 'Drafting basics', order: 1, status: 'draft' }).title).toBe('Foundations');
    expect(() => settingsSchema.parse({ model: 'gpt', temperature: 3, maxTokens: 20, streaming: true, promptVersion: '', embeddingModel: 'x', vectorTopK: 1000, rateLimitPerMinute: 0, maintenanceMode: false })).toThrow();
  });
});
