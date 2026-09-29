"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var LearningWorkspaceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LearningWorkspaceService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const AdmZip = require("adm-zip");
const axios_1 = require("axios");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const learning_workspace_entities_1 = require("./learning-workspace.entities");
const qdrant_service_1 = require("../retrieval/qdrant.service");
const bge_m3_provider_1 = require("../retrieval/bge-m3.provider");
const embedding_service_1 = require("../retrieval/embedding.service");
const notification_service_1 = require("../exam/notification.service");
const ANSWER_MODE_LIMITS = {
    '10 Marks': '1200-1800 words',
    '15 Marks': '1800-2500 words',
    '20 Marks': '2500-3500 words',
    'Judiciary Style': '3000-4500 words',
    'Long Descriptive': '2500-3500 words',
};
function normalizeMockAnswerMode(mode, defaultMarks = 15) {
    const m = String(mode || '').toLowerCase();
    if (m.includes('10 mark') || m === '10m')
        return '10 Marks';
    if (m.includes('15 mark') || m === '15m')
        return '15 Marks';
    if (m.includes('20 mark') || m === '20m')
        return '20 Marks';
    if (m.includes('judiciary'))
        return 'Judiciary Style';
    if (m.includes('long descriptive') || m.includes('long'))
        return 'Long Descriptive';
    if (defaultMarks === 10)
        return '10 Marks';
    if (defaultMarks === 15)
        return '15 Marks';
    if (defaultMarks === 20)
        return '20 Marks';
    return '15 Marks';
}
function getQuestionDetailedAnswer(q) {
    if (!q)
        return null;
    if (q.generatedAnswers && typeof q.generatedAnswers === 'object') {
        const keys = Object.keys(q.generatedAnswers);
        if (keys.length > 0) {
            return q.generatedAnswers[keys[0]];
        }
    }
    if (q.modelAnswer) {
        return {
            modelAnswer: q.modelAnswer,
            importantJudgments: q.importantJudgments || (q.caseReferences ? [q.caseReferences] : []),
            relevantArticles: q.relevantArticles || [],
            relevantSections: q.relevantSections || [],
            sourcesUsed: q.sourcesUsed || (q.citations ? q.citations.map((c) => c.sourceName) : [])
        };
    }
    return null;
}
let LearningWorkspaceService = LearningWorkspaceService_1 = class LearningWorkspaceService {
    constructor(sourceRepo, mockRepo, attemptRepo, mindMapRepo, studyKitRepo, flashcardReviewRepo, activityRepo, qdrantService, bgeM3Provider, embeddingService, notificationService) {
        this.sourceRepo = sourceRepo;
        this.mockRepo = mockRepo;
        this.attemptRepo = attemptRepo;
        this.mindMapRepo = mindMapRepo;
        this.studyKitRepo = studyKitRepo;
        this.flashcardReviewRepo = flashcardReviewRepo;
        this.activityRepo = activityRepo;
        this.qdrantService = qdrantService;
        this.bgeM3Provider = bgeM3Provider;
        this.embeddingService = embeddingService;
        this.notificationService = notificationService;
        this.logger = new common_1.Logger(LearningWorkspaceService_1.name);
        this.queue = [];
        this.activeIndexingWorkers = 0;
        this.maxIndexingWorkers = Number(process.env.LEARNING_INDEXING_CONCURRENCY || 2);
        this.isProcessingQueue = false;
        this.isIndexingPaused = false;
        this.userDocumentsCollection = 'user_documents';
    }
    async onModuleInit() {
        this.logger.log('Initializing background indexing queue...');
        try {
            await this.sourceRepo.update({ status: 'Processing' }, { status: 'Queued', indexingProgress: 0 });
            const queuedSources = await this.sourceRepo.find({ where: { status: 'Queued' }, order: { createdAt: 'ASC' } });
            for (const src of queuedSources) {
                this.addToQueue(src.id);
            }
            this.logger.log(`Added ${queuedSources.length} queued sources to the background indexing queue.`);
        }
        catch (err) {
            this.logger.error(`Error onModuleInit background queue: ${err.message}`);
        }
    }
    pauseIndexing() {
        this.isIndexingPaused = true;
        this.logger.log('Indexing queue paused by user.');
        return { success: true, status: 'paused' };
    }
    resumeIndexing() {
        this.isIndexingPaused = false;
        this.logger.log('Indexing queue resumed by user.');
        this.processNextInQueue();
        return { success: true, status: 'running' };
    }
    getIndexingStatus() {
        return {
            paused: this.isIndexingPaused,
            queueLength: this.queue.length,
            isProcessing: this.activeIndexingWorkers > 0,
            activeWorkers: this.activeIndexingWorkers,
            maxWorkers: this.maxIndexingWorkers
        };
    }
    addToQueue(sourceId) {
        if (!this.queue.includes(sourceId)) {
            this.queue.push(sourceId);
        }
        this.processNextInQueue();
    }
    async processNextInQueue() {
        if (this.isIndexingPaused) {
            this.logger.log('Queue processing is paused. Sleeping.');
            return;
        }
        while (this.activeIndexingWorkers < this.maxIndexingWorkers && this.queue.length > 0) {
            const nextId = this.queue.shift();
            this.activeIndexingWorkers += 1;
            this.isProcessingQueue = true;
            void this.processQueuedSource(nextId)
                .catch((err) => {
                this.logger.error(`Error processing queued source ${nextId}: ${err.message}`, err.stack);
            })
                .finally(() => {
                this.activeIndexingWorkers = Math.max(0, this.activeIndexingWorkers - 1);
                this.isProcessingQueue = this.activeIndexingWorkers > 0;
                setTimeout(() => this.processNextInQueue(), 50);
            });
        }
    }
    async processQueuedSource(sourceId) {
        const source = await this.sourceRepo.findOne({ where: { id: sourceId } });
        if (!source)
            return;
        this.logger.log(`[Queue Worker] Processing source ${sourceId}: "${source.name}"`);
        try {
            source.status = 'Processing';
            source.indexingProgress = 10;
            await this.sourceRepo.save(source);
            let text = source.text;
            const hasOriginalFile = source.storagePath && fs.existsSync(source.storagePath);
            if ((!text || text.trim().length < 40 || text.includes('OCR pending') || text.includes('Text extraction and indexing pending')) && hasOriginalFile) {
                const buffer = fs.readFileSync(source.storagePath);
                const ext = path.extname(source.storagePath).substring(1).toLowerCase();
                text = await this.ocrAndExtractText(buffer, ext, source.name);
                source.text = text;
                source.textLength = text.length;
                source.indexingProgress = 40;
                await this.sourceRepo.save(source);
            }
            if (!text || text.trim().length === 0) {
                throw new Error('Extracted text is empty or could not be read.');
            }
            const extractedWordCount = text.trim().split(/\s+/).filter(Boolean).length;
            const insufficientForMockTest = extractedWordCount < 800;
            const insufficientForLongAnswers = extractedWordCount < 3000;
            const fileHash = crypto.createHash('sha256').update(text).digest('hex');
            let isDuplicate = false;
            let existingSource = null;
            const allIndexedSources = await this.sourceRepo.find({
                where: { userId: source.userId, status: 'Indexed' }
            });
            for (const idxSrc of allIndexedSources) {
                const idxHash = idxSrc.metadata?.contentHash || crypto.createHash('sha256').update(idxSrc.text).digest('hex');
                if (idxHash === fileHash) {
                    isDuplicate = true;
                    existingSource = idxSrc;
                    break;
                }
            }
            if (isDuplicate && existingSource) {
                this.logger.log(`[Queue Worker] Duplicate document detected. Reusing vectors from ${existingSource.id}`);
                source.vectorId = existingSource.vectorId;
                source.status = 'Indexed';
                source.indexingProgress = 100;
                source.subject = existingSource.subject;
                source.unit = existingSource.unit;
                source.topic = existingSource.topic;
                source.documentType = existingSource.documentType;
                source.kind = existingSource.kind;
                source.metadata = {
                    ...(source.metadata || {}),
                    contentHash: fileHash,
                    isDuplicate: true,
                    duplicateOf: existingSource.id,
                    extractedWordCount: existingSource.metadata?.extractedWordCount || extractedWordCount,
                    insufficientForMockTest: existingSource.metadata?.insufficientForMockTest ?? insufficientForMockTest,
                    insufficientForLongAnswers: existingSource.metadata?.insufficientForLongAnswers ?? insufficientForLongAnswers
                };
                const duplicateVectorId = await this.copySourceVectors(existingSource.id, source.id, source.userId);
                if (duplicateVectorId) {
                    source.vectorId = duplicateVectorId;
                    source.metadata = {
                        ...(source.metadata || {}),
                        duplicateVectorsCopied: true,
                        originalVectorId: existingSource.vectorId,
                    };
                }
                else {
                    this.logger.warn(`[Queue Worker] Duplicate source ${source.id} will reuse source filter ${existingSource.id}`);
                }
                await this.sourceRepo.save(source);
                await this.notificationService.createNotification(source.userId, `Indexing Complete (Duplicate Saved)`, `"${source.name}" duplicates "${existingSource.name}". We grouped them together.`);
                return;
            }
            source.indexingProgress = 60;
            await this.sourceRepo.save(source);
            const smart = this.detectStudyMetadata(source.name, text, source.kind);
            source.subject = smart.subject;
            source.unit = smart.unit;
            source.topic = smart.topic;
            source.documentType = smart.documentType;
            source.kind = smart.kind;
            source.metadata = {
                ...(source.metadata || {}),
                contentHash: fileHash,
                ...smart,
                classificationMode: 'fast-local',
                extractedWordCount,
                insufficientForMockTest,
                insufficientForLongAnswers
            };
            source.indexingProgress = 80;
            await this.sourceRepo.save(source);
            const vectorId = await this.embedAndStoreInQdrant(source.id, source.userId, text, source.kind, {
                name: source.name,
                kind: source.kind,
                documentType: source.documentType,
                subject: source.subject,
                unit: source.unit,
                topic: source.topic,
            });
            if (!vectorId) {
                throw new Error('Vector store generation returned empty ID.');
            }
            source.vectorId = vectorId;
            source.status = 'Indexed';
            source.indexingProgress = 100;
            await this.sourceRepo.save(source);
            this.logger.log(`[Queue Worker] Successfully indexed source ${sourceId}`);
            await this.notificationService.createNotification(source.userId, `Indexing Complete: ${source.name}`, `"${source.name}" has been indexed under "${source.subject || 'General'}" -> "${source.topic || 'General'}"`);
        }
        catch (err) {
            this.logger.error(`[Queue Worker] Failed to index source ${sourceId}: ${err.message}`);
            source.status = 'Failed';
            source.indexingProgress = 0;
            source.metadata = { ...(source.metadata || {}), error: err.message };
            await this.sourceRepo.save(source);
            await this.notificationService.createNotification(source.userId, `Indexing Failed: ${source.name}`, `We encountered an error parsing your file: ${err.message}`);
        }
    }
    async ocrAndExtractText(buffer, ext, name) {
        const normalizedExt = ext.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'webp'].includes(normalizedExt)) {
            const mime = this.mimeFromExtension(normalizedExt);
            return this.generateVisionOcr(buffer, mime, 'Extract all readable text, handwritten notes, diagrams text, and equations from this document image. Return only the transcribed text content.');
        }
        if (normalizedExt === 'pdf') {
            let text = '';
            try {
                const pdfParse = require('pdf-parse');
                const parsed = await pdfParse(buffer);
                text = String(parsed.text || '').trim();
            }
            catch (err) {
                this.logger.warn(`pdf-parse failed, falling back to direct OCR: ${err.message}`);
            }
            if (text.length < 100) {
                this.logger.log(`Extracted PDF text is too short (${text.length} chars). Performing PDF OCR...`);
                const geminiKey = process.env.GEMINI_API_KEY;
                if (geminiKey && !geminiKey.includes('placeholder')) {
                    try {
                        return await this.generateVisionOcr(buffer, 'application/pdf', 'Perform OCR and extract all text, handwritten notes, and annotations from this scanned PDF file. Return only the plain text.');
                    }
                    catch (ocrErr) {
                        this.logger.warn(`Direct PDF OCR failed: ${ocrErr.message}`);
                    }
                }
                const jpegs = this.extractJpegStreamsFromPdf(buffer);
                if (jpegs.length > 0) {
                    this.logger.log(`Extracted ${jpegs.length} JPEG streams from scanned PDF. Transcribing images...`);
                    let concatenatedText = '';
                    for (let i = 0; i < Math.min(jpegs.length, 10); i++) {
                        try {
                            const pageText = await this.generateVisionOcr(jpegs[i], 'image/jpeg', `Transcribe all text from page ${i + 1} of this scanned document. Return only the text.`);
                            concatenatedText += `\n--- PAGE ${i + 1} ---\n${pageText}`;
                        }
                        catch (pageErr) {
                            this.logger.warn(`OCR page ${i + 1} failed: ${pageErr.message}`);
                        }
                    }
                    if (concatenatedText.trim().length > 0) {
                        return concatenatedText.trim();
                    }
                }
            }
            return text;
        }
        if (normalizedExt === 'pptx') {
            return this.extractPptxText(buffer);
        }
        if (normalizedExt === 'docx') {
            const zip = new AdmZip(buffer);
            const xml = zip.getEntry('word/document.xml')?.getData().toString('utf8') || '';
            return xml.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }
        if (['txt', 'md', 'csv'].includes(normalizedExt)) {
            return buffer.toString('utf8').trim();
        }
        return buffer.toString('utf8').trim();
    }
    async generateVisionOcr(imageBuffer, mimeType, prompt) {
        const openrouterKey = process.env.OPENROUTER_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;
        if (geminiKey && !geminiKey.includes('placeholder')) {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
            try {
                const body = {
                    contents: [{
                            parts: [
                                { text: prompt },
                                {
                                    inlineData: {
                                        mimeType,
                                        data: imageBuffer.toString('base64')
                                    }
                                }
                            ]
                        }]
                };
                const response = await axios_1.default.post(endpoint, body, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 60000
                });
                const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (content)
                    return content.trim();
            }
            catch (err) {
                this.logger.warn(`Direct Gemini vision OCR failed: ${err.message}`);
            }
        }
        if (openrouterKey && !openrouterKey.includes('placeholder')) {
            const model = process.env.OPENROUTER_GEMINI_MODEL || 'google/gemini-2.5-flash';
            try {
                const response = await axios_1.default.post('https://openrouter.ai/api/v1/chat/completions', {
                    model,
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: prompt },
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: `data:${mimeType};base64,${imageBuffer.toString('base64')}`
                                    }
                                }
                            ]
                        }
                    ]
                }, {
                    headers: {
                        Authorization: `Bearer ${openrouterKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 60000
                });
                const content = response.data?.choices?.[0]?.message?.content;
                if (content)
                    return content.trim();
            }
            catch (err) {
                this.logger.warn(`OpenRouter vision OCR failed: ${err.message}`);
            }
        }
        throw new Error('All OCR vision providers failed or were unconfigured');
    }
    extractJpegStreamsFromPdf(pdfBuffer) {
        const jpegs = [];
        let offset = 0;
        while (offset < pdfBuffer.length) {
            const streamIdx = pdfBuffer.indexOf('stream', offset);
            if (streamIdx === -1)
                break;
            const endStreamIdx = pdfBuffer.indexOf('endstream', streamIdx);
            if (endStreamIdx === -1)
                break;
            let start = streamIdx + 6;
            while (start < endStreamIdx && (pdfBuffer[start] === 10 || pdfBuffer[start] === 13)) {
                start++;
            }
            let end = endStreamIdx;
            while (end > start && (pdfBuffer[end - 1] === 10 || pdfBuffer[end - 1] === 13)) {
                end--;
            }
            const streamData = pdfBuffer.subarray(start, end);
            if (streamData.length > 5000 && streamData[0] === 0xFF && streamData[1] === 0xD8) {
                jpegs.push(streamData);
            }
            offset = endStreamIdx + 9;
            if (jpegs.length >= 10)
                break;
        }
        return jpegs;
    }
    async classifyDocument(title, text) {
        const prompt = `
You are an expert academic cataloging assistant.
Analyze the following title and snippet of a study material document, and classify it.
Title: "${title}"

Return ONLY a JSON object conforming strictly to this schema:
{
  "subject": "The academic subject name (e.g. Constitutional Law, Contract Law, Criminal Law)",
  "unit": "The specific unit name or chapter division within that subject (e.g. Fundamental Rights, DPSP, Basic Structure)",
  "topic": "The exact main topic/concept of the document (e.g. Right to Equality, Directive Principles)",
  "chapter": "Chapter name or number (e.g. Chapter III, Chapter 1)",
  "subtopic": "Subtopics list (comma separated string, e.g. Article 14, Article 15)",
  "concepts": ["Concept A", "Concept B"],
  "documentType": "One of: 'Teacher Notes', 'Class Notes', 'Previous Year Paper', 'Sample Paper', 'Syllabus', 'PPT Slides', 'Student Notes', 'Reference Material', 'Assignment', 'Case Study', 'Lab Manual', 'Research Article', 'Personal Notes', 'Scanned Notes', 'Study Material'"
}

Do not include markdown wraps (like \`\`\`json) or other text. Return raw JSON.
`;
        const snippet = text.slice(0, 4000);
        const classification = await this.generateJson(prompt, snippet, () => {
            throw new Error('Local classification fallback');
        });
        return classification;
    }
    async listWorkspace(userId) {
        const [sources, mockTests, mindMaps, studyKits, analytics, weakAreas, attempts] = await Promise.all([
            this.sourceRepo.find({ where: { userId }, order: { createdAt: 'DESC' } }),
            this.mockRepo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 20 }),
            this.mindMapRepo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 20 }),
            this.studyKitRepo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 20 }),
            this.getAnalytics(userId),
            this.getWeakAreaReport(userId),
            this.attemptRepo.find({ where: { userId }, order: { createdAt: 'ASC' }, take: 50 }),
        ]);
        return { sources, mockTests, mindMaps, studyKits, analytics, weakAreas, attempts };
    }
    async createTextSource(userId, body) {
        const kind = body.kind || (body.url ? (body.url.includes('youtube.com') || body.url.includes('youtu.be') ? 'YouTube URL' : 'Article URL') : 'Notes');
        const name = body.name || body.url || kind;
        let text = (body.text || '').trim();
        if (body.url) {
            if (body.url.includes('youtube.com') || body.url.includes('youtu.be')) {
                text = await this.extractYoutubeTranscript(body.url);
            }
            else {
                text = await this.extractUrlText(body.url);
            }
        }
        if (text.length < 40) {
            throw new common_1.BadRequestException('Source text is too short to analyze.');
        }
        const contentHash = crypto.createHash('sha256').update(text).digest('hex');
        const indexedSources = await this.sourceRepo.find({ where: { userId, status: 'Indexed' } });
        const existingSource = indexedSources.find((source) => {
            const existingHash = source.metadata?.contentHash || crypto.createHash('sha256').update(source.text || '').digest('hex');
            return existingHash === contentHash;
        });
        const source = await this.saveSource(userId, kind, name, text, { url: body.url || null, contentHash }, body.url);
        if (existingSource?.vectorId) {
            source.vectorId = existingSource.vectorId;
            source.status = 'Indexed';
            source.indexingProgress = 100;
            source.subject = existingSource.subject;
            source.unit = existingSource.unit;
            source.topic = existingSource.topic;
            source.documentType = existingSource.documentType;
            source.metadata = { ...(source.metadata || {}), contentHash, isDuplicate: true, duplicateOf: existingSource.id };
            await this.sourceRepo.save(source);
            await this.log(userId, 'source_created_duplicate_reused', { sourceId: source.id, duplicateOf: existingSource.id });
            return source;
        }
        const vectorId = await this.embedAndStoreInQdrant(source.id, userId, text, kind, { name, kind, contentHash });
        source.vectorId = vectorId;
        source.status = vectorId ? 'Indexed' : source.status;
        source.indexingProgress = vectorId ? 100 : source.indexingProgress;
        await this.sourceRepo.save(source);
        await this.log(userId, 'source_created', { sourceId: source.id, kind });
        return source;
    }
    async uploadSource(userId, kind, file) {
        const ext = file.originalname.split('.').pop()?.toLowerCase() || 'txt';
        if (!this.isSupportedUploadExtension(ext)) {
            throw new common_1.BadRequestException(`Unsupported file type .${ext}. Supported: PDF, DOCX, PPTX, TXT, MD, CSV, JPG, JPEG, PNG, WEBP, ZIP.`);
        }
        if (ext === 'zip') {
            const expanded = this.expandZipFiles(file);
            if (!expanded.length) {
                throw new common_1.BadRequestException('ZIP did not contain supported study material files.');
            }
            const uploaded = await this.uploadSources(userId, expanded, kind);
            return uploaded[0];
        }
        const storagePath = this.persistFile(userId, file.originalname, file.buffer);
        const smart = this.detectStudyMetadata(file.originalname, '', kind || this.kindFromExtension(ext));
        const source = await this.sourceRepo.save(this.sourceRepo.create({
            userId,
            kind: smart.kind,
            status: 'Queued',
            indexingProgress: 0,
            documentType: smart.documentType,
            name: file.originalname,
            storagePath,
            mimeType: file.mimetype,
            text: 'Text extraction pending...',
            textLength: 0,
            metadata: {
                bytes: file.size,
                extension: ext,
                ...smart
            }
        }));
        this.addToQueue(source.id);
        await this.log(userId, 'source_uploaded', { sourceId: source.id, kind: source.kind });
        return source;
    }
    async uploadSources(userId, files, kind) {
        if (!files?.length)
            throw new common_1.BadRequestException('No files were uploaded.');
        const expanded = files.flatMap((file) => {
            const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
            return ext === 'zip' ? this.expandZipFiles(file) : [file];
        });
        const supported = expanded.filter((file) => this.isSupportedUploadExtension(file.originalname.split('.').pop()?.toLowerCase() || ''));
        if (!supported.length)
            throw new common_1.BadRequestException('No supported study material files were found.');
        const created = [];
        for (const file of supported) {
            try {
                const ext = file.originalname.split('.').pop()?.toLowerCase() || 'txt';
                const storagePath = this.persistFile(userId, file.originalname, file.buffer);
                const smart = this.detectStudyMetadata(file.originalname, '', kind || this.kindFromExtension(ext));
                const source = await this.sourceRepo.save(this.sourceRepo.create({
                    userId,
                    kind: smart.kind,
                    status: 'Queued',
                    indexingProgress: 0,
                    documentType: smart.documentType,
                    name: file.originalname,
                    storagePath,
                    mimeType: file.mimetype,
                    text: 'Text extraction pending...',
                    textLength: 0,
                    metadata: {
                        bytes: file.size,
                        extension: ext,
                        bulkUpload: true,
                        ...smart
                    }
                }));
                created.push(source);
                this.addToQueue(source.id);
            }
            catch (error) {
                this.logger.warn(`Skipping upload creation for ${file.originalname}: ${error.message}`);
            }
        }
        await this.log(userId, 'bulk_sources_uploaded', { count: created.length });
        return created;
    }
    async renameSource(userId, sourceId, newName) {
        const source = await this.sourceRepo.findOne({ where: { id: sourceId, userId } });
        if (!source)
            throw new common_1.NotFoundException('Source not found.');
        source.name = newName;
        return this.sourceRepo.save(source);
    }
    async deleteSource(userId, sourceId) {
        const source = await this.sourceRepo.findOne({ where: { id: sourceId, userId } });
        if (!source)
            throw new common_1.NotFoundException('Source not found.');
        await this.deleteFromQdrant(sourceId);
        if (source.storagePath && fs.existsSync(source.storagePath)) {
            try {
                fs.unlinkSync(source.storagePath);
            }
            catch (err) {
                this.logger.error(`Could not delete storage file: ${err.message}`);
            }
        }
        await this.sourceRepo.remove(source);
        await this.log(userId, 'source_deleted', { sourceId });
        return { success: true };
    }
    async reprocessSource(userId, sourceId) {
        const source = await this.sourceRepo.findOne({ where: { id: sourceId, userId } });
        if (!source)
            throw new common_1.NotFoundException('Source not found.');
        if (source.status === 'Indexed' && source.vectorId) {
            await this.log(userId, 'source_reprocess_skipped_cached_vectors', { sourceId });
            return source;
        }
        const vectorId = await this.embedAndStoreInQdrant(source.id, userId, source.text, source.kind, { name: source.name, kind: source.kind });
        source.vectorId = vectorId;
        source.status = vectorId ? 'Indexed' : source.status;
        source.indexingProgress = vectorId ? 100 : source.indexingProgress;
        return this.sourceRepo.save(source);
    }
    async generateMockTest(userId, body) {
        const topic = String(body.topic || body.customPrompt || '').trim();
        if (!topic)
            throw new common_1.BadRequestException('Topic or custom paper description is required.');
        const sourceIds = Array.isArray(body.sourceIds) ? body.sourceIds : [];
        if (!sourceIds.length)
            throw new common_1.BadRequestException('Select at least one indexed uploaded source.');
        const geminiKey = process.env.GEMINI_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;
        const deepseekKey = process.env.DEEPSEEK_API_KEY;
        const openrouterKey = process.env.OPENROUTER_API_KEY;
        const missingKeys = [];
        if (!geminiKey || geminiKey.includes('placeholder'))
            missingKeys.push('GEMINI_API_KEY');
        if (!openaiKey || openaiKey.includes('placeholder'))
            missingKeys.push('OPENAI_API_KEY');
        if (!deepseekKey || deepseekKey.includes('placeholder'))
            missingKeys.push('DEEPSEEK_API_KEY');
        if (!openrouterKey || openrouterKey.includes('placeholder'))
            missingKeys.push('OPENROUTER_API_KEY');
        if (missingKeys.length === 4) {
            throw new common_1.BadRequestException(`AI provider is not configured correctly. Please check API key settings. Missing env variables: ${missingKeys.join(', ')}`);
        }
        const sources = await this.sourceRepo.find({
            where: sourceIds.map((id) => ({ id, userId }))
        });
        const totalWords = sources.reduce((sum, s) => {
            const text = s.text || '';
            return sum + text.trim().split(/\s+/).filter(Boolean).length;
        }, 0);
        if (totalWords < 120) {
            throw new common_1.BadRequestException('No usable uploaded legal material was found for Mock Test generation. Please upload a clearer PDF, DOCX, judgment, bare act material, or paste readable notes manually.');
        }
        const insufficientForMockTest = totalWords < 800 || sources.some((source) => source.metadata?.insufficientForMockTest);
        const questionCount = Number(body.questionCount || 10);
        const difficulty = body.difficulty || 'Intermediate';
        const questionType = body.questionType || body.paperType || 'Mixed';
        const mode = body.mode || 'interactive';
        const paperType = body.paperType || questionType;
        const isJudiciaryMode = Boolean(body.isJudiciaryMode) || /judiciary/i.test(`${paperType} ${topic}`);
        const judiciaryState = body.judiciaryState || 'General';
        const examType = body.examType || 'PCS-J';
        const examPattern = body.examPattern || paperType;
        const customPrompt = String(body.customPrompt || '').trim();
        const cacheKey = this.mockRequestCacheKey({
            kind: 'mock-paper-v2-questions-only',
            userId,
            topic,
            difficulty,
            questionType,
            questionCount,
            paperType,
            mode,
            sourceIds: [...sourceIds].sort(),
            isJudiciaryMode,
            judiciaryState,
            examType,
            examPattern,
            customPrompt,
        });
        const cached = await this.findCachedMockTest(userId, cacheKey);
        if (cached) {
            this.logger.log(`Mock paper cache hit for user ${userId}: ${cacheKey}`);
            return cached;
        }
        const query = this.buildMockRetrievalQuery(topic, paperType, difficulty, questionType, customPrompt);
        const retrievedChunks = await this.retrieveRelevantMockChunks(userId, query, sourceIds, 10);
        if (!retrievedChunks.length) {
            throw new common_1.BadRequestException('No indexed Qdrant chunks were found for the selected sources. Wait for indexing to finish or upload study material first.');
        }
        const retrievedText = this.formatRetrievedChunksForPrompt(retrievedChunks);
        const sourceIdsUsed = Array.from(new Set(retrievedChunks.map((chunk) => String(chunk.payload?.source_id || '')).filter(Boolean)));
        const retrievalAudit = {
            topK: retrievedChunks.length,
            requestedTopK: 10,
            sourceIdsUsed,
            qdrantOnly: true,
            fullDocumentsSent: false,
            answersGenerated: false,
            explanationsGenerated: false,
            retrievalQueryHash: crypto.createHash('sha256').update(query).digest('hex'),
        };
        const schemaDescription = `{
      examTitle: "Professional Legal Mock Assessment",
      subjectTopic: "${topic}",
      totalMarks: 50,
      instructions: ["Answer all questions.", "Support answers with provisions, principles, and authorities from the uploaded material.", "Each answer must be written in detailed paragraphs covering all aspects of the legal topic."],
      questions: [{
        id: "q1",
        type: "long answer | case-based | bare-act-based | judgment-based | analytical | problem-based",
        topic: "Subtopic / Concept Name",
        question: "Full detailed university-style legal exam question that requires 3-4 pages of written answer",
        marks: 15,
        difficulty: "${difficulty}",
        expectedAnswerLength: "1,800-2,500 words (approximately 3-4 written pages)",
        modelAnswerRequested: true,
        citations: [{ sourceName: "Source Title", section: "Section/Article if present", chapter: "Unit/Chapter if present", page: "Page Z", chunkRef: "Qdrant point ID", paragraph: "Paragraph W", supportingText: "Exact source sentence used to form the question", confidenceScore: 0.95 }]
      }],
      scoreReport: { totalMarks: 50, scoringRule: "Descriptive long-answer paper only; each answer should cover 3-4 pages of detailed legal analysis." },
      weakAreas: []
    }`;
        const aiPrompt = `Generate a professional grounded LEGATRIXON university-style descriptive legal mock question paper from the supplied study material only.

PAPER METADATA:
- Exam Title: ${isJudiciaryMode ? `${judiciaryState} ${examType} Mock Assessment` : `${topic} Semester Paper`}
- Subject/Topic: ${topic}
- Paper Type / Template Intent: ${paperType}
- Difficulty: ${difficulty}
- Question Count: ${questionCount}
- Total Marks: ${questionCount * this.defaultMarksForQuestion(questionType, 0)}
- Judiciary Mode: ${isJudiciaryMode ? `Yes (${judiciaryState}, ${examType}, ${examPattern})` : 'No'}
- AI Builder Prompt: ${customPrompt || 'None'}
- Instructions: Answer all questions. Each question carries marks as indicated. Every answer must be long-form, analytical, and written in the style of a university law examination.

STRICT QUESTION REQUIREMENTS:
- Generate ONLY descriptive long-answer questions suitable for LLB semester exams, judiciary mains, and legal research practice.
- NEVER generate MCQs, options, one-word prompts, fill-in-the-blanks, true/false, short-answer questions, or any question requiring less than 3 pages to answer.
- Each question must be written in full sentences, university-exam style. Examples: "Discuss in detail the concept of X, examining its statutory framework, essential elements, judicial interpretation, and practical application with reference to the relevant provisions and case law contained in the uploaded material." or "Critically examine the doctrine of Y as reflected in the uploaded study material. In your answer, trace its historical development, statutory basis, essential conditions, judicial trends, and the exceptions recognised therein."
- Questions must be substantive and require the student to demonstrate in-depth knowledge across multiple dimensions: definition, statutory provisions, essential ingredients, judicial interpretation, exceptions, and application.
- Questions should be 2-4 sentences long as a prompt, not single words or short phrases.
- Do NOT invent fake statutes, sections, articles, judgments, citations, doctrines, parties, dates, or legal authorities.
- Ground every question strictly in the uploaded material. Do not ask about topics not covered in the source.
- Prefer Indian law, Indian statutory terminology, Indian constitutional framing, and Indian examination style unless source material clearly uses another jurisdiction.
- Include a balanced mix: long answer, case-based, bare-act-based, judgment-based, analytical, and problem-based question types.
- Marks: Assign ${isJudiciaryMode ? '20 or 25' : '10 or 15'} marks per question.
- Expected Length: Each question must specify "Expected length: 1,800-2,500 words (approximately 3-4 written pages)".
- Citations: Every question must map to specific evidence from the supplied material.
- Output must include examTitle, subjectTopic, totalMarks, instructions, questions, marks per question, expectedAnswerLength, and modelAnswerRequested.

Return ONLY valid JSON matching this schema: ${schemaDescription}`;
        const generated = await this.generateLlmJson(aiPrompt, retrievedText, schemaDescription).catch((error) => {
            this.logger.warn(`Mock paper AI generation failed: ${error.message || error}. Using grounded descriptive fallback.`);
            return this.localQuestionPaper(topic, difficulty, questionType, questionCount, retrievedChunks, paperType);
        });
        const normalizedQuestions = this.normalizeQuestionPaper(generated.questions || [], questionCount, retrievedChunks, difficulty, questionType);
        const entity = this.mockRepo.create({
            userId,
            topic,
            difficulty,
            questionType: isJudiciaryMode ? `${examType} - ${examPattern}` : questionType,
            questionCount: normalizedQuestions.length,
            sourceIds,
            questions: normalizedQuestions,
            scoreReport: {
                ...(generated.scoreReport || {}),
                totalMarks: normalizedQuestions.reduce((sum, q) => sum + Number(q.marks || 0), 0),
                scoringRule: 'Descriptive long-answer paper only; detailed model answers requested for every question.',
                examTitle: generated.examTitle || (isJudiciaryMode ? `${judiciaryState} ${examType} Mock Assessment` : `${topic} Semester Paper`),
                subjectTopic: generated.subjectTopic || topic,
                instructions: generated.instructions || [
                    'Answer all questions.',
                    'Use relevant statutory provisions, principles, and authorities from the uploaded material.',
                    'Write long-form exam-ready answers with analysis and conclusion.',
                ],
                modelAnswerRequested: true,
                insufficientForMockTest,
                extractionWarning: insufficientForMockTest
                    ? 'Selected material is short or marked as limited extraction. The paper was generated from available indexed chunks; verify coverage before final use.'
                    : undefined,
                cacheKey,
                retrievalAudit,
            },
            weakAreas: [],
            mode,
        });
        const saved = await this.mockRepo.save(entity);
        if (mode === 'pdf') {
            const pdfBuffer = await this.compileMockTestPdf(saved);
            const relativePath = path.join('uploads', 'exports', userId);
            const absoluteDir = path.resolve(process.cwd(), relativePath);
            fs.mkdirSync(absoluteDir, { recursive: true });
            const absolutePath = path.join(absoluteDir, `${saved.id}-mock-test.pdf`);
            fs.writeFileSync(absolutePath, pdfBuffer);
            saved.pdfUrl = `/api/v1/learning-workspace/mock-tests/${saved.id}/export/pdf`;
            await this.mockRepo.save(saved);
        }
        await this.log(userId, 'mock_test_generated', { mockTestId: saved.id, mode, cacheKey, retrievalAudit });
        return saved;
    }
    async generateDetailedAnswer(userId, mockTestId, questionId, mode, force = false) {
        const test = await this.mockRepo.findOne({ where: { id: mockTestId, userId } });
        if (!test)
            throw new common_1.BadRequestException('Mock test not found.');
        const question = test.questions.find((item) => String(item.id) === String(questionId));
        if (!question)
            throw new common_1.BadRequestException('Question not found in this mock test.');
        const answerMode = normalizeMockAnswerMode(mode, question.marks || 15);
        question.generatedAnswers = question.generatedAnswers || {};
        if (question.generatedAnswers[answerMode] && !force) {
            return { questionId, mode: answerMode, answer: question.generatedAnswers[answerMode], cached: true };
        }
        const cacheSeed = this.mockRequestCacheKey({
            kind: 'mock-answer-v2',
            userId,
            mockTestId,
            questionId,
            mode: answerMode,
            question: question.question,
            sourceIds: test.sourceIds || [],
        });
        const query = `${test.topic}\n${question.question}`;
        const chunks = await this.retrieveRelevantMockChunks(userId, query, test.sourceIds || [], 20);
        if (!chunks.length)
            throw new common_1.BadRequestException('No indexed chunks available to generate this answer.');
        const schemaDescription = `{
      modelAnswer: "Full plain-text long-form exam answer of approximately 1800-3500 words written in flowing paragraphs. No markdown symbols, no hashtags, no asterisks, no bullet dashes. Use only numbered section headings like '1. Introduction', '2. Meaning and Definition', etc. Every section must be multiple full paragraphs. The answer must read like a real law student exam answer.",
      importantJudgments: ["Case name only when it appears directly in the uploaded material; leave empty array if uncertain"],
      relevantArticles: ["Article number only when explicitly in the uploaded material"],
      relevantSections: ["Section number only when explicitly in the uploaded material"],
      sourcesUsed: ["Filename.pdf"],
      citations: [{ sourceName: "Source Title", page: "Page Z", chunkRef: "Qdrant point ID", supportingText: "Exact quote from source" }]
    }`;
        const wordTarget = ANSWER_MODE_LIMITS[answerMode] || '1800-2500 words';
        const prompt = `Generate a university law examination model answer for the following descriptive legal question. The answer must be grounded entirely in the supplied study material below.

QUESTION: ${question.question}
MARKS: ${question.marks || 15}
ANSWER MODE: ${answerMode}
TARGET LENGTH: ${wordTarget} (approximately 3 to 4 written pages of examination answer)

ABSOLUTE FORMATTING RULES — VIOLATING THESE WILL MAKE THE ANSWER UNUSABLE:
- Write ONLY in plain flowing prose paragraphs. Do NOT use any markdown symbols.
- BANNED characters and patterns: ** (double asterisk), * (asterisk), # (hash), ## (double hash), ### (triple hash), - (dash as a bullet), > (blockquote), _ (underline), backtick characters.
- Do NOT use bullet points, dashes as list items, or any symbol formatting at all.
- Use only numbered section headings written as plain text, for example: "1. Introduction" on its own line, then paragraphs below it.
- Every section must contain multiple full paragraphs of detailed legal prose, not single-sentence placeholders.
- Write exactly as a top-scoring LLB or judiciary mains candidate would write in a physical examination hall — clear, formal, continuous flowing sentences.
- Do NOT use hashtags, emojis, casual phrasing, social-media shorthand, coaching-institute filler phrases, or motivational language.

STRICT CONTENT RULES:
- The entire answer must be grounded in the retrieved uploaded material provided below. Do not fabricate any content.
- Do NOT invent fake statutes, sections, articles, judgments, citations, case names, party names, dates, or holdings that are not in the uploaded material.
- If case law appears in the uploaded material, cite it. If it does not, do NOT invent it. Simply write: "The specific judicial authority on this point should be verified from current law reports."
- If a statutory provision appears in the uploaded material, cite it by name and number. If it does not, do not invent it.
- Prefer Indian law, Indian statutory terminology, Indian constitutional framing, and Indian examination style unless the source material clearly uses another jurisdiction.

REQUIRED STRUCTURE — write all sections in full paragraphs, each section must be substantive:
1. Introduction — Define the legal concept, state its significance, and frame the question clearly in 2-3 paragraphs.
2. Meaning and Definition — Explain the doctrinal meaning in detail drawing from the uploaded material. Include any statutory or judicial definition found in the material.
3. Relevant Sections and Articles — Identify and explain every relevant statutory provision, constitutional article, or rule found in the uploaded material. Discuss their scope and operation in full sentences.
4. Essential Ingredients and Elements — Enumerate and fully explain each legal ingredient, test, or condition in separate paragraphs. Do not use bullet points; write each ingredient as a paragraph starting with the ingredient name followed by its full explanation.
5. Legal Principles — Discuss the governing legal doctrines, rules of interpretation, and fundamental principles that apply, drawing directly from the uploaded material.
6. Case Laws and Judicial Pronouncements — Discuss judgments and case law only if they appear in the uploaded material. For each case, state the facts briefly, the legal issue, and the holding in full sentences. If no case law is in the material, write one sentence noting that judicial authority should be verified separately.
7. Application and Analysis — Apply the law to the facts or issues raised in the question. If it is a problem-based question, work through each ingredient against the given facts and reach a legal conclusion.
8. Exceptions, Limitations and Special Rules — Discuss any exceptions, defences, provisos, or special rules applicable to the topic as found in the uploaded material.
9. Critical Analysis — Provide an analytical evaluation of the law: its strengths, weaknesses, interpretive controversies, policy implications, and any reform suggestions if mentioned in the uploaded material.
10. Conclusion — Summarise the legal position in 2-3 paragraphs, restate the answer to the question clearly, and end with the examiner's expected conclusion.

Return ONLY valid JSON matching this schema: ${schemaDescription}`;
        const geminiKey = process.env.GEMINI_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;
        const deepseekKey = process.env.DEEPSEEK_API_KEY;
        const openrouterKey = process.env.OPENROUTER_API_KEY;
        const missingKeys = [];
        if (!geminiKey || geminiKey.includes('placeholder'))
            missingKeys.push('GEMINI_API_KEY');
        if (!openaiKey || openaiKey.includes('placeholder'))
            missingKeys.push('OPENAI_API_KEY');
        if (!deepseekKey || deepseekKey.includes('placeholder'))
            missingKeys.push('DEEPSEEK_API_KEY');
        if (!openrouterKey || openrouterKey.includes('placeholder'))
            missingKeys.push('OPENROUTER_API_KEY');
        if (missingKeys.length === 4) {
            throw new common_1.BadRequestException(`AI provider is not configured correctly. Please check API key settings. Missing env variables: ${missingKeys.join(', ')}`);
        }
        const generated = await this.generateLlmJson(prompt, this.formatRetrievedChunksForPrompt(chunks), schemaDescription).catch((error) => {
            this.logger.warn(`Detailed answer AI generation failed: ${error.message || error}. Using grounded local fallback.`);
            return {
                modelAnswer: this.localDetailedAnswer(question.question, chunks, answerMode),
                importantJudgments: [],
                relevantArticles: [],
                relevantSections: [],
                sourcesUsed: [],
                citations: this.citationsFromRetrievedChunks(chunks),
            };
        });
        const sourcesUsedFromChunks = chunks.map((c) => String(c.payload?.name || c.payload?.document_name || 'Uploaded Study Material')).filter(Boolean);
        const uniqueSourcesUsed = Array.from(new Set([
            ...(Array.isArray(generated.sourcesUsed) ? generated.sourcesUsed : []),
            ...sourcesUsedFromChunks
        ])).filter(Boolean);
        const answer = {
            modelAnswer: String(generated.modelAnswer || '').trim(),
            importantJudgments: Array.isArray(generated.importantJudgments) ? generated.importantJudgments : [],
            relevantArticles: Array.isArray(generated.relevantArticles) ? generated.relevantArticles : [],
            relevantSections: Array.isArray(generated.relevantSections) ? generated.relevantSections : [],
            sourcesUsed: uniqueSourcesUsed,
            citations: generated.citations?.length ? generated.citations : this.citationsFromRetrievedChunks(chunks),
            cacheKey: cacheSeed,
            generatedAt: new Date().toISOString(),
            retrievalAudit: {
                topK: chunks.length,
                requestedTopK: 10,
                fullDocumentsSent: false,
                generatedOnlyOnDemand: true,
            },
        };
        question.generatedAnswers[answerMode] = answer;
        test.questions = test.questions.map((item) => String(item.id) === String(questionId) ? question : item);
        await this.mockRepo.save(test);
        await this.log(userId, 'mock_answer_generated', { mockTestId, questionId, mode: answerMode, cacheKey: cacheSeed });
        return { questionId, mode: answerMode, answer, cached: false };
    }
    async submitMockTest(userId, id, answers, timeTaken = 0) {
        const test = await this.mockRepo.findOne({ where: { id, userId } });
        if (!test)
            throw new common_1.BadRequestException('Mock test not found.');
        let score = 0;
        const weakAreas = [];
        const totalMarks = test.questions.reduce((sum, q) => sum + Number(q.marks || 15), 0);
        test.questions.forEach((question) => {
            const expected = String(question.answer || '').trim();
            const actual = String(answers?.[question.id] || '').trim();
            const marks = Number(question.marks || 15);
            if (actual && expected) {
                if (actual.toLowerCase() === expected.toLowerCase()) {
                    score += marks;
                }
                else {
                    weakAreas.push(question.topic || test.topic);
                }
            }
            else if (actual && !expected) {
                score += Math.round(marks * 0.5);
            }
            else {
                weakAreas.push(question.topic || test.topic);
            }
        });
        const total = totalMarks || test.questions.length;
        const percentage = total ? Math.round((score / total) * 100) : 0;
        const attempt = await this.attemptRepo.save(this.attemptRepo.create({
            userId,
            mockTestId: id,
            score,
            total,
            percentage,
            timeTaken,
            accuracy: percentage,
            answers,
            weakAreas: Array.from(new Set(weakAreas)).slice(0, 10),
        }));
        await this.log(userId, 'mock_test_submitted', { mockTestId: id, score: attempt.percentage, timeTaken });
        await this.notificationService.createNotification(userId, `Mock Test Completed: ${test.topic}`, `You completed the mock test on "${test.topic}" with a score of ${score}/${total} (${percentage}%).`);
        return attempt;
    }
    async generateMindMap(userId, body) {
        if (!body.sourceIds || body.sourceIds.length === 0) {
            throw new common_1.BadRequestException('Select at least one source.');
        }
        const sources = await this.sourceRepo.find({ where: { userId } });
        const selectedSources = sources.filter((s) => body.sourceIds?.includes(s.id));
        if (selectedSources.length === 0) {
            throw new common_1.BadRequestException('Select at least one source.');
        }
        let retrievedChunks = [];
        const qdrantClient = this.qdrantService.getClient();
        if (qdrantClient) {
            try {
                for (const src of selectedSources) {
                    const vectorSourceId = src.metadata?.isDuplicate && src.metadata?.duplicateOf ? src.metadata.duplicateOf : src.id;
                    const res = await qdrantClient.scroll('user_documents', {
                        filter: {
                            must: [
                                { key: 'user_id', match: { value: userId } },
                                { key: 'source_id', match: { value: vectorSourceId } }
                            ]
                        },
                        limit: 1000,
                        with_payload: true,
                        with_vector: false
                    });
                    if (res && res.points) {
                        retrievedChunks.push(...res.points);
                    }
                }
            }
            catch (err) {
                this.logger.warn(`Qdrant retrieval error: ${err.message}. Using dynamic database chunking fallback.`);
            }
        }
        if (retrievedChunks.length === 0) {
            this.logger.log(`No chunks retrieved from Qdrant. Generating dynamic chunks from SQL database sources...`);
            for (const src of selectedSources) {
                const sentenceBoundary = /(?<!\b(?:[a-zA-Z]|vs?|supp|art|secs?|nos?|vol|ltd|co|corp|inc|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\.)(?<=[.?!])\s+/i;
                const sentences = src.text.split(sentenceBoundary).map(s => s.trim()).filter(Boolean);
                const chunkSize = Number(process.env.LEARNING_CHUNK_SIZE || 1400);
                let currentBuf = [];
                let currentLen = 0;
                let chunkIndex = 0;
                for (const sent of sentences) {
                    if (currentLen + sent.length > chunkSize && currentBuf.length > 0) {
                        retrievedChunks.push({
                            id: `${src.id}-fallback-${chunkIndex}`,
                            payload: {
                                source_id: src.id,
                                user_id: userId,
                                text: currentBuf.join(' '),
                                chunk_text: currentBuf.join(' '),
                                name: src.name,
                                kind: src.kind,
                                page_number: Math.floor(chunkIndex / 3) + 1,
                                chunk_index: chunkIndex
                            }
                        });
                        currentBuf = [sent];
                        currentLen = sent.length;
                        chunkIndex++;
                    }
                    else {
                        currentBuf.push(sent);
                        currentLen += sent.length + 1;
                    }
                }
                if (currentBuf.length > 0) {
                    retrievedChunks.push({
                        id: `${src.id}-fallback-${chunkIndex}`,
                        payload: {
                            source_id: src.id,
                            user_id: userId,
                            text: currentBuf.join(' '),
                            chunk_text: currentBuf.join(' '),
                            name: src.name,
                            kind: src.kind,
                            page_number: Math.floor(chunkIndex / 3) + 1,
                            chunk_index: chunkIndex
                        }
                    });
                }
            }
        }
        console.log("Selected Source IDs:", body.sourceIds);
        console.log("Retrieved Chunks:", retrievedChunks.map(c => ({
            id: c.id,
            source_id: c.payload?.source_id,
            textSnippet: (c.payload?.text || c.payload?.chunk_text || '').substring(0, 60)
        })));
        console.log("Chunk Count:", retrievedChunks.length);
        if (retrievedChunks.length === 0) {
            throw new common_1.BadRequestException('No source content available.');
        }
        const structureType = body.structureType || 'Quick';
        const retrievedText = retrievedChunks.map((c, idx) => {
            const p = c.payload || {};
            const chunkText = p.text || p.chunk_text || '';
            const cleanedChunk = this.cleanLearningText(chunkText);
            return `[Chunk #${idx + 1} | Source ID: "${p.source_id || 'fallback-source'}" | Document: "${p.name || p.document_name || 'Document'}" | Page: ${p.page_number || p.pageNumber || 1} | Ref: ${c.id || `chunk-${idx}`}]\n${cleanedChunk}`;
        }).join('\n\n');
        const schemaDescription = `{
      title: "Mind Map Title reflecting the specific source content",
      concepts: ["Concept A extracted directly from source", "Concept B extracted directly from source"],
      map: {
        id: "root",
        node_id: "root",
        label: "Main Topic from Source",
        concept_name: "Main Topic from Source",
        type: "Root",
        definition: "A concise definition of the main topic",
        summary: "A brief revision summary of the subject",
        full_content: "A detailed complete explanation of the main topic",
        detailedExplanation: "A detailed complete explanation of the main topic",
        key_points: ["Key point 1"],
        important_facts: ["Grounded fact 1"],
        related_concepts: ["concept1"],
        relatedConcepts: ["concept1"],
        cases_mentioned: ["Case 1"],
        relatedCases: ["Case 1"],
        articles_mentioned: ["Article X"],
        relevantArticles: ["Article X"],
        sections_mentioned: ["Section Y"],
        relevantSections: ["Section Y"],
        exam_important_notes: ["Exam notes"],
        source_chunks: ["chunk-id-1"],
        page_numbers: ["Page 1"],
        confidence_score: 1.0,
        confidenceScore: 1.0,
        sourceId: "source-uuid",
        pageNumber: "Page 1",
        chunkId: "chunk-id-1",
        documentName: "SourceDoc.pdf",
        originalSourceText: "Exact sentence from the chunk.",
        citations: [{ sourceName: "SourceDoc.pdf", page: "Page 1", chunkRef: "chunk-id-1", supportingText: "Exact sentence" }],
        children: [
          {
            id: "node-level2-1",
            node_id: "node-level2-1",
            label: "Major Concept extracted from source",
            concept_name: "Major Concept extracted from source",
            type: "Concept",
            definition: "...",
            summary: "...",
            full_content: "...",
            detailedExplanation: "...",
            key_points: [],
            important_facts: [],
            related_concepts: [],
            relatedConcepts: [],
            cases_mentioned: [],
            relatedCases: [],
            articles_mentioned: [],
            relevantArticles: [],
            sections_mentioned: [],
            relevantSections: [],
            exam_important_notes: [],
            source_chunks: ["chunk-id-1"],
            page_numbers: ["Page 1"],
            confidence_score: 0.95,
            confidenceScore: 0.95,
            sourceId: "source-uuid",
            pageNumber: "Page 1",
            chunkId: "chunk-id-1",
            documentName: "SourceDoc.pdf",
            originalSourceText: "Exact sentence.",
            citations: [],
            children: [
              {
                id: "node-level3-1",
                node_id: "node-level3-1",
                label: "Sub Concept details",
                concept_name: "Sub Concept details",
                type: "Concept",
                definition: "...",
                summary: "...",
                full_content: "...",
                detailedExplanation: "...",
                key_points: [],
                important_facts: [],
                related_concepts: [],
                relatedConcepts: [],
                cases_mentioned: [],
                relatedCases: [],
                articles_mentioned: [],
                relevantArticles: [],
                sections_mentioned: [],
                relevantSections: [],
                exam_important_notes: [],
                source_chunks: ["chunk-id-1"],
                page_numbers: ["Page 1"],
                confidence_score: 0.9,
                confidenceScore: 0.9,
                sourceId: "source-uuid",
                pageNumber: "Page 1",
                chunkId: "chunk-id-1",
                documentName: "SourceDoc.pdf",
                originalSourceText: "Exact sentence.",
                citations: [],
                children: [
                  {
                    id: "node-level4-1",
                    node_id: "node-level4-1",
                    label: "Specific Example / Case Law / Section Reference",
                    concept_name: "Specific Example / Case Law / Section Reference",
                    type: "Case | Article | Section",
                    definition: "...",
                    summary: "...",
                    full_content: "...",
                    detailedExplanation: "...",
                    key_points: [],
                    important_facts: [],
                    related_concepts: [],
                    relatedConcepts: [],
                    cases_mentioned: [],
                    relatedCases: [],
                    articles_mentioned: [],
                    relevantArticles: [],
                    sections_mentioned: [],
                    relevantSections: [],
                    exam_important_notes: [],
                    source_chunks: ["chunk-id-1"],
                    page_numbers: ["Page 1"],
                    confidence_score: 0.9,
                    confidenceScore: 0.9,
                    sourceId: "source-uuid",
                    pageNumber: "Page 1",
                    chunkId: "chunk-id-1",
                    documentName: "SourceDoc.pdf",
                    originalSourceText: "Exact sentence.",
                    citations: [],
                    children: [
                      {
                        id: "node-level5-1",
                        node_id: "node-level5-1",
                        label: "Important Exam Notes for this Concept",
                        concept_name: "Important Exam Notes for this Concept",
                        type: "Concept",
                        definition: "...",
                        summary: "...",
                        full_content: "...",
                        detailedExplanation: "...",
                        key_points: [],
                        important_facts: [],
                        related_concepts: [],
                        relatedConcepts: [],
                        cases_mentioned: [],
                        relatedCases: [],
                        articles_mentioned: [],
                        relevantArticles: [],
                        sections_mentioned: [],
                        relevantSections: [],
                        exam_important_notes: [],
                        source_chunks: ["chunk-id-1"],
                        page_numbers: ["Page 1"],
                        confidence_score: 0.85,
                        confidenceScore: 0.85,
                        sourceId: "source-uuid",
                        pageNumber: "Page 1",
                        chunkId: "chunk-id-1",
                        documentName: "SourceDoc.pdf",
                        originalSourceText: "Exact sentence.",
                        citations: [],
                        children: []
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    }`;
        const prompt = `Create a premium, document-grounded, interactive visual mind map summarizing the provided source text chunks.
      Structure Type: ${structureType}

      LEVEL DEPTH RULES:
      The tree map MUST follow a strict 5-level hierarchy based on the structure of the document:
      - LEVEL 1 (Root): Main Topic of the provided chunks.
      - LEVEL 2 (Children of Root): Major Concepts (the main chapters, divisions, or core themes).
      - LEVEL 3 (Children of Level 2): Sub Concepts (definitions, conceptual sub-parts).
      - LEVEL 4 (Children of Level 3): Examples / Cases / Sections (factual examples, specific statutory sections, or case names cited).
      - LEVEL 5 (Children of Level 4): Important Exam Notes (revision checklists, typical exam issues, questions to keep in mind, and errors to avoid).
      
      CRITICAL GROUNDING RULES:
      1. Every single node and concept MUST originate ONLY from the provided source chunks below. Do NOT use general legal knowledge, generic legal definitions, or fallback ideas that are not explicitly present in the source text chunks.
      2. Match Google's NotebookLM behavior: do not hallucinate outside the context.
      3. For every node in the tree recursively (root and all children), you MUST populate these fields:
         - 'id' & 'node_id': Unique node ID string
         - 'label' & 'concept_name': Node title/concept name
         - 'type': One of 'Root', 'Concept', 'Article', 'Case', 'Doctrine', or 'Section'
         - 'definition': A concise definition of this node
         - 'summary': A brief revision summary
         - 'full_content' & 'detailedExplanation': Detailed complete explanation grounded in the text
         - 'key_points', 'important_facts', 'related_concepts', 'cases_mentioned', 'articles_mentioned', 'sections_mentioned', 'exam_important_notes': Standard arrays
         - 'source_chunks' & 'page_numbers': Arrays of chunks and page strings
         - 'confidence_score' & 'confidenceScore': Float value indicating grounding strength
         - 'sourceId': The exact 'Source ID' of the chunk this node was extracted from.
         - 'pageNumber': The 'Page' of the chunk.
         - 'chunkId': The 'Ref' (Chunk ID) of the chunk.
         - 'documentName': The 'Document' name.
         - 'originalSourceText': The exact sentence or clause from the chunk containing the evidence for this node's labels/definition.
         - 'citations': A list containing the citation mapping.
      4. Avoid placeholder or empty fields. Every node must represent real information from the source.
      5. Return ONLY a valid JSON payload matching this 5-level nested schema: ${schemaDescription}`;
        const generated = await this.generateJson(prompt, retrievedText, () => this.localMindMapFromChunks(retrievedChunks, structureType));
        const totalConcepts = generated.concepts?.length || 10;
        const uniquePages = new Set(retrievedChunks.map((c) => c.payload?.page_number || c.payload?.pageNumber || 1));
        const pagesAnalyzed = Math.max(1, uniquePages.size);
        const chunksUsed = retrievedChunks.length;
        const sourceConfidence = Number((0.88 + Math.min(chunksUsed * 0.01, 0.11)).toFixed(2));
        const coverageMetrics = {
            totalConcepts,
            pagesAnalyzed,
            chunksUsed,
            sourceConfidence
        };
        const saved = await this.mindMapRepo.save(this.mindMapRepo.create({
            userId,
            title: generated.title || 'AI Mind Map',
            structureType,
            sourceIds: body.sourceIds || [],
            map: generated.map || generated,
            concepts: generated.concepts || [],
            coverageMetrics,
        }));
        await this.log(userId, 'mind_map_generated', { mindMapId: saved.id, structureType });
        return saved;
    }
    async generateStudyKit(userId, body) {
        const sourceText = await this.collectSourceText(userId, body.sourceIds || []);
        if (!sourceText)
            throw new common_1.BadRequestException('Select at least one source.');
        const schemaDescription = `{
      title: "Study Kit Subject Title",
      summary: "Comprehensive executive summary block with citations",
      keyConcepts: [{ title: "Concept Title", explanation: "Detail explanation", citations: [] }],
      importantCases: [{ caseName: "Landmark Case Citation", summary: "Case holdings, facts and reasoning", citations: [] }],
      importantArticles: [{ articleOrSection: "Article 21 / Section 300", summary: "Statutory breakdown", citations: [] }],
      revisionNotes: "Bulleted critical study checklist mapping rules and procedures",
      examQuestions: [{ question: "Exemplary Mains descriptive question", approach: "How to draft a winning answer", citations: [] }],
      flashcards: [{ id: "fc1", topic: "Subtopic", front: "Prompt/Question?", back: "Grounded Answer text" }],
      mcqs: [{ id: "q1", type: "MCQ", topic: "Subtopic", question: "Question?", options: ["A", "B", "C", "D"], answer: "A", explanation: "Explanation" }]
    }`;
        const prompt = `Forge a complete Smart Study Kit from the supplied legal documents.
      Generate: Executive Summary, Key Concepts, Important Cases, Important Articles/Sections, Revision Notes, Exam Questions with Answer Draft Approaches, Flashcards, and MCQs.
      Every component (summary, cases, articles, key concepts, questions) MUST include explicit citations.
      Return ONLY valid JSON matching this schema: ${schemaDescription}`;
        const generated = await this.generateJson(prompt, sourceText, () => this.localStudyKit(sourceText));
        const saved = await this.studyKitRepo.save(this.studyKitRepo.create({
            userId,
            title: generated.title || 'Smart Study Kit',
            sourceIds: body.sourceIds || [],
            content: generated,
        }));
        await this.log(userId, 'study_kit_generated', { studyKitId: saved.id });
        return saved;
    }
    async reviewFlashcard(userId, body) {
        const review = await this.flashcardReviewRepo.save(this.flashcardReviewRepo.create({
            userId,
            studyKitId: body.studyKitId,
            cardId: body.cardId,
            rating: String(body.rating),
            correct: Boolean(body.correct),
            topic: body.topic || 'General',
        }));
        await this.log(userId, 'flashcard_reviewed', { studyKitId: body.studyKitId, cardId: body.cardId, correct: review.correct });
        return review;
    }
    async getAnalytics(userId) {
        const [documentsUploaded, mockTestsGenerated, mindMapsCreated, studyKitsGenerated, attempts, reviews] = await Promise.all([
            this.sourceRepo.count({ where: { userId } }),
            this.mockRepo.count({ where: { userId } }),
            this.mindMapRepo.count({ where: { userId } }),
            this.studyKitRepo.count({ where: { userId } }),
            this.attemptRepo.find({ where: { userId } }),
            this.flashcardReviewRepo.find({ where: { userId } }),
        ]);
        const averageScore = attempts.length ? Math.round(attempts.reduce((sum, item) => sum + item.percentage, 0) / attempts.length) : 0;
        const mastered = new Set();
        attempts.filter((item) => item.percentage >= 80).forEach((item) => mastered.add(item.mockTestId));
        reviews.filter((item) => item.correct).forEach((item) => mastered.add(item.topic || item.cardId));
        const avgTestAccuracy = attempts.length ? (attempts.reduce((sum, a) => sum + a.accuracy, 0) / attempts.length) : 0;
        const flashcardAccuracy = reviews.length ? (reviews.filter(r => r.correct).length / reviews.length) * 100 : 0;
        const coverageScore = documentsUploaded ? Math.min(100, documentsUploaded * 20) : 0;
        let readinessScore = 0;
        if (attempts.length === 0 && reviews.length === 0) {
            readinessScore = Math.min(30, Math.round(coverageScore * 0.3));
        }
        else {
            const testPart = attempts.length ? avgTestAccuracy * 0.5 : 0;
            const reviewPart = reviews.length ? flashcardAccuracy * 0.3 : 0;
            const coveragePart = coverageScore * 0.2;
            const totalWeight = (attempts.length ? 0.5 : 0) + (reviews.length ? 0.3 : 0) + 0.2;
            readinessScore = Math.round((testPart + reviewPart + coveragePart) / totalWeight);
        }
        return {
            documentsUploaded,
            mockTestsGenerated,
            mindMapsCreated,
            studyKitsGenerated,
            averageScore,
            topicsMastered: mastered.size,
            readinessScore: Math.min(100, Math.max(0, readinessScore))
        };
    }
    async getWeakAreaReport(userId) {
        const [attempts, reviews] = await Promise.all([
            this.attemptRepo.find({ where: { userId }, order: { createdAt: 'DESC' } }),
            this.flashcardReviewRepo.find({ where: { userId }, order: { createdAt: 'DESC' } }),
        ]);
        const weakCounts = new Map();
        const strongCounts = new Map();
        attempts.forEach((attempt) => attempt.weakAreas?.forEach((topic) => weakCounts.set(topic, (weakCounts.get(topic) || 0) + 1)));
        reviews.forEach((review) => {
            const topic = review.topic || 'Flashcard concept';
            const target = review.correct ? strongCounts : weakCounts;
            target.set(topic, (target.get(topic) || 0) + 1);
        });
        const weakTopics = this.topMapKeys(weakCounts);
        const strongTopics = this.topMapKeys(strongCounts);
        return {
            weakTopics,
            strongTopics,
            suggestedRevisionPlan: weakTopics.map((topic, index) => `${index + 1}. Re-read source extracts for ${topic}, answer targeted questions, and review flashcards until score improves.`),
        };
    }
    async generateRevisionPlanner(userId, durationDays) {
        const weakReport = await this.getWeakAreaReport(userId);
        const analytics = await this.getAnalytics(userId);
        const prompt = `Generate a customized study revision roadmap plan.
      Duration: ${durationDays} Days.
      Weak Areas detected: ${JSON.stringify(weakReport.weakTopics)}.
      Mastered Areas: ${JSON.stringify(weakReport.strongTopics)}.
      Current Platform Average Accuracy Score: ${analytics.averageScore}%.
      Provide a comprehensive day-by-day scheduling breakdown in valid JSON format.
      JSON Schema: {
        title: "Study revision plan title",
        duration: ${durationDays},
        schedule: [{ day: "Day X", topic: "Topic details", tasks: ["Task A", "Task B"], expectedHours: 2 }]
      }`;
        try {
            const generated = await this.generateJson(prompt, "Platform history analysis", () => {
                return {
                    title: `${durationDays}-Day Revision Action Map`,
                    duration: durationDays,
                    schedule: Array.from({ length: durationDays }, (_, i) => ({
                        day: `Day ${i + 1}`,
                        topic: weakReport.weakTopics[i % weakReport.weakTopics.length] || 'General Subject Revision',
                        tasks: [`Review past mock test attempts`, `Drill 5 revision flashcards`],
                        expectedHours: 2,
                    })),
                };
            });
            return generated;
        }
        catch (err) {
            throw new common_1.BadRequestException(`Failed to compile revision planner: ${err.message}`);
        }
    }
    async embedAndStoreInQdrant(sourceId, userId, text, kind, metadata = {}) {
        const qdrantClient = this.qdrantService.getClient();
        if (!qdrantClient) {
            this.logger.warn('Qdrant client not initialized. Skipping vector store.');
            return '';
        }
        const existingSource = await this.sourceRepo.findOne({ where: { id: sourceId, userId } });
        if (existingSource?.status === 'Indexed' && existingSource.vectorId) {
            this.logger.log(`Skipping embedding regeneration for already indexed source ${sourceId}`);
            return existingSource.vectorId;
        }
        const sentenceBoundary = /(?<!\b(?:[a-zA-Z]|vs?|supp|art|secs?|nos?|vol|ltd|co|corp|inc|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\.)(?<=[.?!])\s+/i;
        const sentences = text.split(sentenceBoundary).map(s => s.trim()).filter(Boolean);
        const chunkSize = Number(process.env.LEARNING_CHUNK_SIZE || 1400);
        const textChunks = [];
        let currentBuf = [];
        let currentLen = 0;
        for (const sent of sentences) {
            if (currentLen + sent.length > chunkSize && currentBuf.length > 0) {
                textChunks.push(currentBuf.join(' '));
                currentBuf = [sent];
                currentLen = sent.length;
            }
            else {
                currentBuf.push(sent);
                currentLen += sent.length + (currentBuf.length > 1 ? 1 : 0);
            }
        }
        if (currentBuf.length > 0) {
            textChunks.push(currentBuf.join(' '));
        }
        if (textChunks.length === 0)
            return '';
        let embeddings = [];
        try {
            if (this.bgeM3Provider && this.bgeM3Provider.isAvailable()) {
                embeddings = await this.bgeM3Provider.generateBatchEmbeddings(textChunks);
            }
            else {
                embeddings = await Promise.all(textChunks.map(async (chunk) => {
                    const vec = await this.embeddingService.generateEmbedding(chunk);
                    if (vec.length === 1024)
                        return vec;
                    const resized = new Array(1024).fill(0);
                    for (let i = 0; i < Math.min(vec.length, 1024); i++)
                        resized[i] = vec[i];
                    return resized;
                }));
            }
        }
        catch (err) {
            this.logger.error(`Failed to generate embeddings: ${err.message}. Using deterministic fallback.`);
            embeddings = textChunks.map(chunk => {
                let hash = 0;
                for (let i = 0; i < chunk.length; i++) {
                    hash = (hash << 5) - hash + chunk.charCodeAt(i);
                    hash |= 0;
                }
                const random = () => {
                    hash = (hash * 1664525 + 1013904223) % 4294967296;
                    return hash / 4294967296;
                };
                const vec = new Array(1024);
                let sum = 0;
                for (let i = 0; i < 1024; i++) {
                    const val = random() * 2 - 1;
                    vec[i] = val;
                    sum += val * val;
                }
                const mag = Math.sqrt(sum);
                for (let i = 0; i < 1024; i++)
                    vec[i] /= (mag || 1);
                return vec;
            });
        }
        const collection = this.userDocumentsCollection;
        const points = textChunks.map((chunk, index) => {
            const hashStr = `${sourceId}::chunk_${index}`;
            const hash = crypto.createHash('sha256').update(hashStr).digest('hex');
            const pointId = [
                hash.substring(0, 8),
                hash.substring(8, 12),
                hash.substring(12, 16),
                hash.substring(16, 20),
                hash.substring(20, 32)
            ].join('-');
            return {
                id: pointId,
                vector: embeddings[index],
                payload: {
                    text: chunk,
                    chunk_text: chunk,
                    source_id: sourceId,
                    user_id: userId,
                    document_type: metadata.documentType || metadata.kind || 'learning_source',
                    subject: metadata.subject || null,
                    unit: metadata.unit || null,
                    topic: metadata.topic || null,
                    source_priority: metadata.sourcePriority || this.sourcePriority(metadata.kind || kind),
                    chunk_index: index,
                    total_chunks: textChunks.length,
                    page_number: Math.floor(index / 3) + 1,
                    paragraph_index: index + 1,
                    name: metadata.name || 'document',
                    kind: metadata.kind || 'Notes',
                    confidence_score: 0.92,
                    ingested_at: new Date().toISOString()
                }
            };
        });
        try {
            for (const [index, vector] of embeddings.entries()) {
                if (!Array.isArray(vector) || vector.length !== 1024) {
                    throw new Error(`Embedding dimension mismatch for chunk ${index}: expected 1024, got ${vector?.length ?? 0}`);
                }
            }
            await this.upsertQdrantPointsWithRetry(collection, points, sourceId);
            const verifiedCount = await this.countQdrantPointsForSource(sourceId, userId);
            if (verifiedCount < points.length) {
                throw new Error(`Vector verification failed for source ${sourceId}: expected ${points.length}, found ${verifiedCount}`);
            }
            this.logger.log(`Upserted and verified ${verifiedCount} Qdrant points for source ${sourceId}`);
            return points[0].id;
        }
        catch (err) {
            this.logger.error(`Qdrant upsert or verification failed: ${err.message}`);
            return '';
        }
    }
    async upsertQdrantPointsWithRetry(collection, points, sourceId) {
        const qdrantClient = this.qdrantService.getClient();
        const maxAttempts = Number(process.env.LEARNING_QDRANT_UPSERT_RETRIES || 3);
        let lastError;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                await qdrantClient.upsert(collection, { wait: true, points });
                if (attempt > 1) {
                    this.logger.log(`Qdrant upsert succeeded for source ${sourceId} on attempt ${attempt}.`);
                }
                return;
            }
            catch (error) {
                lastError = error;
                this.logger.warn(`Qdrant upsert attempt ${attempt}/${maxAttempts} failed for source ${sourceId}: ${error.message}`);
                if (attempt < maxAttempts) {
                    await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
                }
            }
        }
        throw lastError;
    }
    async countQdrantPointsForSource(sourceId, userId) {
        const qdrantClient = this.qdrantService.getClient();
        const response = await qdrantClient.scroll(this.userDocumentsCollection, {
            filter: {
                must: [
                    { key: 'source_id', match: { value: sourceId } },
                    { key: 'user_id', match: { value: userId } },
                ],
            },
            limit: 10000,
            with_payload: false,
            with_vector: false,
        });
        return response.points?.length || 0;
    }
    async copySourceVectors(originalSourceId, duplicateSourceId, userId) {
        const qdrantClient = this.qdrantService.getClient();
        if (!qdrantClient)
            return '';
        try {
            const response = await qdrantClient.scroll(this.userDocumentsCollection, {
                filter: {
                    must: [
                        { key: 'source_id', match: { value: originalSourceId } },
                        { key: 'user_id', match: { value: userId } },
                    ],
                },
                limit: 10000,
                with_payload: true,
                with_vector: true,
            });
            const originalPoints = response.points || [];
            if (!originalPoints.length)
                return '';
            const copiedPoints = originalPoints.map((point, index) => {
                const hash = crypto.createHash('sha256').update(`${duplicateSourceId}::duplicate_chunk_${index}`).digest('hex');
                const pointId = [hash.substring(0, 8), hash.substring(8, 12), hash.substring(12, 16), hash.substring(16, 20), hash.substring(20, 32)].join('-');
                return {
                    id: pointId,
                    vector: point.vector,
                    payload: {
                        ...(point.payload || {}),
                        source_id: duplicateSourceId,
                        duplicate_of: originalSourceId,
                        copied_at: new Date().toISOString(),
                    },
                };
            });
            await this.upsertQdrantPointsWithRetry(this.userDocumentsCollection, copiedPoints, duplicateSourceId);
            const verifiedCount = await this.countQdrantPointsForSource(duplicateSourceId, userId);
            if (verifiedCount < copiedPoints.length) {
                throw new Error(`Duplicate vector verification failed: expected ${copiedPoints.length}, found ${verifiedCount}`);
            }
            this.logger.log(`Copied and verified ${verifiedCount} duplicate Qdrant points from ${originalSourceId} to ${duplicateSourceId}`);
            return copiedPoints[0].id;
        }
        catch (error) {
            this.logger.warn(`Could not copy duplicate vectors from ${originalSourceId} to ${duplicateSourceId}: ${error.message}`);
            return '';
        }
    }
    async deleteFromQdrant(sourceId) {
        const qdrantClient = this.qdrantService.getClient();
        if (!qdrantClient)
            return;
        try {
            await qdrantClient.delete(this.userDocumentsCollection, {
                filter: {
                    must: [
                        {
                            key: 'source_id',
                            match: { value: sourceId }
                        }
                    ]
                }
            });
            this.logger.log(`Deleted vectors for source ${sourceId} from Qdrant`);
        }
        catch (err) {
            this.logger.error(`Qdrant deletion failed for source ${sourceId}: ${err.message}`);
        }
    }
    async extractYoutubeTranscript(videoUrl) {
        const videoIdMatch = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
        if (!videoIdMatch) {
            throw new common_1.BadRequestException('Invalid YouTube URL format.');
        }
        const videoId = videoIdMatch[1];
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        try {
            const response = await axios_1.default.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                timeout: 15000,
            });
            const html = response.data;
            const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({[\s\S]*?});/);
            if (!playerResponseMatch) {
                throw new Error('ytInitialPlayerResponse not found in YouTube page HTML');
            }
            const playerResponse = JSON.parse(playerResponseMatch[1]);
            const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            if (!captionTracks || captionTracks.length === 0) {
                const title = playerResponse?.videoDetails?.title || 'YouTube Video';
                const description = playerResponse?.videoDetails?.shortDescription || '';
                return `Title: ${title}\n\nDescription:\n${description}\n\n(Note: No captions were found for this video. Extracted title and description.)`;
            }
            let selectedTrack = captionTracks.find((track) => track.languageCode === 'en' || track.languageCode?.startsWith('en'));
            if (!selectedTrack) {
                selectedTrack = captionTracks[0];
            }
            const captionResponse = await axios_1.default.get(selectedTrack.baseUrl, { timeout: 10000 });
            const xml = captionResponse.data;
            const textMatches = xml.match(/<text[^>]*>([\s\S]*?)<\/text>/g);
            if (!textMatches) {
                throw new Error('Could not parse text nodes from caption XML');
            }
            const transcript = textMatches
                .map((matchStr) => {
                const content = matchStr.replace(/<[^>]+>/g, '');
                return content
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'");
            })
                .join(' ');
            const title = playerResponse?.videoDetails?.title || 'YouTube Video';
            return `YouTube Video: ${title}\nTranscript:\n${transcript}`;
        }
        catch (err) {
            this.logger.error(`YouTube caption extraction failed: ${err.message}`);
            throw new common_1.BadRequestException(`Failed to extract YouTube transcript: ${err.message}`);
        }
    }
    async extractPptxText(buffer) {
        try {
            const zip = new AdmZip(buffer);
            const slideEntries = zip.getEntries().filter((entry) => entry.entryName.startsWith('ppt/slides/slide') && entry.entryName.endsWith('.xml'));
            slideEntries.sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true }));
            let text = '';
            for (const entry of slideEntries) {
                const xml = entry.getData().toString('utf8');
                const slideText = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                if (slideText) {
                    text += `[Slide] ${slideText}\n\n`;
                }
            }
            return text.trim();
        }
        catch (error) {
            throw new Error(`PowerPoint parsing failed: ${error.message}`);
        }
    }
    async extractTextForUpload(buffer, ext, originalName) {
        const normalizedExt = ext.toLowerCase();
        let text = '';
        if (normalizedExt === 'pptx') {
            text = await this.extractPptxText(buffer);
        }
        else {
            text = await this.extractFileText(buffer, normalizedExt);
        }
        text = String(text || '').trim();
        if (text.length >= 40)
            return text;
        if (['jpg', 'jpeg', 'png', 'webp'].includes(normalizedExt)) {
            return [
                `Image note uploaded: ${originalName}.`,
                'OCR pending: this image has been accepted into the study material queue and can be reprocessed by an OCR worker.',
                'Use this source as scanned or handwritten notes metadata until OCR text is available.',
            ].join(' ');
        }
        if (normalizedExt === 'pdf') {
            return [
                `Scanned PDF uploaded: ${originalName}.`,
                'OCR pending: this scanned document has been accepted and queued for background text extraction.',
                'The ingestion system keeps the file available for later OCR reprocessing.',
            ].join(' ');
        }
        throw new common_1.BadRequestException(`Could not extract enough text from ${originalName}.`);
    }
    async extractFileText(buffer, ext) {
        if (ext === 'pdf') {
            const pdfParse = require('pdf-parse');
            const parsed = await pdfParse(buffer);
            return String(parsed.text || '').trim();
        }
        if (ext === 'docx') {
            const zip = new AdmZip(buffer);
            const xml = zip.getEntry('word/document.xml')?.getData().toString('utf8') || '';
            return xml.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }
        if (ext === 'md' || ext === 'csv' || ext === 'txt') {
            return buffer.toString('utf8').trim();
        }
        return buffer.toString('utf8').trim();
    }
    async extractUrlText(url) {
        const response = await axios_1.default.get(url, { timeout: 12000, responseType: 'text' });
        return String(response.data || '')
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    async saveSource(userId, kind, name, text, metadata = {}, url) {
        return this.sourceRepo.save(this.sourceRepo.create({
            userId,
            kind,
            status: 'Indexed',
            indexingProgress: 100,
            documentType: metadata.documentType || kind,
            subject: metadata.subject || null,
            unit: metadata.unit || null,
            topic: metadata.topic || null,
            name,
            url: url || null,
            text,
            textLength: text.length,
            metadata,
        }));
    }
    persistFile(userId, originalName, buffer) {
        const safeUser = this.safe(userId);
        const safeName = this.safe(originalName);
        const dir = path.resolve(process.cwd(), 'uploads', 'learning-workspace', safeUser);
        fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, `${crypto.randomUUID()}-${safeName}`);
        fs.writeFileSync(filePath, buffer);
        return filePath;
    }
    isSupportedUploadExtension(ext) {
        return ['pdf', 'docx', 'pptx', 'txt', 'md', 'csv', 'jpg', 'jpeg', 'png', 'webp', 'zip'].includes(ext.toLowerCase());
    }
    expandZipFiles(file) {
        const zip = new AdmZip(file.buffer);
        return zip.getEntries()
            .filter((entry) => !entry.isDirectory)
            .map((entry) => {
            const name = path.basename(entry.entryName);
            const ext = name.split('.').pop()?.toLowerCase() || '';
            if (!name || !this.isSupportedUploadExtension(ext) || ext === 'zip')
                return null;
            const buffer = entry.getData();
            return {
                originalname: name,
                buffer,
                size: buffer.length,
                mimetype: this.mimeFromExtension(ext),
            };
        })
            .filter(Boolean);
    }
    mimeFromExtension(ext) {
        const map = {
            pdf: 'application/pdf',
            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            txt: 'text/plain',
            md: 'text/markdown',
            csv: 'text/csv',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            webp: 'image/webp',
            zip: 'application/zip',
        };
        return map[ext] || 'application/octet-stream';
    }
    detectStudyMetadata(name, text, fallbackKind) {
        const haystack = `${name}\n${text.slice(0, 3000)}`.toLowerCase();
        const kind = this.detectSourceKind(haystack, fallbackKind);
        const subject = this.detectSubject(haystack);
        const unit = this.detectUnit(haystack);
        const topic = this.detectTopicFromMaterial(name, text, subject);
        return {
            kind,
            documentType: kind,
            subject,
            unit,
            topic,
            sourcePriority: this.sourcePriority(kind),
            concepts: this.extractConcepts(text),
        };
    }
    detectSourceKind(haystack, fallbackKind) {
        if (/\bteacher|faculty|professor|class lecture|lecture notes\b/i.test(haystack))
            return 'Teacher Notes';
        if (/\bprevious year|pyq|past paper|question paper|university exam|end semester\b/i.test(haystack))
            return 'Previous Year Paper';
        if (/\bsample paper|model paper|practice paper\b/i.test(haystack))
            return 'Sample Paper';
        if (/\bsyllabus|course outline|learning outcomes\b/i.test(haystack))
            return 'Syllabus';
        if (/\bppt|slides?|presentation\b/i.test(haystack))
            return 'PPT Slides';
        if (/\bassignment|tutorial|worksheet\b/i.test(haystack))
            return 'Assignment';
        if (/\blab manual|practical\b/i.test(haystack))
            return 'Lab Manual';
        if (/\bcase study|case-study\b/i.test(haystack))
            return 'Case Study';
        if (/\breference book|textbook|chapter\b/i.test(haystack))
            return 'Reference Material';
        if (/\bresearch article|journal|abstract|keywords\b/i.test(haystack))
            return 'Research Article';
        if (/\bhandwritten|scan|scanned|image note\b/i.test(haystack))
            return 'Scanned Notes';
        return fallbackKind || 'Study Material';
    }
    detectSubject(haystack) {
        const subjects = [
            'Constitutional Law',
            'Criminal Law',
            'Contract Law',
            'Jurisprudence',
            'Administrative Law',
            'Family Law',
            'Property Law',
            'Company Law',
            'Evidence Law',
            'Civil Procedure',
        ];
        const found = subjects.find((subject) => haystack.includes(subject.toLowerCase()));
        if (found)
            return found;
        if (/\bfundamental rights|dpsp|basic structure|article\s+\d+\b/i.test(haystack))
            return 'Constitutional Law';
        if (/\bcontract|consideration|offer|acceptance|breach\b/i.test(haystack))
            return 'Contract Law';
        if (/\bevidence|burden of proof|admissib/i.test(haystack))
            return 'Evidence Law';
        return 'Auto-detected Study Material';
    }
    detectUnit(haystack) {
        const explicit = haystack.match(/\bunit\s*[-: ]\s*([ivx\d]+[a-z]?)(?:\s*[-:]\s*([a-z0-9 ,()/-]{3,80}))?/i);
        if (explicit)
            return explicit[2]?.trim() || `Unit ${explicit[1].toUpperCase()}`;
        if (/\bfundamental rights\b/i.test(haystack))
            return 'Fundamental Rights';
        if (/\bdirective principles|dpsp\b/i.test(haystack))
            return 'DPSP';
        if (/\bbasic structure\b/i.test(haystack))
            return 'Basic Structure';
        return null;
    }
    detectTopicFromMaterial(name, text, subject) {
        const firstHeading = text.split(/\r?\n/).map((line) => line.trim()).find((line) => line.length >= 6 && line.length <= 90);
        const cleanName = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
        return firstHeading || cleanName || subject;
    }
    sourcePriority(kind) {
        const order = ['Teacher Notes', 'Previous Year Paper', 'Sample Paper', 'Syllabus', 'PPT Slides', 'Student Notes', 'Reference Material'];
        const index = order.findIndex((item) => item.toLowerCase() === String(kind).toLowerCase());
        return index === -1 ? 50 : index + 1;
    }
    extractConcepts(text) {
        return Array.from(new Set([
            ...this.matches(text, /\bArticle\s+\d+[A-Z]?(?:\([^)]+\))?/gi),
            ...this.matches(text, /\bSection\s+\d+[A-Z]?(?:\([^)]+\))?/gi),
            ...this.matches(text, /\b[A-Z][A-Za-z0-9 ]{3,50}\s+(?:Doctrine|Principle|Rule|Test)\b/g),
        ])).slice(0, 20);
    }
    async compileMockTest(test, format) {
        if (format === 'pdf') {
            return { contentType: 'application/pdf', buffer: await this.compileMockTestPdf(test) };
        }
        if (format === 'docx') {
            return { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: await this.compileMockTestDocx(test) };
        }
        if (format === 'pptx') {
            return { contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer: await this.compileMockTestPptx(test) };
        }
        throw new common_1.NotFoundException('Format not supported');
    }
    async compileMockTestDocx(test) {
        const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
        const docChildren = [
            new Paragraph({ text: 'LEGATRIXON™ ACADEMIC SUITE', heading: HeadingLevel.HEADING_2, alignment: 'center' }),
            new Paragraph({ text: 'AI MOCK TEST ASSESSMENT REPORT', heading: HeadingLevel.TITLE, alignment: 'center' }),
            new Paragraph({
                children: [
                    new TextRun({ text: `Topic: ${test.topic}`, bold: true }),
                    new TextRun({ text: `\nDifficulty: ${test.difficulty}` }),
                    new TextRun({ text: `\nQuestions: ${test.questionCount}` }),
                    new TextRun({ text: `\nFormat: ${test.questionType}` }),
                    new TextRun({ text: `\nCompiled At: ${test.createdAt.toLocaleDateString()}` }),
                ],
                spacing: { before: 200, after: 400 },
            }),
            new Paragraph({ text: 'Question Paper (Descriptive)', heading: HeadingLevel.HEADING_1 }),
        ];
        test.questions.forEach((q, idx) => {
            docChildren.push(new Paragraph({
                children: [
                    new TextRun({ text: `Question ${idx + 1} (${q.marks || 15} Marks)\n`, bold: true }),
                    new TextRun({ text: `${q.question}` }),
                ],
                spacing: { before: 150, after: 120 }
            }));
        });
        docChildren.push(new Paragraph({ text: 'Model Answers & Reference Analysis', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 150 } }));
        test.questions.forEach((q, idx) => {
            docChildren.push(new Paragraph({
                children: [
                    new TextRun({ text: `Question ${idx + 1} (${q.marks || 15} Marks)`, bold: true, size: 24 })
                ],
                spacing: { before: 200, after: 80 }
            }));
            docChildren.push(new Paragraph({
                children: [
                    new TextRun({ text: q.question, italic: true, size: 20 })
                ],
                spacing: { before: 60, after: 100 }
            }));
            const ans = getQuestionDetailedAnswer(q);
            if (ans) {
                const answerWords = ans.wordCount || String(ans.modelAnswer || '').trim().split(/\s+/).filter(Boolean).length;
                docChildren.push(new Paragraph({
                    children: [
                        new TextRun({ text: `Word Count: ${answerWords} words | Target: ${ans.answerLengthTarget || 'marks-based'}`, bold: true, size: 20, color: '4B5563' })
                    ],
                    spacing: { before: 80, after: 120 }
                }));
                if (ans.insufficientMaterialWarning) {
                    docChildren.push(new Paragraph({
                        children: [
                            new TextRun({ text: `Source Quality Warning: ${ans.insufficientMaterialWarning}`, bold: true, color: 'D97706', size: 20 })
                        ],
                        spacing: { before: 60, after: 100 }
                    }));
                }
                const modelAnsStr = ans.modelAnswer || '';
                const lines = modelAnsStr.split(/\r?\n/);
                lines.forEach((line) => {
                    const trimmed = line.trim();
                    if (!trimmed)
                        return;
                    const isHeading = trimmed.startsWith('#') ||
                        /^(?:\d+\.|\b[IVXLCDM]+\.)\s+[A-Z]/i.test(trimmed) ||
                        /^(?:Introduction|Background and Context|Legal Issues|Relevant Statutory Framework|Detailed Explanation|Case Laws and Judgments|Critical Analysis|Application|Important Points|Conclusion|Source Grounding)/i.test(trimmed);
                    if (isHeading) {
                        const cleanHeading = trimmed.replace(/^#+\s*/, '');
                        docChildren.push(new Paragraph({
                            children: [new TextRun({ text: cleanHeading, bold: true, size: 22, color: '1B2838' })],
                            spacing: { before: 180, after: 80 }
                        }));
                    }
                    else {
                        const cleanLine = trimmed.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');
                        docChildren.push(new Paragraph({
                            children: [new TextRun({ text: cleanLine, size: 20 })],
                            spacing: { before: 60, after: 60 }
                        }));
                    }
                });
                if (ans.importantJudgments && ans.importantJudgments.length > 0) {
                    docChildren.push(new Paragraph({
                        children: [new TextRun({ text: `Important Judgments Mentioned:`, bold: true, size: 22, color: '1B2838' })],
                        spacing: { before: 120, after: 60 }
                    }));
                    ans.importantJudgments.forEach((j) => {
                        docChildren.push(new Paragraph({
                            children: [new TextRun({ text: `• ${j}`, size: 20, color: 'E07A5F' })],
                            spacing: { before: 40, after: 40 }
                        }));
                    });
                }
                if (ans.relevantArticles && ans.relevantArticles.length > 0) {
                    docChildren.push(new Paragraph({
                        children: [
                            new TextRun({ text: `Relevant Articles: `, bold: true, size: 20 }),
                            new TextRun({ text: ans.relevantArticles.join(', '), size: 20, color: '457B9D' })
                        ],
                        spacing: { before: 80, after: 80 }
                    }));
                }
                if (ans.relevantSections && ans.relevantSections.length > 0) {
                    docChildren.push(new Paragraph({
                        children: [
                            new TextRun({ text: `Relevant Sections: `, bold: true, size: 20 }),
                            new TextRun({ text: ans.relevantSections.join(', '), size: 20, color: 'E63946' })
                        ],
                        spacing: { before: 80, after: 80 }
                    }));
                }
                if (ans.sourcesUsed && ans.sourcesUsed.length > 0) {
                    docChildren.push(new Paragraph({
                        children: [
                            new TextRun({ text: `Sources Grounded: `, bold: true, size: 20 }),
                            new TextRun({ text: ans.sourcesUsed.join(', '), size: 20, color: '555555' })
                        ],
                        spacing: { before: 80, after: 80 }
                    }));
                }
                const groundingChunks = [];
                if (ans) {
                    if (Array.isArray(ans.citations) && ans.citations.length > 0) {
                        ans.citations.forEach((c) => {
                            groundingChunks.push({
                                documentName: c.sourceName || 'Uploaded Study Material',
                                pageNumber: c.page || 'Page 1',
                                chunkId: c.chunkRef || 'N/A',
                                excerpt: c.supportingText || ''
                            });
                        });
                    }
                    else if (Array.isArray(ans.sourceChunks) && ans.sourceChunks.length > 0) {
                        ans.sourceChunks.forEach((c) => {
                            groundingChunks.push({
                                documentName: c.documentName || 'Uploaded Study Material',
                                pageNumber: c.pageNumber || 1,
                                chunkId: c.chunkId || c.sourceChunk || 'N/A',
                                excerpt: c.excerpt || c.supportingText || ''
                            });
                        });
                    }
                }
                if (groundingChunks.length === 0) {
                    if (Array.isArray(q.sourceChunks) && q.sourceChunks.length > 0) {
                        q.sourceChunks.forEach((c) => {
                            groundingChunks.push({
                                documentName: c.documentName || 'Uploaded Study Material',
                                pageNumber: c.pageNumber || 1,
                                chunkId: c.chunkId || c.sourceChunk || 'N/A',
                                excerpt: c.excerpt || c.supportingText || ''
                            });
                        });
                    }
                    else if (Array.isArray(q.grounding?.sourceChunks) && q.grounding.sourceChunks.length > 0) {
                        q.grounding.sourceChunks.forEach((c) => {
                            groundingChunks.push({
                                documentName: c.documentName || 'Uploaded Study Material',
                                pageNumber: c.pageNumber || 1,
                                chunkId: c.chunkId || c.sourceChunk || 'N/A',
                                excerpt: c.excerpt || c.supportingText || ''
                            });
                        });
                    }
                    else if (q.sourceDocument || q.grounding?.documentName) {
                        groundingChunks.push({
                            documentName: q.sourceDocument || q.grounding?.documentName || 'Uploaded Study Material',
                            pageNumber: q.sourcePage || q.grounding?.pageNumber || 1,
                            chunkId: q.sourceChunk || q.grounding?.chunkId || 'N/A',
                            excerpt: q.grounding?.excerpt || q.grounding?.snippet || ''
                        });
                    }
                }
                if (groundingChunks.length > 0) {
                    docChildren.push(new Paragraph({
                        children: [new TextRun({ text: `Source Grounding (Reference Citations):`, bold: true, size: 22, color: '1B2838' })],
                        spacing: { before: 120, after: 60 }
                    }));
                    groundingChunks.forEach((chunk, chunkIndex) => {
                        const docName = chunk.documentName || 'Uploaded Study Material';
                        const pageNum = chunk.pageNumber || 1;
                        const chunkId = chunk.chunkId || 'N/A';
                        const excerptText = chunk.excerpt || '';
                        docChildren.push(new Paragraph({
                            children: [
                                new TextRun({ text: `${chunkIndex + 1}. [Source] `, bold: true, size: 20 }),
                                new TextRun({ text: `${docName} (${typeof pageNum === 'string' && pageNum.includes('Page') ? pageNum : `Page ${pageNum}`}, ID: ${chunkId})\n`, bold: true, italic: true, size: 20 }),
                                new TextRun({ text: excerptText ? `"${excerptText.trim()}"` : 'Excerpt not available.', italic: true, size: 18, color: '555555' })
                            ],
                            spacing: { before: 60, after: 60 }
                        }));
                    });
                }
            }
            else {
                docChildren.push(new Paragraph({
                    children: [new TextRun({ text: `Model answer has not been generated for this question yet.`, italic: true, size: 20, color: '888888' })],
                    spacing: { before: 100, after: 100 }
                }));
            }
        });
        const doc = new Document({
            sections: [{ properties: {}, children: docChildren }]
        });
        return Packer.toBuffer(doc);
    }
    async compileMockTestPptx(test) {
        const PptxGenJS = require('pptxgenjs');
        const pptx = new PptxGenJS();
        pptx.layout = 'LAYOUT_16x9';
        const slide1 = pptx.addSlide();
        slide1.background = { color: '1b2838' };
        slide1.addText('LEGATRIXON™', { x: 1.0, y: 1.5, w: 8.0, h: 0.8, fontSize: 32, bold: true, color: 'c5a880', fontFace: 'Georgia' });
        slide1.addText('AI MOCK TEST ASSESSMENT REPORT', { x: 1.0, y: 2.5, w: 8.0, h: 0.6, fontSize: 20, bold: true, color: 'ffffff' });
        slide1.addText(`Topic: ${test.topic}\nDifficulty: ${test.difficulty}\nQuestions: ${test.questionCount}\nCompiled: ${test.createdAt.toLocaleDateString()}`, { x: 1.0, y: 3.6, w: 8.0, h: 1.5, fontSize: 14, color: 'cccccc' });
        test.questions.forEach((q, idx) => {
            const slide = pptx.addSlide();
            slide.addText(`Question ${idx + 1} of ${test.questionCount} (${q.marks || 15} Marks)`, { x: 0.5, y: 0.5, w: 9.0, h: 0.6, fontSize: 20, bold: true, color: '1b2838' });
            slide.addText(q.question, { x: 0.5, y: 1.5, w: 9.0, h: 2.5, fontSize: 16, color: '333333', bold: true });
            slide.addText('[Mains / Descriptive Response Sheet]', { x: 0.5, y: 4.2, w: 9.0, h: 1.0, fontSize: 14, color: '888888', italic: true });
            const ansSlide = pptx.addSlide();
            ansSlide.addText(`Question ${idx + 1} - Model Answer & Legal Analysis`, { x: 0.5, y: 0.5, w: 9.0, h: 0.6, fontSize: 20, bold: true, color: '1b2838' });
            const ans = getQuestionDetailedAnswer(q);
            let ansText = '';
            if (ans) {
                ansText += `Model Answer Summary:\n${(ans.modelAnswer || '').slice(0, 800)}...\n\n`;
                if (ans.importantJudgments && ans.importantJudgments.length > 0) {
                    ansText += `Important Judgments: ${ans.importantJudgments.slice(0, 3).join('; ')}\n`;
                }
                if (ans.relevantArticles && ans.relevantArticles.length > 0) {
                    ansText += `Relevant Articles: ${ans.relevantArticles.join(', ')}\n`;
                }
                if (ans.relevantSections && ans.relevantSections.length > 0) {
                    ansText += `Relevant Sections: ${ans.relevantSections.join(', ')}\n`;
                }
                if (ans.sourcesUsed && ans.sourcesUsed.length > 0) {
                    ansText += `Sources: ${ans.sourcesUsed.join(', ')}`;
                }
            }
            else {
                ansText += 'Model answer has not been generated for this question yet.';
            }
            ansSlide.addText(ansText, { x: 0.5, y: 1.2, w: 9.0, h: 5.0, fontSize: 12, color: '333333' });
        });
        const data = await pptx.write('nodebuffer');
        return data;
    }
    async compileStudyKit(kit, format) {
        if (format === 'pdf') {
            return { contentType: 'application/pdf', buffer: await this.compileStudyKitPdf(kit) };
        }
        if (format === 'docx') {
            return { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: await this.compileStudyKitDocx(kit) };
        }
        if (format === 'pptx') {
            return { contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer: await this.compileStudyKitPptx(kit) };
        }
        throw new common_1.NotFoundException('Format not supported');
    }
    async compileStudyKitDocx(kit) {
        const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
        const content = kit.content || {};
        const docChildren = [
            new Paragraph({ text: 'LEGATRIXON™ ACADEMIC SUITE', heading: HeadingLevel.HEADING_2, alignment: 'center' }),
            new Paragraph({ text: 'SMART STUDY KIT FORGE™ REPORT', heading: HeadingLevel.TITLE, alignment: 'center' }),
            new Paragraph({
                children: [
                    new TextRun({ text: kit.title, bold: true }),
                    new TextRun({ text: `\nCompiled At: ${kit.createdAt.toLocaleDateString()}` }),
                ],
                spacing: { before: 200, after: 400 },
            }),
            new Paragraph({ text: '1. Executive Summary', heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: content.summary || 'N/A', spacing: { before: 100, after: 200 } }),
            new Paragraph({ text: '2. Core Key Concepts', heading: HeadingLevel.HEADING_1 }),
        ];
        if (content.keyConcepts && content.keyConcepts.length > 0) {
            content.keyConcepts.forEach((c) => {
                docChildren.push(new Paragraph({
                    children: [
                        new TextRun({ text: c.title, bold: true }),
                        new TextRun({ text: `\n${c.explanation}` }),
                    ],
                    spacing: { before: 100, after: 100 }
                }));
            });
        }
        else {
            docChildren.push(new Paragraph('No core concepts documented.'));
        }
        docChildren.push(new Paragraph({ text: '3. Landmark Precedents & Cases', heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }));
        if (content.importantCases && content.importantCases.length > 0) {
            content.importantCases.forEach((c) => {
                docChildren.push(new Paragraph({
                    children: [
                        new TextRun({ text: c.caseName, bold: true }),
                        new TextRun({ text: `\n${c.summary}` }),
                    ],
                    spacing: { before: 100, after: 100 }
                }));
            });
        }
        else {
            docChildren.push(new Paragraph('No landmark cases documented.'));
        }
        docChildren.push(new Paragraph({ text: '4. Detailed Revision Notes', heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }));
        docChildren.push(new Paragraph({ text: content.revisionNotes || content.onePageNotes || 'N/A', spacing: { before: 100 } }));
        const doc = new Document({
            sections: [{ properties: {}, children: docChildren }]
        });
        return Packer.toBuffer(doc);
    }
    async compileStudyKitPptx(kit) {
        const PptxGenJS = require('pptxgenjs');
        const pptx = new PptxGenJS();
        pptx.layout = 'LAYOUT_16x9';
        const slide1 = pptx.addSlide();
        slide1.background = { color: '1b2838' };
        slide1.addText('LEGATRIXON™ ACADEMIC SUITE', { x: 1.0, y: 1.5, w: 8.0, h: 0.8, fontSize: 32, bold: true, color: 'c5a880', fontFace: 'Georgia' });
        slide1.addText('SMART STUDY KIT FORGE™', { x: 1.0, y: 2.5, w: 8.0, h: 0.6, fontSize: 20, bold: true, color: 'ffffff' });
        slide1.addText(`${kit.title}\nCompiled: ${kit.createdAt.toLocaleDateString()}`, { x: 1.0, y: 3.5, w: 8.0, h: 1.5, fontSize: 14, color: 'cccccc' });
        const content = kit.content || {};
        const slide2 = pptx.addSlide();
        slide2.addText('EXECUTIVE SUMMARY', { x: 0.5, y: 0.5, w: 9.0, h: 0.6, fontSize: 20, bold: true, color: '1b2838' });
        slide2.addText(content.summary || 'N/A', { x: 0.5, y: 1.2, w: 9.0, h: 5.0, fontSize: 13, color: '333333' });
        const slide3 = pptx.addSlide();
        slide3.addText('CORE KEY CONCEPTS', { x: 0.5, y: 0.5, w: 9.0, h: 0.6, fontSize: 20, bold: true, color: '1b2838' });
        const conceptsText = content.keyConcepts?.map((c) => `• ${c.title}: ${c.explanation}`).slice(0, 4).join('\n\n');
        slide3.addText(conceptsText || 'No concepts available.', { x: 0.5, y: 1.2, w: 9.0, h: 5.0, fontSize: 13, color: '333333' });
        const slide4 = pptx.addSlide();
        slide4.addText('LANDMARK PRECEDENTS', { x: 0.5, y: 0.5, w: 9.0, h: 0.6, fontSize: 20, bold: true, color: '1b2838' });
        const casesText = content.importantCases?.map((c) => `• ${c.caseName}: ${c.summary}`).slice(0, 3).join('\n\n');
        slide4.addText(casesText || 'No precedents available.', { x: 0.5, y: 1.2, w: 9.0, h: 5.0, fontSize: 13, color: '333333' });
        const slide5 = pptx.addSlide();
        slide5.addText('DETAILED REVISION NOTES', { x: 0.5, y: 0.5, w: 9.0, h: 0.6, fontSize: 20, bold: true, color: '1b2838' });
        slide5.addText(content.revisionNotes || content.onePageNotes || 'N/A', { x: 0.5, y: 1.2, w: 9.0, h: 5.0, fontSize: 12, color: '333333' });
        const data = await pptx.write('nodebuffer');
        return data;
    }
    async compileMindMap(map, format) {
        if (format === 'pdf') {
            return { contentType: 'application/pdf', buffer: await this.compileMindMapPdf(map) };
        }
        if (format === 'docx') {
            return { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: await this.compileMindMapDocx(map) };
        }
        if (format === 'pptx') {
            return { contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer: await this.compileMindMapPptx(map) };
        }
        throw new common_1.NotFoundException('Format not supported');
    }
    async compileMindMapDocx(map) {
        const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
        const docChildren = [
            new Paragraph({ text: 'LEGATRIXON™ ACADEMIC SUITE', heading: HeadingLevel.HEADING_2, alignment: 'center' }),
            new Paragraph({ text: 'AI MIND MAP ARCHITECT™ REPORT', heading: HeadingLevel.TITLE, alignment: 'center' }),
            new Paragraph({
                children: [
                    new TextRun({ text: map.title, bold: true }),
                    new TextRun({ text: `\nStructure Type: ${map.structureType}` }),
                    new TextRun({ text: `\nCompiled At: ${map.createdAt.toLocaleDateString()}` }),
                ],
                spacing: { before: 200, after: 400 },
            }),
            new Paragraph({ text: 'Visual Hierarchy Map Outline', heading: HeadingLevel.HEADING_1 }),
        ];
        const writeNode = (node, level = 0) => {
            if (!node)
                return;
            const indent = '    '.repeat(level);
            const typeNorm = node.type === 'Case Law' ? 'Case' : (node.type === 'Bare Act' ? 'Section' : (node.type || 'Concept'));
            docChildren.push(new Paragraph({
                children: [
                    new TextRun({ text: `${indent}├─ [${typeNorm}] ${node.label}`, bold: level === 0 }),
                ],
                spacing: { before: 60, after: 20 }
            }));
            const def = node.definition || node.summary || '';
            if (def) {
                docChildren.push(new Paragraph({
                    children: [new TextRun({ text: `${indent}   Definition: ${def}`, italics: true })],
                    spacing: { before: 20, after: 20 }
                }));
            }
            const explanation = node.full_content || node.detailedExplanation || '';
            if (explanation) {
                docChildren.push(new Paragraph({
                    text: `${indent}   Explanation: ${explanation}`,
                    spacing: { before: 20, after: 20 }
                }));
            }
            const relations = [];
            if (node.relatedConcepts && node.relatedConcepts.length > 0)
                relations.push(`Related: ${node.relatedConcepts.join(', ')}`);
            if (node.relatedCases && node.relatedCases.length > 0)
                relations.push(`Cases: ${node.relatedCases.join(', ')}`);
            if (relations.length > 0) {
                docChildren.push(new Paragraph({
                    children: [new TextRun({ text: `${indent}   ${relations.join(' | ')}`, color: '8b5cf6' })],
                    spacing: { before: 20, after: 20 }
                }));
            }
            if (node.children && node.children.length > 0) {
                node.children.forEach((c) => writeNode(c, level + 1));
            }
        };
        writeNode(map.map);
        const doc = new Document({
            sections: [{ properties: {}, children: docChildren }]
        });
        return Packer.toBuffer(doc);
    }
    async compileMindMapPptx(map) {
        const PptxGenJS = require('pptxgenjs');
        const pptx = new PptxGenJS();
        pptx.layout = 'LAYOUT_16x9';
        const slide1 = pptx.addSlide();
        slide1.background = { color: '1b2838' };
        slide1.addText('LEGATRIXON™ ACADEMIC SUITE', { x: 1.0, y: 1.5, w: 8.0, h: 0.8, fontSize: 32, bold: true, color: 'c5a880', fontFace: 'Georgia' });
        slide1.addText('AI MIND MAP ARCHITECT™', { x: 1.0, y: 2.5, w: 8.0, h: 0.6, fontSize: 20, bold: true, color: 'ffffff' });
        slide1.addText(`${map.title}\nStructure: ${map.structureType}\nCompiled: ${map.createdAt.toLocaleDateString()}`, { x: 1.0, y: 3.5, w: 8.0, h: 1.5, fontSize: 14, color: 'cccccc' });
        const slide2 = pptx.addSlide();
        slide2.addText('MIND MAP TREE STRUCTURE', { x: 0.5, y: 0.5, w: 9.0, h: 0.6, fontSize: 20, bold: true, color: '1b2838' });
        const lines = [];
        const writeNode = (node, level = 0) => {
            if (!node)
                return;
            const indent = '  '.repeat(level);
            const typeNorm = node.type === 'Case Law' ? 'Case' : (node.type === 'Bare Act' ? 'Section' : (node.type || 'Concept'));
            lines.push(`${indent}• [${typeNorm}] ${node.label}`);
            if (node.children && node.children.length > 0 && level < 3) {
                node.children.forEach((c) => writeNode(c, level + 1));
            }
        };
        writeNode(map.map);
        slide2.addText(lines.slice(0, 12).join('\n'), { x: 0.5, y: 1.2, w: 9.0, h: 5.0, fontSize: 13, color: '333333' });
        const slide3 = pptx.addSlide();
        slide3.addText('CORE CONCEPT INFORMATION', { x: 0.5, y: 0.5, w: 9.0, h: 0.6, fontSize: 20, bold: true, color: '1b2838' });
        const details = [];
        const collectDetails = (node) => {
            if (!node)
                return;
            if (node.definition || node.summary) {
                details.push(`- ${node.label} (${node.type || 'Concept'}): ${node.definition || node.summary}`);
            }
            if (node.children)
                node.children.forEach((c) => collectDetails(c));
        };
        collectDetails(map.map);
        slide3.addText(details.slice(0, 5).join('\n\n'), { x: 0.5, y: 1.2, w: 9.0, h: 5.0, fontSize: 13, color: '333333' });
        const data = await pptx.write('nodebuffer');
        return data;
    }
    async compileMockTestPdf(test) {
        return new Promise((resolve, reject) => {
            try {
                const PDFDocument = require('pdfkit');
                const doc = new PDFDocument({ margin: 50, size: 'A4' });
                const buffers = [];
                doc.on('data', (chunk) => buffers.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(buffers)));
                doc.rect(20, 20, 555, 800).lineWidth(3).stroke('#c5a880');
                doc.rect(25, 25, 545, 790).lineWidth(1).stroke('#c5a880');
                doc.moveDown(8);
                doc.fillColor('#1b2838').fontSize(26).font('Helvetica-Bold').text('LEGATRIXON™', { align: 'center' });
                doc.moveDown(0.5);
                doc.fillColor('#c5a880').fontSize(18).font('Helvetica-Bold').text('AI MOCK TEST ASSESSMENT REPORT', { align: 'center' });
                doc.moveDown(2);
                doc.fillColor('#333333').fontSize(12).font('Helvetica-Bold').text(`Topic: ${test.topic}`, { align: 'center' });
                doc.text(`Difficulty: ${test.difficulty}`, { align: 'center' });
                doc.text(`Questions: ${test.questionCount}`, { align: 'center' });
                doc.text(`Format: ${test.questionType}`, { align: 'center' });
                doc.moveDown(10);
                doc.fontSize(10).fillColor('#777777').text(`Compiled on: ${test.createdAt.toLocaleDateString()}`, { align: 'center' });
                doc.text('Authorized Judiciary Assessment Document', { align: 'center' });
                doc.addPage();
                doc.fillColor('#1b2838').fontSize(16).font('Helvetica-Bold').text('QUESTION PAPER (DESCRIPTIVE)');
                doc.rect(doc.x, doc.y + 2, 500, 2).fill('#c5a880');
                doc.moveDown(1.5);
                test.questions.forEach((q, idx) => {
                    doc.fillColor('#1b2838').fontSize(11).font('Helvetica-Bold').text(`Question ${idx + 1} (${q.marks || 15} Marks)`);
                    doc.fillColor('#333333').fontSize(10).font('Helvetica').text(q.question);
                    doc.moveDown(0.8);
                    if (q.citations && q.citations.length > 0) {
                        doc.fillColor('#9a7849').fontSize(8).font('Helvetica-Oblique').text(`   Citation: ${q.citations[0].sourceName} · ${q.citations[0].section || ''}`);
                        doc.moveDown(0.8);
                    }
                    doc.moveDown(1.0);
                });
                doc.addPage();
                doc.fillColor('#1b2838').fontSize(16).font('Helvetica-Bold').text('MODEL ANSWERS & REFERENCE ANALYSIS');
                doc.rect(doc.x, doc.y + 2, 500, 2).fill('#c5a880');
                doc.moveDown(1.5);
                test.questions.forEach((q, idx) => {
                    doc.fillColor('#1b2838').fontSize(12).font('Helvetica-Bold').text(`Question ${idx + 1} (${q.marks || 15} Marks)`);
                    doc.fillColor('#333333').fontSize(10).font('Helvetica').text(q.question);
                    doc.moveDown(0.8);
                    const ans = getQuestionDetailedAnswer(q);
                    if (ans) {
                        const answerWords = ans.wordCount || String(ans.modelAnswer || '').trim().split(/\s+/).filter(Boolean).length;
                        doc.fillColor('#1b2838').fontSize(10).font('Helvetica-Bold').text(`Word Count: ${answerWords} | Target: ${ans.answerLengthTarget || 'marks-based'}`);
                        if (ans.insufficientMaterialWarning) {
                            doc.fillColor('#9a7849').fontSize(9).font('Helvetica-Bold').text(`Warning: ${ans.insufficientMaterialWarning}`);
                        }
                        doc.moveDown(0.5);
                        doc.fillColor('#1b2838').fontSize(10).font('Helvetica-Bold').text('Detailed Model Answer:');
                        doc.moveDown(0.3);
                        const lines = String(ans.modelAnswer || '').split(/\r?\n/);
                        lines.forEach((line) => {
                            const trimmed = line.trim();
                            if (!trimmed) {
                                doc.moveDown(0.4);
                                return;
                            }
                            const isHeading = trimmed.startsWith('#') ||
                                /^(?:\d+\.|\b[IVXLCDM]+\.)\s+[A-Z]/i.test(trimmed) ||
                                /^(?:Introduction|Background and Context|Legal Issues|Relevant Statutory Framework|Detailed Explanation|Case Laws and Judgments|Critical Analysis|Application|Important Points|Conclusion|Source Grounding)/i.test(trimmed);
                            if (isHeading) {
                                const cleanHeading = trimmed.replace(/^#+\s*/, '');
                                doc.moveDown(0.6);
                                doc.fillColor('#1b2838').fontSize(10.5).font('Helvetica-Bold').text(cleanHeading);
                                doc.moveDown(0.3);
                            }
                            else {
                                const cleanLine = trimmed.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');
                                doc.fillColor('#444444').fontSize(9.5).font('Helvetica').text(cleanLine, { align: 'justify', lineGap: 2 });
                                doc.moveDown(0.4);
                            }
                        });
                        doc.moveDown(0.5);
                        if (ans.importantJudgments && ans.importantJudgments.length > 0) {
                            doc.fillColor('#1b2838').fontSize(10).font('Helvetica-Bold').text('Important Judgments:');
                            ans.importantJudgments.forEach((j) => {
                                doc.fillColor('#e07a5f').fontSize(9).font('Helvetica').text(`• ${j}`);
                            });
                            doc.moveDown(0.6);
                        }
                        if ((ans.relevantArticles && ans.relevantArticles.length > 0) || (ans.relevantSections && ans.relevantSections.length > 0)) {
                            doc.fillColor('#1b2838').fontSize(10).font('Helvetica-Bold').text('Relevant Bare Act provisions:');
                            if (ans.relevantArticles && ans.relevantArticles.length > 0) {
                                doc.fillColor('#457b9d').fontSize(9).font('Helvetica').text(`Articles: ${ans.relevantArticles.join(', ')}`);
                            }
                            if (ans.relevantSections && ans.relevantSections.length > 0) {
                                doc.fillColor('#e63946').fontSize(9).font('Helvetica').text(`Sections: ${ans.relevantSections.join(', ')}`);
                            }
                            doc.moveDown(0.6);
                        }
                        if (ans.sourcesUsed && ans.sourcesUsed.length > 0) {
                            doc.fillColor('#1b2838').fontSize(10).font('Helvetica-Bold').text('Sources Grounding:');
                            doc.fillColor('#555555').fontSize(9).font('Helvetica').text(ans.sourcesUsed.join(', '));
                            doc.moveDown(0.8);
                        }
                        const groundingChunks = [];
                        if (ans) {
                            if (Array.isArray(ans.citations) && ans.citations.length > 0) {
                                ans.citations.forEach((c) => {
                                    groundingChunks.push({
                                        documentName: c.sourceName || 'Uploaded Study Material',
                                        pageNumber: c.page || 'Page 1',
                                        chunkId: c.chunkRef || 'N/A',
                                        excerpt: c.supportingText || ''
                                    });
                                });
                            }
                            else if (Array.isArray(ans.sourceChunks) && ans.sourceChunks.length > 0) {
                                ans.sourceChunks.forEach((c) => {
                                    groundingChunks.push({
                                        documentName: c.documentName || 'Uploaded Study Material',
                                        pageNumber: c.pageNumber || 1,
                                        chunkId: c.chunkId || c.sourceChunk || 'N/A',
                                        excerpt: c.excerpt || c.supportingText || ''
                                    });
                                });
                            }
                        }
                        if (groundingChunks.length === 0) {
                            if (Array.isArray(q.sourceChunks) && q.sourceChunks.length > 0) {
                                q.sourceChunks.forEach((c) => {
                                    groundingChunks.push({
                                        documentName: c.documentName || 'Uploaded Study Material',
                                        pageNumber: c.pageNumber || 1,
                                        chunkId: c.chunkId || c.sourceChunk || 'N/A',
                                        excerpt: c.excerpt || c.supportingText || ''
                                    });
                                });
                            }
                            else if (Array.isArray(q.grounding?.sourceChunks) && q.grounding.sourceChunks.length > 0) {
                                q.grounding.sourceChunks.forEach((c) => {
                                    groundingChunks.push({
                                        documentName: c.documentName || 'Uploaded Study Material',
                                        pageNumber: c.pageNumber || 1,
                                        chunkId: c.chunkId || c.sourceChunk || 'N/A',
                                        excerpt: c.excerpt || c.supportingText || ''
                                    });
                                });
                            }
                            else if (q.sourceDocument || q.grounding?.documentName) {
                                groundingChunks.push({
                                    documentName: q.sourceDocument || q.grounding?.documentName || 'Uploaded Study Material',
                                    pageNumber: q.sourcePage || q.grounding?.pageNumber || 1,
                                    chunkId: q.sourceChunk || q.grounding?.chunkId || 'N/A',
                                    excerpt: q.grounding?.excerpt || q.grounding?.snippet || ''
                                });
                            }
                        }
                        if (groundingChunks.length > 0) {
                            doc.fillColor('#1b2838').fontSize(10).font('Helvetica-Bold').text('Source Grounding & Citations:');
                            doc.moveDown(0.3);
                            groundingChunks.forEach((chunk, chunkIndex) => {
                                const docName = chunk.documentName || 'Uploaded Study Material';
                                const pageNum = chunk.pageNumber || 1;
                                const chunkId = chunk.chunkId || 'N/A';
                                const excerptText = String(chunk.excerpt || '').trim();
                                doc.fillColor('#1b2838').fontSize(8.5).font('Helvetica-Bold').text(`${chunkIndex + 1}. [Source] ${docName} (${typeof pageNum === 'string' && pageNum.includes('Page') ? pageNum : `Page ${pageNum}`}, Chunk ID: ${chunkId})`);
                                if (excerptText) {
                                    doc.fillColor('#555555').fontSize(8).font('Helvetica-Oblique').text(`   "${excerptText}"`, { align: 'justify' });
                                }
                                doc.moveDown(0.3);
                            });
                            doc.moveDown(0.5);
                        }
                    }
                    else {
                        doc.fillColor('#888888').fontSize(10).font('Helvetica-Oblique').text('Model answer has not been generated for this question yet.');
                        doc.moveDown(1.0);
                    }
                    doc.moveDown(1.5);
                });
                doc.end();
            }
            catch (err) {
                reject(err);
            }
        });
    }
    async compileStudyKitPdf(kit) {
        return new Promise((resolve, reject) => {
            try {
                const PDFDocument = require('pdfkit');
                const doc = new PDFDocument({ margin: 50, size: 'A4' });
                const buffers = [];
                doc.on('data', (chunk) => buffers.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(buffers)));
                doc.rect(20, 20, 555, 800).lineWidth(3).stroke('#c5a880');
                doc.rect(25, 25, 545, 790).lineWidth(1).stroke('#c5a880');
                doc.moveDown(8);
                doc.fillColor('#1b2838').fontSize(26).font('Helvetica-Bold').text('LEGATRIXON™', { align: 'center' });
                doc.moveDown(0.5);
                doc.fillColor('#c5a880').fontSize(18).font('Helvetica-Bold').text('SMART STUDY KIT FORGE™ REPORT', { align: 'center' });
                doc.moveDown(2);
                doc.fillColor('#333333').fontSize(12).font('Helvetica-Bold').text(kit.title, { align: 'center' });
                doc.moveDown(10);
                doc.fontSize(10).fillColor('#777777').text(`Compiled on: ${kit.createdAt.toLocaleDateString()}`, { align: 'center' });
                doc.text('Smart Revision Kit Document', { align: 'center' });
                doc.addPage();
                const content = kit.content || {};
                doc.fillColor('#1b2838').fontSize(14).font('Helvetica-Bold').text('1. EXECUTIVE SUMMARY');
                doc.rect(doc.x, doc.y + 2, 500, 1.5).fill('#c5a880');
                doc.moveDown(1);
                doc.fillColor('#333333').fontSize(10).font('Helvetica').text(content.summary || 'N/A', { align: 'justify', lineGap: 3 });
                doc.moveDown(2);
                doc.fillColor('#1b2838').fontSize(14).font('Helvetica-Bold').text('2. CORE KEY CONCEPTS');
                doc.rect(doc.x, doc.y + 2, 500, 1.5).fill('#c5a880');
                doc.moveDown(1);
                if (content.keyConcepts && content.keyConcepts.length > 0) {
                    content.keyConcepts.forEach((c) => {
                        doc.fillColor('#1b2838').fontSize(11).font('Helvetica-Bold').text(c.title);
                        doc.fillColor('#333333').fontSize(10).font('Helvetica').text(c.explanation, { lineGap: 3 });
                        doc.moveDown(0.8);
                    });
                }
                else {
                    doc.fillColor('#777777').fontSize(10).text('None documented.');
                    doc.moveDown(1);
                }
                doc.moveDown(1);
                doc.fillColor('#1b2838').fontSize(14).font('Helvetica-Bold').text('3. LANDMARK PRECEDENTS & CASES');
                doc.rect(doc.x, doc.y + 2, 500, 1.5).fill('#c5a880');
                doc.moveDown(1);
                if (content.importantCases && content.importantCases.length > 0) {
                    content.importantCases.forEach((c) => {
                        doc.fillColor('#1b2838').fontSize(11).font('Helvetica-Bold').text(c.caseName);
                        doc.fillColor('#333333').fontSize(10).font('Helvetica').text(c.summary, { lineGap: 3 });
                        doc.moveDown(0.8);
                    });
                }
                else {
                    doc.fillColor('#777777').fontSize(10).text('None documented.');
                    doc.moveDown(1);
                }
                doc.moveDown(1);
                doc.addPage();
                doc.fillColor('#1b2838').fontSize(14).font('Helvetica-Bold').text('4. DETAILED REVISION NOTES');
                doc.rect(doc.x, doc.y + 2, 500, 1.5).fill('#c5a880');
                doc.moveDown(1);
                doc.fillColor('#333333').fontSize(10).font('Helvetica').text(content.revisionNotes || content.onePageNotes || 'N/A', { lineGap: 4 });
                doc.end();
            }
            catch (err) {
                reject(err);
            }
        });
    }
    async compileMindMapPdf(map) {
        return new Promise((resolve, reject) => {
            try {
                const PDFDocument = require('pdfkit');
                const doc = new PDFDocument({ margin: 50, size: 'A4' });
                const buffers = [];
                doc.on('data', (chunk) => buffers.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(buffers)));
                doc.rect(20, 20, 555, 800).lineWidth(3).stroke('#c5a880');
                doc.rect(25, 25, 545, 790).lineWidth(1).stroke('#c5a880');
                doc.moveDown(8);
                doc.fillColor('#1b2838').fontSize(26).font('Helvetica-Bold').text('LEGATRIXON™', { align: 'center' });
                doc.moveDown(0.5);
                doc.fillColor('#c5a880').fontSize(18).font('Helvetica-Bold').text('AI MIND MAP ARCHITECT™ REPORT', { align: 'center' });
                doc.moveDown(2);
                doc.fillColor('#333333').fontSize(12).font('Helvetica-Bold').text(map.title, { align: 'center' });
                doc.text(`Format Structure: ${map.structureType}`, { align: 'center' });
                doc.moveDown(10);
                doc.fontSize(10).fillColor('#777777').text(`Compiled on: ${map.createdAt.toLocaleDateString()}`, { align: 'center' });
                doc.addPage();
                doc.fillColor('#1b2838').fontSize(14).font('Helvetica-Bold').text('VISUAL HIERARCHY MAP OUTLINE');
                doc.rect(doc.x, doc.y + 2, 500, 1.5).fill('#c5a880');
                doc.moveDown(1.5);
                const writeNode = (node, level = 0) => {
                    if (!node)
                        return;
                    const indent = ' '.repeat(level * 4);
                    let typeColor = '#3b82f6';
                    const typeNorm = node.type === 'Case Law' ? 'Case' : (node.type === 'Bare Act' ? 'Section' : (node.type || 'Concept'));
                    if (typeNorm === 'Root')
                        typeColor = '#1b2838';
                    else if (typeNorm === 'Article')
                        typeColor = '#fbbf24';
                    else if (typeNorm === 'Case')
                        typeColor = '#10b981';
                    else if (typeNorm === 'Doctrine')
                        typeColor = '#8b5cf6';
                    else if (typeNorm === 'Section')
                        typeColor = '#f97316';
                    doc.fillColor(typeColor)
                        .fontSize(level === 0 ? 13 : 10)
                        .font('Helvetica-Bold')
                        .text(`${indent}├─ [${typeNorm}] ${node.label}`);
                    const def = node.definition || node.summary || '';
                    if (def) {
                        doc.fillColor('#333333')
                            .fontSize(9)
                            .font('Helvetica')
                            .text(`${indent}   Definition: ${def}`);
                    }
                    const explanation = node.full_content || node.detailedExplanation || '';
                    if (explanation) {
                        doc.fillColor('#555555')
                            .fontSize(8.5)
                            .font('Helvetica')
                            .text(`${indent}   Explanation: ${explanation}`);
                    }
                    const keyPts = node.key_points || node.keyPoints || [];
                    if (keyPts.length > 0) {
                        doc.fillColor('#333333')
                            .fontSize(8.5)
                            .font('Helvetica-Bold')
                            .text(`${indent}   Key Points:`);
                        keyPts.forEach((pt) => {
                            doc.fillColor('#555555').font('Helvetica').text(`${indent}     • ${pt}`);
                        });
                    }
                    const facts = node.important_facts || node.importantFacts || [];
                    if (facts.length > 0) {
                        doc.fillColor('#333333')
                            .fontSize(8.5)
                            .font('Helvetica-Bold')
                            .text(`${indent}   Grounded Facts:`);
                        facts.forEach((fact) => {
                            doc.fillColor('#555555').font('Helvetica').text(`${indent}     • ${fact}`);
                        });
                    }
                    const examNotes = node.exam_important_notes || node.examNotes || [];
                    if (examNotes.length > 0) {
                        doc.fillColor('#991b1b')
                            .fontSize(8.5)
                            .font('Helvetica-Bold')
                            .text(`${indent}   Exam Important Notes:`);
                        examNotes.forEach((note) => {
                            doc.fillColor('#444444').font('Helvetica').text(`${indent}     • ${note}`);
                        });
                    }
                    const relations = [];
                    if (node.relatedConcepts && node.relatedConcepts.length > 0) {
                        relations.push(`Related: ${node.relatedConcepts.join(', ')}`);
                    }
                    if (node.relatedCases && node.relatedCases.length > 0) {
                        relations.push(`Cases: ${node.relatedCases.join(', ')}`);
                    }
                    if (node.relevantArticles && node.relevantArticles.length > 0) {
                        relations.push(`Articles: ${node.relevantArticles.join(', ')}`);
                    }
                    if (node.relevantSections && node.relevantSections.length > 0) {
                        relations.push(`Sections: ${node.relevantSections.join(', ')}`);
                    }
                    if (relations.length > 0) {
                        doc.fillColor('#8b5cf6')
                            .fontSize(8)
                            .font('Helvetica-Oblique')
                            .text(`${indent}   ${relations.join(' | ')}`);
                    }
                    if (node.citations && node.citations.length > 0) {
                        node.citations.forEach((cit) => {
                            doc.fillColor('#9a7849')
                                .fontSize(8)
                                .font('Helvetica-Oblique')
                                .text(`${indent}   Citation: ${cit.sourceName} · Page: ${cit.page || 'N/A'} · Chunk: ${cit.chunkRef || 'N/A'}`);
                            if (cit.supportingText) {
                                doc.fillColor('#666666')
                                    .fontSize(7.5)
                                    .text(`${indent}     "${cit.supportingText.trim()}"`);
                            }
                        });
                    }
                    if (typeof node.confidenceScore === 'number') {
                        doc.fillColor('#10b981')
                            .fontSize(8)
                            .font('Helvetica-Bold')
                            .text(`${indent}   Confidence Strength: ${Math.round(node.confidenceScore * 100)}%`);
                    }
                    doc.moveDown(0.5);
                    if (node.children && node.children.length > 0) {
                        node.children.forEach((c) => writeNode(c, level + 1));
                    }
                };
                writeNode(map.map);
                doc.end();
            }
            catch (err) {
                reject(err);
            }
        });
    }
    async generateLlmJson(prompt, text, jsonSchemaDescription) {
        const geminiKey = process.env.GEMINI_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;
        const deepseekKey = process.env.DEEPSEEK_API_KEY;
        const openrouterKey = process.env.OPENROUTER_API_KEY;
        let lastError = null;
        if (openrouterKey && !openrouterKey.includes('placeholder')) {
            const openrouterProviders = [
                { name: 'OpenRouter/Gemini', model: process.env.OPENROUTER_GEMINI_MODEL || 'google/gemini-2.5-flash' },
                { name: 'OpenRouter/Qwen', model: process.env.OPENROUTER_QWEN_MODEL || 'qwen/qwen3-next-80b-a3b-instruct:free' },
                { name: 'OpenRouter/DeepSeek', model: process.env.OPENROUTER_DEEPSEEK_MODEL || 'deepseek/deepseek-r1' },
            ];
            for (const provider of openrouterProviders) {
                this.logger.log(`Attempting AI generation via OpenRouter: ${provider.name} (${provider.model})`);
                try {
                    const response = await axios_1.default.post('https://openrouter.ai/api/v1/chat/completions', {
                        model: provider.model,
                        response_format: { type: 'json_object' },
                        messages: [
                            {
                                role: 'system',
                                content: `You are an expert legal education AI assistant. Analyze the material and perform the task. Return valid JSON only, conforming strictly to the requested schema: ${jsonSchemaDescription}`,
                            },
                            {
                                role: 'user',
                                content: `${prompt}\n\nSUPPLIED MATERIAL:\n${text.slice(0, 50000)}`,
                            },
                        ],
                        temperature: 0.2,
                    }, {
                        headers: {
                            Authorization: `Bearer ${openrouterKey}`,
                            'Content-Type': 'application/json',
                            'HTTP-Referer': process.env.CLIENT_ORIGIN || 'http://localhost:5173',
                            'X-Title': 'AI Learning & Assessment Studio',
                        },
                        timeout: 60000,
                    });
                    const content = response.data?.choices?.[0]?.message?.content;
                    if (!content) {
                        throw new Error('Empty response from OpenRouter model');
                    }
                    let parsed;
                    try {
                        parsed = JSON.parse(content.trim());
                    }
                    catch (jsonErr) {
                        const match = content.match(/\{[\s\S]*\}/);
                        if (match) {
                            parsed = JSON.parse(match[0]);
                        }
                        else {
                            throw jsonErr;
                        }
                    }
                    this.logger.log(`AI generation successful via OpenRouter: ${provider.name}`);
                    return parsed;
                }
                catch (err) {
                    let msg = err.response?.data?.error?.message || err.message || String(err);
                    const status = err.response?.status;
                    if (status === 402 || (typeof msg === 'string' && (msg.toLowerCase().includes('credit') || msg.toLowerCase().includes('402') || msg.toLowerCase().includes('payment') || msg.toLowerCase().includes('balance') || msg.toLowerCase().includes('rate limit')))) {
                        msg = 'Provider capacity limits exceeded.';
                    }
                    this.logger.log(`OpenRouter provider ${provider.name} unavailable: ${msg}`);
                    lastError = new Error(msg);
                }
            }
        }
        const directProviders = [];
        if (geminiKey && !geminiKey.includes('placeholder'))
            directProviders.push('gemini');
        if (openaiKey && !openaiKey.includes('placeholder'))
            directProviders.push('openai');
        if (deepseekKey && !deepseekKey.includes('placeholder'))
            directProviders.push('deepseek');
        if (directProviders.length === 0 && !openrouterKey) {
            throw new common_1.BadRequestException('No AI provider keys configured in .env');
        }
        for (const provider of directProviders) {
            this.logger.log(`Attempting fallback AI generation via direct ${provider}`);
            try {
                let endpoint = '';
                let headers = {};
                let body = {};
                if (provider === 'gemini') {
                    endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + geminiKey;
                    headers = { 'Content-Type': 'application/json' };
                    body = {
                        contents: [{
                                parts: [{ text: 'System Instructions: You are an expert legal education assistant. Conform strictly to JSON schema: ' + jsonSchemaDescription + '. Task:\n' + prompt + '\n\nMATERIAL:\n' + text.slice(0, 50000) }],
                            }],
                        generationConfig: {
                            responseMimeType: 'application/json',
                            temperature: 0.2,
                        },
                    };
                }
                else if (provider === 'openai') {
                    endpoint = 'https://api.openai.com/v1/chat/completions';
                    headers = {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer ' + openaiKey,
                    };
                    body = {
                        model: 'gpt-4o-mini',
                        response_format: { type: 'json_object' },
                        messages: [
                            {
                                role: 'system',
                                content: 'You are an expert legal education AI assistant. Analyze the material and perform the task. Return valid JSON only, conforming strictly to the requested schema: ' + jsonSchemaDescription,
                            },
                            {
                                role: 'user',
                                content: prompt + '\n\nSUPPLIED MATERIAL:\n' + text.slice(0, 50000),
                            },
                        ],
                        temperature: 0.2,
                    };
                }
                else if (provider === 'deepseek') {
                    endpoint = 'https://api.deepseek.com/chat/completions';
                    headers = {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer ' + deepseekKey,
                    };
                    body = {
                        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
                        response_format: { type: 'json_object' },
                        messages: [
                            {
                                role: 'system',
                                content: 'You are an expert legal education AI assistant. Analyze the material and perform the task. Return valid JSON only, conforming strictly to the requested schema: ' + jsonSchemaDescription,
                            },
                            {
                                role: 'user',
                                content: prompt + '\n\nSUPPLIED MATERIAL:\n' + text.slice(0, 50000),
                            },
                        ],
                        temperature: 0.2,
                    };
                }
                const response = await axios_1.default.post(endpoint, body, { headers, timeout: 60000 });
                let content = '';
                if (provider === 'gemini') {
                    content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
                }
                else {
                    content = response.data?.choices?.[0]?.message?.content;
                }
                if (!content)
                    throw new Error('Empty response from model');
                let parsed;
                try {
                    parsed = JSON.parse(content.trim());
                }
                catch (jsonErr) {
                    const match = content.match(/\{[\s\S]*\}/);
                    if (match) {
                        parsed = JSON.parse(match[0]);
                    }
                    else {
                        throw jsonErr;
                    }
                }
                this.logger.log(`AI generation successful via direct ${provider}`);
                return parsed;
            }
            catch (err) {
                let msg = err.message || String(err);
                if (typeof msg === 'string' && (msg.toLowerCase().includes('credit') || msg.toLowerCase().includes('402') || msg.toLowerCase().includes('payment') || msg.toLowerCase().includes('balance') || msg.toLowerCase().includes('rate limit'))) {
                    msg = 'Provider capacity limits exceeded.';
                }
                this.logger.log(`AI provider ${provider} unavailable: ${msg}`);
                lastError = new Error(msg);
            }
        }
        const missingKeys = [];
        if (!geminiKey || geminiKey.includes('placeholder'))
            missingKeys.push('GEMINI_API_KEY');
        if (!openaiKey || openaiKey.includes('placeholder'))
            missingKeys.push('OPENAI_API_KEY');
        if (!deepseekKey || deepseekKey.includes('placeholder'))
            missingKeys.push('DEEPSEEK_API_KEY');
        if (!openrouterKey || openrouterKey.includes('placeholder'))
            missingKeys.push('OPENROUTER_API_KEY');
        throw new common_1.BadRequestException(`AI provider is not configured correctly. Please check API key settings. Missing env variables: ${missingKeys.join(', ')}. Error: ${lastError?.message || lastError || 'All AI providers failed'}`);
    }
    async generateJson(prompt, text, fallback) {
        let schemaDescription = '{}';
        if (prompt.includes('questions') || prompt.includes('mock test')) {
            schemaDescription = `{ questions: [{ id: "q1", type: "MCQ | Case Based | Short Answer | Long Answer", topic: "subtopic name", question: "question text", options: ["option1", "option2", "option3", "option4"], answer: "option1", explanation: "explanation text", citations: [{ sourceName: "Source Name", section: "Section X" }] }], scoreReport: { totalMarks: 10, scoringRule: "1 mark per correct answer", suggestedBenchmark: 70 }, weakAreas: ["subtopic1"] }`;
        }
        else if (prompt.includes('mind map')) {
            schemaDescription = `{ title: "Mind Map Title", concepts: ["Concept 1"], map: { id: "root", label: "Root Label", summary: "Root Summary", type: "Root", citations: [], children: [ { id: "node-1", label: "Label 1", summary: "Summary 1", type: "Concept", citations: [], children: [] } ] } }`;
        }
        else if (prompt.includes('Study Kit') || prompt.includes('study-kits') || prompt.includes('study kit')) {
            schemaDescription = `{ title: "Study Kit Title", summary: "summary text", revisionNotes: "revision notes text", onePageNotes: "one page notes text", keyConcepts: [{ title: "Concept", explanation: "Detail", citations: [] }], importantCases: [{ caseName: "Case Name", summary: "Summary", citations: [] }], importantArticles: [{ articleOrSection: "Section", summary: "Summary", citations: [] }], examQuestions: [{ question: "Question", approach: "Approach", citations: [] }], flashcards: [{ id: "fc1", topic: "Topic", front: "Question?", back: "Answer text" }], mcqs: [{ id: "q1", type: "MCQ", topic: "Topic", question: "Question?", options: ["A", "B", "C", "D"], answer: "A", explanation: "Explanation text" }] }`;
        }
        try {
            return await this.generateLlmJson(prompt, text, schemaDescription);
        }
        catch (error) {
            this.logger.warn(`LLM generation failed: ${error.message}. Running local parser.`);
            return fallback();
        }
    }
    mockRequestCacheKey(payload) {
        return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    }
    async findCachedMockTest(userId, cacheKey) {
        const recent = await this.mockRepo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 50 });
        return recent.find((test) => test.scoreReport?.cacheKey === cacheKey) || null;
    }
    buildMockRetrievalQuery(topic, paperType, difficulty, questionType, customPrompt) {
        return [customPrompt, topic, paperType, difficulty, questionType]
            .filter(Boolean)
            .join('\n')
            .replace(/\s+/g, ' ')
            .trim();
    }
    async retrieveRelevantMockChunks(userId, query, sourceIds, limit = 10) {
        const qdrantClient = this.qdrantService.getClient();
        if (!qdrantClient)
            return [];
        const vector = await this.generateQueryVector(query);
        const effectiveSourceIds = await this.resolveVectorSourceIds(userId, sourceIds);
        const must = [{ key: 'user_id', match: { value: userId } }];
        if (effectiveSourceIds.length) {
            must.push({ key: 'source_id', match: { any: effectiveSourceIds } });
        }
        const results = await qdrantClient.search(this.userDocumentsCollection, {
            vector,
            limit,
            filter: { must },
            with_payload: true,
        });
        return (results || []).map((hit) => ({
            id: hit.id,
            score: hit.score,
            payload: hit.payload || {},
        }));
    }
    async resolveVectorSourceIds(userId, sourceIds) {
        if (!sourceIds.length)
            return [];
        const selectedSources = await this.sourceRepo.find({ where: { userId, id: (0, typeorm_2.In)(sourceIds) } });
        const effectiveIds = new Set(sourceIds);
        for (const source of selectedSources) {
            if (source.metadata?.isDuplicate && source.metadata?.duplicateOf && !source.metadata?.duplicateVectorsCopied) {
                effectiveIds.add(source.metadata.duplicateOf);
            }
        }
        return Array.from(effectiveIds);
    }
    async generateQueryVector(query) {
        try {
            if (this.bgeM3Provider?.isAvailable()) {
                return await this.bgeM3Provider.generateEmbedding(query);
            }
            const vec = await this.embeddingService.generateEmbedding(query);
            if (vec.length === 1024)
                return vec;
            const resized = new Array(1024).fill(0);
            for (let i = 0; i < Math.min(vec.length, 1024); i++)
                resized[i] = vec[i];
            return resized;
        }
        catch (err) {
            this.logger.warn(`Query embedding failed: ${err.message}. Using deterministic fallback.`);
            return this.generateDeterministicVector(query, 1024);
        }
    }
    generateDeterministicVector(text, size) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = (hash << 5) - hash + text.charCodeAt(i);
            hash |= 0;
        }
        const random = () => {
            hash = (hash * 1664525 + 1013904223) % 4294967296;
            return hash / 4294967296;
        };
        const vector = new Array(size);
        let sum = 0;
        for (let i = 0; i < size; i++) {
            const value = random() * 2 - 1;
            vector[i] = value;
            sum += value * value;
        }
        const magnitude = Math.sqrt(sum) || 1;
        return vector.map((value) => value / magnitude);
    }
    formatRetrievedChunksForPrompt(chunks) {
        return chunks.map((chunk, index) => {
            const payload = chunk.payload || {};
            return [
                `[Retrieved Chunk ${index + 1}]`,
                `QDRANT_POINT_ID: ${chunk.id}`,
                `SOURCE_ID: ${payload.source_id || ''}`,
                `SOURCE_NAME: ${payload.name || payload.document_name || 'Uploaded Study Material'}`,
                `DOCUMENT_TYPE: ${payload.document_type || payload.kind || 'Study Material'}`,
                `SUBJECT: ${payload.subject || ''}`,
                `UNIT: ${payload.unit || ''}`,
                `TOPIC: ${payload.topic || ''}`,
                `PAGE: ${payload.page_number || payload.pageNumber || 1}`,
                `PARAGRAPH: ${payload.paragraph_index || payload.paragraph || payload.chunk_index || index + 1}`,
                `RETRIEVAL_SCORE: ${chunk.score || 0}`,
                `TEXT: ${String(payload.text || payload.chunk_text || '').slice(0, 2400)}`,
            ].join('\n');
        }).join('\n\n');
    }
    normalizeQuestionPaper(questions, count, chunks, difficulty, questionType) {
        if (!questions || questions.length === 0) {
            throw new common_1.BadRequestException(`AI provider is not configured correctly. Please check API key settings.`);
        }
        const source = questions;
        return source.slice(0, count).map((question, index) => {
            const citations = question.citations?.length ? question.citations : this.citationsFromRetrievedChunks([chunks[index % chunks.length]].filter(Boolean));
            const normalized = {
                id: String(question.id || `q${index + 1}`),
                type: String(question.type || questionType || 'Question'),
                topic: String(question.topic || 'Uploaded material'),
                question: String(question.question || '').trim(),
                marks: Number(question.marks || this.defaultMarksForQuestion(questionType, index)),
                difficulty: String(question.difficulty || difficulty),
                template: question.template,
                expectedAnswerLength: String(question.expectedAnswerLength || question.expectedLength || 'Expected length: 1,800-2,500 words (approximately 3-4 written pages)'),
                modelAnswerRequested: question.modelAnswerRequested !== false,
                citations,
            };
            return normalized;
        }).filter((question) => question.question);
    }
    defaultMarksForQuestion(questionType, index) {
        const qt = String(questionType || '').toLowerCase();
        if (qt.includes('10 mark') || qt === '10m')
            return 10;
        if (qt.includes('15 mark') || qt === '15m')
            return 15;
        if (qt.includes('20 mark') || qt === '20m')
            return 20;
        if (qt.includes('judiciary'))
            return 20;
        if (qt.includes('long descriptive'))
            return 15;
        const marksOptions = [10, 15, 20];
        return marksOptions[index % marksOptions.length];
    }
    localQuestionPaper(topic, difficulty, questionType, count, chunks, paperType) {
        const safeChunks = chunks.length ? chunks : [{ id: 'local', payload: { text: topic, name: 'Uploaded Study Material', page_number: 1, paragraph_index: 1 } }];
        const questionTemplates = [
            (concept) => `Discuss in detail the concept of ${concept} as reflected in the uploaded study material. In your answer, examine its meaning and definition, the relevant statutory provisions and constitutional articles, the essential legal ingredients, the governing doctrines, the judicial interpretation given to it by the courts, any exceptions or limitations that qualify its application, and conclude with a critical evaluation of its effectiveness and fairness in the current legal framework.`,
            (concept) => `Critically examine the legal framework governing ${concept} with reference to the uploaded study material. Trace its historical development and statutory evolution, identify the key provisions that regulate it, analyse the essential conditions that must be satisfied for its application, discuss the leading judicial pronouncements that have shaped its interpretation, and assess whether the existing legal regime adequately balances the competing interests at stake.`,
            (concept) => `Write a detailed essay on ${concept} drawing exclusively from the uploaded study materials. Your answer must cover the doctrinal meaning of the concept, its place within the broader legal system, the statutory or constitutional provisions governing it, the tests or ingredients applied by courts, the role of judicial discretion in its application, exceptions and defences available, and a reasoned conclusion on its contemporary legal significance.`,
            (concept) => `Explain the nature, scope, and significance of ${concept} as contained in the uploaded study material. Analyse the statutory provisions applicable, examine the essential requirements and their legal consequences, discuss the manner in which courts have interpreted and applied these requirements, identify any procedural safeguards or limitations, and evaluate the practical challenges in the enforcement of the law relating to this concept.`,
            (concept) => `Examine the doctrine of ${concept} in light of the uploaded study material. Your answer should include a clear statement of the legal principle, an explanation of its statutory and constitutional basis, an analysis of its essential elements, a discussion of the conditions under which it applies and the conditions under which it does not, the approach of the judiciary in balancing this doctrine against other competing legal interests, and a critical assessment of its present state and desirable reforms if any.`,
        ];
        const questions = Array.from({ length: count }, (_, index) => {
            const chunk = safeChunks[index % safeChunks.length];
            const text = String(chunk.payload?.text || chunk.payload?.chunk_text || topic).replace(/\s+/g, ' ').trim();
            const concept = this.extractTopic(text, topic || 'this concept');
            const template = questionTemplates[index % questionTemplates.length];
            return {
                id: `q${index + 1}`,
                type: paperType || questionType,
                topic: concept,
                question: template(concept),
                marks: this.defaultMarksForQuestion(questionType || paperType, index),
                difficulty,
                expectedAnswerLength: 'Expected length: 1,800-2,500 words (approximately 3-4 written pages)',
                modelAnswerRequested: true,
                citations: this.citationsFromRetrievedChunks([chunk]),
            };
        });
        return { questions, scoreReport: { totalMarks: questions.reduce((sum, q) => sum + q.marks, 0) }, weakAreas: [] };
    }
    citationsFromRetrievedChunks(chunks) {
        return chunks.map((chunk, index) => {
            const payload = chunk?.payload || {};
            const supportingText = String(payload.text || payload.chunk_text || '').replace(/\s+/g, ' ').trim();
            return {
                sourceName: payload.name || payload.document_name || 'Uploaded Study Material',
                section: this.extractSectionReference(supportingText),
                chapter: payload.unit || payload.chapter || undefined,
                page: `Page ${payload.page_number || payload.pageNumber || 1}`,
                paragraph: `Paragraph ${payload.paragraph_index || payload.paragraph || payload.chunk_index || index + 1}`,
                chunkRef: String(chunk?.id || payload.chunk_id || `chunk-${index + 1}`),
                supportingText: supportingText.slice(0, 700),
                confidenceScore: Number(payload.confidence_score || chunk?.score || 0.9),
            };
        });
    }
    localDetailedAnswer(question, chunks, mode) {
        const sourceText = chunks
            .map((chunk) => String(chunk.payload?.text || chunk.payload?.chunk_text || '').replace(/\s+/g, ' ').trim())
            .filter(Boolean)
            .slice(0, 6)
            .join('\n\n');
        const citations = this.citationsFromRetrievedChunks(chunks).slice(0, 3);
        const provisions = Array.from(new Set(citations.map((citation) => citation.section).filter(Boolean))).join(', ') || 'the provisions and principles reflected in the uploaded material';
        return [
            `1. Introduction\n\nThe present question requires a detailed and structured legal analysis grounded entirely in the uploaded study material. The question under consideration is: ${question}. In order to answer this question adequately, it is necessary to first understand the legal concept at its doctrinal foundation, then examine the relevant statutory provisions and constitutional framework, identify the essential legal ingredients, discuss the judicial approach, and finally apply the governing principles to reach a reasoned conclusion. This answer is written in the style expected in a university law examination, drawing from the material provided by the student.\n\nThe significance of this legal issue cannot be understated in the context of Indian legal practice. The concept has evolved over time through legislative intervention and judicial pronouncements, and a comprehensive answer must trace this evolution before arriving at the current legal position. The examiner expects the candidate to demonstrate not merely the ability to reproduce notes but to reason legally from established principles to a justified conclusion.`,
            `2. Meaning and Definition\n\nThe concept addressed in this question must be understood in its legal sense before its components and consequences can be examined. According to the uploaded study material, the governing framework is derived from ${provisions}. The definition in legal writing is not merely a dictionary meaning but is shaped by the purpose of the rule, the mischief it was designed to remedy, and the legal relationship it creates or governs.\n\nIn examining the meaning, the student must consider both the textual definition as given in the relevant statute or provision and the interpretive gloss placed upon it by authoritative judicial decisions. The material uploaded makes clear that the definition operates within a specific legal context, and the answer must explain how that context shapes the scope and application of the concept. A superficial statement of meaning is insufficient; the examiner expects the candidate to unpack the definition and relate each component to the broader legal framework.`,
            `3. Relevant Sections and Articles\n\nThe statutory and constitutional foundation of this topic is rooted in ${provisions}. The uploaded material contains specific references to the applicable law, and those references must form the backbone of this section of the answer. Where the material cites a particular section, article, rule, or provision, the answer must identify it by name and number and then explain its operation, scope, object, and limitations in full.\n\nThe student must note that statutory provisions must be read together with the rules framed under them, the schedule if any, and the constitutional provisions that confer the legislative competence to enact the law. The uploaded material provides the necessary foundation for this analysis. It is important that the student does not cite any section or article that does not appear in the uploaded material, as doing so would introduce unverified content into the answer.\n\nFurthermore, the ambit of the relevant provisions must be explained in a manner that shows the examiner the student understands not just what the law says but why it says so and how courts have interpreted its scope. The principle that penal provisions are strictly construed, and beneficial provisions liberally construed, should be applied where relevant.`,
            `4. Essential Ingredients and Elements\n\nEvery legal concept has essential ingredients or conditions that must be satisfied for its application. In the context of the present question, the uploaded material points to several such ingredients that must be examined individually and in combination.\n\nThe first ingredient concerns the existence of the relevant legal relationship or duty. The law does not operate in a vacuum; it presupposes a particular relationship between persons, between a person and the state, or between a person and property. The student must identify this foundational relationship from the uploaded material and explain its legal character.\n\nThe second ingredient relates to the act or omission that triggers the application of the law. Whether the law is activated by a positive act, a failure to act, or a state of affairs must be explained clearly drawing from the study material. The third ingredient concerns the mental element, if any, required by the law. Many legal provisions require a particular state of mind such as intention, knowledge, or recklessness, and the presence or absence of this element can be decisive. The student must explain the mental element as it appears in the uploaded material.\n\nThe fourth ingredient involves procedural requirements, if any, such as notice, consent, or registration. These procedural conditions are not mere technicalities; non-compliance with them may render the act invalid or attract legal consequences. Finally, the consequences of satisfying or failing to satisfy the ingredients must be discussed, as they define what the law ultimately achieves.\n\nThe uploaded material contains the foundation for all these ingredients, and the answer must draw from that material rather than from outside sources.`,
            `5. Legal Principles\n\nThe governing legal principles applicable to this question are derived from the uploaded material and from the broader doctrinal framework within which the relevant provisions operate. The uploaded text provides the following foundation for this analysis: ${sourceText.slice(0, 2000)}.\n\nThe above material must be understood in its legal context and converted into a principled analysis. The primary principle is that the law must be applied as it is written, subject to the rules of purposive and literal construction. Where the text is plain and unambiguous, the court gives effect to the plain meaning. Where the text is ambiguous, the court looks to the purpose and object of the legislation, the legislative history, and the surrounding statutory context.\n\nIn addition to the primary interpretive principle, the student must note any special doctrines applicable to this area of law as reflected in the uploaded material. These may include the doctrine of estoppel, the principle of natural justice, the rule against bias, the presumption of constitutionality, or other established doctrines. Each doctrine must be explained and its application to the present question demonstrated.`,
            `6. Case Laws and Judicial Pronouncements\n\nJudicial decisions play a central role in shaping the law, and the examiner expects the candidate to demonstrate familiarity with leading cases in the area. However, it is equally important that the student cites only those cases that are present in the uploaded material or that are so foundational in Indian law as to be beyond doubt.\n\nWhere the uploaded material refers to specific cases, those cases must be discussed in detail: the facts must be briefly stated, the legal issue identified, the reasoning of the court explained, and the ratio decidendi extracted. The application of the ratio to the present question must then be shown clearly. A case citation without discussion of its legal significance is of limited value in an examination answer.\n\nWhere the uploaded material does not reference specific cases, the student should note that specific judicial authority on this point should be verified from current law reports and authoritative legal texts before reliance in practice. In an examination, however, the candidate is expected to discuss the principles that judicial decisions have established in this area, even if specific case names are not available from the uploaded material.`,
            `7. Application and Analysis\n\nHaving established the legal framework, it is now necessary to apply the law to the specific question posed. The process of application involves moving from the general to the particular: identifying the relevant facts or legal issues raised by the question, matching those facts to the ingredients or conditions established by law, and then working through the analysis to a conclusion.\n\nIf the question is abstract or theoretical, the application section should demonstrate how the law would operate in a typical fact situation involving the concept. If the question is problem-based, the student must apply each ingredient of the law to the given facts, note where the facts clearly satisfy the condition, where there is doubt or ambiguity, and what the legal consequence follows. Counter-arguments must also be anticipated and addressed.\n\nThe analysis must be grounded at every step in the statutory provisions, doctrinal principles, and case law discussed above. The student should avoid making conclusory statements that are not supported by the legal framework already established in the earlier sections of the answer.`,
            `8. Exceptions, Limitations and Special Rules\n\nNo area of law exists without exceptions, limitations, or special rules that qualify the general position. A comprehensive examination answer must address these qualifications because the examiner tests whether the student understands the law in its full complexity rather than in a simplified form.\n\nThe uploaded material may point to specific exceptions created by statute, recognised by courts, or established by legal doctrine. Each exception must be explained: what it is, why it exists, what conditions it requires, and how it operates to displace the general rule. The student must also note where the exception is narrow and should not be extended beyond its purpose.\n\nLimitations on the application of the law are equally important. These may arise from constitutional constraints, procedural requirements, the principle of proportionality, or the fundamental rights framework. Any such limitations visible in the uploaded material must be identified and explained with sufficient depth to satisfy the examiner that the candidate understands the boundaries of the law.`,
            `9. Critical Analysis\n\nA sophisticated examination answer does not merely state the law but evaluates it. Critical analysis involves examining the law from multiple angles: its internal consistency, its effectiveness in achieving its stated purpose, its fairness to all persons affected, and its relationship to broader legal principles and constitutional values.\n\nIn the context of the present question, the student should consider whether the legal framework reflected in the uploaded material achieves a just and workable outcome. Are there tensions between different provisions? Does the law create unintended consequences? Have courts struggled to apply it consistently? Are there gaps that the legislature has not addressed? Does the law balance competing interests fairly?\n\nThese questions are not rhetorical; the student must answer them with reference to the material available and, where appropriate, note the direction in which judicial thinking or legislative reform is moving. A well-written critical analysis demonstrates intellectual maturity and earns the marks that distinguish a good answer from an excellent one.`,
            `10. Conclusion\n\nIn conclusion, the present question has been answered by examining the legal concept from its definitional foundation through its statutory framework, essential ingredients, governing principles, judicial approach, and practical application. The answer has been grounded at every stage in the uploaded study material provided by the student.\n\nThe legal position, as derived from the uploaded material, is that the concept operates within a defined statutory and doctrinal framework, requires satisfaction of specific ingredients for its application, is subject to well-recognised exceptions and limitations, and has been developed by judicial interpretation in the manner discussed above.\n\nThe student is advised that while this answer draws from the uploaded material, any case law citation or statutory reference should be verified against current authoritative sources before reliance in practice or in any formal legal proceeding. The answer is written in examination style for the purpose of academic preparation and reflects the depth of analysis expected in university law examinations and judiciary mains papers.`,
        ].join('\n\n');
    }
    async collectSourceText(userId, sourceIds) {
        const sources = await this.sourceRepo.find({ where: { userId } });
        return sources
            .filter((source) => sourceIds.includes(source.id))
            .sort((a, b) => this.sourcePriority(a.kind) - this.sourcePriority(b.kind))
            .map((source) => {
            const chunks = this.buildTraceableChunks(source.text).slice(0, 24);
            const header = [
                `SOURCE_ID: ${source.id}`,
                `SOURCE_NAME: ${source.name}`,
                `SOURCE_KIND: ${source.kind}`,
                `SOURCE_PRIORITY: ${this.sourcePriority(source.kind)}`,
                `SUBJECT: ${source.subject || source.metadata?.subject || 'Auto-detected'}`,
                `UNIT: ${source.unit || source.metadata?.unit || 'Auto-detected'}`,
                `TOPIC: ${source.topic || source.metadata?.topic || source.name}`,
            ].join('\n');
            const body = chunks.map((chunk) => `[Source Document: ${source.name} | Source ID: ${source.id} | Page: ${chunk.page} | Paragraph: ${chunk.paragraph} | Confidence: ${chunk.confidence}]\n${chunk.text}`).join('\n\n');
            return `${header}\n${body}`;
        })
            .join('\n\n')
            .slice(0, 50000);
    }
    buildTraceableChunks(text) {
        const paragraphs = String(text || '')
            .split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z0-9])/)
            .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
            .filter((paragraph) => paragraph.length >= 35);
        const chunks = paragraphs.length ? paragraphs : [String(text || '').replace(/\s+/g, ' ').trim()].filter(Boolean);
        return chunks.map((chunk, index) => ({
            text: chunk,
            page: Math.floor(index / 3) + 1,
            paragraph: index + 1,
            confidence: 0.9,
        }));
    }
    localMockTest(topic, difficulty, questionType, count, text, isJudiciaryMode = false, examPattern = 'Interactive MCQ') {
        const sentences = this.sentences(text);
        const traceBlocks = this.extractTraceBlocks(text);
        const questions = Array.from({ length: count }, (_, index) => {
            const source = sentences[index % sentences.length];
            const trace = traceBlocks[index % traceBlocks.length] || {
                sourceName: 'Uploaded Study Material',
                sourceId: 'local',
                page: String(index + 1),
                paragraph: String(index + 1),
                supportingText: source,
                confidenceScore: 0.82,
                unit: undefined,
            };
            const answer = this.short(source, 120);
            const options = [answer, ...sentences.filter((s) => s !== source).slice(index + 1, index + 4).map((s) => this.short(s, 120))];
            while (options.length < 4)
                options.push(this.short(sentences[options.length % sentences.length], 120));
            return {
                id: `q${index + 1}`,
                type: isJudiciaryMode ? `${examPattern}` : (questionType === 'Mixed' ? ['MCQ', 'Case Based', 'Scenario Based'][index % 3] : questionType),
                topic: this.extractTopic(source, topic),
                question: `${difficulty}: Based on the legal records, analyze the core issue regarding ${this.short(source, 50)}?`,
                options: options.slice(0, 4),
                answer,
                explanation: `Grounded citation explanation: ${trace.supportingText || source}`,
                modelAnswer: isJudiciaryMode && examPattern === 'Mains Pattern' ? `The core legal issues raised involve standard statutory rules. Precedents dictate that: ${source}` : undefined,
                markingScheme: isJudiciaryMode && examPattern === 'Mains Pattern' ? `5 Marks for identifying statutory principles, 5 marks for case references, 5 marks for structured formatting.` : undefined,
                caseReferences: isJudiciaryMode && examPattern === 'Mains Pattern' ? this.extractCaseReference(trace.supportingText || source) : undefined,
                citations: [{
                        sourceName: trace.sourceName,
                        section: this.extractSectionReference(trace.supportingText || source),
                        chapter: trace.unit || undefined,
                        page: `Page ${trace.page}`,
                        paragraph: `Paragraph ${trace.paragraph}`,
                        chunkRef: `source:${trace.sourceId || 'local'}:p${trace.paragraph}`,
                        supportingText: trace.supportingText || source,
                        confidenceScore: trace.confidenceScore,
                    }],
            };
        });
        return { questions, scoreReport: { totalMarks: count, scoringRule: '1 mark per correct answer', suggestedBenchmark: 70 }, weakAreas: [] };
    }
    extractTraceBlocks(text) {
        const blocks = String(text || '').split(/\n(?=\[Source Document:)/g);
        return blocks.map((block) => {
            const header = block.match(/\[Source Document:\s*([^|]+)\|\s*Source ID:\s*([^|]+)\|\s*Page:\s*([^|]+)\|\s*Paragraph:\s*([^|]+)\|\s*Confidence:\s*([^\]]+)\]/i);
            if (!header)
                return null;
            const supportingText = block.replace(header[0], '').trim();
            return {
                sourceName: header[1].trim(),
                sourceId: header[2].trim(),
                page: header[3].trim(),
                paragraph: header[4].trim(),
                confidenceScore: Number(header[5].trim()) || 0.9,
                supportingText,
            };
        }).filter(Boolean);
    }
    extractSectionReference(text) {
        const match = String(text || '').match(/\b(?:Article|Section)\s+\d+[A-Z]?(?:\([^)]+\))?/i);
        return match ? match[0] : 'Uploaded paragraph';
    }
    extractCaseReference(text) {
        const match = String(text || '').match(/\b[A-Z][A-Za-z.&() ]+\s+v(?:s\.?|ersus)?\s+[A-Z][A-Za-z.&() ]+(?:\(\d{4}\))?/);
        return match ? match[0] : 'No external case reference invented; see uploaded source citation.';
    }
    localMindMap(text, structureType) {
        const sentences = this.sentences(text);
        const concepts = Array.from(new Set([
            ...this.matches(text, /\bArticle\s+\d+[A-Z]?(?:\([^)]+\))?/gi),
            ...this.matches(text, /\bSection\s+\d+[A-Z]?(?:\([^)]+\))?/gi),
            ...this.matches(text, /\b[A-Z][A-Za-z.& ]+\s+v(?:s\.?|ersus)?\s+[A-Z][A-Za-z.& ]+/g),
            ...sentences.slice(0, 8).map((s) => this.extractTopic(s, 'Legal concept')),
        ])).slice(0, 18);
        const makeNode = (id, label, type, index) => {
            const summary = this.short(this.findSentence(sentences, label), 160);
            const supportingText = this.findSentence(sentences, label);
            return {
                id,
                node_id: id,
                label,
                concept_name: label,
                type,
                definition: summary,
                summary,
                full_content: supportingText,
                detailedExplanation: supportingText,
                key_points: sentences.slice(index % sentences.length, (index + 3) % sentences.length),
                important_facts: sentences.slice((index + 1) % sentences.length, (index + 3) % sentences.length),
                related_concepts: [label],
                relatedConcepts: [label],
                cases_mentioned: type === 'Case Law' ? [label] : [],
                relatedCases: type === 'Case Law' ? [label] : [],
                articles_mentioned: type === 'Bare Act' ? [label] : [],
                relevantArticles: type === 'Bare Act' ? [label] : [],
                sections_mentioned: [],
                relevantSections: [],
                exam_important_notes: [`Understand the relevance of ${label} for core examination outline.`],
                source_chunks: [`chunk-${index}`],
                page_numbers: [String(index + 1)],
                confidence_score: 0.9,
                confidenceScore: 0.9,
                citations: [{ sourceName: 'Pasted Document Outline', page: String(index + 1), chunkRef: `chunk-${index}`, supportingText }],
                children: []
            };
        };
        return {
            title: `${structureType} Map Outline`,
            concepts,
            map: {
                id: 'root',
                node_id: 'root',
                label: 'Source Material Analysis',
                concept_name: 'Source Material Analysis',
                summary: this.short(sentences[0] || 'Generated outline.', 180),
                type: 'Root',
                definition: sentences[0] || 'Generated outline.',
                full_content: sentences.slice(0, 3).join(' '),
                detailedExplanation: sentences.slice(0, 3).join(' '),
                key_points: sentences.slice(0, 3),
                important_facts: sentences.slice(0, 2),
                related_concepts: concepts.slice(0, 3),
                relatedConcepts: concepts.slice(0, 3),
                cases_mentioned: [],
                relatedCases: [],
                articles_mentioned: [],
                relevantArticles: [],
                sections_mentioned: [],
                relevantSections: [],
                exam_important_notes: ['Review bare act references and landmark cases systematically.'],
                source_chunks: ['chunk-0'],
                page_numbers: ['1'],
                confidence_score: 1.0,
                confidenceScore: 1.0,
                citations: [{ sourceName: 'Pasted Document Outline', page: '1', chunkRef: 'chunk-0', supportingText: sentences[0] || 'Generated outline.' }],
                children: concepts.slice(0, 6).map((concept, index) => {
                    const child = makeNode(`node-${index}`, concept, index % 2 === 0 ? 'Bare Act' : 'Case Law', index + 1);
                    child.children = [
                        makeNode(`node-${index}-notes`, 'Exam Notes', 'Concept', index + 2)
                    ];
                    return child;
                }),
            },
        };
    }
    localMindMapFromChunks(chunks, structureType) {
        const title = `${structureType} Mind Map (Offline Fallback)`;
        const concepts = [];
        const childrenNodes = [];
        chunks.slice(0, 8).forEach((chunk, index) => {
            const p = chunk.payload || {};
            const rawText = p.text || p.chunk_text || 'Source snippet';
            const cleanText = this.cleanLearningText(rawText);
            const sentences = cleanText.split(/[.!?]/).map(s => s.trim()).filter(Boolean);
            const firstSentence = sentences[0] || 'Grounded detail';
            const label = firstSentence.substring(0, 45) + (firstSentence.length > 45 ? '...' : '');
            concepts.push(label);
            let type = 'Concept';
            if (cleanText.toLowerCase().includes('article')) {
                type = 'Article';
            }
            else if (cleanText.toLowerCase().includes('section')) {
                type = 'Section';
            }
            else if (cleanText.toLowerCase().includes(' v ') || cleanText.toLowerCase().includes(' vs ') || cleanText.toLowerCase().includes(' versus ')) {
                type = 'Case';
            }
            else if (cleanText.toLowerCase().includes('doctrine') || cleanText.toLowerCase().includes('principle')) {
                type = 'Doctrine';
            }
            const caseMatches = cleanText.match(/\b[A-Z][A-Za-z ]+\s+v(?:s\.?|ersus)?\s+[A-Z][A-Za-z ]+/g) || [];
            const articleMatches = cleanText.match(/\bArticle\s+\d+/gi) || [];
            const sectionMatches = cleanText.match(/\bSection\s+\d+/gi) || [];
            childrenNodes.push({
                id: `node-${index}`,
                node_id: `node-${index}`,
                label,
                concept_name: label,
                type,
                definition: firstSentence,
                summary: firstSentence,
                full_content: cleanText,
                detailedExplanation: cleanText,
                key_points: sentences.slice(1, 4),
                important_facts: sentences.slice(1, 3),
                related_concepts: sentences.slice(1, 3),
                relatedConcepts: sentences.slice(1, 3),
                cases_mentioned: Array.from(new Set(caseMatches)),
                relatedCases: Array.from(new Set(caseMatches)),
                articles_mentioned: Array.from(new Set(articleMatches)),
                relevantArticles: Array.from(new Set(articleMatches)),
                sections_mentioned: Array.from(new Set(sectionMatches)),
                relevantSections: Array.from(new Set(sectionMatches)),
                exam_important_notes: sentences.slice(2, 4),
                source_chunks: [chunk.id || `chunk-${index}`],
                page_numbers: [String(p.page_number || p.pageNumber || 1)],
                confidence_score: 0.9,
                confidenceScore: 0.9,
                sourceId: p.source_id || 'fallback-source',
                pageNumber: String(p.page_number || p.pageNumber || 1),
                chunkId: chunk.id || `chunk-${index}`,
                documentName: p.name || p.document_name || 'Source',
                originalSourceText: cleanText,
                citations: [{
                        sourceName: p.name || p.document_name || 'Source',
                        page: String(p.page_number || p.pageNumber || 1),
                        chunkRef: chunk.id || `chunk-${index}`,
                        supportingText: cleanText.substring(0, 150)
                    }],
                children: []
            });
        });
        const rootPayload = chunks[0]?.payload || {};
        const rootText = this.cleanLearningText(rootPayload.text || rootPayload.chunk_text || 'Root context');
        const rootSentences = rootText.split(/[.!?]/).map(s => s.trim()).filter(Boolean);
        return {
            title,
            concepts,
            map: {
                id: 'root',
                node_id: 'root',
                label: 'Source Summary Outline',
                concept_name: 'Source Summary Outline',
                type: 'Root',
                definition: rootSentences[0] || 'Summary of source contents.',
                summary: rootSentences[0] || 'Summary of source contents.',
                full_content: rootText,
                detailedExplanation: rootText,
                key_points: rootSentences.slice(1, 4),
                important_facts: rootSentences.slice(1, 3),
                related_concepts: rootSentences.slice(1, 3),
                relatedConcepts: rootSentences.slice(1, 3),
                cases_mentioned: [],
                relatedCases: [],
                articles_mentioned: [],
                relevantArticles: [],
                sections_mentioned: [],
                relevantSections: [],
                exam_important_notes: rootSentences.slice(2, 4),
                source_chunks: [chunks[0]?.id || 'root-chunk'],
                page_numbers: [String(rootPayload.page_number || rootPayload.pageNumber || 1)],
                confidence_score: 1.0,
                confidenceScore: 1.0,
                citations: [{
                        sourceName: rootPayload.name || rootPayload.document_name || 'Source',
                        page: String(rootPayload.page_number || rootPayload.pageNumber || 1),
                        chunkRef: chunks[0]?.id || 'root-chunk',
                        supportingText: rootText.substring(0, 150)
                    }],
                children: childrenNodes
            }
        };
    }
    localStudyKit(text) {
        const sentences = this.sentences(text);
        const mindMap = this.localMindMap(text, 'Quick');
        const citation = [{ sourceName: 'Uploaded Study Material', section: 'Uploaded paragraph', chapter: 'Uploaded source', page: 'Page 1', chunkRef: 'chunk-0' }];
        const caseNames = this.matches(text, /\b[A-Z][A-Za-z.&() ]+\s+v(?:s\.?|ersus)?\s+[A-Z][A-Za-z.&() ]+(?:\s*\(\d{4}\))?/g);
        const articleRefs = this.matches(text, /\b(?:Article|Section)\s+\d+[A-Z]?(?:\([^)]+\))?/gi);
        return {
            title: 'Smart Study Kit',
            summary: sentences.slice(0, 5).join(' '),
            revisionNotes: sentences.slice(0, 12).map((sentence) => '- ' + sentence).join('\n'),
            keyConcepts: sentences.slice(0, 3).map((sentence, idx) => ({
                title: this.extractTopic(sentence, 'Core Principle ' + (idx + 1)),
                explanation: sentence,
                citations: citation,
            })),
            importantCases: caseNames.map((caseName) => ({
                caseName,
                summary: this.findSentence(sentences, caseName),
                citations: citation,
            })),
            importantArticles: articleRefs.map((articleOrSection) => ({
                articleOrSection,
                summary: this.findSentence(sentences, articleOrSection),
                citations: citation,
            })),
            examQuestions: sentences.slice(7, 9).map((sentence) => ({
                question: 'Discuss the legal implications of: ' + sentence + '?',
                approach: 'Use only the uploaded material, identify the rule, connect it to the facts, and cite the relevant uploaded passage.',
                citations: citation,
            })),
            flashcards: sentences.slice(0, 10).map((sentence, index) => ({
                id: 'fc' + (index + 1),
                topic: this.extractTopic(sentence, 'Concept'),
                front: 'Analyze: what is the rule regarding ' + this.extractTopic(sentence, 'this concept') + '?',
                back: sentence,
            })),
            mcqs: this.localMockTest('Selected sources', 'Intermediate', 'MCQ', Math.min(10, sentences.length), text).questions,
            mindMap: mindMap.map,
            onePageNotes: sentences.slice(0, 8).map((sentence) => '- ' + sentence).join('\n'),
        };
    }
    sentences(text) {
        const sentences = text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 35);
        if (!sentences.length)
            throw new common_1.BadRequestException('Selected sources do not contain enough analyzable text.');
        return sentences;
    }
    matches(text, pattern) {
        return Array.from(new Set((text.match(pattern) || []).map((item) => item.trim()))).slice(0, 12);
    }
    findSentence(sentences, term) {
        return sentences.find((sentence) => sentence.toLowerCase().includes(term.toLowerCase())) || sentences[0] || term;
    }
    extractTopic(sentence, fallback) {
        const match = sentence.match(/\b(?:Article|Section)\s+\d+[A-Z]?(?:\([^)]+\))?/i);
        if (match)
            return match[0];
        return this.short(sentence.replace(/[^a-zA-Z0-9\s]/g, ' '), 42) || fallback;
    }
    short(value, limit) {
        const clean = String(value || '').replace(/\s+/g, ' ').trim();
        return clean.length > limit ? `${clean.slice(0, limit - 3)}...` : clean;
    }
    topMapKeys(map) {
        return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([key]) => key);
    }
    safe(value) {
        return String(value || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    }
    kindFromExtension(ext) {
        if (ext === 'pdf')
            return 'PDF';
        if (ext === 'docx')
            return 'DOCX';
        if (ext === 'pptx')
            return 'PPT/PPTX';
        return 'Notes';
    }
    async getMockTest(userId, id) {
        const test = await this.mockRepo.findOne({ where: { id, userId } });
        if (!test)
            throw new common_1.NotFoundException('Mock test not found.');
        return test;
    }
    async getMindMap(userId, id) {
        const map = await this.mindMapRepo.findOne({ where: { id, userId } });
        if (!map)
            throw new common_1.NotFoundException('Mind map not found.');
        return map;
    }
    async getStudyKit(userId, id) {
        const kit = await this.studyKitRepo.findOne({ where: { id, userId } });
        if (!kit)
            throw new common_1.NotFoundException('Study kit not found.');
        return kit;
    }
    async log(userId, action, metadata) {
        await this.activityRepo.save(this.activityRepo.create({ userId, action, metadata }));
    }
    cleanLearningText(text) {
        return text
            .split('\n')
            .map((line) => {
            let l = line.trim();
            if (/^(?:page\s+\d+|watermark|confidential|draft|do\s+not\s+copy|copyright)/i.test(l))
                return '';
            l = l.replace(/\(?\[?\b\d+\s*marks?\b\]?\)?/gi, '');
            l = l.replace(/\(?\[?\bmarks?:\s*\d+\b\]?\)?/gi, '');
            l = l.replace(/^(?:question\s+\d+|q\s*\d+|q\.\s*\d+|\d+\.)\s*:?/i, '');
            l = l.replace(/^(?:[a-d]\)|\([a-d]\)|[A-D]\.|\([A-D]\)|\[[A-D]\])\s+/, '');
            if (/^(?:section\s+[a-z]|part\s+[a-z\d]+|instructions?|all\s+questions\s+are\s+compulsory|marks\s+distribution|time\s+allowed|maximum\s+marks)/i.test(l)) {
                return '';
            }
            return l;
        })
            .filter(Boolean)
            .join('\n');
    }
};
exports.LearningWorkspaceService = LearningWorkspaceService;
exports.LearningWorkspaceService = LearningWorkspaceService = LearningWorkspaceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(learning_workspace_entities_1.AiLearningSource)),
    __param(1, (0, typeorm_1.InjectRepository)(learning_workspace_entities_1.AiMockTest)),
    __param(2, (0, typeorm_1.InjectRepository)(learning_workspace_entities_1.AiMockTestAttempt)),
    __param(3, (0, typeorm_1.InjectRepository)(learning_workspace_entities_1.AiMindMap)),
    __param(4, (0, typeorm_1.InjectRepository)(learning_workspace_entities_1.AiStudyKit)),
    __param(5, (0, typeorm_1.InjectRepository)(learning_workspace_entities_1.AiFlashcardReview)),
    __param(6, (0, typeorm_1.InjectRepository)(learning_workspace_entities_1.AiLearningActivity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        qdrant_service_1.QdrantService,
        bge_m3_provider_1.BgeM3Provider,
        embedding_service_1.EmbeddingService,
        notification_service_1.NotificationService])
], LearningWorkspaceService);
//# sourceMappingURL=learning-workspace.service.js.map