import {
  sendJson,
  readBody,
  insertSupabase,
  selectSupabase,
  updateSupabase,
  parseMultipart,
  emptyDashboard,
  getBearerSubject,
  getDashboardData,
  localLexMentorReply,
  getLearningProgressData
} from '../_utils.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const json = sendJson;

function getRoute(req: any) {
  const value = req.query?.path;
  if (Array.isArray(value) && value.length) return value.join('/');
  if (typeof value === 'string' && value) return value;
  const rawUrl = String(req.url || '');
  const pathname = rawUrl.split('?')[0] || '';
  return pathname.replace(/^\/api\/v1\/?/, '').replace(/^\/+|\/+$/g, '');
}

function isPaidCompatRoute(method: string, route: string) {
  if (!['POST', 'GET'].includes(method)) return false;
  return [
    /^chat\/(message|guidebot\/(message|stt|tts)|search)$/,
    /^legal-intelligence\/(case|research|authority|bare-act|drafting)/,
    /^drafting-mentor\/academy\//,
    /^research\/(generate|judgment-intelligence|legal-brief|bare-act|challenge)$/,
    /^judgments\/[^/]+\/(analyze|explain|evaluate-verdict|revision-notes|moot-court-kit|alternative-reasoning|mastery)$/,
    /^exam\/(mock-paper|study-library|assistant|doubt-solve|lexmentor\/strategy)/,
    /^learning-workspace\/(sources\/(text|upload|bulk-upload|[^/]+\/reprocess)|mock-tests\/(generate|analyze-structure|[^/]+\/handwritten-ocr)|mind-maps\/generate|study-kits\/generate|revision-plan\/generate)/,
    /^notebook\/(upload|bulk-upload|url-ingest|chat|documents\/[^/]+\/(reprocess|extraction|intelligence|study-forge\/generate))/,
    /^draft-analyzer\/[^/]+\/(extract|review|analyze)$/,
    /^document-engine\/upload$/,
    /^contracts\/(review|[^/]+\/clauses)$/,
    /^exam-engine\/(mock-tests|model-answers|question-bank|question-planning)/,
    /^memorial-workflow\/(blueprint|run)$/,
  ].some((pattern) => pattern.test(route));
}

function isCommandCenterCompatRoute(route: string) {
  if (!route.startsWith('research/')) return false;
  // This legacy endpoint is shared by LexMentor outside the Command Center.
  return route !== 'research/bare-act';
}
function compactId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeFileType(fileName: string, rawType = '') {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  if (rawType.includes('pdf') || extension === 'pdf') return 'PDF';
  if (rawType.includes('word') || extension === 'docx' || extension === 'doc') return 'DOCX';
  if (rawType.includes('presentation') || extension === 'pptx' || extension === 'ppt') return 'PPTX';
  if (rawType.includes('markdown') || extension === 'md') return 'MD';
  if (rawType.includes('text') || extension === 'txt') return 'TXT';
  return extension ? extension.toUpperCase() : 'STUDY_MATERIAL';
}

function wordsIn(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function buildNotebookChunks(text: string, documentId: string, name: string) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const chunks: any[] = [];
  const chunkSize = 1800;
  for (let index = 0; index < cleaned.length; index += chunkSize) {
    const chunkText = cleaned.slice(index, index + chunkSize).trim();
    if (!chunkText) continue;
    chunks.push({
      id: documentId + '_chunk_' + (chunks.length + 1),
      text: chunkText,
      rawExcerpt: chunkText,
      summary: chunkText.slice(0, 280),
      documentName: name,
      pageNumber: chunks.length + 1,
      chunkIndex: chunks.length,
      confidence: 0.9,
    });
  }
  return chunks;
}

function isReadableCompatSourceText(text: string) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (cleaned.length < 450) return false;
  const badChars = (cleaned.match(/[\uFFFD\x00-\x08\x0E-\x1F]/g) || []).length;
  const alphaWords = (cleaned.match(/\b[A-Za-z][A-Za-z]{2,}\b/g) || []).length;
  const sentenceSignals = (cleaned.match(/[.!?]\s+[A-Z]/g) || []).length;
  const pdfNoise = (cleaned.match(/\b(?:obj|endobj|stream|endstream|xref|trailer|FlateDecode|startxref)\b/g) || []).length;
  return badChars / Math.max(1, cleaned.length) < 0.01 && alphaWords >= 80 && sentenceSignals >= 3 && pdfNoise < 12;
}

function notebookRowToDoc(row: any) {
  const metadata = row.metadata || {};
  const chunks = Array.isArray(row.chunks) ? row.chunks : [];
  const content = row.summary || chunks.map((chunk: any) => chunk.text || chunk.rawExcerpt || '').join('\\n\\n');
  const wordCount = wordsIn(String(content || ''));
  const chunkCount = chunks.length;
  const readable = isReadableCompatSourceText(String(content || ''));
  const sufficientForMock = readable && wordCount >= 800;
  const sufficientForLongAnswers = readable && wordCount >= 3000;
  const qualityScore = Math.max(0, Math.min(100, Math.round((readable ? 35 : 0) + Math.min(45, wordCount / 35) + Math.min(20, chunkCount * 4))));
  const status = metadata.extractionStatus || metadata.status || (sufficientForLongAnswers ? 'Indexed Successfully' : sufficientForMock ? 'Limited Text Extracted' : wordCount > 0 ? 'Insufficient for Long Answers' : 'Extraction Failed');
  return {
    id: row.document_id,
    name: row.title || metadata.fileName || 'Uploaded Study Material',
    type: metadata.fileType || row.document_type || 'Study Material',
    size: Number(metadata.fileSize || 0),
    uploadedAt: row.created_at || metadata.uploadedAt || new Date().toISOString(),
    status,
    extractionStatus: status,
    previewContent: String(content || '').slice(0, 1200),
    extractedText: content || '',
    wordCount,
    extractedWordCount: wordCount,
    chunkCount: Number(metadata.chunksCreated || metadata.chunk_count || chunkCount),
    pages: metadata.pagesProcessed || metadata.pages || metadata.page_count || Math.max(1, chunks.length),
    pagesProcessed: metadata.pagesProcessed || metadata.pages || metadata.page_count || Math.max(1, chunks.length),
    sourceQualityScore: qualityScore,
    insufficientForMockTest: metadata.insufficientForMockTest ?? !sufficientForMock,
    insufficientForLongAnswers: metadata.insufficientForLongAnswers ?? !sufficientForLongAnswers,
    insufficientMaterialWarning: !sufficientForMock ? 'This file does not contain enough readable legal text for grounded mock test generation. Please upload a clearer PDF, DOCX, text notes, bare act material, judgment PDF, or paste notes manually.' : undefined,
    documentType: row.document_type || metadata.documentType || 'Study Material',
    legalMetadata: { documentType: row.document_type || metadata.documentType || 'Study Material' },
    embeddingsStatus: metadata.embeddingsStatus || 'Limited',
    errorMessage: metadata.errorMessage || undefined,
  };
}
function materialRowToNotebookRow(row: any) {
  const documentId = row.document_id || row.id || compactId('material');
  const name = row.title || row.file_name || 'Uploaded Study Material';
  const text = row.extracted_text || row.summary || '';
  return {
    document_id: documentId,
    user_id: row.user_id,
    document_type: row.document_type || 'Study Material',
    title: name,
    summary: text,
    chunks: buildNotebookChunks(text, documentId, name),
    metadata: {
      fileName: row.file_name || name,
      fileType: row.file_type || 'Study Material',
      fileSize: Number(row.file_size || 0),
      status: row.status === 'failed' ? 'Extraction Failed' : undefined,
      uploadedAt: row.created_at || row.updated_at || new Date().toISOString(),
    },
    created_at: row.created_at || row.updated_at || new Date().toISOString(),
  };
}

function materialRowToDoc(row: any) {
  return notebookRowToDoc(materialRowToNotebookRow(row));
}
function clientDocToNotebookRow(doc: any) {
  const documentId = String(doc.id || compactId('client_doc'));
  const name = String(doc.name || doc.fileName || doc.title || 'Uploaded Study Material');
  const text = String(doc.extractedText || doc.previewContent || doc.content || doc.summary || '');
  return {
    document_id: documentId,
    user_id: doc.user_id || 'client-session',
    document_type: doc.documentType || 'Study Material',
    title: name,
    summary: text,
    chunks: buildNotebookChunks(text, documentId, name),
    metadata: {
      fileName: name,
      fileType: doc.type || doc.fileType || 'Study Material',
      fileSize: Number(doc.size || doc.fileSize || 0),
      status: undefined,
      uploadedAt: doc.uploadedAt || new Date().toISOString(),
    },
    created_at: doc.uploadedAt || new Date().toISOString(),
  };
}

async function insertStudyMaterialFallback(clerkUserId: string, fileName: string, fileType: string, fileSize: number, extractedText: string, now: string, documentId?: string, status = 'indexed') {
  const basePayload: Record<string, unknown> = {
    user_id: clerkUserId,
    title: fileName,
    file_name: fileName,
    file_type: fileType.toLowerCase(),
    file_size: fileSize,
    document_id: documentId,
    status,
    extracted_text: extractedText,
    created_at: now,
    updated_at: now,
  };
  let insert = await insertSupabase('study_materials', basePayload);
  if (!insert.ok) {
    const { extracted_text, ...minimalPayload } = basePayload;
    insert = await insertSupabase('study_materials', minimalPayload);
  }
  return insert;
}

function stableHex(input: string, length: number) {
  let h = 2166136261;
  let out = '';
  while (out.length < length) {
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= out.length + input.length;
    out += (h >>> 0).toString(16).padStart(8, '0');
  }
  return out.slice(0, length);
}

function stableUuid(input: string) {
  const hex = stableHex(input, 32);
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

function deterministicEmbedding(text: string, dimensions = 1024) {
  const vector = new Array(dimensions).fill(0);
  const tokens = String(text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
  for (const token of tokens) {
    let h = 2166136261;
    for (let i = 0; i < token.length; i++) {
      h ^= token.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const index = Math.abs(h) % dimensions;
    vector[index] += 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / norm).toFixed(6)));
}

async function compatQdrantRequest(path: string, init: any = {}) {
  const env = (globalThis as any).process?.env || {};
  const baseUrl = String(env.QDRANT_URL || env.QDRANT_HOST || '').replace(/\/$/, '');
  if (!baseUrl) return { ok: false, status: 0, data: null, message: 'QDRANT_URL missing' };
  const apiKey = String(env.QDRANT_API_KEY || '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers || {}) };
  if (apiKey) headers['api-key'] = apiKey;
  const response = await fetch(baseUrl + path, { ...init, headers });
  const text = await response.text().catch(() => '');
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: response.ok, status: response.status, data, message: response.ok ? '' : String((data && (data.status?.error || data.message || data.error)) || text || response.statusText) };
}

async function ensureCompatQdrantCollection(collectionName: string) {
  const existing = await compatQdrantRequest(`/collections/${collectionName}`);
  if (existing.ok) return { ok: true, message: 'Collection exists' };
  const created = await compatQdrantRequest(`/collections/${collectionName}`, {
    method: 'PUT',
    body: JSON.stringify({ vectors: { size: 1024, distance: 'Cosine' } }),
  });
  return created.ok ? { ok: true, message: 'Collection created' } : { ok: false, message: created.message || `Qdrant collection create failed (${created.status})` };
}

async function upsertCompatVectors(clerkUserId: string, documentId: string, fileName: string, chunks: any[]) {
  const collectionName = String((globalThis as any).process?.env?.QDRANT_COLLECTION || 'user_documents');
  if (!chunks.length) return { ok: false, message: 'Chunking Failed', inserted: 0, verified: 0 };
  const ensured = await ensureCompatQdrantCollection(collectionName);
  if (!ensured.ok) return { ok: false, message: ensured.message, inserted: 0, verified: 0 };

  const points = chunks.map((chunk: any, index: number) => ({
    id: stableUuid(`${documentId}:${chunk.id || index}`),
    vector: deterministicEmbedding(String(chunk.text || chunk.rawExcerpt || chunk.summary || '')),
    payload: {
      user_id: clerkUserId,
      document_id: documentId,
      source_id: documentId,
      chunk_id: chunk.id || `${documentId}_chunk_${index + 1}`,
      file_name: fileName,
      documentName: fileName,
      text: String(chunk.text || chunk.rawExcerpt || chunk.summary || '').slice(0, 4000),
      pageNumber: chunk.pageNumber || index + 1,
      chunkIndex: index,
    },
  }));

  const upsert = await compatQdrantRequest(`/collections/${collectionName}/points?wait=true`, {
    method: 'PUT',
    body: JSON.stringify({ points }),
  });
  if (!upsert.ok) return { ok: false, message: upsert.message || `Vector Insert Failed (${upsert.status})`, inserted: 0, verified: 0 };

  const verify = await compatQdrantRequest(`/collections/${collectionName}/points/scroll`, {
    method: 'POST',
    body: JSON.stringify({
      limit: Math.max(points.length, 1),
      with_payload: false,
      with_vector: false,
      filter: {
        must: [
          { key: 'user_id', match: { value: clerkUserId } },
          { key: 'document_id', match: { value: documentId } },
        ],
      },
    }),
  });
  const verified = Array.isArray(verify.data?.result?.points) ? verify.data.result.points.length : 0;
  if (!verify.ok || verified < points.length) {
    return { ok: false, message: `Vector verification failed: verified ${verified}/${points.length}`, inserted: points.length, verified };
  }
  return { ok: true, message: 'Vector insertion verified', inserted: points.length, verified };
}

function selectUsefulExcerpt(docs: any[], questionIndex: number) {
  const chunks = docs.flatMap((doc) => Array.isArray(doc.chunks)
    ? doc.chunks.map((chunk: any) => ({ ...chunk, documentName: doc.title || chunk.documentName || 'Uploaded Material' }))
    : [])
    .filter((chunk: any) => isReadableCompatSourceText(String(chunk.text || chunk.rawExcerpt || chunk.summary || '')));
  if (!chunks.length) return null;
  return chunks[(questionIndex - 1) % chunks.length];
}

function inferExamDesign(prompt: string) {
  const lower = prompt.toLowerCase();
  if (lower.includes('judiciary')) return { count: 5, marks: 20, title: 'Judiciary Mains Practice Mock Test' };
  const totalMatch = lower.match(/(\d{2,3})\s*marks?/);
  const totalMarks = totalMatch ? Number(totalMatch[1]) : 50;
  if (lower.includes('long answer')) return { count: 5, marks: 15, title: 'Long Answer Practice Mock Test' };
  if (totalMarks >= 70) return { count: 7, marks: 10, title: 'Full Semester Mock Test' };
  if (totalMarks <= 20) return { count: Math.max(2, Math.ceil(totalMarks / 5)), marks: 5, title: `${totalMarks} Marks Mock Test` };
  return { count: Math.max(4, Math.min(8, Math.ceil(totalMarks / 10))), marks: 10, title: `${totalMarks} Marks Mock Test` };
}

function compatAnswerRange(marks: number) {
  if (Number(marks) <= 5) return { min: 300, max: 600, label: '300-600 words' };
  if (Number(marks) <= 10) return { min: 900, max: 1300, label: '900-1300 words' };
  if (Number(marks) <= 15) return { min: 1300, max: 1700, label: '1300-1700 words' };
  return { min: 1700, max: 2200, label: '1700-2200 words' };
}

function compatWordCount(text: string) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function detectMockTestTemplate(prompt: string): string {
  const normalized = String(prompt || '').toLowerCase();
  if (/full\s*semester|semester\s*paper/.test(normalized)) return 'Full Semester Paper';
  if (/unit\s*wise|unit\s*[-:]?\s*\d+|unit\s+[ivxlcdm]+\b/.test(normalized)) return 'Unit Wise Test';
  if (/pyq|previous\s*year/.test(normalized)) return 'PYQ Style Paper';
  if (/teacher\s*style|teacher\s*pattern/.test(normalized)) return 'Teacher Style Paper';
  if (/50\s*marks?|fifty\s*marks?/.test(normalized)) return '50 Marks Exam';
  if (/important\s+questions?|high\s*probability|probable/.test(normalized)) return 'Important Questions';
  if (/difficult|advanced|analytical|application\s*based/.test(normalized)) return 'Difficult Practice Test';
  if (/revision|revise|quick\s*test/.test(normalized)) return 'Revision Test';
  return 'AI Prompt';
}

function extractRequestedUnitLabel(prompt: string): string | null {
  const match = String(prompt || '').match(/\bunit\s*(?:-|:)?\s*([0-9]+|[ivxlcdm]+)\b/i);
  return match ? match[1].toLowerCase() : null;
}

function requestedUnitExistsInChunks(prompt: string, docs: any[]): boolean {
  const unit = extractRequestedUnitLabel(prompt);
  if (!unit) return true;
  const escapedUnit = unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const unitPattern = new RegExp(`\\bunit\\s*(?:-|:)?\\s*${escapedUnit}\\b`, 'i');
  const haystack = docs.map((doc: any) => `${doc.title || ''} ${doc.document_type || ''} ${doc.summary || ''}`).join(' ');
  return unitPattern.test(haystack);
}

const forbiddenQuestionPattern = /(insufficient|uploaded material|uploaded study material|uploaded study materials|filename\.pdf|\.pdf\b|\.docx\b|generic fallback|no content|not enough details|placeholder|arising from the uploaded|legal issues arising from|document\s+name|file\s+name)/i;

function generateCompatMockTest(prompt: string, docs: any[], includeDetailedAnswers: boolean) {
  const hasFailed = docs.some((doc) => doc.status === 'Extraction Failed' || doc.status === 'Failed');
  const totalWords = docs.reduce((sum, doc) => sum + compatWordCount(String(doc.summary || doc.extractedText || '')), 0);

  if (hasFailed || totalWords < 800 || (includeDetailedAnswers && totalWords < 3000)) {
    return {
      success: false,
      message: 'This file does not contain enough readable legal text for grounded mock test generation. Please upload a clearer PDF, DOCX, text notes, bare act material, judgment PDF, or paste notes manually.',
      questions: [],
      sources: docs.map(notebookRowToDoc),
    };
  }

  // Validate unit request
  const requestedUnit = extractRequestedUnitLabel(prompt);
  if (requestedUnit && !requestedUnitExistsInChunks(prompt, docs)) {
    return {
      success: false,
      message: `Unit ${requestedUnit.toUpperCase()} was not found in the readable uploaded material. Please upload Unit ${requestedUnit.toUpperCase()} notes/PDF/DOCX/text material or paste the relevant unit notes manually.`,
      questions: [],
      sources: docs.map(notebookRowToDoc),
    };
  }

  const readableDocs = docs.filter((doc) => isReadableCompatSourceText(String(doc.summary || doc.extractedText || '')) && compatWordCount(String(doc.summary || doc.extractedText || '')) >= 800);
  const template = detectMockTestTemplate(prompt);
  const design = inferExamDesign(prompt);

  const questions = Array.from({ length: design.count }, (_, index) => {
    const number = index + 1;
    const excerpt = selectUsefulExcerpt(readableDocs, number);
    if (!excerpt) return null;
    const sourceName = excerpt.documentName || readableDocs[0]?.title || 'Uploaded Material';
    const rawSource = String(excerpt.text || excerpt.rawExcerpt || excerpt.summary || '').replace(/\s+/g, ' ').trim();

    // Extract meaningful legal concepts from the chunk to form a question
    const legalTerms = rawSource.match(/\b(?:Article|Section|Act|Contract|Tort|Negligence|Liability|Doctrine|Principle|Right|Duty|Jurisdiction|Remedy|Writ|Constitution|Code|Rules|Evidence|Procedure|Offence|Consideration|Estoppel|Consent|Coercion|Fraud|Misrepresentation|Undue\s+Influence)\s+[\w\s,()]+/gi) || [];
    const topConcepts = legalTerms.slice(0, 3).map((t) => t.replace(/\s+/g, ' ').trim()).join(', ');
    const questionFocus = topConcepts || rawSource.slice(0, 200);

    const question = `Discuss and explain the legal principles, statutory provisions, and relevant framework relating to ${questionFocus}. Provide a detailed analysis with reference to applicable legal concepts.`;

    // Validate question quality - skip if it references filenames or has no overlap
    if (forbiddenQuestionPattern.test(question)) return null;

    const sourceChunk = excerpt.id || excerpt.chunkIndex || ('chunk_' + number);
    const sourceChunks = [{ chunkId: sourceChunk, documentName: sourceName, pageNumber: excerpt.pageNumber || 1, excerpt: rawSource.slice(0, 900) }];
    return {
      id: 'q_' + number,
      questionNumber: number,
      question,
      marks: design.marks,
      difficulty: number % 3 === 0 ? 'Hard' : number % 2 === 0 ? 'Moderate' : 'University Standard',
      type: design.marks >= 15 ? 'Long Answer' : 'Descriptive',
      section: design.marks >= 20 ? 'C' : design.marks >= 10 ? 'B' : 'A',
      template,
      sourceDocument: sourceName,
      sourcePage: excerpt.pageNumber || 1,
      sourceChunk,
      grounding: { documentName: sourceName, pageNumber: excerpt.pageNumber || 1, excerpt: rawSource.slice(0, 500), sourceChunks, topic: topConcepts || 'Legal Analysis' },
      sourceChunks,
      modelAnswer: '',
      wordCount: 0,
      answerWordCount: 0,
      answerDepth: 'detailed',
      answerLengthTarget: compatAnswerRange(design.marks).label,
      insufficientMaterialWarning: '',
    };
  }).filter(Boolean);

  if (!questions.length) {
    return { success: false, message: 'Mock Test cannot be generated because the uploaded material is unreadable or too limited.', questions: [], sources: docs.map(notebookRowToDoc) };
  }

  return {
    success: true,
    id: compactId('mock_test'),
    title: design.title,
    subject: 'Study Library Mock Test',
    totalMarks: questions.reduce((sum: number, question: any) => sum + Number(question.marks || 0), 0),
    timeMinutes: Math.max(30, questions.length * 12),
    generatedAt: new Date().toISOString(),
    questions,
    sources: readableDocs.map(notebookRowToDoc),
    provider: 'vercel-compat-grounded',
  };
}


function learningStatusFromDoc(doc: any) {
  const status = String(doc.status || doc.extractionStatus || '').toLowerCase();
  if (status.includes('failed')) return 'Failed';
  if (status.includes('ocr') || status.includes('pending')) return 'Failed';
  return 'Indexed';
}

function notebookRowToLearningSource(row: any) {
  const doc = notebookRowToDoc(row);
  return {
    id: doc.id,
    kind: doc.documentType || doc.type || 'Study Material',
    name: doc.name,
    url: null,
    text: doc.extractedText || doc.previewContent || '',
    textLength: String(doc.extractedText || doc.previewContent || '').length,
    createdAt: doc.uploadedAt || new Date().toISOString(),
    vectorId: doc.id,
    status: learningStatusFromDoc(doc),
    indexingProgress: learningStatusFromDoc(doc) === 'Indexed' ? 100 : 0,
    subject: (doc.legalMetadata as any)?.subject || undefined,
    documentType: doc.documentType || doc.type || 'Study Material',
    unit: (doc.legalMetadata as any)?.unit || undefined,
    topic: (doc.legalMetadata as any)?.topic || undefined,
    metadata: {
      extractedWordCount: doc.extractedWordCount || doc.wordCount || 0,
      insufficientForMockTest: !!doc.insufficientForMockTest,
      insufficientForLongAnswers: !!doc.insufficientForLongAnswers,
      chunksCreated: doc.chunkCount || 0,
      embeddingsStatus: doc.embeddingsStatus || 'Serverless Indexed',
      error: doc.errorMessage || undefined,
    },
  };
}

async function loadLearningDocs(clerkUserId: string) {
  const docs = await selectSupabase('notebook_documents', 'user_id=eq.' + encodeURIComponent(clerkUserId) + '&order=created_at.desc&limit=100');
  if (docs.ok && Array.isArray(docs.data)) return docs.data;
  const materials = await selectSupabase('study_materials', 'user_id=eq.' + encodeURIComponent(clerkUserId) + '&order=created_at.desc&limit=100');
  return Array.isArray(materials.data) ? materials.data.map(materialRowToNotebookRow) : [];
}

async function extractCompatUploadText(file: any) {
  const fileName = file.filename || 'Uploaded Study Material';
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  let extractedText = '';
  let pagesProcessed = 1;

  if (extension === 'pdf') {
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const pdfData = await pdfParse(file.buffer);
      extractedText = String(pdfData.text || '').trim();
      pagesProcessed = pdfData.numpages || 1;
    } catch {
      extractedText = '';
    }
  } else if (extension === 'docx') {
    try {
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip(file.buffer);
      const documentXml = zip.readAsText('word/document.xml');
      const textMatches = documentXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
      extractedText = textMatches.map((match: string) => match.replace(/<w:t[^>]*>/g, '').replace(/<\/w:t>/g, '')).join(' ');
    } catch {
      extractedText = file.buffer.toString('utf8').replace(/\s+/g, ' ').trim();
    }
  } else if (extension === 'pptx' || extension === 'ppt') {
    try {
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip(file.buffer);
      const slides = zip.getEntries().filter((entry: any) => entry.entryName.includes('slide') && entry.entryName.endsWith('.xml'));
      const texts: string[] = [];
      for (const slide of slides) {
        const xml = slide.getData().toString('utf8');
        const textMatches = xml.match(/<a:t>([^<]*)<\/a:t>/g) || [];
        texts.push(...textMatches.map((match: string) => match.replace(/<\/?a:t>/g, '')));
      }
      extractedText = texts.join(' ').trim();
    } catch {
      extractedText = file.buffer.toString('utf8').replace(/\s+/g, ' ').trim();
    }
  } else {
    extractedText = file.buffer.toString('utf8').trim();
  }

  return { extractedText: String(extractedText || '').replace(/\s+/g, ' ').trim(), pagesProcessed };
}

async function saveLearningCompatDocument(clerkUserId: string, input: { fileName: string; fileType: string; fileSize: number; text: string; documentType?: string; pagesProcessed?: number }) {
  const documentId = compactId('doc');
  const now = new Date().toISOString();
  const cleanedText = String(input.text || '').replace(/\s+/g, ' ').trim();
  const wordCount = wordsIn(cleanedText);
  const chunks = buildNotebookChunks(cleanedText, documentId, input.fileName);
  const isReadable = isReadableCompatSourceText(cleanedText);
  const qualityStatus = isReadable && wordCount >= 120 ? 'Indexed Successfully' : 'Extraction Failed';
  const payload = {
    document_id: documentId,
    user_id: clerkUserId,
    document_type: input.documentType || 'Study Material',
    title: input.fileName,
    summary: cleanedText,
    chunks,
    metadata: {
      fileName: input.fileName,
      fileType: input.fileType,
      fileSize: input.fileSize,
      uploadedAt: now,
      sourceType: input.documentType || 'Study Material',
      extractedWordCount: wordCount,
      pagesProcessed: input.pagesProcessed || Math.max(1, chunks.length),
      chunksCreated: chunks.length,
      extractionStatus: qualityStatus,
      embeddingsStatus: 'Serverless Indexed',
      insufficientForMockTest: !isReadable || wordCount < 800,
      insufficientForLongAnswers: !isReadable || wordCount < 3000,
      isReadable,
      errorMessage: qualityStatus === 'Extraction Failed' ? 'Readable text extraction failed or produced too little text.' : undefined,
    },
    created_at: now,
  };
  const insert = await insertSupabase('notebook_documents', payload);
  return notebookRowToLearningSource(insert.ok ? (insert.data?.[0] || payload) : payload);
}

function compatMockToLearningMock(body: any, generated: any, sourceIds: string[]) {
  const questions = (generated.questions || []).map((q: any, index: number) => ({
    id: String(q.id || 'q' + (index + 1)),
    type: q.type || 'Descriptive',
    topic: q.grounding?.topic || q.section || 'Uploaded material',
    question: q.question,
    marks: Number(q.marks || 10),
    difficulty: q.difficulty || body.difficulty || 'Intermediate',
    expectedAnswerLength: q.answerLengthTarget || compatAnswerRange(Number(q.marks || 10)).label,
    modelAnswerRequested: true,
    generatedAnswers: q.modelAnswer ? { '15 Marks': { modelAnswer: q.modelAnswer, citations: q.sourceChunks || [] } } : {},
    citations: (q.sourceChunks || []).map((chunk: any) => ({
      sourceName: chunk.documentName || q.sourceDocument || 'Uploaded Study Material',
      page: 'Page ' + (chunk.pageNumber || q.sourcePage || 1),
      chunkRef: chunk.chunkId || q.sourceChunk || 'chunk',
      supportingText: chunk.excerpt || q.grounding?.excerpt || '',
    })),
  }));
  return {
    id: generated.id || compactId('mock_test'),
    userId: 'serverless-user',
    topic: String(body.topic || body.customPrompt || generated.subject || 'Mock Test'),
    difficulty: body.difficulty || 'Intermediate',
    questionType: body.questionType || body.paperType || 'Descriptive',
    questionCount: questions.length,
    sourceIds,
    questions,
    scoreReport: {
      totalMarks: questions.reduce((sum: number, question: any) => sum + Number(question.marks || 0), 0),
      examTitle: generated.title || 'Professional Legal Mock Assessment',
      subjectTopic: String(body.topic || body.customPrompt || generated.subject || 'Uploaded Material'),
      instructions: ['Answer all questions.', 'Use the uploaded study material as the grounding source.', 'Write structured legal answers with provisions and authorities where available.'],
      modelAnswerRequested: true,
      retrievalAudit: { provider: generated.provider || 'vercel-compat-grounded', sourceIdsUsed: sourceIds, qdrantOnly: false },
    },
    weakAreas: [],
    mode: body.mode || 'interactive',
    createdAt: generated.generatedAt || new Date().toISOString(),
  };
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    return json(res, 204, null);
  }

  const route = getRoute(req);

  // Production AI traffic must go through the NestJS entitlement interceptor.
  // Keeping the compatibility implementation enabled would create a second,
  // unmetered path to paid providers.
  if ((globalThis as any).process?.env?.NODE_ENV === 'production' && (isPaidCompatRoute(req.method, route) || isCommandCenterCompatRoute(route))) {
    return json(res, 503, { code: 'PROTECTED_API_REQUIRES_BACKEND', message: 'This feature must use the configured LEGATRIXON API service.' });
  }

  if (route === 'health') {
    return json(res, 200, { status: 'healthy', timestamp: new Date().toISOString() });
  }

  if (route === 'learning-workspace' && req.method === 'GET') {
    const clerkUserId = getBearerSubject(req);
    if (!clerkUserId) return json(res, 401, { message: 'Unauthorized' });
    const docs = await loadLearningDocs(clerkUserId);
    return json(res, 200, {
      sources: docs.map(notebookRowToLearningSource),
      mockTests: [],
      mindMaps: [],
      studyKits: [],
      analytics: {},
      weakAreas: { weakTopics: [], strongTopics: [], suggestedRevisionPlan: [] },
      attempts: [],
    });
  }

  if (route === 'learning-workspace/indexing/status' && req.method === 'GET') {
    return json(res, 200, { paused: false, queueLength: 0, isProcessing: false, activeWorkers: 0, maxWorkers: 1 });
  }

  if ((route === 'learning-workspace/indexing/pause' || route === 'learning-workspace/indexing/resume') && req.method === 'POST') {
    return json(res, 200, { success: true, status: route.endsWith('/pause') ? 'paused' : 'running' });
  }

  if ((route === 'learning-workspace/sources/upload' || route === 'learning-workspace/sources/bulk-upload') && req.method === 'POST') {
    const clerkUserId = getBearerSubject(req);
    if (!clerkUserId) return json(res, 401, { message: 'Unauthorized' });
    const { fields, files } = await parseMultipart(req);
    if (!files.length) return json(res, 400, { message: 'Multipart file payload missing.' });
    const created: any[] = [];
    for (const file of files) {
      const fileName = file.filename || 'Uploaded Study Material';
      const fileType = normalizeFileType(fileName, file.mimeType || '');
      const extracted = await extractCompatUploadText(file);
      const source = await saveLearningCompatDocument(clerkUserId, {
        fileName,
        fileType,
        fileSize: file.buffer.length,
        text: extracted.extractedText,
        documentType: String(fields.kind || fields.documentType || 'Study Material'),
        pagesProcessed: extracted.pagesProcessed,
      });
      created.push(source);
    }
    if (route.endsWith('/bulk-upload')) return json(res, 200, { accepted: created.length, sources: created });
    return json(res, 200, created[0]);
  }

  if (route === 'learning-workspace/sources/text' && req.method === 'POST') {
    const clerkUserId = getBearerSubject(req);
    if (!clerkUserId) return json(res, 401, { message: 'Unauthorized' });
    const body = await readBody(req);
    const textContent = String(body.text || '').replace(/\s+/g, ' ').trim();
    if (textContent.length < 40) return json(res, 400, { message: 'Source text is too short to analyze.' });
    const source = await saveLearningCompatDocument(clerkUserId, {
      fileName: String(body.name || 'Pasted Notes'),
      fileType: 'TXT',
      fileSize: textContent.length,
      text: textContent,
      documentType: String(body.kind || 'Notes'),
      pagesProcessed: 1,
    });
    return json(res, 200, source);
  }

  const learningSourceAction = route.match(/^learning-workspace\/sources\/([^/]+)\/(rename|delete|reprocess)$/);
  if (learningSourceAction && req.method === 'POST') {
    const clerkUserId = getBearerSubject(req);
    if (!clerkUserId) return json(res, 401, { message: 'Unauthorized' });
    const docs = await loadLearningDocs(clerkUserId);
    const row = docs.find((doc: any) => String(doc.document_id) === decodeURIComponent(learningSourceAction[1]));
    if (!row) return json(res, 404, { message: 'Source not found.' });
    return json(res, 200, notebookRowToLearningSource(row));
  }

  if (route === 'learning-workspace/mock-tests/generate' && req.method === 'POST') {
    const clerkUserId = getBearerSubject(req);
    if (!clerkUserId) return json(res, 401, { message: 'Unauthorized' });
    const body = await readBody(req);
    const sourceIds = Array.isArray(body.sourceIds) ? body.sourceIds.map(String) : [];
    let docs = await loadLearningDocs(clerkUserId);
    if (sourceIds.length) docs = docs.filter((row: any) => sourceIds.includes(String(row.document_id)));
    if (!docs.length) return json(res, 400, { message: 'Please upload study material before generating a mock test.' });
    const prompt = String(body.customPrompt || body.topic || body.paperType || 'Generate a legal mock test');
    const generated = generateCompatMockTest(prompt, docs, false);
    if (!generated.success) return json(res, 400, generated);
    return json(res, 200, compatMockToLearningMock(body, generated, sourceIds));
  }

  const learningAnswerMatch = route.match(/^learning-workspace\/mock-tests\/([^/]+)\/questions\/([^/]+)\/answer$/);
  if (learningAnswerMatch && req.method === 'POST') {
    const clerkUserId = getBearerSubject(req);
    if (!clerkUserId) return json(res, 401, { message: 'Unauthorized' });
    const body = await readBody(req);
    const questionId = decodeURIComponent(learningAnswerMatch[2]);
    const docs = await loadLearningDocs(clerkUserId);
    const readableDocs = docs.filter((doc: any) => isReadableCompatSourceText(String(doc.summary || doc.extractedText || '')));
    if (!readableDocs.length) return json(res, 400, { message: 'No indexed chunks available to generate this answer.' });
    const context = readableDocs.map((doc: any) => String(doc.summary || '').slice(0, 1800)).join('\n\n');
    const answerText = [
      '1. Introduction',
      'This answer is grounded in the uploaded study material and is structured for a descriptive legal examination.',
      '',
      '2. Legal Framework',
      context.slice(0, 1800),
      '',
      '3. Application and Analysis',
      'Apply the extracted provisions, doctrines, and legal principles to the question. Where the uploaded material identifies sections, articles, or judgments, cite them directly and avoid unsupported authorities.',
      '',
      '4. Conclusion',
      'The conclusion should synthesize the governing rule, its statutory or doctrinal basis, and its exam-relevant application.'
    ].join('\n');
    return json(res, 200, {
      questionId,
      mode: body.mode || '15 Marks',
      cached: false,
      answer: {
        modelAnswer: answerText,
        importantJudgments: [],
        relevantArticles: [],
        relevantSections: [],
        sourcesUsed: readableDocs.map((doc: any) => doc.title).filter(Boolean),
        citations: readableDocs.slice(0, 3).map((doc: any) => ({ sourceName: doc.title, page: 'Page 1', chunkRef: doc.document_id, supportingText: String(doc.summary || '').slice(0, 500) })),
        generatedAt: new Date().toISOString(),
      },
    });
  }

  if (route === 'notebook/upload' && req.method === 'POST') {
    const clerkUserId = getBearerSubject(req);
    if (!clerkUserId) return json(res, 401, { message: 'Unauthorized' });

    let fileName = 'Uploaded Study Material';
    let fileType = 'PDF';
    let fileSize = 0;
    let extractedText = '';
    let documentType = 'Study Material';
    let pagesProcessed = 1;

    const contentType = req.headers['content-type'] || req.headers['Content-Type'] || '';
    if (contentType.includes('multipart/form-data')) {
      try {
        const { parseMultipart } = await import('../_utils.js');
        const { fields, files } = await parseMultipart(req);
        
        const file = files[0];
        if (!file) {
          return json(res, 400, { success: false, message: 'File upload failed: No file provided' });
        }

        fileName = file.filename || String(fields.fileName || fields.name || 'Uploaded Study Material');
        fileSize = file.buffer.length;
        documentType = String(fields.documentType || 'Study Material');
        const extension = fileName.split('.').pop()?.toLowerCase() || '';

        // Validate file size (100MB limit)
        if (fileSize > 100 * 1024 * 1024) {
          return json(res, 422, {
            success: false,
            message: 'File size exceeds 100MB limit. Please upload a smaller file.',
            extractionStatus: 'Upload Failed',
          });
        }

        if (extension === 'pdf') {
          try {
            const pdfParse = (await import('pdf-parse')).default;
            const pdfData = await pdfParse(file.buffer);
            extractedText = String(pdfData.text || '').trim();
            pagesProcessed = pdfData.numpages || 1;
          } catch (pdfErr: any) {
            console.error('Failed to parse PDF:', pdfErr.message);
            return json(res, 422, {
              success: false,
              message: 'This file does not contain enough readable legal text. Please upload a clearer PDF, DOCX, TXT, or paste notes manually.',
              extractionStatus: 'Extraction Failed',
              extractedWordCount: 0,
              pagesProcessed: 0,
              chunkCount: 0,
            });
          }
        } else if (extension === 'docx') {
          try {
            // Try proper DOCX extraction via AdmZip
            const AdmZip = (await import('adm-zip')).default;
            const zip = new AdmZip(file.buffer);
            try {
              const documentXml = zip.readAsText('word/document.xml');
              const textMatches = documentXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
              extractedText = textMatches
                .map(match => match.replace(/<w:t[^>]*>/g, '').replace(/<\/w:t>/g, ''))
                .filter(Boolean)
                .join(' ');
            } catch {
              // Fallback to binary conversion
              extractedText = file.buffer.toString('utf8').replace(/\s+/g, ' ').trim();
            }
          } catch (docxErr: any) {
            console.error('Failed to parse DOCX:', docxErr.message);
            extractedText = file.buffer.toString('utf8').replace(/\s+/g, ' ').trim();
          }
        } else if (extension === 'txt' || extension === 'md') {
          extractedText = file.buffer.toString('utf8').trim();
        } else if (extension === 'pptx' || extension === 'ppt') {
          // For PowerPoint, try basic extraction
          try {
            const AdmZip = (await import('adm-zip')).default;
            const zip = new AdmZip(file.buffer);
            const slides = zip.getEntries().filter(e => e.entryName.includes('slide') && e.entryName.endsWith('.xml'));
            const texts: string[] = [];
            for (const slide of slides) {
              const xml = slide.getData().toString('utf8');
              const textMatches = xml.match(/<a:t>([^<]*)<\/a:t>/g) || [];
              texts.push(...textMatches.map(m => m.replace(/<\/?a:t>/g, '')));
            }
            extractedText = texts.join(' ').trim();
          } catch {
            extractedText = file.buffer.toString('utf8').replace(/\s+/g, ' ').trim();
          }
        } else {
          // Default: UTF-8 conversion
          extractedText = file.buffer.toString('utf8').trim();
        }
        fileType = normalizeFileType(fileName, file.mimeType || String(fields.fileType || fields.type || '').toLowerCase());
      } catch (err: any) {
        console.error('Multipart parsing error:', err.message);
        return json(res, 500, { success: false, message: 'File upload failed: ' + err.message });
      }
    } else {
      const body = await readBody(req);
      fileName = String(body.fileName || body.name || 'Uploaded Study Material');
      fileType = normalizeFileType(fileName, String(body.fileType || body.type || '').toLowerCase());
      extractedText = String(body.extractedText || body.text || body.content || '').replace(/\s+/g, ' ').trim();
      fileSize = Number(body.fileSize || extractedText.length);
      documentType = String(body.documentType || 'Study Material');
    }

    // Clean up extracted text
    let cleanedText = String(extractedText || '')
      .replace(/\s+/g, ' ')
      .trim();

    const plainTextLength = cleanedText.length;
    if (plainTextLength < 150) {
      cleanedText = [
        `Document uploaded: ${fileName}.`,
        'Text extraction was limited. The file was saved successfully and can be reprocessed with OCR later.'
      ].join(' ');
    }

    if (!cleanedText || cleanedText.trim().length === 0) {
      cleanedText = [
        `Document uploaded: ${fileName}.`,
        'No readable text was extracted, but upload was saved successfully.'
      ].join(' ');
    }

    // Validate readability
    const badChars = (cleanedText.match(/[\uFFFD\x00-\x08\x0E-\x1F]/g) || []).length;
    const alphaWords = (cleanedText.match(/\b[A-Za-z][A-Za-z]{2,}\b/g) || []).length;
    const sentenceSignals = (cleanedText.match(/[.!?]\s+[A-Z]/g) || []).length;
    const pdfNoise = (cleanedText.match(/\b(?:obj|endobj|stream|endstream|xref|trailer|FlateDecode|startxref)\b/g) || []).length;

    const isReadable = badChars / Math.max(1, cleanedText.length) < 0.01 && alphaWords >= 80 && sentenceSignals >= 3 && pdfNoise < 12;

    const documentId = compactId('doc');
    const now = new Date().toISOString();
    const wordCount = wordsIn(cleanedText);
    const chunks = buildNotebookChunks(cleanedText, documentId, fileName);
    
    let qualityStatus = 'Indexed Successfully';
    let vectorResult = { ok: false, message: 'Not attempted', inserted: 0, verified: 0 };
    if (!wordCount || !isReadable) {
      qualityStatus = 'OCR Needed';
      vectorResult = { ok: false, message: 'OCR Needed', inserted: 0, verified: 0 };
    } else if (!chunks.length) {
      qualityStatus = 'Chunking Failed';
      vectorResult = { ok: false, message: 'Chunking Failed', inserted: 0, verified: 0 };
    } else {
      vectorResult = await upsertCompatVectors(clerkUserId, documentId, fileName, chunks);
      qualityStatus = vectorResult.ok ? 'Indexed Successfully' : 'Vector Insert Failed';
    }

    console.log("[LOGGING PIPELINE] - Extraction complete.");
    console.log(`[LOGGING PIPELINE] - Chunks created: ${chunks.length} chunks.`);
    console.log(`[LOGGING PIPELINE] - Embeddings generated: ${vectorResult.inserted || 0} deterministic vectors.`);
    console.log(`[LOGGING PIPELINE] - Vectors stored in Qdrant: ${vectorResult.ok ? 'Yes' : 'No'} (${vectorResult.message}).`);
    console.log(`[LOGGING PIPELINE] - Vector verification: ${vectorResult.verified || 0}/${chunks.length}.`);
    console.log(`[LOGGING PIPELINE] - Status updated to: ${qualityStatus}.`);

    const payload = {
      document_id: documentId,
      user_id: clerkUserId,
      document_type: documentType,
      title: fileName,
      summary: cleanedText.slice(0, 4000),
      chunks,
      metadata: {
        fileName,
        fileType,
        fileSize,
        uploadedAt: now,
        sourceType: documentType,
        extractedWordCount: wordCount,
        pagesProcessed: pagesProcessed,
        chunksCreated: chunks.length,
        qualityStatus: qualityStatus,
        extractionStatus: qualityStatus,
        embeddingsStatus: vectorResult.ok ? 'Verified' : 'Failed',
        vectorStatus: vectorResult.ok ? 'Verified' : 'Failed',
        vectorsInserted: vectorResult.inserted,
        vectorsVerified: vectorResult.verified,
        errorMessage: vectorResult.ok ? undefined : vectorResult.message,
        isReadable: isReadable,
        confidence: isReadable ? 0.95 : 0.75,
      },
      created_at: now,
    };

    const insert = await insertSupabase('notebook_documents', payload);
    if (insert.ok) {
      return json(res, 200, notebookRowToDoc(insert.data?.[0] || payload));
    }

    const fallbackInsert = await insertStudyMaterialFallback(clerkUserId, fileName, fileType, fileSize, cleanedText || chunks[0]?.text || '', now, documentId, qualityStatus);
    if (!fallbackInsert.ok) {
      console.error('[LOGGING PIPELINE] - Persistence Failed:', insert.error || fallbackInsert.error || (fallbackInsert as any).message);
      return json(res, 500, {
        success: false,
        message: 'Persistence Failed: uploaded document could not be saved for status polling.',
        extractionStatus: 'Persistence Failed',
        errorMessage: insert.error || fallbackInsert.error || (fallbackInsert as any).message || 'Persistence Failed',
      });
    }
    return json(res, 200, materialRowToDoc(fallbackInsert.data?.[0] || {
      id: documentId,
      document_id: documentId,
      user_id: clerkUserId,
      title: fileName,
      file_name: fileName,
      file_type: fileType.toLowerCase(),
      file_size: fileSize,
      status: qualityStatus,
      extracted_text: cleanedText || chunks[0]?.text || '',
      created_at: now,
      updated_at: now,
    }));
  }

  if (route === 'notebook/documents' && req.method === 'GET') {
    const clerkUserId = getBearerSubject(req);
    if (!clerkUserId) return json(res, 401, { message: 'Unauthorized' });
    const docs = await selectSupabase('notebook_documents', `user_id=eq.${encodeURIComponent(clerkUserId)}&order=created_at.desc`);
    if (docs.ok && Array.isArray(docs.data)) return json(res, 200, docs.data.map(notebookRowToDoc));
    const materials = await selectSupabase('study_materials', `user_id=eq.${encodeURIComponent(clerkUserId)}&order=created_at.desc`);
    if (!materials.ok || !Array.isArray(materials.data)) return json(res, 200, []);
    return json(res, 200, materials.data.map(materialRowToDoc));
  }

  const documentMatch = route.match(/^notebook\/documents\/([^/]+)(?:\/chunks)?$/);
  if (documentMatch && req.method === 'GET') {
    const clerkUserId = getBearerSubject(req);
    if (!clerkUserId) return json(res, 401, { message: 'Unauthorized' });
    const documentId = decodeURIComponent(documentMatch[1]);
    const docs = await selectSupabase('notebook_documents', `document_id=eq.${encodeURIComponent(documentId)}&user_id=eq.${encodeURIComponent(clerkUserId)}&limit=1`);
    let row = Array.isArray(docs.data) ? docs.data[0] : null;
    let normalized = row;
    if (!row) {
      const materials = await selectSupabase('study_materials', `id=eq.${encodeURIComponent(documentId)}&user_id=eq.${encodeURIComponent(clerkUserId)}&limit=1`);
      row = Array.isArray(materials.data) ? materials.data[0] : null;
      normalized = row ? materialRowToNotebookRow(row) : null;
    }
    if (!normalized) return json(res, 404, { message: 'Document not found' });
    if (route.endsWith('/chunks')) return json(res, 200, Array.isArray(normalized.chunks) ? normalized.chunks : []);
    return json(res, 200, notebookRowToDoc(normalized));
  }

  if (route === 'exam/study-library/stats' && req.method === 'GET') {
    const clerkUserId = getBearerSubject(req);
    if (!clerkUserId) return json(res, 401, { message: 'Unauthorized' });
    const docs = await selectSupabase('notebook_documents', `user_id=eq.${encodeURIComponent(clerkUserId)}`);
    const materialRows = (!docs.ok || !Array.isArray(docs.data))
      ? await selectSupabase('study_materials', `user_id=eq.${encodeURIComponent(clerkUserId)}`)
      : { data: docs.data };
    const rows = Array.isArray(materialRows.data) ? materialRows.data.map((row: any) => row.document_id ? row : materialRowToNotebookRow(row)) : [];
    const totalWords = rows.reduce((sum: number, row: any) => sum + wordsIn(String(row.summary || '')), 0);
    return json(res, 200, {
      documents: rows.length,
      indexedDocuments: rows.length,
      totalWords,
      sourceTypes: [...new Set(rows.map((row: any) => row.document_type || 'Study Material'))],
      strictGrounding: true,
    });
  }

  if (route === 'exam/study-library/generate-test' && req.method === 'POST') {
    const clerkUserId = getBearerSubject(req);
    if (!clerkUserId) return json(res, 401, { message: 'Unauthorized' });
    const apiKey = (globalThis as any).process?.env?.GEMINI_API_KEY;
    if (!apiKey || apiKey.includes('placeholder')) {
      return json(res, 400, {
        success: false,
        message: "AI provider is not configured correctly. Please check API key settings. Missing env variable: GEMINI_API_KEY"
      });
    }
    const body = await readBody(req);
    const selectedIds = Array.isArray(body.docIds) ? body.docIds.map(String) : [];
    const docsResult = await selectSupabase('notebook_documents', `user_id=eq.${encodeURIComponent(clerkUserId)}&order=created_at.desc&limit=50`);
    const materialsResult = (!docsResult.ok || !Array.isArray(docsResult.data))
      ? await selectSupabase('study_materials', `user_id=eq.${encodeURIComponent(clerkUserId)}&order=created_at.desc&limit=50`)
      : { data: docsResult.data };
    let docs = Array.isArray(materialsResult.data) ? materialsResult.data.map((row: any) => row.document_id ? row : materialRowToNotebookRow(row)) : [];
    if (!docs.length && Array.isArray(body.documents)) docs = body.documents.map(clientDocToNotebookRow);
    if (selectedIds.length) docs = docs.filter((row: any) => selectedIds.includes(String(row.document_id)) || !row.document_id.startsWith('doc_'));
    if (!docs.length) return json(res, 400, { success: false, message: 'Please upload study material before generating a mock test.' });
    return json(res, 200, generateCompatMockTest(String(body.prompt || body.settings?.command || ''), docs, body.settings?.includeDetailedAnswers !== false));
  }

  const tempAnswerMatch = route.match(/^learning-workspace\/mock-tests\/temp\/questions\/([^/]+)\/answer$/);
  if (tempAnswerMatch && req.method === 'POST') {
    const clerkUserId = getBearerSubject(req);
    if (!clerkUserId) return json(res, 401, { message: 'Unauthorized' });
    const body = await readBody(req);
    const questionId = tempAnswerMatch[1];
    const questionText = String(body.question || '');
    const selectedIds = Array.isArray(body.docIds) ? body.docIds.map(String) : [];
    
    const docsResult = await selectSupabase('notebook_documents', `user_id=eq.${encodeURIComponent(clerkUserId)}&order=created_at.desc&limit=50`);
    const materialsResult = (!docsResult.ok || !Array.isArray(docsResult.data))
      ? await selectSupabase('study_materials', `user_id=eq.${encodeURIComponent(clerkUserId)}&order=created_at.desc&limit=50`)
      : { data: docsResult.data };
    let docs = Array.isArray(materialsResult.data) ? materialsResult.data.map((row: any) => row.document_id ? row : materialRowToNotebookRow(row)) : [];
    if (selectedIds.length) docs = docs.filter((row: any) => selectedIds.includes(String(row.document_id)) || !row.document_id.startsWith('doc_'));
    
    const readableDocs = docs.filter((doc) => isReadableCompatSourceText(String(doc.summary || doc.extractedText || '')));
    const excerpt = selectUsefulExcerpt(readableDocs, 1);
    
    if (!readableDocs.length) {
      return json(res, 200, {
        questionId,
        content: '',
        modelAnswer: '',
        wordCount: 0,
        insufficientMaterialWarning: 'Insufficient grounded material found.',
        answerLengthTarget: '0 words'
      });
    }

    const aiPrompt = `You are LEGATRIXON AI, an expert Indian legal exam answer generator.
Generate a real, detailed, professional subjective legal exam answer strictly grounded in retrieved uploaded material.

Rules:
- Answer the actual legal question.
- Do not use filename as topic.
- Do not write generic fallback frameworks.
- Follow required word count.
- Use formal legal language.
- Use headings and subheadings.
- Include legal principles from source.
- Include statutory provisions only if present in source.
- Include case laws/judgments only if present in source.
- Do not invent fake cases, judgments, citations, sections, articles, doctrines, courts, years, or facts.
- Avoid repetition and filler.
- Make the answer useful for law students and judiciary aspirants.

Structure:
1. Introduction
2. Background and Context
3. Legal Issues
4. Relevant Statutory Framework/Legal Principles
5. Detailed Explanation
6. Case Laws/Judgments (only if present)
7. Critical Analysis
8. Application/Exam-Relevant Discussion
9. Important Points for Answer Writing
10. Conclusion
11. Source Grounding

Question: ${questionText}
Source context:
${readableDocs.map(d => String(d.summary || d.extractedText).slice(0, 5000)).join('\n\n')}

Write the complete answer structured strictly following the points above.`;
    
    const apiKey = (globalThis as any).process?.env?.GEMINI_API_KEY;
    if (!apiKey || apiKey.includes('placeholder')) {
      return json(res, 400, {
        success: false,
        message: "AI provider is not configured correctly. Please check API key settings. Missing env variable: GEMINI_API_KEY"
      });
    }

    let answerText = '';
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: aiPrompt }] }],
          generationConfig: { temperature: 0.2 }
        })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || 'Gemini API Error');
      }
      answerText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!answerText) {
        throw new Error('AI provider returned empty response');
      }
    } catch (e: any) {
      return json(res, 400, {
        success: false,
        message: `AI provider is not configured correctly. Please check API key settings. Error: ${e.message}`
      });
    }

    return json(res, 200, {
      questionId,
      content: answerText,
      modelAnswer: answerText,
      wordCount: compatWordCount(answerText),
      answerLengthTarget: 'Detailed Answer',
      insufficientMaterialWarning: answerText.includes('insufficient') ? 'Source context might be thin.' : ''
    });
  }

  if (route === 'legal-intelligence/bare-act/professor-chat' && req.method === 'POST') {
    const clerkUserId = getBearerSubject(req);
    if (!clerkUserId) return json(res, 401, { message: 'Unauthorized' });
    const body = await readBody(req);
    const userInput = String(body.userInput || '').trim();
    if (!userInput) return json(res, 400, { message: 'userInput is required' });

    const NON_LEGAL_PATTERNS = [
      /\b(recipe|cook|cooking|meal|restaurant|travel itinerary|hotel|flight|tourist)\b/,
      /\b(movie|music|song|gaming|video game|sports score|cricket score|football score|celebrity gossip)\b/,
      /\b(weather|temperature|forecast|joke|poem|riddle|trivia|horoscope)\b/,
      /\b(write|build|debug|fix|compile|run|implement|create)\b[\s\S]{0,30}\b(code|program|script|function|api|component|website|javascript|typescript|python|java|react|html|css)\b/,
      /\b(solve|calculate|differentiate|integrate)\b[\s\S]{0,30}\b(equation|integral|derivative|matrix|calculus|trigonometry|physics|chemistry|biology)\b/,
    ];
    const hasLegalSignal = /\b(law|legal|court|tribunal|judge|judiciary|constitution|constitutional|article\s+\d+|section\s+\d+|statute|act|rule|regulation|petitioner|respondent|plaintiff|defendant|appellant|accused|counsel|advocate|mens\s+rea|actus\s+reus|ratio\s+decidendi|stare\s+decisis|writ|habeas|mandamus|certiorari|negligence|tort|evidence|bail|fir|arbitration|trademark|patent|copyright|contract|agreement|moot|judgment|judgement|case\s+law|precedent|doctrine|liability|remedy|injunction|damages|bns|bnss|bsa|ipc|crpc|cpc)\b/.test(userInput.toLowerCase());
    const isClearlyNonLegal = !hasLegalSignal && NON_LEGAL_PATTERNS.some(p => p.test(userInput.toLowerCase()));

    if (isClearlyNonLegal) {
      return json(res, 200, {
        response: `I am **LexMentor AI** — a specialized legal intelligence assistant designed exclusively for legal education, legal research, legal drafting, case analysis, moot court preparation, statutes, judgments, and judiciary exam preparation.\n\nYour query appears to be outside the legal domain. Please ask a law-related question and I will be happy to assist.`,
        act: 'UNKNOWN',
        source: 'none',
        lowConfidence: false,
      });
    }

    return json(res, 200, {
      response: localLexMentorReply(userInput),
      act: 'UNKNOWN',
      source: 'knowledge',
      lowConfidence: true,
    });
  }

  if (route === 'legal-intelligence/authority-verification' && req.method === 'POST') {
    const body = await readBody(req);
    const query = String(body.query || '').trim();
    const answer = String(body.answer || '').trim();
    const citationMatches = `${query}\n${answer}`.match(/\b(?:AIR|SCC|SCR|CriLJ|All LJ|INSC|MANU)[:\sA-Z0-9./()-]{5,80}|\b[A-Z][A-Za-z. ]+\s+v\.?\s+[A-Z][A-Za-z. ]+/g) || [];
    const citations = Array.from(new Set(citationMatches.map((item: string) => item.trim()).filter(Boolean))).slice(0, 12);
    const hasCitations = citations.length > 0;
    return json(res, 200, {
      authorityStatus: hasCitations ? 'Authorities detected; verification required before reliance' : 'No explicit authority detected',
      goodLawStatus: 'Unverified pending primary-source confirmation',
      recentAmendments: ['Check current Bare Act text, official Gazette updates, and latest amendment acts.'],
      conflictingJudgments: ['Run Supreme Court and jurisdictional High Court conflict search before final reliance.'],
      bindingCourt: 'Depends on forum, territorial jurisdiction, bench strength, and date of authority.',
      citationValidation: citations.map((citation: string) => ({ citation, status: 'Format detected', paragraphSupport: 'Needs paragraph-level source check' })),
      confidenceScore: hasCitations ? 62 : 38,
      riskLevel: hasCitations ? 'Medium' : 'High',
      verificationTimestamp: new Date().toISOString(),
      primarySources: ['Official Bare Act', 'Supreme Court of India', 'Jurisdictional High Court', 'e-Gazette'],
      professionalSummary: `The proposition${query ? ` on "${query.slice(0, 120)}"` : ''} should not be relied on until cited authorities, statutory text, amendments, and paragraph support are checked against primary sources.`,
      unsupportedReasoning: answer && !hasCitations ? ['The answer contains legal reasoning without explicit cited authority.'] : [],
      paragraphSupportChecks: citations.map((citation: string) => ({ citation, supportsProposition: 'Unverified', note: 'Confirm cited paragraph actually states the proposition.' })),
      provider: 'vercel-compat',
    });
  }

  if (route === 'legal-intelligence/research-mentor/session/start' && req.method === 'POST') {
    const body = await readBody(req);
    const topic = String(body.topic || '').trim();
    if (!topic) return json(res, 400, { message: 'Topic is required' });

    const apiKey = (globalThis as any).process?.env?.GEMINI_API_KEY;
    if (!apiKey || apiKey.includes('placeholder')) {
      return json(res, 400, { message: 'AI provider not configured. Missing GEMINI_API_KEY.' });
    }

    const STAGE_TITLES = [
      'Identify the Legal Issue',
      'Identify Governing Law & Statute',
      'Read the Relevant Bare Act Provisions',
      'Find Leading Judgments',
      'Analyze the Cases',
      'Apply the Law to the Facts',
      'Reach a Reasoned Legal Conclusion',
    ];

    const sessionPrompt = `You are Adv. Raghav Mehta, Senior Advocate with 22 years at Delhi High Court. You mentor junior lawyers in structured legal research. Your teaching is ruthlessly specific — you always name actual Indian statutes, actual section numbers, and actual case names. Return ONLY valid JSON — no markdown, no code block.

ABSOLUTE RULES you must never break:
1. Every "appliedExample" must name the specific Indian Act (e.g. "Bharatiya Nagarik Suraksha Sanhita, 2023" not "the relevant statute"), specific section numbers, and real case names with year.
2. Every "commonMistakes" entry must be a mistake lawyers make on THIS specific type of legal problem — not generic advice applicable to any topic.
3. Every "coreQuestion" must be a precise legal question specific to the topic — not a generic "What does this step require?"
4. "governingStatutes" and "relevantProvisions" in finalMemo must name actual Acts with year and actual section numbers.
5. "leadingJudgments" must name real Supreme Court or High Court cases with year, bench strength, and ratio.
6. NEVER write: "the applicable statute", "a leading case", "the relevant provision" — always name them specifically.
7. For criminal law topics: use BNSS 2023 and BNS 2023 (not CrPC or IPC, which have been replaced).

Research topic: "${topic}"

BEFORE writing JSON, identify:
— Primary area of Indian law this falls under
— The primary Central/State Act (with year) governing this topic
— 3–4 specific section numbers most relevant to this topic
— 2–3 real SC/HC cases on this topic (case name, year, brief ratio)
Use these throughout every "appliedExample" field.

EXAMPLE of GOOD appliedExample (for topic "anticipatory bail"):
Stage 1: "The issue: Whether the accused is entitled to anticipatory bail under Section 482 BNSS 2023, given the FIR alleges a non-bailable offence punishable up to 10 years."
Stage 2: "The governing statute is the Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS). Bail is under Chapter XXXV, Sections 479-485. Section 482 governs anticipatory bail specifically."
Stage 4: "The landmark case is Gurbaksh Singh Sibbia v State of Punjab (1980) 2 SCC 565 — a 5-judge Constitution Bench held anticipatory bail cannot be refused as blanket policy."

EXAMPLES of BAD appliedExample — NEVER write these:
X "For this topic, the advocate identifies the issue under the applicable statute."
X "A leading case will be identified at this stage."
X "The relevant provisions will be read at this step."

Return this exact JSON structure for topic "${topic}":
{
  "intro": {
    "areaOfLaw": "Specific area + primary statute name + year",
    "explanation": "2-3 sentences citing the specific Act and what it governs for '${topic}'",
    "importance": "1-2 sentences on practical risk of getting '${topic}' wrong",
    "mentorIntroduction": "3-4 sentences as Adv. Raghav Mehta — name the specific statute and what makes '${topic}' tricky in practice"
  },
  "stages": [
    {"stepNumber":1,"title":"Identify the Legal Issue","coreQuestion":"The specific court-level legal question raised by '${topic}' with statute and section reference","whyThisStep":"2-3 sentences why precise issue-framing matters for '${topic}'","whatAdvocateDoes":"2-3 sentences what specifically happens at this step for a '${topic}' matter","appliedExample":"2-3 sentences — the ACTUAL issue statement for '${topic}' naming the specific statute and section","commonMistakes":["Mistake specific to '${topic}' issue-framing","Second specific mistake","Third specific mistake"],"mentorNote":"One sentence practical wisdom for '${topic}' at this stage","transitionSentence":"One sentence naming the specific statute to study at Stage 2"},
    {"stepNumber":2,"title":"Identify Governing Law & Statute","coreQuestion":"...","whyThisStep":"...","whatAdvocateDoes":"...","appliedExample":"Name the exact Act with year and the specific sections covering '${topic}' — no placeholder language","commonMistakes":["...","...","..."],"mentorNote":"...","transitionSentence":"..."},
    {"stepNumber":3,"title":"Read the Relevant Bare Act Provisions","coreQuestion":"...","whyThisStep":"...","whatAdvocateDoes":"...","appliedExample":"What the key section(s) of the Act actually say for '${topic}' — quote or paraphrase the operative text with section number","commonMistakes":["...","...","..."],"mentorNote":"...","transitionSentence":"..."},
    {"stepNumber":4,"title":"Find Leading Judgments","coreQuestion":"...","whyThisStep":"...","whatAdvocateDoes":"...","appliedExample":"Name 2-3 real SC/HC cases on '${topic}' with court, year, and what each case specifically decided","commonMistakes":["...","...","..."],"mentorNote":"...","transitionSentence":"..."},
    {"stepNumber":5,"title":"Analyze the Cases","coreQuestion":"...","whyThisStep":"...","whatAdvocateDoes":"...","appliedExample":"Extract the ratio from the leading '${topic}' case — state the binding rule and whether it applies to this problem","commonMistakes":["...","...","..."],"mentorNote":"...","transitionSentence":"..."},
    {"stepNumber":6,"title":"Apply the Law to the Facts","coreQuestion":"...","whyThisStep":"...","whatAdvocateDoes":"...","appliedExample":"Show the IRAC application: cite the specific section and case ratio as applied to the concrete '${topic}' question","commonMistakes":["...","...","..."],"mentorNote":"...","transitionSentence":"..."},
    {"stepNumber":7,"title":"Reach a Reasoned Legal Conclusion","coreQuestion":"...","whyThisStep":"...","whatAdvocateDoes":"...","appliedExample":"State the conclusion for '${topic}' with statutory basis and case authority in 2-3 sentences","commonMistakes":["...","...","..."],"mentorNote":"...","transitionSentence":""}
  ],
  "finalMemo": {
    "legalIssue":"The precise legal question for '${topic}' as a court-level issue","areaOfLaw":"Area with specific Act name and year","governingStatutes":"Exact Act names with year — no placeholder phrases","relevantProvisions":"Section numbers with what each specifically provides for '${topic}'","leadingJudgments":"3-5 real cases: name, court, year, bench, ratio specific to '${topic}'","caseAnalysis":"How each case interprets the provisions for '${topic}'","applicationToFacts":"Statutory and case law applied directly to '${topic}'","conclusion":"Clear reasoned conclusion citing the specific statute and case authority","practicePoints":["3-4 practical tips specific to '${topic}' practice area — not generic advice"]
  }
}`;

    let sessionData: any = null;
    try {
      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: sessionPrompt }] }],
          generationConfig: { temperature: 0.3, responseMimeType: 'application/json', maxOutputTokens: 5000 },
        }),
      });
      const geminiData = await geminiRes.json();
      if (geminiRes.ok) {
        const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        try {
          // Strip markdown fences that some models emit despite responseMimeType: json
          const cleaned = rawText.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/m, '').trim();
          const parsed = JSON.parse(cleaned);
          if (parsed?.intro && Array.isArray(parsed?.stages) && parsed?.stages?.length >= 1 && parsed?.finalMemo) {
            sessionData = parsed;
          }
        } catch (parseErr) {
          console.error('[ResearchMentor] JSON parse error:', parseErr instanceof Error ? parseErr.message : parseErr);
        }
      } else {
        console.error('[ResearchMentor] Gemini error:', geminiData?.error?.message || geminiRes.status);
      }
    } catch (fetchErr) {
      console.error('[ResearchMentor] Fetch failed:', fetchErr instanceof Error ? fetchErr.message : fetchErr);
    }

    if (!sessionData) {
      const topicLower = topic.toLowerCase();
      let fbArea = 'Indian Law', fbStatute = 'the applicable Central or State Act', fbSections = 'relevant provisions', fbCases = 'leading Supreme Court judgments on this topic';
      if (/bail|anticipatory bail|custody|remand/.test(topicLower)) { fbArea = 'Criminal Procedure'; fbStatute = 'Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)'; fbSections = 'Sections 479–485'; fbCases = 'Gurbaksh Singh Sibbia v State of Punjab (1980) 2 SCC 565; Sushila Aggarwal v State (NCT of Delhi) (2020) 5 SCC 1'; }
      else if (/murder|theft|robbery|assault|bns|ipc|penal|criminal law/.test(topicLower)) { fbArea = 'Criminal Law'; fbStatute = 'Bharatiya Nyaya Sanhita, 2023 (BNS)'; fbSections = 'relevant BNS sections'; fbCases = 'Bachan Singh v State of Punjab (1980) 2 SCC 684'; }
      else if (/contract|agreement|offer|acceptance|consideration|breach/.test(topicLower)) { fbArea = 'Contract Law'; fbStatute = 'Indian Contract Act, 1872'; fbSections = 'Sections 2, 10, 14–16, 56, 73–74'; fbCases = 'Satyabrata Ghose v Mugneeram Bangur & Co (1954) SCR 310'; }
      else if (/constitution|fundamental rights|article 14|article 19|article 21|writ|habeas/.test(topicLower)) { fbArea = 'Constitutional Law'; fbStatute = 'Constitution of India, 1950'; fbSections = 'Part III (Articles 12–35)'; fbCases = 'Kesavananda Bharati v State of Kerala (1973) 4 SCC 225; Maneka Gandhi v Union of India (1978) 1 SCC 248'; }
      else if (/property|land|transfer|mortgage|lease|sale deed/.test(topicLower)) { fbArea = 'Property Law'; fbStatute = 'Transfer of Property Act, 1882'; fbSections = 'Sections 5, 54, 58, 105'; fbCases = 'leading SC judgments on transfer of property'; }
      else if (/divorce|marriage|matrimonial|custody|maintenance/.test(topicLower)) { fbArea = 'Family Law'; fbStatute = 'Hindu Marriage Act, 1955'; fbSections = 'Sections 5, 13, 24–25'; fbCases = 'Sarla Mudgal v Union of India (1995) 3 SCC 635'; }

      sessionData = {
        intro: {
          areaOfLaw: fbArea,
          explanation: `"${topic}" falls under ${fbArea} in India. The primary statute is the ${fbStatute}, which governs the rights, duties, and remedies relevant to this topic.`,
          importance: `Getting "${topic}" wrong can result in procedural defeat or loss of client rights — which is why precise statutory and judicial analysis is non-negotiable.`,
          mentorIntroduction: `Good question — "${topic}" is the kind of issue where most junior lawyers make avoidable errors by jumping straight to Google. The governing statute is the ${fbStatute}, and the leading cases have laid down specific rules. I am going to walk you through seven research stages, the same method I have used for 22 years at the Delhi High Court.`,
        },
        stages: STAGE_TITLES.map((title, i) => ({
          stepNumber: i + 1,
          title,
          coreQuestion: [
            `Whether a specific legal right or obligation arises under ${fbSections} of the ${fbStatute} for "${topic}"`,
            `Which provisions of the ${fbStatute} directly govern "${topic}"`,
            `What the exact words of ${fbSections} of the ${fbStatute} say about "${topic}"`,
            `Which SC/HC judgment most directly interprets ${fbSections} of the ${fbStatute}`,
            `What is the ratio decidendi of the leading case on "${topic}" and does it apply here`,
            `How do ${fbSections} of the ${fbStatute} and the case ratio resolve the specific facts of "${topic}"`,
            `What is the legally defensible conclusion on "${topic}" under ${fbStatute}`,
          ][i],
          whyThisStep: `This step is essential — skipping it leads to avoidable errors that experienced advocates spot immediately.`,
          whatAdvocateDoes: `A senior advocate follows a precise method at this stage, grounded in ${fbStatute}, to ensure research is defensible in court.`,
          appliedExample: [
            `The issue for "${topic}": Whether a specific legal right or obligation arises under ${fbSections} of the ${fbStatute}. Frame this as a court-level question, not a factual narrative.`,
            `The governing statute is the ${fbStatute}. The directly relevant provisions are ${fbSections}. Verify the current version — check for amendments since the original enactment.`,
            `Read ${fbSections} of the ${fbStatute} word by word. Start with the Definitions section, then the operative provision, then any provisos or exceptions that could reverse the main rule.`,
            `The leading cases on "${topic}" include: ${fbCases}. Search by section number + Act name on SCC Online or IndianKanoon. Prioritise Constitution Bench decisions.`,
            `From the leading case, extract the ratio decidendi — the binding rule laid down by the court. Ask: are the facts of "${topic}" similar enough for this ratio to govern, or are they distinguishable?`,
            `Apply IRAC to "${topic}": Issue — [from Stage 1]. Rule — ${fbSections} of the ${fbStatute} read with the case ratio. Application — do the specific facts satisfy each element?`,
            `State the conclusion for "${topic}" first, citing ${fbStatute} and the authority of ${fbCases}. Do not hedge unless there is a genuine conflict between benches.`,
          ][i],
          commonMistakes: ['Skipping this step and moving too quickly', 'Being too vague instead of citing specific provisions', 'Not documenting findings before moving to the next stage'],
          mentorNote: `Do not move to the next stage until this step is complete and documented in writing.`,
          transitionSentence: i < 6 ? `With this done, we move to ${STAGE_TITLES[i + 1].toLowerCase()}.` : '',
        })),
        finalMemo: {
          legalIssue: `Whether "${topic}" gives rise to a specific legal right or obligation under ${fbStatute}.`,
          areaOfLaw: fbArea,
          governingStatutes: `${fbStatute} — ${fbSections}`,
          relevantProvisions: `${fbSections} of the ${fbStatute}`,
          leadingJudgments: fbCases,
          caseAnalysis: `Ratio and application of the leading cases to the specific question raised by "${topic}" under ${fbStatute}.`,
          applicationToFacts: `Applying ${fbSections} of the ${fbStatute} and the case authority to the question: "${topic}" — the outcome turns on whether all statutory elements are satisfied on the specific facts.`,
          conclusion: `Based on ${fbStatute} and the leading authorities (${fbCases}), "${topic}" is governed by specific statutory conditions whose satisfaction must be established on the facts.`,
          practicePoints: ['Always verify the current statute version — check for amendments and notifications.', 'Prefer Supreme Court judgments over High Court decisions where both exist.', 'Note bench composition — a larger bench always overrides a smaller bench.', 'Date and sign your research notes — stale research is dangerous in practice.'],
        },
      };
    }

    const clerkUserId = getBearerSubject(req) || '';
    const sessionId = compactId('rms');
    const now = new Date().toISOString();
    await insertSupabase('research_mentor_sessions', {
      session_id: sessionId,
      user_id: clerkUserId,
      topic,
      session_data: sessionData,
      created_at: now,
    });

    return json(res, 200, { sessionId, topic, ...sessionData });
  }

  const mentorSessionGetMatch = route.match(/^legal-intelligence\/research-mentor\/session\/([^/]+)$/);
  if (mentorSessionGetMatch && req.method === 'GET') {
    const clerkUserId = getBearerSubject(req);
    if (!clerkUserId) return json(res, 401, { message: 'Unauthorized' });
    const sessionId = decodeURIComponent(mentorSessionGetMatch[1]);
    const result = await selectSupabase('research_mentor_sessions', `session_id=eq.${encodeURIComponent(sessionId)}&user_id=eq.${encodeURIComponent(clerkUserId)}&limit=1`);
    const row = Array.isArray(result.data) ? result.data[0] : null;
    if (!row) return json(res, 404, { message: 'Session not found' });
    return json(res, 200, { sessionId: row.session_id, topic: row.topic, ...row.session_data });
  }

  if (route === 'legal-intelligence/research-mentor/intro' && req.method === 'POST') {
    const body = await readBody(req);
    const topic = String(body.topic || '').trim();
    if (!topic) return json(res, 400, { message: 'Topic is required' });

    const apiKey = (globalThis as any).process?.env?.GEMINI_API_KEY;
    if (!apiKey || apiKey.includes('placeholder')) {
      return json(res, 400, { message: 'AI provider not configured. Missing GEMINI_API_KEY.' });
    }

    const STEP_NAMES = [
      'Identify the Legal Issue',
      'Identify Governing Law & Statute',
      'Read the Relevant Bare Act Provisions',
      'Find Leading Judgments',
      'Analyze the Cases',
      'Apply the Law to the Facts',
      'Reach a Reasoned Legal Conclusion',
    ];

    const introPrompt = `You are a senior advocate at a Delhi law firm mentoring a junior lawyer. The junior wants to research: "${topic}"

Respond ONLY with valid JSON (no markdown, no code block):
{
  "explanation": "2-3 sentences explaining this legal question in plain language a first-year law student can understand",
  "areaOfLaw": "The specific area of Indian law this belongs to (e.g., Contract Law, Constitutional Law, Criminal Law, Family Law)",
  "importance": "1-2 sentences on why this legal issue matters — what rights or disputes are at stake",
  "whatYouWillLearn": "One sentence on what researching this will teach about legal method",
  "step1Task": "A specific, actionable instruction for the first step (Identify the Legal Issue): ask the user to write the legal question as a precise 1-2 sentence legal issue statement, without googling cases yet. Tailor this instruction to the specific topic.",
  "step1Hint": "One practical hint about what a precise legal issue statement looks like for this topic"
}`;

    let introResult: any = {};
    try {
      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: introPrompt }] }],
          generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
        }),
      });
      const geminiData = await geminiRes.json();
      if (!geminiRes.ok) {
        const msg = geminiData.error?.message || 'AI provider error';
        if (geminiRes.status === 429) return json(res, 429, { message: 'AI quota exceeded. Please wait a minute and try again.' });
        return json(res, 500, { message: msg });
      }
      const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      try { introResult = JSON.parse(rawText); } catch { introResult = {}; }
    } catch (e: any) {
      return json(res, 500, { message: 'AI call failed: ' + e.message });
    }

    return json(res, 200, {
      explanation: String(introResult.explanation || `This question concerns the legal enforceability of "${topic}" under Indian law.`),
      areaOfLaw: String(introResult.areaOfLaw || 'Indian Law'),
      importance: String(introResult.importance || 'Understanding this issue is important for legal practice and research.'),
      whatYouWillLearn: String(introResult.whatYouWillLearn || 'You will learn structured legal research methodology applicable to any legal proposition.'),
      step1Task: String(introResult.step1Task || `Write the legal issue raised by "${topic}" as a precise legal question in 1-2 sentences. Do not search for cases or statutes yet — just identify the core legal question.`),
      step1Hint: String(introResult.step1Hint || 'A good legal issue statement identifies the legal right or rule in dispute, not just the facts of the situation.'),
      steps: STEP_NAMES,
    });
  }

  if (route === 'legal-intelligence/research-mentor/evaluate' && req.method === 'POST') {
    const body = await readBody(req);
    const topic = String(body.topic || '').trim();
    const stepNumber = Number(body.stepNumber || 1);
    const stepName = String(body.stepName || '');
    const userAnswer = String(body.userAnswer || '').trim();
    const isLastStep = Boolean(body.isLastStep);

    if (!topic || !userAnswer) return json(res, 400, { message: 'topic and userAnswer are required' });

    const apiKey = (globalThis as any).process?.env?.GEMINI_API_KEY;
    if (!apiKey || apiKey.includes('placeholder')) {
      return json(res, 400, { message: 'AI provider not configured. Missing GEMINI_API_KEY.' });
    }

    const ALL_STEPS = [
      'Identify the Legal Issue',
      'Identify Governing Law & Statute',
      'Read the Relevant Bare Act Provisions',
      'Find Leading Judgments',
      'Analyze the Cases',
      'Apply the Law to the Facts',
      'Reach a Reasoned Legal Conclusion',
    ];
    const nextStepName = stepNumber < 7 ? ALL_STEPS[stepNumber] : '';

    const nextStepField = !isLastStep
      ? `"nextStepTask": "A specific task instruction for Step ${stepNumber + 1} (${nextStepName}) tailored to the topic \\"${topic}\\". Include only if isCorrect is true, otherwise empty string.",
  "nextStepHint": "A brief practical hint for Step ${stepNumber + 1}. Include only if isCorrect is true, otherwise empty string."`
      : `"nextStepTask": "",
  "nextStepHint": ""`;

    const summaryField = isLastStep
      ? `,
  "finalSummary": {
    "legalIssue": "The precise legal issue",
    "applicableStatutes": "Primary statutes governing this topic in India",
    "relevantSections": "Key sections/articles from those statutes",
    "leadingJudgments": "2-3 leading Supreme Court or High Court judgments with brief citation",
    "ratioDecidendi": "The core legal principle(s) established by those judgments",
    "applicationToFacts": "How the law applies to the original question",
    "reasonedConclusion": "The legal conclusion with reasoning",
    "keyLearnings": ["Learning 1", "Learning 2", "Learning 3"]
  }`
      : '';

    const evalPrompt = `You are a senior advocate reviewing a junior lawyer's research answer. Be pedagogically honest but encouraging.

Research Topic: "${topic}"
Step ${stepNumber}/7: ${stepName}
Junior's Answer: "${userAnswer.slice(0, 600)}"

Evaluate whether this answer demonstrates genuine understanding of "${stepName}" for this topic.
Accept answers that show real legal reasoning and effort even if imperfect.
Reject only if the answer is clearly wrong, off-topic, or too vague to demonstrate any understanding (e.g. "I don't know", single word, unrelated topic).${isLastStep ? '\nSince this is Step 7 (final step), if isCorrect is true, generate a complete finalSummary for the topic.' : ''}

Respond ONLY with valid JSON:
{
  "isCorrect": true or false,
  "feedback": "2-3 sentences of warm, specific mentor-style feedback addressing their answer directly",
  "strengths": "What they got right in 1-2 sentences. Empty string if nothing notable.",
  "improvements": "What specifically needs to be added or corrected in 1-2 sentences. Empty string if isCorrect is true.",
  ${nextStepField}${summaryField}
}`;

    let evalResult: any = {};
    try {
      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: evalPrompt }] }],
          generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
        }),
      });
      const geminiData = await geminiRes.json();
      if (!geminiRes.ok) {
        const msg = geminiData.error?.message || 'AI provider error';
        if (geminiRes.status === 429) return json(res, 429, { message: 'AI quota exceeded. Please wait a minute and try again.' });
        return json(res, 500, { message: msg });
      }
      const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      try { evalResult = JSON.parse(rawText); } catch { evalResult = {}; }
    } catch (e: any) {
      return json(res, 500, { message: 'AI evaluation failed: ' + e.message });
    }

    return json(res, 200, {
      isCorrect: Boolean(evalResult.isCorrect),
      feedback: String(evalResult.feedback || 'Please review your answer and try again.'),
      strengths: String(evalResult.strengths || ''),
      improvements: String(evalResult.improvements || ''),
      nextStepTask: String(evalResult.nextStepTask || ''),
      nextStepHint: String(evalResult.nextStepHint || ''),
      finalSummary: evalResult.finalSummary || null,
    });
  }

  if (route === 'legal-intelligence/research-guide' && req.method === 'POST') {
    const body = await readBody(req);
    const proposition = String(body.proposition || 'the legal proposition').trim();
    const labels = [
      'Define legal issues',
      'Identify applicable statutes',
      'Recommend Bare Acts',
      'Recommend Sections',
      'Recommend Supreme Court Judgments',
      'Recommend High Court Judgments',
      'Recommend Constitutional Articles',
      'Recommend Law Commission Reports',
      'Recommend Legal Journals',
      'Recommend Commentaries',
      'Explain search methodology',
      'Explain hierarchy of authorities',
      'Explain primary vs secondary sources',
      'Explain how to prepare research notes',
      'Explain how to structure the final research paper',
    ];
    return json(res, 200, {
      proposition,
      researchObjective: `Learn how to research "${proposition}" through primary law first, then persuasive and secondary materials.`,
      steps: labels.map((title, index) => ({
        step: index + 1,
        title,
        professorGuidance: `${title} for "${proposition}" by recording what source you checked, why it is authoritative, and how it narrows the next search.`,
        output: index < 4 ? 'Issue and statute map' : index < 10 ? 'Authority list with relevance notes' : 'Research workflow artifact',
      })),
      recommendedSearchQueries: [`"${proposition}" Supreme Court India`, `"${proposition}" bare act section`, `"${proposition}" Law Commission report`, `"${proposition}" High Court judgment`],
      authorityHierarchy: ['Constitution', 'Statutes and Rules', 'Larger Bench Supreme Court', 'Coordinate Bench Supreme Court', 'Jurisdictional High Court', 'Persuasive High Courts', 'Tribunals', 'Commentaries and journals'],
      noteTakingTemplate: ['Issue', 'Rule', 'Authority', 'Court/bench strength', 'Facts', 'Ratio', 'Limitations', 'Use in paper'],
      finalPaperStructure: ['Introduction', 'Issues', 'Statutory framework', 'Case law development', 'Analysis', 'Counter-view', 'Conclusion', 'Bibliography'],
      provider: 'vercel-compat',
    });
  }

  if (route === 'legal-intelligence/drafting/check' && req.method === 'POST') {
    const body = await readBody(req);
    const text = String(body.text || '').trim();
    const words = text.split(/\s+/).filter(Boolean).length;
    const hasClauses = /\b(whereas|therefore|clause|party|obligation|termination|jurisdiction|signature)\b/i.test(text);
    const score = Math.max(35, Math.min(88, 45 + Math.floor(words / 25) + (hasClauses ? 18 : 0)));
    return json(res, 200, {
      overallScore: score,
      sectionScores: {
        grammar: Math.min(90, score + 4),
        formatting: hasClauses ? 78 : 52,
        legalLanguage: hasClauses ? 82 : 58,
        structure: hasClauses ? 80 : 50,
        citationQuality: /\b(AIR|SCC|Section|Article)\b/i.test(text) ? 76 : 42,
      },
      lineSuggestions: [
        { line: 1, issue: 'Opening should identify parties, date, capacity, and governing document type clearly.' },
        { line: 2, issue: 'Use numbered clauses and avoid long mixed-purpose paragraphs.' },
      ],
      highlightedErrors: words < 80 ? ['Draft is too short for a complete legal review.'] : [],
      missingClauses: hasClauses ? ['Confidentiality, dispute resolution, notices, governing law if applicable.'] : ['Definitions, obligations, remedies, termination, jurisdiction, signature block.'],
      improvedDraft: text ? `${text}\n\n[Suggested professional polish]\nUse numbered clauses, define key terms, state obligations precisely, add remedies, and close with jurisdiction and execution blocks.` : '',
      professionalFeedback: 'The draft should be tightened into a clause-based legal structure with defined parties, precise obligations, remedies, and consistent formatting.',
      riskLevel: score >= 75 ? 'Low' : score >= 55 ? 'Medium' : 'High',
      provider: 'vercel-compat',
    });
  }

  if (route === 'legal-intelligence/drafting/courses' && req.method === 'GET') {
    return json(res, 200, []);
  }

  if (route === 'legal-intelligence/drafting/admin/courses' && req.method === 'POST') {
    const body = await readBody(req);
    return json(res, 200, {
      id: compactId('course'),
      title: body.title || 'Untitled Drafting Course',
      category: body.category || 'Contract Drafting',
      contentType: body.contentType || 'Recorded Lecture',
      resourceUrl: body.resourceUrl || '',
      description: body.description || '',
      status: body.status || 'draft',
      createdAt: new Date().toISOString(),
    });
  }
  if (route === 'settings/dashboard' && req.method === 'GET') {
    const clerkUserId = getBearerSubject(req);
    if (!clerkUserId) {
      return json(res, 200, emptyDashboard());
    }
    try {
      const data = await getDashboardData(clerkUserId);
      return json(res, 200, data);
    } catch {
      return json(res, 200, emptyDashboard());
    }
  }

  if (route === 'settings/profile' && req.method === 'PUT') {
    const clerkUserId = getBearerSubject(req);
    if (!clerkUserId) {
      return json(res, 401, { message: 'Unauthorized' });
    }
    try {
      const body = await readBody(req);
      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (body.fullName !== undefined) updatePayload.full_name = body.fullName;
      if (body.phoneNumber !== undefined) updatePayload.phone_number = body.phoneNumber;
      if (body.universityName !== undefined) updatePayload.university_name = body.universityName;
      if (body.semesterYear !== undefined) updatePayload.semester_year = body.semesterYear;
      if (body.email !== undefined) updatePayload.email = body.email;
      if (body.avatarUrl !== undefined) updatePayload.avatar_url = body.avatarUrl;

      const result = await updateSupabase('users', `clerk_user_id=eq.${clerkUserId}`, updatePayload);
      if (result.ok) {
        return json(res, 200, { success: true, data: result.data });
      } else {
        return json(res, 500, { message: 'Failed to update profile', error: result.error });
      }
    } catch (error: any) {
      return json(res, 500, { message: 'Internal server error', error: error.message });
    }
  }


  if (route === 'learning-progress/dashboard' && req.method === 'GET') {
    const clerkUserId = getBearerSubject(req);
    if (!clerkUserId) return json(res, 401, { message: 'Unauthorized' });
    const data = await getLearningProgressData(clerkUserId);
    return json(res, 200, data);
  }

  if (route === 'learning-progress/upload' && req.method === 'POST') {
    const clerkUserId = getBearerSubject(req);
    if (!clerkUserId) return json(res, 401, { message: 'Unauthorized' });
    const body = await readBody(req);
    const fileName = String(body.fileName || body.name || 'Uploaded Study Material');
    const fileType = String(body.fileType || body.type || '').toLowerCase();
    const allowed = ['pdf', 'docx', 'txt', 'pptx'];
    const normalizedType = allowed.find((type) => fileType.includes(type)) || fileName.split('.').pop()?.toLowerCase() || 'pdf';
    if (!allowed.includes(normalizedType)) {
      return json(res, 400, { message: 'Unsupported study material type. Upload PDF, DOCX, TXT, or PPTX.' });
    }
    const now = new Date().toISOString();
    const material = {
      user_id: clerkUserId,
      title: fileName,
      file_name: fileName,
      file_type: normalizedType,
      file_size: Number(body.fileSize || 0),
      status: 'indexed',
      created_at: now,
      updated_at: now,
    };
    const insert = await insertSupabase('study_materials', material);
    if (!insert.ok) {
      return json(res, 500, { message: 'Study material could not be saved.', error: insert.error || insert.data });
    }
    return json(res, 200, { success: true, material: insert.data?.[0] || material, processing: ['Analyzing Legal Content', 'Extracting Topics', 'Identifying Bare Acts', 'Building Mind Map', 'Updating Preparation Profile'] });
  }

  if (route === 'learning-progress/weak-topics' && req.method === 'GET') {
    const clerkUserId = getBearerSubject(req);
    if (!clerkUserId) return json(res, 401, { message: 'Unauthorized' });
    const data = await getLearningProgressData(clerkUserId);
    return json(res, 200, { weakAreas: data.weakAreas });
  }

  if (route === 'learning-progress/exam-readiness' && req.method === 'GET') {
    const clerkUserId = getBearerSubject(req);
    if (!clerkUserId) return json(res, 401, { message: 'Unauthorized' });
    const data = await getLearningProgressData(clerkUserId);
    return json(res, 200, { readiness: data.readiness });
  }

  if (route === 'learning-progress/mastery' && req.method === 'GET') {
    const clerkUserId = getBearerSubject(req);
    if (!clerkUserId) return json(res, 401, { message: 'Unauthorized' });
    const data = await getLearningProgressData(clerkUserId);
    return json(res, 200, { mindMaps: data.mindMaps, bareActCoverage: data.bareActCoverage });
  }

  if (route === 'learning-progress/performance' && req.method === 'GET') {
    const clerkUserId = getBearerSubject(req);
    if (!clerkUserId) return json(res, 401, { message: 'Unauthorized' });
    const data = await getLearningProgressData(clerkUserId);
    return json(res, 200, { todaysTasks: data.todaysTasks, revisionQueue: data.revisionQueue });
  }

  if (route === 'student-verification/status' && req.method === 'GET') {
    return json(res, 200, { status: 'Not Submitted', request: null });
  }

  if ((route === 'settings/login' || route === 'settings/logout') && req.method === 'POST') {
    return json(res, 200, { success: true });
  }

  if (route === 'settings/activity' && req.method === 'POST') {
    const body = await readBody(req);
    const metadata = body.metadata || {};
    const userId = body.userId || body.user_id || metadata.userId || 'production-user';
    const moduleName = body.module || body.moduleName || body.module_name || 'LEGATRIXON';
    const actionType = body.action || body.actionType || body.action_type || 'Activity';
    const insert = await insertSupabase('user_activity_logs', {
      user_id: userId,
      module: moduleName,
      action: actionType,
      module_name: moduleName,
      action_type: actionType,
      session_id: metadata.sessionId || body.sessionId || null,
      created_at: new Date().toISOString(),
    });

    return json(res, 200, { success: true, supabase: insert });
  }

  if (route === 'chat/message' && req.method === 'POST') {
    const body = await readBody(req);
    const sessionId = body.sessionId || `session_${Math.random().toString(36).slice(2, 11)}`;
    const messageId = `msg_${Math.random().toString(36).slice(2, 11)}`;
    const content = localLexMentorReply(String(body.message || ''), String(body.depth || 'Intermediate'));

    await insertSupabase('user_activity_logs', {
      user_id: 'production-user',
      module: 'LexMentor AI',
      action: 'Asked Question',
      module_name: 'LexMentor AI',
      action_type: 'Asked Question',
      session_id: sessionId,
      created_at: new Date().toISOString(),
    });

    return json(res, 200, {
      sessionId,
      messageId,
      content,
      citations: [],
      provider: 'vercel-compat',
      model: 'local-production-fallback',
    });
  }

  if (route === 'settings/feedback/my' && req.method === 'GET') {
    return json(res, 200, []);
  }

  if (route === 'settings/feedback/community' && req.method === 'GET') {
    return json(res, 200, []);
  }

  // ─── AI Legal Research Assistant ──────────────────────────────────────────
  if (route === 'legal-intelligence/research-assistant/conduct' && req.method === 'POST') {
    const body = await readBody(req);
    const question = String(body.question || '').trim();
    if (!question) return json(res, 400, { message: 'Question is required' });

    const apiKey = (globalThis as any).process?.env?.GEMINI_API_KEY;
    if (!apiKey || apiKey.includes('placeholder')) {
      return json(res, 400, { message: 'GEMINI_API_KEY is not configured on this deployment.' });
    }

    // ── Execution Audit scaffolding ──────────────────────────────────────────
    const executionId = compactId('exec');
    const correlationId = compactId('corr');
    const pipelineStart = Date.now();

    const STAGE_NAMES: Record<number, string> = {
      1: 'Understand Question', 2: 'Design Research Strategy', 3: 'Statutory Research',
      4: 'Bare Act Reading', 5: 'Case Law Research', 6: 'Academic Research',
      7: 'Conflict Analysis', 8: 'Comparative Law', 9: 'Professional Legal Reasoning',
      10: 'Professional Research Memorandum', 11: 'Final Memorandum Assembly',
    };

    const auditStages = Object.entries(STAGE_NAMES).map(([num, name]) => ({
      stageNumber: Number(num), stageName: name, status: 'WAITING',
      startTime: null as number | null, endTime: null as number | null, durationMs: null as number | null,
      provider: 'Gemini', model: 'gemini-2.5-flash',
      promptTokens: 0, completionTokens: 0, totalTokens: 0,
      retryCount: 0, fallbackUsed: false, error: null as string | null,
    }));

    const raClassifyRootCause = (msg: string): string => {
      const m = msg.toLowerCase();
      if (m.includes('429') || m.includes('rate limit') || m.includes('quota') || m.includes('resource_exhausted')) return 'RATE_LIMIT_EXCEEDED';
      if (m.includes('401') || m.includes('api key') || m.includes('authentication') || m.includes('unauthorized')) return 'INVALID_API_KEY';
      if (m.includes('timeout') || m.includes('abort') || m.includes('timed out')) return 'PROVIDER_TIMEOUT';
      if (m.includes('context') || m.includes('too long') || m.includes('maximum context')) return 'CONTEXT_WINDOW_EXCEEDED';
      if (m.includes('json') || m.includes('parse') || m.includes('syntaxerror')) return 'JSON_PARSE_FAILURE';
      if (m.includes('503') || m.includes('overload') || m.includes('unavailable')) return 'PROVIDER_OVERLOADED';
      if (m.includes('network') || m.includes('fetch') || m.includes('econnrefused')) return 'NETWORK_ERROR';
      if (m.includes('stages') || m.includes('incomplete') || m.includes('schema')) return 'SCHEMA_VALIDATION_FAILURE';
      return 'UNKNOWN_FAILURE';
    };

    const raGetRecommendation = (rc: string): string => ({
      RATE_LIMIT_EXCEEDED: 'Enable billing at console.cloud.google.com/billing or create a new Gemini project with fresh quota',
      INVALID_API_KEY: 'Set a valid GEMINI_API_KEY in your Vercel environment variables (aistudio.google.com/app/apikey)',
      PROVIDER_TIMEOUT: 'The Gemini API was temporarily slow — retry immediately',
      CONTEXT_WINDOW_EXCEEDED: 'Narrow the research question to a more specific legal issue',
      JSON_PARSE_FAILURE: 'Gemini returned malformed JSON — retry the research',
      PROVIDER_OVERLOADED: 'Wait 60 seconds then retry — Gemini is under high load',
      NETWORK_ERROR: 'Check the deployment environment network connectivity',
      SCHEMA_VALIDATION_FAILURE: 'Gemini returned fewer than 10 stages or omitted finalMemorandum — retry',
    }[rc] || 'Retry the research or contact LEGATRIXON support');

    const raGetNextAction = (rc: string): string => ({
      RATE_LIMIT_EXCEEDED: 'Open console.cloud.google.com → Billing → Link billing account to Gemini project',
      INVALID_API_KEY: 'Open Vercel dashboard → Settings → Environment Variables → update GEMINI_API_KEY',
      PROVIDER_TIMEOUT: 'Click Retry Research',
      JSON_PARSE_FAILURE: 'Click Retry Research',
      PROVIDER_OVERLOADED: 'Wait 60 seconds, then click Retry Research',
      NETWORK_ERROR: 'Check Vercel function logs for connectivity errors',
    }[rc] || 'Click Retry Research');

    const buildAuditFailureResponse = (failedStageNum: number, errorMsg: string) => {
      const rootCause = raClassifyRootCause(errorMsg);
      auditStages.forEach(s => {
        if (s.stageNumber === failedStageNum) { s.status = 'FAILED'; s.error = errorMsg; }
        else if (s.stageNumber > failedStageNum) { s.status = 'SKIPPED'; }
        else if (s.status === 'WAITING' || s.status === 'RUNNING') { s.status = 'SKIPPED'; }
      });
      return {
        executionStatus: 'FAILED',
        executionAudit: {
          executionId, correlationId,
          overallStatus: 'FAILED',
          progress: Math.round(((failedStageNum - 1) / 11) * 100),
          executionTimeMs: Date.now() - pipelineStart,
          failureBatch: 'Single-Call Pipeline (Gemini)',
          failureStage: STAGE_NAMES[failedStageNum] || 'Research Pipeline',
          failureStageIndex: failedStageNum,
          failureCategory: rootCause.replace(/_/g, ' '),
          rootCause,
          errorMessage: errorMsg,
          retryAttempts: 1,
          fallbackAttempted: false,
          recoverySucceeded: false,
          recommendation: raGetRecommendation(rootCause),
          nextAction: raGetNextAction(rootCause),
          stages: auditStages,
        },
      };
    };

    // ── Mark all stages as running ───────────────────────────────────────────
    const callStart = Date.now();
    auditStages.forEach(s => { s.status = 'RUNNING'; s.startTime = callStart; });

    const assistantPrompt = `You are LEGATRIXON Deep Legal Research Engine. Act like a Supreme Court senior advocate supervising a top-tier law-firm junior associate. Perform genuine legal research, not template drafting.

Research assignment: "${question}"

Return strict JSON only. No markdown fences. No placeholder text. No bracketed examples. No generic filler. Every legal proposition must cite a named authority: constitutional article, statutory provision, rule, regulation, notification, case citation, Law Commission Report, committee report, book, article, government report, Constituent Assembly Debate, or comparative-law authority.

Return exactly 10 chronological notebook stages plus a final memorandum. Each stage object must have: stageNumber, title, status, timeSpentMinutes, sourcesFound, summary, researchNotes, authoritiesAnalysed, caseAnalyses, statutoryFindings, keyObservations, professionalInsights, sources, nextStep.

Stage requirements:
1. Understand the Question: at least 800 words; explain exact question, legal issues, primary/secondary issues, doctrines, assumptions not to make, missing facts and why.
2. Design Research Strategy: at least 1000 words; keywords, synonyms, Latin maxims, Boolean queries, official/academic databases, search order and why each search is useful.
3. Statutory Research: at least 1500 words; Constitution articles, Acts, Rules, Regulations, Notifications, Schedules, delegated legislation, purpose, history, object, exceptions and cross references.
4. Bare Act Reading: at least 2000 words; explain every relevant provision in plain English with intent, ingredients, scope, exceptions, judicial interpretation, illustrations and practical application.
5. Case Law Research: at least 3000 words; for each important case include facts, issues, arguments, reasoning, ratio, obiter, holding, later treatment, followed/distinguished/overruled status, current position and why it matters.
6. Academic Research: at least 2000 words; Law Commission Reports, papers, commentaries, books, committee reports, Constituent Assembly Debates and government reports; explain disagreements and criticisms.
7. Conflict Analysis: at least 1500 words; conflicting precedents, High Court splits, majority/minority views, academic disagreement, grey areas and unresolved constitutional questions.
8. Comparative Law: at least 2000 words; India, UK, US, Canada, Australia, Singapore and EU; framework, advantages, weaknesses and lessons for India.
9. Professional Legal Reasoning: at least 2000 words; strengths, weaknesses, constitutional concerns, policy implications, future litigation, strategy, alternative interpretation and likely outcome.
10. Professional Research Memorandum: researchNotes should summarize drafting work; finalMemorandum must be at least 5000 words with executiveSummary, researchQuestion, issues, applicableLaw, statutoryAnalysis, caseLawAnalysis, academicAnalysis, comparativeAnalysis, arguments, counterArguments, criticalEvaluation, conclusion, futureDevelopments, bibliography and OSCOLA footnotes.

If a fact or authority cannot be verified from your legal knowledge, say so expressly and identify the verification step required. Do not fabricate certainty.`;

    let geminiErrorMsg = '';
    let parsed: any = null;

    try {
      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: assistantPrompt }] }],
          generationConfig: { temperature: 0.3, responseMimeType: 'application/json', maxOutputTokens: 60000 },
        }),
      });
      const geminiData = await geminiRes.json();

      if (!geminiRes.ok) {
        geminiErrorMsg = geminiData?.error?.message || `Gemini HTTP ${geminiRes.status}`;
        console.error('[ResearchAssistant] Gemini API error:', geminiErrorMsg);
        return json(res, 200, buildAuditFailureResponse(1, geminiErrorMsg));
      }

      const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!rawText) {
        geminiErrorMsg = 'Gemini returned an empty response body';
        return json(res, 200, buildAuditFailureResponse(1, geminiErrorMsg));
      }

      const cleaned = rawText.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/m, '').trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        geminiErrorMsg = `JSON parse failure: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`;
        return json(res, 200, buildAuditFailureResponse(1, geminiErrorMsg));
      }
    } catch (fetchErr) {
      geminiErrorMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.error('[ResearchAssistant] Fetch failed:', geminiErrorMsg);
      return json(res, 200, buildAuditFailureResponse(1, geminiErrorMsg));
    }

    // ── Schema validation ────────────────────────────────────────────────────
    if (!parsed?.stages || !Array.isArray(parsed.stages) || parsed.stages.length < 10) {
      const got = parsed?.stages?.length ?? 0;
      return json(res, 200, buildAuditFailureResponse(
        got > 0 ? got + 1 : 1,
        `Schema validation: expected 10 stages, received ${got}`,
      ));
    }
    if (!parsed.finalMemorandum) {
      return json(res, 200, buildAuditFailureResponse(11, 'Schema validation: finalMemorandum missing from Gemini response'));
    }

    // ── Mark all stages completed ────────────────────────────────────────────
    const callEnd = Date.now();
    auditStages.forEach(s => { s.status = 'COMPLETED'; s.endTime = callEnd; s.durationMs = callEnd - callStart; });

    return json(res, 200, {
      executionStatus: 'SUCCESS',
      sessionId: compactId('ra'),
      ...parsed,
      executionAudit: {
        executionId, correlationId,
        overallStatus: 'SUCCESS',
        progress: 100,
        executionTimeMs: Date.now() - pipelineStart,
        stages: auditStages,
      },
    });
  }

  return json(res, 404, {
    message: `Production API route not implemented: ${req.method} /api/v1/${route}`,
  });
}
