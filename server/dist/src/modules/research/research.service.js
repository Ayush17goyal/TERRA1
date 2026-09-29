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
var ResearchService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResearchService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const research_entities_1 = require("./research.entities");
const bge_m3_provider_1 = require("../retrieval/bge-m3.provider");
const qdrant_service_1 = require("../retrieval/qdrant.service");
const legal_retrieval_service_1 = require("../retrieval/legal-retrieval.service");
const notification_service_1 = require("../exam/notification.service");
const AdmZip = require("adm-zip");
const crypto = require("crypto");
const path = require("path");
const token_optimization_service_1 = require("../chat/token-optimization.service");
const openrouter_ai_provider_service_1 = require("../chat/openrouter-ai-provider.service");
const semantic_cache_service_1 = require("../chat/semantic-cache.service");
let ResearchService = ResearchService_1 = class ResearchService {
    constructor(users, queries, reports, sources, notes, savedReports, assets, documents, judgmentReports, bgeM3Provider, qdrantService, legalRetrievalService, notificationService, tokenService, aiProvider, cacheService) {
        this.users = users;
        this.queries = queries;
        this.reports = reports;
        this.sources = sources;
        this.notes = notes;
        this.savedReports = savedReports;
        this.assets = assets;
        this.documents = documents;
        this.judgmentReports = judgmentReports;
        this.bgeM3Provider = bgeM3Provider;
        this.qdrantService = qdrantService;
        this.legalRetrievalService = legalRetrievalService;
        this.notificationService = notificationService;
        this.tokenService = tokenService;
        this.aiProvider = aiProvider;
        this.cacheService = cacheService;
        this.logger = new common_1.Logger(ResearchService_1.name);
    }
    async resolveUser(reqUser) {
        if (!reqUser?.id || !reqUser.email) {
            throw new common_1.BadRequestException('Authenticated Clerk user email is required for research');
        }
        const existingByEmail = await this.users.findOne({ where: { email: reqUser.email } });
        if (existingByEmail)
            return existingByEmail;
        const userId = /^[0-9a-f-]{36}$/i.test(reqUser.id)
            ? reqUser.id
            : this.deterministicUuid(reqUser.id);
        let user = await this.users.findOne({ where: { id: userId } });
        if (!user) {
            user = this.users.create({
                id: userId,
                email: reqUser.email,
                fullName: reqUser.fullName || null,
            });
            await this.users.save(user);
        }
        return user;
    }
    deterministicUuid(value) {
        const hash = crypto.createHash('sha256').update(value).digest('hex').slice(0, 32).split('');
        hash[12] = '4';
        hash[16] = ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16);
        const hex = hash.join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    async createQuery(userId, body) {
        const query = await this.queries.save(this.queries.create({
            userId,
            topic: body.topic,
            researchMode: body.researchMode,
            status: 'completed',
        }));
        const report = await this.createReport(userId, {
            queryId: query.id,
            title: body.topic,
            summary: `Research workspace for ${body.topic}. Click 'Generate Research' to run DeepSeek R1 agent analysis.`,
            researchMode: body.researchMode,
            researchOutline: {
                issues: [`Primary issue: ${body.topic}`],
                arguments: [],
                questions: ['What are the controlling authorities?', 'Which statutes and doctrines frame the dispute?'],
            },
        });
        await this.seedWorkspace(report.id);
        return { query, report: await this.getReport(userId, report.id) };
    }
    listQueries(userId) {
        return this.queries.find({ where: { userId }, order: { createdAt: 'DESC' } });
    }
    async getQuery(userId, id) {
        const query = await this.queries.findOne({ where: { id, userId } });
        if (!query)
            throw new common_1.NotFoundException('Research query not found');
        return query;
    }
    async createReport(userId, body) {
        return this.reports.save(this.reports.create({
            userId,
            queryId: body.queryId,
            title: body.title || 'Untitled Research Report',
            summary: body.summary || '',
            researchMode: body.researchMode || 'Academic',
            researchOutline: body.researchOutline || { issues: [], arguments: [], questions: [] },
        }));
    }
    async getReport(userId, id) {
        const report = await this.reports.findOne({ where: { id, userId } });
        if (!report)
            throw new common_1.NotFoundException('Research report not found');
        const [sources, notes, assets] = await Promise.all([
            this.sources.find({ where: { reportId: id }, order: { createdAt: 'ASC' } }),
            this.notes.find({ where: { reportId: id, userId }, order: { updatedAt: 'DESC' } }),
            this.assets.find({ where: { reportId: id }, order: { createdAt: 'ASC' } }),
        ]);
        return { ...report, sources, notes, assets };
    }
    async updateReport(userId, id, body) {
        const report = await this.reports.findOne({ where: { id, userId } });
        if (!report)
            throw new common_1.NotFoundException('Research report not found');
        Object.assign(report, body);
        await this.reports.save(report);
        return this.getReport(userId, id);
    }
    async deleteReport(userId, id) {
        const report = await this.reports.findOne({ where: { id, userId } });
        if (!report)
            throw new common_1.NotFoundException('Research report not found');
        await this.reports.remove(report);
        return { success: true };
    }
    async createSource(userId, body) {
        await this.getReport(userId, body.reportId);
        return this.sources.save(this.sources.create(body));
    }
    async getSource(userId, id) {
        const source = await this.sources.findOne({ where: { id } });
        if (!source)
            throw new common_1.NotFoundException('Research source not found');
        await this.getReport(userId, source.reportId);
        return source;
    }
    async deleteSource(userId, id) {
        const source = await this.getSource(userId, id);
        await this.sources.remove(source);
        return { success: true };
    }
    async createNote(userId, body) {
        await this.getReport(userId, body.reportId);
        return this.notes.save(this.notes.create({ ...body, userId }));
    }
    async getNote(userId, id) {
        const note = await this.notes.findOne({ where: { id, userId } });
        if (!note)
            throw new common_1.NotFoundException('Research note not found');
        return note;
    }
    async updateNote(userId, id, body) {
        const note = await this.getNote(userId, id);
        Object.assign(note, body);
        return this.notes.save(note);
    }
    async deleteNote(userId, id) {
        const note = await this.getNote(userId, id);
        await this.notes.remove(note);
        return { success: true };
    }
    async saveReport(userId, reportId) {
        await this.getReport(userId, reportId);
        const existing = await this.savedReports.findOne({ where: { userId, reportId } });
        return existing || this.savedReports.save(this.savedReports.create({ userId, reportId }));
    }
    listSavedReports(userId) {
        return this.savedReports.find({ where: { userId }, relations: ['report'], order: { createdAt: 'DESC' } });
    }
    async deleteSavedReport(userId, id) {
        const saved = await this.savedReports.findOne({ where: { id, userId } });
        if (!saved)
            throw new common_1.NotFoundException('Saved report not found');
        await this.savedReports.remove(saved);
        return { success: true };
    }
    async createAsset(userId, body) {
        await this.getReport(userId, body.reportId);
        return this.assets.save(this.assets.create(body));
    }
    async uploadDocument(userId, file, queryId, docCategory) {
        if (!file) {
            throw new Error('No file uploaded');
        }
        const name = file.originalname || 'document.txt';
        const type = path.extname(name).toLowerCase().replace('.', '') || 'txt';
        const category = docCategory || 'User Notes';
        const doc = this.documents.create({
            userId,
            queryId: queryId || null,
            name,
            type,
            docCategory: category,
            status: 'Processing',
        });
        await this.documents.save(doc);
        try {
            let text = '';
            if (type === 'pdf') {
                const pdfParse = require('pdf-parse');
                const parsed = await pdfParse(file.buffer);
                text = parsed.text;
            }
            else if (type === 'docx') {
                const zip = new AdmZip(file.buffer);
                const docXml = zip.readAsText('word/document.xml');
                const matches = docXml.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
                if (matches) {
                    text = matches.map(m => m.replace(/<[^>]+>/g, '')).join(' ');
                }
            }
            else {
                text = file.buffer.toString('utf-8');
            }
            doc.content = text;
            await this.documents.save(doc);
            const chunks = [];
            const CHUNK_SIZE = 1000;
            const CHUNK_OVERLAP = 200;
            for (let i = 0; i < text.length; i += (CHUNK_SIZE - CHUNK_OVERLAP)) {
                chunks.push(text.substring(i, i + CHUNK_SIZE));
                if (i + CHUNK_SIZE >= text.length)
                    break;
            }
            if (chunks.length > 0) {
                const embeddings = await this.bgeM3Provider.generateBatchEmbeddings(chunks);
                const qdrantClient = this.qdrantService.getClient();
                const points = chunks.map((chunkText, j) => {
                    const pointId = this.generatePointId(doc.id, j);
                    return {
                        id: pointId,
                        vector: embeddings[j],
                        payload: {
                            text: chunkText,
                            source_id: doc.id,
                            query_id: queryId || null,
                            user_id: userId,
                            doc_category: category,
                            chunk_index: j,
                            name,
                            uploaded_at: new Date().toISOString(),
                        },
                    };
                });
                await qdrantClient.upsert('user_documents', {
                    wait: true,
                    points,
                });
            }
            doc.status = 'Ready';
            await this.documents.save(doc);
            return doc;
        }
        catch (error) {
            this.logger.error(`Error processing document upload: ${error.message}`);
            doc.status = 'Error';
            doc.content = `Processing failed: ${error.message}`;
            await this.documents.save(doc);
            throw error;
        }
    }
    async getDocuments(userId, queryId) {
        return this.documents.find({ where: { userId, queryId } });
    }
    async generateJudgmentIntelligence(userId, body) {
        const docs = body.queryId
            ? await this.documents.find({ where: { userId, queryId: body.queryId }, order: { createdAt: 'DESC' } })
            : [];
        const judgmentDoc = docs.find((doc) => /judg/i.test(doc.docCategory || ''));
        if (!judgmentDoc?.content) {
            throw new common_1.BadRequestException('Upload or select a Judgment document before generating judgment intelligence.');
        }
        const text = judgmentDoc.content;
        const analysis = await this.buildJudgmentIntelligence(text, body, userId);
        const reportText = this.renderJudgmentReportMarkdown(analysis);
        const saved = await this.judgmentReports.save(this.judgmentReports.create({
            userId,
            researchTopic: body.topic,
            caseName: analysis.caseMetadata.caseName,
            citation: analysis.caseMetadata.citation,
            court: analysis.caseMetadata.court,
            judge: analysis.caseMetadata.judge,
            facts: analysis.factsOfCase,
            issues: analysis.issues,
            holdings: analysis.holdings,
            ratioDecidendi: analysis.ratioDecidendi,
            obiterDicta: analysis.obiterDicta,
            reliefGranted: analysis.reliefGranted,
            impactAnalysis: this.stringifySection(analysis.impactAnalysis),
            researchMatrix: analysis.researchMatrix,
            generatedReport: reportText,
            fileName: judgmentDoc?.name || null,
            metadata: analysis,
        }));
        return this.toJudgmentReportResponse(saved);
    }
    async generateLegalBrief(userId, body) {
        const docs = body.queryId
            ? await this.documents.find({ where: { userId, queryId: body.queryId }, order: { createdAt: 'DESC' } })
            : [];
        const briefDoc = docs.find((doc) => /brief/i.test(doc.docCategory || ''));
        if (!briefDoc?.content) {
            throw new common_1.BadRequestException('Upload or select a Legal Brief document before generating a legal brief.');
        }
        const text = briefDoc.content;
        const brief = await this.buildLegalBrief(text, body, userId);
        const reportText = this.renderLegalBriefMarkdown(brief);
        let query = body.queryId ? await this.queries.findOne({ where: { id: body.queryId, userId } }) : null;
        if (!query) {
            query = await this.queries.save(this.queries.create({
                id: body.queryId || undefined,
                userId,
                topic: body.topic,
                researchMode: body.researchMode,
                status: 'completed',
            }));
        }
        else {
            query.topic = body.topic;
            query.researchMode = body.researchMode;
            query.status = 'completed';
            await this.queries.save(query);
        }
        const report = await this.reports.save(this.reports.create({
            userId,
            queryId: query.id,
            title: brief.case || `Case Brief: ${body.topic}`,
            summary: reportText,
            researchMode: body.researchMode,
            researchOutline: {
                documentType: 'Legal Brief',
                template: 'Model Case Brief Template',
                issues: [brief.issue].filter(Boolean),
                arguments: [brief.holding].filter(Boolean),
                questions: ['What is the issue?', 'What is the holding?', 'What rule and application drive the majority reasoning?'],
                sourceFile: briefDoc?.name || null,
            },
        }));
        return this.getReport(userId, report.id);
    }
    async generateBareActAnalysis(userId, body) {
        const docs = body.queryId
            ? await this.documents.find({ where: { userId, queryId: body.queryId }, order: { createdAt: 'DESC' } })
            : [];
        const actDoc = docs.find((doc) => /bare|act|statute/i.test(doc.docCategory || ''));
        if (!actDoc?.content) {
            throw new common_1.BadRequestException('Upload or select a Bare Act document before generating statutory analysis.');
        }
        const text = actDoc.content;
        const analysis = await this.buildBareActAnalysis(text, body, userId);
        const reportText = this.renderBareActMarkdown(analysis);
        let query = body.queryId ? await this.queries.findOne({ where: { id: body.queryId, userId } }) : null;
        if (!query) {
            query = await this.queries.save(this.queries.create({
                id: body.queryId || undefined,
                userId,
                topic: body.topic,
                researchMode: body.researchMode,
                status: 'completed',
            }));
        }
        else {
            query.topic = body.topic;
            query.researchMode = body.researchMode;
            query.status = 'completed';
            await this.queries.save(query);
        }
        const report = await this.reports.save(this.reports.create({
            userId,
            queryId: query.id,
            title: analysis.actTitle || `Bare Act Analysis: ${body.topic}`,
            summary: reportText,
            researchMode: body.researchMode,
            researchOutline: {
                documentType: 'Bare Act',
                template: 'Bare Act Statutory Analysis',
                issues: (analysis.keyDefinitions || []).map((item) => item.term || item.section).filter(Boolean).slice(0, 5),
                arguments: (analysis.penalties || []).map((item) => item.section || item.offence).filter(Boolean).slice(0, 5),
                questions: ['What is the short title and extent?', 'Which definitions control interpretation?', 'Which sections create rights, remedies, offences, or penalties?'],
                sourceFile: actDoc?.name || null,
            },
        }));
        return this.getReport(userId, report.id);
    }
    async listJudgmentReports(userId, search) {
        const reports = await this.judgmentReports.find({ where: { userId }, order: { createdAt: 'DESC' } });
        const q = (search || '').trim().toLowerCase();
        const filtered = q
            ? reports.filter((report) => {
                const haystack = [
                    report.caseName,
                    report.citation,
                    report.court,
                    report.judge,
                    report.ratioDecidendi,
                    report.researchTopic,
                    report.generatedReport,
                ].filter(Boolean).join(' ').toLowerCase();
                return haystack.includes(q);
            })
            : reports;
        return filtered.map((report) => this.toJudgmentReportResponse(report));
    }
    async getJudgmentReport(userId, id) {
        const report = await this.judgmentReports.findOne({ where: { id, userId } });
        if (!report)
            throw new common_1.NotFoundException('Judgment report not found');
        return this.toJudgmentReportResponse(report);
    }
    async deleteJudgmentReport(userId, id) {
        const report = await this.judgmentReports.findOne({ where: { id, userId } });
        if (!report)
            throw new common_1.NotFoundException('Judgment report not found');
        await this.judgmentReports.remove(report);
        return { success: true };
    }
    async getJudgmentAnalytics(userId) {
        const reports = await this.judgmentReports.find({ where: { userId } });
        const countBy = (items) => items.reduce((acc, item) => {
            const key = item || 'Unknown';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        const top = (record) => Object.entries(record)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([label, count]) => ({ label, count }));
        const statutes = reports.flatMap((report) => report.metadata?.statutoryFramework || [])
            .map((item) => item.article || item.section || item.act || 'Unknown Statute');
        const precedents = reports.flatMap((report) => report.metadata?.precedentsReliedUpon || [])
            .map((item) => item.caseName || item.case || 'Unknown Precedent');
        return {
            totalJudgmentsGenerated: reports.length,
            mostUsedCourts: top(countBy(reports.map((report) => report.court || 'Unknown Court'))),
            mostResearchedTopics: top(countBy(reports.map((report) => report.researchTopic || 'Untitled Topic'))),
            mostUsedStatutes: top(countBy(statutes)),
            mostUsedPrecedents: top(countBy(precedents)),
        };
    }
    async buildJudgmentIntelligence(text, body, userId) {
        const local = this.extractJudgmentSignals(text, body.topic);
        const prompt = `You are LEGATRIXON Judgment Writing Engine, a senior Indian judicial clerk.
Read the uploaded judgment text and return ONLY valid JSON. Do not include markdown.
The JSON must include these keys: caseMetadata, parties, appearances, caseOverview, chargesOrClaims, factsOfCase, proceduralHistory, issues, argumentsOfParties, evidenceAnalysis, courtAnalysis, pointsForDetermination, ratioDecidendi, obiterDicta, holdings, precedentsReliedUpon, statutoryFramework, reliefGranted, finalDecision, finalOrder, sentencingOrDirections, impactAnalysis, researchMatrix, examPreparation, onePageRevisionNotes, confidenceScore.
Generate content in the style of an Indian court judgment-writing document like this structure:
IN THE COURT OF [COURT]
[JURISDICTION]
[CASE NUMBER]
[PARTIES]
Appearance
Date of Judgment
Judgement
1. Charge/claim and statutory provisions
2. Brief facts
3. Supply of copies/procedural compliance where relevant
4. Arguments of prosecution/appellant/petitioner and defence/respondent
5. Evidence of witnesses/documents/exhibits
6. Court discussion and points for determination
Decision
Order/sentence/directions
Given under my hand and seal of this court...
Use numbered judicial paragraphs, formal court language, and no memorial headings. If a field is not explicit, infer cautiously and mark "Not expressly available in uploaded text".
Research topic: ${body.topic}
Research lens: ${body.researchMode}
Research depth: ${body.depth || 'standard'}
Selected databases: ${(body.sources || []).join(', ')}
Uploaded judgment text:
${text.slice(0, body.depth === 'exhaustive' ? 55000 : body.depth === 'deep' ? 42000 : 30000)}`;
        try {
            const preferred = body.provider === 'openai' ? 'GPT-4o-Mini' : body.provider === 'gemini' ? 'Gemini' : 'DeepSeek';
            const result = await this.aiProvider.complete({
                temperature: 0.1,
                maxTokens: body.depth === 'exhaustive' ? 7000 : body.depth === 'deep' ? 5500 : 4200,
                preferredModel: preferred,
                module: 'judgment',
                jsonMode: true,
                userId,
                messages: [
                    { role: 'system', content: 'Return only valid JSON for a professional Indian court judgment-writing document. Do not write memorial content.' },
                    { role: 'user', content: prompt },
                ],
            });
            const parsed = JSON.parse((result.content.match(/\{[\s\S]*\}/) || [result.content])[0]);
            return this.normalizeJudgmentAnalysis({ ...local, ...parsed }, local);
        }
        catch (error) {
            this.logger.warn(`Judgment intelligence AI fallback used: ${error.message}`);
            return this.normalizeJudgmentAnalysis(local, local);
        }
    }
    extractJudgmentSignals(text, topic) {
        const clean = (text || '').replace(/\r/g, '').trim();
        const lines = clean.split('\n').map((line) => line.trim()).filter(Boolean);
        const firstBlock = lines.slice(0, 30).join('\n');
        const partiesLine = lines.find((line) => /\b(v\.|vs\.?|versus)\b/i.test(line)) || '';
        const articles = Array.from(new Set((clean.match(/\bArticle\s+\d+[A-Z]?\b/gi) || []).map((x) => x.trim())));
        const sections = Array.from(new Set((clean.match(/\bSection\s+\d+[A-Z]?(?:\(\d+\))?\b/gi) || []).map((x) => x.trim())));
        const precedents = Array.from(new Set((clean.match(/[A-Z][A-Za-z.\s&]+?\s+(?:v\.|vs\.?|versus)\s+[A-Z][A-Za-z.\s&]+?(?=,|\(|\n|;)/g) || []).slice(0, 12)));
        const date = (firstBlock.match(/\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December),?\s+\d{4}\b/i) || firstBlock.match(/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/))?.[0] || '';
        const caseNo = (firstBlock.match(/\b(?:Civil|Criminal|Writ|Special Leave|SLP|Appeal|Petition)[^\n]{0,80}No\.?[^\n]{0,80}/i) || [])[0] || '';
        const court = /supreme court/i.test(firstBlock) ? 'Supreme Court of India' : (/high court/i.test(firstBlock) ? 'High Court' : '');
        const decision = /partly allowed|allowed in part/i.test(clean) ? 'Partly Allowed' : /dismissed/i.test(clean) ? 'Dismissed' : /remand/i.test(clean) ? 'Remanded' : /allowed/i.test(clean) ? 'Allowed' : 'Not expressly available in uploaded text';
        const [petitioner, respondent] = partiesLine.split(/\b(?:v\.|vs\.?|versus)\b/i).map((part) => part?.trim()).filter(Boolean);
        return {
            caseMetadata: {
                caseName: partiesLine || topic,
                court,
                bench: '',
                judge: '',
                caseNo,
                citation: (firstBlock.match(/\b(?:AIR|SCC|SCR|CriLJ|All ER)[^\n,;]*/i) || [])[0] || '',
                date,
                jurisdiction: /appellate/i.test(firstBlock) ? 'Appellate Jurisdiction' : /writ/i.test(firstBlock) ? 'Writ Jurisdiction' : 'Not expressly available in uploaded text',
            },
            parties: { petitioner: petitioner || 'Not expressly available in uploaded text', respondent: respondent || 'Not expressly available in uploaded text' },
            caseOverview: `This judgment intelligence report examines ${topic}. The uploaded judgment raises legal controversy around ${articles.concat(sections).slice(0, 4).join(', ') || 'the pleaded legal framework'} and culminates in a court decision recorded as ${decision}.`,
            factsOfCase: this.timelineFromText(clean),
            proceduralHistory: {
                trialCourt: 'Not expressly available in uploaded text',
                highCourt: /high court/i.test(clean) ? 'High Court proceedings are referenced in the uploaded judgment.' : 'Not expressly available in uploaded text',
                supremeCourt: /supreme court/i.test(clean) ? 'The matter reached the Supreme Court for final consideration.' : 'Not expressly available in uploaded text',
            },
            issues: this.issueList(clean, topic),
            argumentsOfParties: {
                petitionerArguments: this.argumentList(clean, 'petitioner|appellant'),
                respondentArguments: this.argumentList(clean, 'respondent|state|union'),
            },
            evidenceAnalysis: {
                documentaryEvidence: 'Analyzed from pleadings, statutory materials, and judgment record where available.',
                oralEvidence: 'Not expressly available in uploaded text',
                expertEvidence: 'Not expressly available in uploaded text',
                exhibits: 'Not expressly available in uploaded text',
            },
            courtAnalysis: `The court analysis turns on ${articles.concat(sections).slice(0, 5).join(', ') || 'the controlling legal framework'}, precedent discipline, and the fit between the impugned action and constitutional or statutory limits.`,
            ratioDecidendi: this.ratioFromText(clean, decision),
            obiterDicta: 'Judicial observations beyond the decisive holding should be treated as persuasive unless expressly tied to the final decision.',
            holdings: this.issueList(clean, topic).map((issue, index) => ({ issue: `Issue ${index + 1}`, finding: index === 0 ? decision : 'Answered as per the court analysis' })),
            precedentsReliedUpon: precedents.map((caseName) => ({ caseName, court: '', year: (caseName.match(/\b(19|20)\d{2}\b/) || [''])[0], purpose: 'Cited in the judgment reasoning' })),
            statutoryFramework: articles.map((article) => ({ article, section: '', act: 'Constitution of India', purpose: 'Constitutional provision considered by the court' }))
                .concat(sections.map((section) => ({ article: '', section, act: 'Relevant statute', purpose: 'Statutory provision considered by the court' }))),
            reliefGranted: decision,
            finalDecision: decision,
            impactAnalysis: {
                academicImpact: 'Useful for doctrinal discussion and classroom case analysis.',
                mootCourtRelevance: 'Useful for issue framing, authority use, and respondent-petitioner argument mapping.',
                advocacyRelevance: 'Useful for identifying relief strategy and precedent positioning.',
                judicialSignificance: 'Relevant to issue-wise reasoning and judicial review methodology.',
                practicalApplication: 'Useful for legal research notes, case briefs, and litigation preparation.',
            },
            researchMatrix: [],
            examPreparation: {
                mostLikelyExamQuestions: [`Explain the ratio of ${partiesLine || topic}.`, `Discuss the court's treatment of ${articles[0] || 'the main legal issue'}.`],
                mostLikelyVivaQuestions: ['What were the material facts?', 'What is the difference between ratio and obiter in this case?'],
                mostLikelyMootCourtQuestions: ['What relief was ultimately granted?', 'Which precedent best supports the holding?'],
                mostImportantCitations: precedents.slice(0, 5),
            },
            onePageRevisionNotes: `Case: ${partiesLine || topic}\nCourt: ${court || 'N/A'}\nDecision: ${decision}\nCore provisions: ${articles.concat(sections).join(', ') || 'N/A'}\nCore ratio: ${this.ratioFromText(clean, decision)}`,
            confidenceScore: { confidence: 82, researchDepth: bodyDepthScore(topic), citationCoverage: Math.min(95, 55 + precedents.length * 5 + articles.length * 4 + sections.length * 3) },
        };
        function bodyDepthScore(_) { return 78; }
    }
    normalizeJudgmentAnalysis(analysis, fallback) {
        const merged = { ...fallback, ...analysis };
        merged.caseMetadata = { ...fallback.caseMetadata, ...(analysis.caseMetadata || {}) };
        merged.parties = { ...fallback.parties, ...(analysis.parties || {}) };
        merged.issues = Array.isArray(merged.issues) && merged.issues.length ? merged.issues : fallback.issues;
        merged.holdings = Array.isArray(merged.holdings) && merged.holdings.length ? merged.holdings : fallback.holdings;
        merged.precedentsReliedUpon = Array.isArray(merged.precedentsReliedUpon) ? merged.precedentsReliedUpon : fallback.precedentsReliedUpon;
        merged.statutoryFramework = Array.isArray(merged.statutoryFramework) ? merged.statutoryFramework : fallback.statutoryFramework;
        merged.researchMatrix = Array.isArray(merged.researchMatrix) && merged.researchMatrix.length
            ? merged.researchMatrix
            : merged.issues.map((issue, index) => ({
                issue: typeof issue === 'string' ? issue : issue.issue || `Issue ${index + 1}`,
                arguments: [merged.argumentsOfParties?.petitionerArguments?.[index], merged.argumentsOfParties?.respondentArguments?.[index]].filter(Boolean).join(' | '),
                courtFinding: merged.holdings?.[index]?.finding || merged.finalDecision,
                ratio: merged.ratioDecidendi,
                statute: merged.statutoryFramework?.[index]?.article || merged.statutoryFramework?.[index]?.section || '',
                precedent: merged.precedentsReliedUpon?.[index]?.caseName || '',
            }));
        return merged;
    }
    renderJudgmentReportMarkdown(a) {
        const list = (items, fallback = 'Not expressly available in uploaded text') => {
            if (!Array.isArray(items) || items.length === 0)
                return fallback;
            return items.map((item, index) => {
                if (typeof item === 'string')
                    return `${index + 1}. ${item}`;
                return `${index + 1}. ${item.issue || item.finding || item.event || item.argument || JSON.stringify(item)}`;
            }).join('\n');
        };
        const petitioner = a.parties?.petitioner || 'Not expressly available in uploaded text';
        const respondent = a.parties?.respondent || 'Not expressly available in uploaded text';
        const prosecutionArgs = a.argumentsOfParties?.petitionerArguments || a.argumentsOfParties?.prosecutionArguments || [];
        const defenceArgs = a.argumentsOfParties?.respondentArguments || a.argumentsOfParties?.defenceArguments || [];
        const finalOrder = a.finalOrder || a.sentencingOrDirections || a.finalDecision || a.reliefGranted || 'Not expressly available in uploaded text';
        const court = a.caseMetadata?.court || '__________';
        const judge = a.caseMetadata?.judge || a.caseMetadata?.presidingOfficer || '__________';
        const date = a.caseMetadata?.date || '__________';
        return `# IN THE COURT OF ${court}

${a.caseMetadata?.jurisdiction || 'JURISDICTION: Not expressly available in uploaded text'}

${a.caseMetadata?.caseNo || 'Case No.: Not expressly available in uploaded text'}

${petitioner} ............................................... Appellant / Petitioner

Vs

${respondent} ............................................... Respondent / Accused

Appearance:
${this.stringifySection(a.appearances || {
            appellant: 'Learned counsel for the appellant/prosecution: Not expressly available in uploaded text',
            respondent: 'Learned counsel for the respondent/defence: Not expressly available in uploaded text',
        })}

Presiding Officer / Judge: ${judge}
Citation: ${a.caseMetadata?.citation || 'N/A'}
Bench: ${a.caseMetadata?.bench || 'N/A'}
Date of Judgment: ${date}

## Judgement

1. The matter has been placed before this Court for adjudication in ${a.caseMetadata?.caseName || 'the present case'}. The case concerns ${this.stringifySection(a.chargesOrClaims || a.caseOverview)} The relevant statutory and legal provisions noticed from the record are: ${(a.statutoryFramework || []).map((x) => x.article || x.section || x.act).filter(Boolean).join(', ') || 'Not expressly available in uploaded text'}.

2. The facts in brief are as follows:
${this.stringifySection(a.factsOfCase)}

3. The procedural history and compliance with prior proceedings are recorded as follows:
${this.stringifySection(a.proceduralHistory)}

4. I have heard the arguments advanced by the learned counsel appearing for the parties.

According to the appellant/prosecution/petitioner:
${list(prosecutionArgs)}

According to the respondent/defence:
${list(defenceArgs)}

5. To prove or support the case, the material evidence and documents appearing from the uploaded judgment are considered below:
${this.stringifySection(a.evidenceAnalysis)}

6. The points for determination before this Court are:
${list(a.pointsForDetermination || a.issues)}

7. On a careful consideration of the pleadings, evidence, statutory provisions, and submissions, this Court records the following reasoning:
${this.stringifySection(a.courtAnalysis)}

8. The ratio decidendi emerging from the judgment is:
${a.ratioDecidendi || 'Not expressly available in uploaded text'}

9. The observations, if any, which are in the nature of obiter dicta are:
${a.obiterDicta || 'Not expressly available in uploaded text'}

## Decision

10. The findings on the issues are as follows:
${list(a.holdings)}

11. In view of the above discussion, the relief granted is:
${this.stringifySection(a.reliefGranted)}

## Order

12. Accordingly, it is ordered that:
${this.stringifySection(finalOrder)}

13. The legal impact and operative significance of this judgment are as follows:
${this.stringifySection(a.impactAnalysis)}

Given under my hand and seal of this Court on this ${date}.

.................... J.

${judge}

${court}
`;
    }
    toJudgmentReportResponse(report) {
        return {
            id: report.id,
            userId: report.userId,
            researchTopic: report.researchTopic,
            caseName: report.caseName,
            citation: report.citation,
            court: report.court,
            judge: report.judge,
            facts: report.facts,
            issues: report.issues,
            holdings: report.holdings,
            ratioDecidendi: report.ratioDecidendi,
            obiterDicta: report.obiterDicta,
            reliefGranted: report.reliefGranted,
            impactAnalysis: report.impactAnalysis,
            researchMatrix: report.researchMatrix,
            generatedReport: report.generatedReport,
            fileName: report.fileName,
            metadata: report.metadata,
            title: report.caseName || report.researchTopic,
            summary: report.generatedReport,
            researchMode: 'Judgment Intelligence',
            sources: [],
            notes: [],
            assets: [],
            createdAt: report.createdAt,
            updatedAt: report.updatedAt,
        };
    }
    stringifySection(value) {
        if (!value)
            return 'N/A';
        if (typeof value === 'string')
            return value;
        if (Array.isArray(value))
            return value.map((item, i) => typeof item === 'string' ? `${i + 1}. ${item}` : `${i + 1}. ${JSON.stringify(item)}`).join('\n');
        return Object.entries(value).map(([key, val]) => `- ${key}: ${Array.isArray(val) ? val.join('; ') : String(val)}`).join('\n');
    }
    camel(value) {
        return value.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
    }
    timelineFromText(text) {
        const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 40).slice(0, 6);
        return sentences.length ? sentences.map((event, index) => ({ sequence: index + 1, event })) : [{ sequence: 1, event: 'Material facts are not expressly available in uploaded text.' }];
    }
    issueList(text, topic) {
        const issueLines = text.split('\n').filter((line) => /\b(whether|issue|question)\b/i.test(line)).slice(0, 5);
        return issueLines.length ? issueLines : [`Whether the court correctly resolved the legal controversy concerning ${topic}.`];
    }
    argumentList(text, sidePattern) {
        const regex = new RegExp(`(?:${sidePattern}).{0,180}`, 'gi');
        const matches = text.match(regex) || [];
        return matches.slice(0, 5).map((match) => match.trim());
    }
    ratioFromText(text, decision) {
        const judicialReview = /judicial review.*basic feature|basic feature.*judicial review/i.test(text);
        if (judicialReview)
            return 'Judicial review by constitutional courts forms part of the basic structure and cannot be abrogated by subordinate or administrative action.';
        return `The binding principle is drawn from the court's issue-wise reasoning and final decision: ${decision}.`;
    }
    async buildLegalBrief(text, body, userId) {
        const fallback = this.extractLegalBriefSignals(text, body.topic);
        const prompt = `You are LEGATRIXON Legal Brief Generator.
Read the uploaded case/brief text and return ONLY valid JSON with this exact structure:
{
  "case": "Name of the case and year of decision",
  "facts": "Who are the parties, what is their dispute, and how did the case reach the court? Include only important facts.",
  "issue": "The basic legal question and specific legal provision to be decided.",
  "holding": "The court's basic answer to the legal question, including vote count if available.",
  "majorityOpinionReasoning": {
    "rule": "Rule of law announced in the case.",
    "application": "How the rule applies to the facts and which party wins."
  },
  "concurringOpinionReasoning": "Reasoning of concurring opinions, or Not expressly available in uploaded text.",
  "dissentingOpinionReasoning": "Reasoning of dissenting opinions, or Not expressly available in uploaded text."
}
Use the model case brief template format. Do not write memorial prayers, grounds of appeal, or court judgment orders.
Research topic: ${body.topic}
Research lens: ${body.researchMode}
Uploaded text:
${text.slice(0, body.depth === 'exhaustive' ? 45000 : body.depth === 'deep' ? 32000 : 22000)}`;
        try {
            const preferred = body.provider === 'openai' ? 'GPT-4o-Mini' : body.provider === 'gemini' ? 'Gemini' : 'DeepSeek';
            const result = await this.aiProvider.complete({
                temperature: 0.1,
                maxTokens: body.depth === 'exhaustive' ? 4500 : body.depth === 'deep' ? 3500 : 2500,
                preferredModel: preferred,
                module: 'research',
                jsonMode: true,
                userId,
                messages: [
                    { role: 'system', content: 'Return only valid JSON for a model case brief template. No memorial format.' },
                    { role: 'user', content: prompt },
                ],
            });
            const parsed = JSON.parse((result.content.match(/\{[\s\S]*\}/) || [result.content])[0]);
            return {
                ...fallback,
                ...parsed,
                majorityOpinionReasoning: {
                    ...fallback.majorityOpinionReasoning,
                    ...(parsed.majorityOpinionReasoning || {}),
                },
            };
        }
        catch (error) {
            this.logger.warn(`Legal brief AI fallback used: ${error.message}`);
            return fallback;
        }
    }
    extractLegalBriefSignals(text, topic) {
        const clean = (text || '').replace(/\r/g, '').trim();
        const lines = clean.split('\n').map((line) => line.trim()).filter(Boolean);
        const partiesLine = lines.find((line) => /\b(v\.|vs\.?|versus)\b/i.test(line)) || topic;
        const provisions = Array.from(new Set([
            ...(clean.match(/\bArticle\s+\d+[A-Z]?\b/gi) || []),
            ...(clean.match(/\bSection\s+\d+[A-Z]?(?:\(\d+\))?\b/gi) || []),
        ]));
        const issue = this.issueList(clean, topic)[0] || `What legal question is raised by ${topic}?`;
        const holding = /dismissed/i.test(clean)
            ? 'The court dismissed the claim/appeal as reflected in the uploaded text.'
            : /allowed/i.test(clean)
                ? 'The court allowed the claim/appeal as reflected in the uploaded text.'
                : 'The holding is not expressly available in uploaded text.';
        const factSentences = clean.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.length > 35).slice(0, 5).join(' ');
        return {
            case: partiesLine,
            facts: factSentences || 'Not expressly available in uploaded text.',
            issue: provisions.length ? `${issue} Relevant provision(s): ${provisions.join(', ')}.` : issue,
            holding,
            majorityOpinionReasoning: {
                rule: this.ratioFromText(clean, holding),
                application: 'Applying the rule to the material facts, the winning party and exact application should be confirmed from the uploaded decision text.',
            },
            concurringOpinionReasoning: /concurring|concurrence/i.test(clean) ? 'Concurring opinion reasoning is referenced in the uploaded text and should be read with the majority holding.' : 'Not expressly available in uploaded text.',
            dissentingOpinionReasoning: /dissent/i.test(clean) ? 'Dissenting opinion reasoning is referenced in the uploaded text and should be compared with the majority rule/application.' : 'Not expressly available in uploaded text.',
        };
    }
    renderLegalBriefMarkdown(brief) {
        return `# Model Case Brief

## Case:
${brief.case || 'Name of the case, and year of the decision.'}

## Facts:
${brief.facts || 'Who are the parties to the lawsuit, what is their dispute, and how did they get to the Supreme Court? Include only the important facts necessary to understand the case.'}

## Issue:
${brief.issue || 'What is the basic legal question regarding what specific provision of law that is to be decided in the case?'}

## Holding:
${brief.holding || "What is the majority's basic answer to the basic legal question in the case. Include vote count if available."}

## Majority Opinion Reasoning:
What is the majority's explanation why it reached its holding? The reasoning consists of the rule and the application of the rule to the facts.

### A. Rule:
${brief.majorityOpinionReasoning?.rule || 'What rule of law is announced in the case?'}

### B. Application:
${brief.majorityOpinionReasoning?.application || 'How does the rule of law specifically apply to the facts? Which party wins according to that rule?'}

## Concurring Opinion(s) Reasoning:
${brief.concurringOpinionReasoning || "What is the reasoning of each separate concurrence? How do they differ in proposed rule or application?"}

## Dissenting Opinion(s) Reasoning:
${brief.dissentingOpinionReasoning || "What is the reasoning of each separate dissent? How do they differ in proposed rule or application?"}
`;
    }
    sampleLegalBriefText(topic) {
        return `Case: Anay Sharma v. Union of India (2026)
Facts: The petitioner challenges administrative guidelines restricting direct access to High Courts under Article 226 by requiring prior tribunal exhaustion.
Issue: Whether executive guidelines can restrict Article 226 access.
Holding: The restriction is invalid to the extent it penalizes direct constitutional access.
Reasoning: Judicial review is part of the basic structure. Administrative efficiency cannot extinguish constitutional remedies.`;
    }
    async buildBareActAnalysis(text, body, userId) {
        const fallback = this.extractBareActSignals(text, body.topic);
        const prompt = `You are LEGATRIXON Bare Act Statutory Analysis Engine.
Read the uploaded Bare Act/statute text and return ONLY valid JSON with this exact structure:
{
  "actTitle": "The full short title of the Act",
  "actNumber": "Act number if available",
  "enactmentDate": "Date of enactment/commencement if available",
  "preamble": "Preamble or object clause",
  "extentAndCommencement": "Short title, extent, commencement",
  "arrangementOfSections": [{"chapter":"Chapter name","sections":["1. Short title...", "2. Interpretation..."]}],
  "keyDefinitions": [{"section":"Section number","term":"Defined term","meaning":"Plain meaning"}],
  "importantSections": [{"section":"Section number","heading":"Heading","summary":"What it provides","practicalUse":"How it is used"}],
  "rightsAndDuties": [{"section":"Section number","rightOrDuty":"Right/duty/liability","whoIsAffected":"Affected person"}],
  "complianceRequirements": [{"section":"Section number","requirement":"Compliance requirement","consequence":"Consequence of non-compliance"}],
  "penalties": [{"section":"Section number","offence":"Offence/default","penalty":"Penalty/punishment"}],
  "remediesAndJurisdiction": [{"section":"Section number","remedy":"Remedy/forum/jurisdiction"}],
  "appealsAndProcedure": [{"section":"Section number","procedure":"Appeal/procedure"}],
  "amendmentsAndOmissions": [{"section":"Section number","change":"Amendment/omission/substitution note"}],
  "relatedProvisions": [{"section":"Section number","relatedTo":"Connected section/chapter","connection":"How they connect"}],
  "statutoryInterpretationNotes": "Professional interpretation notes",
  "examRevisionNotes": "Concise revision notes"
}
Generate in Bare Act format like: THE COPYRIGHT ACT, 1957; ACT NO.; Arrangement of Sections; Chapters; Section-wise analysis. Do not write memorial, legal brief, or judgment format.
Research topic: ${body.topic}
Research lens: ${body.researchMode}
Uploaded statute text:
${text.slice(0, body.depth === 'exhaustive' ? 55000 : body.depth === 'deep' ? 38000 : 26000)}`;
        try {
            const preferred = body.provider === 'openai' ? 'GPT-4o-Mini' : body.provider === 'gemini' ? 'Gemini' : 'DeepSeek';
            const result = await this.aiProvider.complete({
                temperature: 0.1,
                maxTokens: body.depth === 'exhaustive' ? 6500 : body.depth === 'deep' ? 4800 : 3400,
                preferredModel: preferred,
                module: 'research',
                jsonMode: true,
                userId,
                messages: [
                    { role: 'system', content: 'Return only valid JSON for a Bare Act statutory analysis. No memorial, judgment, or case brief format.' },
                    { role: 'user', content: prompt },
                ],
            });
            const parsed = JSON.parse((result.content.match(/\{[\s\S]*\}/) || [result.content])[0]);
            return { ...fallback, ...parsed };
        }
        catch (error) {
            this.logger.warn(`Bare Act AI fallback used: ${error.message}`);
            return fallback;
        }
    }
    extractBareActSignals(text, topic) {
        const clean = (text || '').replace(/\r/g, '').trim();
        const lines = clean.split('\n').map((line) => line.trim()).filter(Boolean);
        const title = lines.find((line) => /\bACT,\s*\d{4}\b/i.test(line)) || lines.find((line) => /^THE\s+.+\bACT\b/i.test(line)) || topic;
        const actNumber = (clean.match(/\bACT\s+NO\.\s*[^.\n]+/i) || [])[0] || 'Not expressly available in uploaded text';
        const enactmentDate = (clean.match(/\[\s*\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,\s+\d{4}\s*\]/) || clean.match(/\b\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,\s+\d{4}\b/))?.[0] || 'Not expressly available in uploaded text';
        const preamble = (clean.match(/An Act[\s\S]{0,350}?(?=BE it enacted|CHAPTER I|1\.\s)/i) || [])[0] || 'Not expressly available in uploaded text';
        const sectionLines = lines.filter((line) => /^\d+[A-Z]?\.\s+/.test(line)).slice(0, 90);
        const chapters = [];
        let currentChapter = 'PRELIMINARY / GENERAL';
        for (const line of lines.slice(0, 220)) {
            if (/^CHAPTER\s+[IVXLC]+/i.test(line)) {
                currentChapter = line;
                chapters.push({ chapter: currentChapter, sections: [] });
            }
            else if (/^\d+[A-Z]?\.\s+/.test(line)) {
                if (chapters.length === 0)
                    chapters.push({ chapter: currentChapter, sections: [] });
                chapters[chapters.length - 1].sections.push(line);
            }
        }
        const definitionTerms = Array.from(clean.matchAll(/(?:\(([a-z]+)\)|\b\d+[A-Z]?\.)\s*[“"]([^”"]+)[”"]\s+means\s+([^;.\n]+)/gi))
            .slice(0, 20)
            .map((match) => ({ section: 'Section 2', term: match[2], meaning: match[3].trim() }));
        const penalties = sectionLines
            .filter((line) => /penalty|offence|punishment|cognizance|fine|imprisonment/i.test(line))
            .map((line) => ({ section: (line.match(/^\d+[A-Z]?/) || [''])[0], offence: line.replace(/^\d+[A-Z]?\.\s*/, ''), penalty: 'See full statutory text for punishment/fine details.' }));
        const importantSections = sectionLines.slice(0, 20).map((line) => ({
            section: (line.match(/^\d+[A-Z]?/) || [''])[0],
            heading: line.replace(/^\d+[A-Z]?\.\s*/, ''),
            summary: 'Section heading extracted from arrangement of sections; read with the full statutory text for scope and exceptions.',
            practicalUse: 'Use for quick navigation, issue spotting, and statutory research.',
        }));
        return {
            actTitle: title,
            actNumber,
            enactmentDate,
            preamble,
            extentAndCommencement: sectionLines.find((line) => /^1\.\s/i.test(line)) || 'Not expressly available in uploaded text',
            arrangementOfSections: chapters.length ? chapters : [{ chapter: 'ARRANGEMENT OF SECTIONS', sections: sectionLines }],
            keyDefinitions: definitionTerms.length ? definitionTerms : [{ section: 'Section 2', term: 'Interpretation', meaning: 'Definitions are located in the interpretation section of the Act.' }],
            importantSections,
            rightsAndDuties: sectionLines.filter((line) => /right|owner|licence|registration|copyright|duty|liability/i.test(line)).slice(0, 12).map((line) => ({ section: (line.match(/^\d+[A-Z]?/) || [''])[0], rightOrDuty: line.replace(/^\d+[A-Z]?\.\s*/, ''), whoIsAffected: 'Persons governed by the Act' })),
            complianceRequirements: sectionLines.filter((line) => /register|application|particulars|returns|reports|notice|certificate/i.test(line)).slice(0, 10).map((line) => ({ section: (line.match(/^\d+[A-Z]?/) || [''])[0], requirement: line.replace(/^\d+[A-Z]?\.\s*/, ''), consequence: 'Compliance consequence depends on the operative section.' })),
            penalties,
            remediesAndJurisdiction: sectionLines.filter((line) => /remed|jurisdiction|court|appeal|board|registrar/i.test(line)).slice(0, 12).map((line) => ({ section: (line.match(/^\d+[A-Z]?/) || [''])[0], remedy: line.replace(/^\d+[A-Z]?\.\s*/, '') })),
            appealsAndProcedure: sectionLines.filter((line) => /appeal|procedure|powers|cognizance/i.test(line)).slice(0, 10).map((line) => ({ section: (line.match(/^\d+[A-Z]?/) || [''])[0], procedure: line.replace(/^\d+[A-Z]?\.\s*/, '') })),
            amendmentsAndOmissions: lines.filter((line) => /\[Omitted\]|\[.*\]|substituted|inserted|amended/i.test(line)).slice(0, 12).map((line) => ({ section: (line.match(/^\d+[A-Z]?/) || [''])[0] || 'N/A', change: line })),
            relatedProvisions: [],
            statutoryInterpretationNotes: `The Act should be read chapter-wise. Definitions control operative sections; rights/liabilities must be checked with exceptions, remedies, offences, appeals, and rule-making provisions.`,
            examRevisionNotes: `Remember: title/extent, key definitions, core rights or duties, remedies/jurisdiction, offences/penalties, appeals/procedure, and miscellaneous powers.`,
        };
    }
    renderBareActMarkdown(act) {
        const list = (items, mapper, fallback = 'Not expressly available in uploaded text') => {
            if (!Array.isArray(items) || items.length === 0)
                return fallback;
            return items.map(mapper).join('\n');
        };
        return `# ${act.actTitle || 'BARE ACT STATUTORY ANALYSIS'}

${act.actNumber || ''}
${act.enactmentDate || ''}

## Preamble / Object
${act.preamble || 'Not expressly available in uploaded text'}

## Short Title, Extent and Commencement
${act.extentAndCommencement || 'Not expressly available in uploaded text'}

## Arrangement of Sections
${list(act.arrangementOfSections || [], (chapter) => `### ${chapter.chapter}\n${(chapter.sections || []).map((section) => `- ${section}`).join('\n')}`)}

## Key Definitions
${list(act.keyDefinitions || [], (item) => `- ${item.section || ''} - ${item.term || 'Term'}: ${item.meaning || 'Meaning not expressly available.'}`)}

## Important Sections
${list(act.importantSections || [], (item) => `- Section ${item.section || ''}: ${item.heading || ''}\n  Summary: ${item.summary || 'N/A'}\n  Practical Use: ${item.practicalUse || 'N/A'}`)}

## Rights, Duties and Liabilities
${list(act.rightsAndDuties || [], (item) => `- Section ${item.section || ''}: ${item.rightOrDuty || ''} (${item.whoIsAffected || 'Affected persons not specified'})`)}

## Compliance Requirements
${list(act.complianceRequirements || [], (item) => `- Section ${item.section || ''}: ${item.requirement || ''}\n  Consequence: ${item.consequence || 'N/A'}`)}

## Penalties and Offences
${list(act.penalties || [], (item) => `- Section ${item.section || ''}: ${item.offence || ''}\n  Penalty: ${item.penalty || 'N/A'}`)}

## Remedies and Jurisdiction
${list(act.remediesAndJurisdiction || [], (item) => `- Section ${item.section || ''}: ${item.remedy || ''}`)}

## Appeals and Procedure
${list(act.appealsAndProcedure || [], (item) => `- Section ${item.section || ''}: ${item.procedure || ''}`)}

## Amendments, Omissions and Substitutions
${list(act.amendmentsAndOmissions || [], (item) => `- ${item.section || 'N/A'}: ${item.change || ''}`)}

## Related Provisions
${list(act.relatedProvisions || [], (item) => `- Section ${item.section || ''} relates to ${item.relatedTo || ''}: ${item.connection || ''}`)}

## Statutory Interpretation Notes
${act.statutoryInterpretationNotes || 'N/A'}

## Exam / Revision Notes
${act.examRevisionNotes || 'N/A'}
`;
    }
    sampleBareActText(topic) {
        return `THE SAMPLE ACT, 2026
ACT NO. 1 OF 2026
An Act to consolidate the law relating to ${topic}.
CHAPTER I PRELIMINARY
1. Short title, extent and commencement.
2. Interpretation.
CHAPTER II RIGHTS AND DUTIES
3. Duties of regulated persons.
4. Registration.
CHAPTER III PENALTIES
5. Penalty for contravention.
6. Appeals.`;
    }
    sampleJudgmentText(topic) {
        return `IN THE SUPREME COURT OF INDIA
CIVIL APPELLATE JURISDICTION
CIVIL APPEAL NO. 4082 OF 2026
Anay Sharma & Ors. versus Union of India & Anr.
JUDGMENT
This appeal concerns ${topic}. The core legal issue is whether administrative guidelines can restrict direct access to High Courts under Article 226. Judicial review under Articles 32 and 226 is part of the basic structure as held in L. Chandra Kumar v. Union of India. The appeal is allowed in part. Penalty clauses are struck down and the advisory mechanism is validated.`;
    }
    detectTopicScope(topic) {
        const text = (topic || '').toLowerCase();
        let primaryDomain = 'General Jurisprudence & Statutory Law';
        let secondaryDomains = ['Common Law', 'Statutory Construction'];
        let allowedKeywords = ['precedent', 'court', 'section', 'liability', 'remedy', 'statute'];
        let forbiddenKeywords = ['reservation', 'backward class', 'creamy layer', 'ews reservation', 'quota', 'caste', 'affirmative action'];
        let researchScope = 'Evaluating the statutory frameworks, judicial remedies, and institutional compliance standards.';
        if (text.includes('contract') || text.includes('agreement') || text.includes('commercial') || text.includes('business') || text.includes('sale') || text.includes('goods') || text.includes('indemnity') || text.includes('guarantee') || text.includes('bailment') || text.includes('agency')) {
            primaryDomain = 'Contract & Commercial Law';
            secondaryDomains = ['Statutory Obligations', 'Civil Remedies', 'Business Transactions'];
            allowedKeywords = ['contract', 'agreement', 'promise', 'proposal', 'offer', 'acceptance', 'consideration', 'damages', 'breach', 'indemnity', 'consent', 'frustration', 'void', 'enforceable'];
            forbiddenKeywords = ['reservation', 'backward class', 'ews quota', 'caste', 'criminal homicide', 'murder', 'bail', 'custody', 'marriage', 'divorce'];
            researchScope = 'Analyzing the formation, execution, breach, and statutory remedies governing contract relations under the Indian Contract Act, 1872 and related commercial codes.';
        }
        else if (text.includes('reservation') || text.includes('equality') || text.includes('article 14') || text.includes('article 15') || text.includes('article 16') || text.includes('constitution') || text.includes('fundamental rights') || text.includes('basic structure')) {
            primaryDomain = 'Constitutional & Administrative Law';
            secondaryDomains = ['Fundamental Rights', 'Equal Protection', 'Affirmative Action'];
            allowedKeywords = ['article', 'constitution', 'amendment', 'equality', 'reservation', 'quota', 'backward class', 'basic structure', 'writ', 'state', 'reasonable restriction'];
            forbiddenKeywords = ['breach of contract', 'consideration', 'damages', 'sale of goods', 'criminal homicide', 'murder', 'theft', 'bailment', 'agency'];
            researchScope = 'Evaluating constitutional guarantees, fundamental rights limits, amendment powers, and affirmative action classifications under Part III of the Constitution of India.';
        }
        else if (text.includes('criminal') || text.includes('murder') || text.includes('homicide') || text.includes('ipc') || text.includes('bns') || text.includes('bail') || text.includes('arrest') || text.includes('crpc') || text.includes('bnss') || text.includes('theft')) {
            primaryDomain = 'Criminal Jurisprudence & Penal Law';
            secondaryDomains = ['Penal Code', 'Criminal Procedure', 'State Punitive Power'];
            allowedKeywords = ['crime', 'offence', 'punishment', 'intent', 'mens rea', 'actus reus', 'homicide', 'murder', 'bail', 'arrest', 'custody', 'police', 'trial', 'sentencing'];
            forbiddenKeywords = ['reservation', 'backward class', 'ews quota', 'consideration', 'breach of contract', 'promissory estoppel', 'commercial agreement'];
            researchScope = 'Investigating criminal liability, penal definitions, mens rea, procedural guarantees, and judicial sentencing frameworks under penal codes.';
        }
        else if (text.includes('family') || text.includes('marriage') || text.includes('divorce') || text.includes('succession') || text.includes('maintenance')) {
            primaryDomain = 'Family & Personal Law';
            secondaryDomains = ['Marriage Statutes', 'Succession Rights', 'Personal Codes'];
            allowedKeywords = ['marriage', 'divorce', 'maintenance', 'succession', 'inheritance', 'guardian', 'adoption', 'personal law', 'custom'];
            forbiddenKeywords = ['reservation', 'backward class', 'breach of contract', 'indemnity', 'mens rea', 'homicide', 'murder', 'commercial transaction'];
            researchScope = 'Analyzing family relations, marriage validity, divorce procedures, and inheritance laws under applicable personal statutes.';
        }
        return { primaryDomain, secondaryDomains, allowedKeywords, forbiddenKeywords, researchScope };
    }
    calculateRelevanceScore(text, allowedKeywords, forbiddenKeywords) {
        const textLower = (text || '').toLowerCase();
        let matchCount = 0;
        for (const kw of allowedKeywords) {
            if (textLower.includes(kw))
                matchCount++;
        }
        let penaltyCount = 0;
        for (const kw of forbiddenKeywords) {
            if (textLower.includes(kw))
                penaltyCount++;
        }
        const overlapScore = allowedKeywords.length > 0 ? (matchCount / allowedKeywords.length) : 0.5;
        const penalty = penaltyCount * 0.25;
        return Math.max(0, Math.min(1.0, overlapScore - penalty));
    }
    calculateTopicMatchScore(content, topic, primaryDomain, allowedKeywords, forbiddenKeywords) {
        const textLower = (content || '').toLowerCase();
        let matchCount = 0;
        for (const kw of allowedKeywords) {
            const regex = new RegExp(`\\b${kw}\\b`, 'gi');
            const count = (textLower.match(regex) || []).length;
            matchCount += count;
        }
        let forbiddenCount = 0;
        for (const kw of forbiddenKeywords) {
            const regex = new RegExp(`\\b${kw}\\b`, 'gi');
            const count = (textLower.match(regex) || []).length;
            forbiddenCount += count;
        }
        if (matchCount === 0)
            return 50;
        const penaltyRatio = forbiddenCount / (matchCount + forbiddenCount + 1);
        const score = Math.max(0.60, Math.min(1.0, 1.0 - penaltyRatio));
        return Math.round(score * 100);
    }
    calculateConfidenceScore(content, sourcesUsedCount) {
        const text = content || '';
        const citationMatches = text.match(/\[\d+\]|v\.\s+[A-Z]/g) || [];
        const citationDensity = citationMatches.length;
        let score = 70;
        score += Math.min(15, sourcesUsedCount * 3);
        score += Math.min(15, Math.floor(citationDensity / 5));
        return Math.min(100, score);
    }
    async generateLlmResponseWithFallback(primaryProvider, prompt, maxTokens, userId) {
        try {
            const preferred = primaryProvider === 'openai' ? 'GPT-4o-Mini' : primaryProvider === 'gemini' ? 'Gemini' : 'DeepSeek';
            const result = await this.aiProvider.complete({
                temperature: 0.1,
                maxTokens,
                preferredModel: preferred,
                module: 'research',
                userId,
                messages: [{ role: 'user', content: prompt }],
            });
            if (result.model.includes('gemini')) {
                await this.cacheService.recordPipelineMetrics('geminiHits');
            }
            else if (result.model.includes('gpt-4o')) {
                await this.cacheService.recordPipelineMetrics('gptHits');
            }
            else if (result.model.includes('deepseek')) {
                await this.cacheService.recordPipelineMetrics('deepseekHits');
            }
            return {
                responseText: result.content,
                usedFallback: false,
                providerUsed: result.provider,
            };
        }
        catch (err) {
            this.logger.error(`Unified LLM provider call failed: ${err.message}`);
            throw err;
        }
    }
    async generateReport(userId, body) {
        const { queryId, topic, sources = [], provider = 'deepseek', depth = 'standard' } = body;
        const selectedWorkspace = body.selectedWorkspace || '';
        const detectedType = body.detectedType || selectedWorkspace || '';
        const pipeline = body.pipeline || (selectedWorkspace === 'Memorial'
            ? 'Memorial Analysis'
            : selectedWorkspace === 'Research Paper'
                ? 'Research Paper Analysis'
                : `${selectedWorkspace || body.researchMode} Analysis`);
        const researchMode = selectedWorkspace === 'Memorial'
            ? 'Moot Court'
            : selectedWorkspace === 'Research Paper'
                ? 'Academic'
                : body.researchMode;
        const cacheKey = `research:${userId}:${topic}:${researchMode}:${selectedWorkspace}:${pipeline}:${depth || 'standard'}`;
        const cachedResult = await this.cacheService.get('research', cacheKey, userId);
        if (cachedResult) {
            this.logger.log(`Cache hit for Research Report query: "${topic}"`);
            return cachedResult;
        }
        let query;
        if (queryId) {
            query = await this.queries.findOne({ where: { id: queryId, userId } });
        }
        if (!query) {
            query = await this.queries.save(this.queries.create({
                id: queryId,
                userId,
                topic,
                researchMode,
                status: 'processing',
            }));
        }
        else {
            query.status = 'processing';
            await this.queries.save(query);
        }
        const scopeInfo = this.detectTopicScope(topic);
        let contextString = 'No relevant database precedents or documents retrieved.';
        let retrieved = [];
        let sourcesFiltered = 0;
        try {
            const allRetrieved = await this.retrieveContext(query.id, topic, sources, scopeInfo.allowedKeywords, scopeInfo.forbiddenKeywords);
            retrieved = allRetrieved.filter(item => {
                if (item.relevanceScore >= 0.65) {
                    return true;
                }
                else {
                    sourcesFiltered++;
                    return false;
                }
            });
            if (retrieved.length > 0) {
                contextString = retrieved
                    .map((item, idx) => `[Source ${idx + 1}: ${item.source} (Relevance: ${Math.round(item.relevanceScore * 100)}%)]\n${item.text}`)
                    .join('\n\n');
            }
        }
        catch (error) {
            this.logger.warn(`Context retrieval failed: ${error.message}`);
        }
        const userDocs = queryId
            ? await this.documents.find({ where: { queryId, userId } })
            : [];
        let uploadedDocsContext = '';
        if (userDocs && userDocs.length > 0) {
            uploadedDocsContext = `\n\nUSER UPLOADED REFERENCE DOCUMENTS (You MUST incorporate and refer to these in your analysis):\n` + userDocs.map((doc, idx) => {
                const textSnippet = doc.content ? doc.content.substring(0, 10000) : '';
                return `Reference Document ${idx + 1}:\n- Name: ${doc.name}\n- Category: ${doc.docCategory}\n- Document Content Preview:\n${textSnippet}`;
            }).join('\n\n') + `\n\nEnsure that you cite these uploaded documents (e.g. "Uploaded Document: ${userDocs.map(d => d.name).join(', ')}") when utilizing their facts or arguments.`;
        }
        const providerName = (provider || 'deepseek').toLowerCase();
        const modelFriendlyName = providerName === 'openai' ? 'OpenAI GPT-4o' : providerName === 'gemini' ? 'Gemini 2.5 Flash' : 'DeepSeek R1';
        const wordCountInstructions = depth === 'exhaustive'
            ? 'Your generated report MUST be extremely exhaustive, dense, and comprehensive, containing at least 20000+ words. Provide elaborate legal arguments, full case briefs, academic debates, and detailed statutory breakdowns. Prioritize depth, evidence, and reasoning over brevity.'
            : depth === 'deep'
                ? 'Your generated report MUST be detailed and comprehensive, containing at least 10000+ words. Elaborate on every section and include case and statute discussions.'
                : 'Your generated report MUST be comprehensive, containing at least 5000+ words.';
        const prompt = `You are an expert legal reasoning agent powered by ${modelFriendlyName}.
Analyze the following research topic: "${topic}"
Research Mode Lens: ${researchMode}
Selected Workspace: ${selectedWorkspace || 'Not specified'}
Detected Type: ${detectedType || 'Not specified'}
Pipeline: ${pipeline}

Selected Sources for context:
${sources.join(', ')}

Retrieved context passages (if any):
${contextString}
${uploadedDocsContext}

${wordCountInstructions}

STRICT DOCUMENT TYPE ROUTING:
- User-selected workspace has highest priority and MUST control the pipeline.
- If Selected Workspace is "Memorial", execute ONLY the Memorial Analysis Pipeline. NEVER generate Research Paper sections such as Abstract, Methodology, Literature Review, Findings, Discussion, Conclusion, or References as the primary output.
- If Selected Workspace is "Research Paper", execute ONLY the Research Paper Analysis Pipeline. NEVER generate Memorial sections such as Statement of Jurisdiction, Issues Raised, Arguments Advanced, Prayer, Petitioner Memorial, or Respondent Memorial as the primary output.
- Explicit document type is secondary. AI auto-detection is lowest priority and must never override the selected workspace.
- Before the report body, include this validation block:
Selected Workspace: ${selectedWorkspace || researchMode}
Detected Type: ${detectedType || selectedWorkspace || researchMode}
Pipeline: ${pipeline}

STRICT TOPIC RELEVANCE CONSTRAINTS (Topic Lock System):
- This research report is locked to the primary legal domain: "${scopeInfo.primaryDomain}" and secondary domains: ${scopeInfo.secondaryDomains.join(', ')}.
- You MUST strictly stick to this legal domain and the user query "${topic}".
- Allowed core concepts and keywords: ${scopeInfo.allowedKeywords.join(', ')}.
- You MUST NOT discuss or refer to unrelated domains. Forbidden concepts to avoid (unless directly relevant to the query): ${scopeInfo.forbiddenKeywords.join(', ')}.
- If any section contains unrelated subjects, the report will fail validation. Ensure at least 95% of generated content relates directly to the user topic.

Generate a comprehensive deep legal research report for this topic and mode. The generated output must NEVER be a simple AI summary. It must be a complete, structured, publication-quality legal research paper containing exactly 22 sections.
Based on the selected Research Lens Mode (${researchMode}), you MUST customize the tone, focus, and structure:
- ACADEMIC MODE: Generate scholarly analysis, a dense literature review, academic commentary, granular research methodology, and extensive citations.
- MOOT COURT MODE: Structure the report as a formal Moot Court Memorial framework, focusing on Issues Raised, Questions of Law, Petitioner Arguments, Respondent Arguments, Authorities Relied Upon, Counter Arguments, and Memorial Ready structures.
- JUDICIARY MODE: Structure the reasoning like a formal judicial judgment, writing Facts, Issues, Applicable Law, Judicial Reasoning, Precedent Analysis, Ratio Decidendi, and the Final Decision.
- LAWYER MODE: Focus on litigation strategy, client risk analysis, practical implications, compliance issues, and strategic recommendations.

You MUST output your response containing exactly these XML blocks:

<report>
# [Research Title]
Format the paper in clean Markdown using the following exact 22 sections:

## 1. Cover Page
- Research Title
- Author
- Date
- Research Lens: ${researchMode}
- Generated by LEGATRIXON

## 2. Abstract
- Research Problem
- Objectives
- Key Findings
- Conclusion

## 3. Table of Contents

## 4. Introduction
- Background
- Importance
- Scope
- Research Context

## 5. Research Questions

## 6. Objectives of Study

## 7. Research Methodology
- Doctrinal Research
- Primary Sources
- Secondary Sources
- Comparative Analysis

## 8. Constitutional Framework
- Relevant Articles
- Constitutional Principles
- Constitutional Interpretation

## 9. Relevant Statutes
- Acts
- Rules
- Amendments
- Notifications

## 10. Historical Evolution Timeline
Generate chronological legal development.

## 11. Landmark Cases
For every major case include:
- Case Name
- Citation
- Facts
- Issues
- Arguments
- Judgment
- Ratio Decidendi
- Obiter Dicta
- Impact
- Criticism
- Legal Significance

## 12. Ratio Decidendi Matrix
Generate a structured Markdown table with columns: Case Name | Citation | Ratio Decidendi | Impact

## 13. Comparative Jurisprudence
Compare: India, United States, United Kingdom, Canada, Australia

## 14. Conflicting Judicial Views
- Majority View
- Minority View
- Academic Criticism
- Judicial Criticism

## 15. Academic Commentary
Include: Research Papers, Law Commission Reports, Scholarly Opinions

## 16. Practical Implications
Impact on: Citizens, Lawyers, Judiciary, Government, Businesses

## 17. Emerging Challenges
Future legal challenges and unresolved questions.

## 18. Findings
Generate clear findings based on legal analysis.

## 19. Recommendations
- Legislative
- Judicial
- Administrative
- Policy Recommendations

## 20. Conclusion
Comprehensive final conclusion.

## 21. Bibliography
Separate: Cases, Statutes, Books, Research Papers, Reports, Websites

## 22. Citation Sheet
Provide citations in: Bluebook, OSCOLA, and ILI Citation Format
</report>

<outline>
{
  "issues": ["List of core legal issues identified"],
  "arguments": ["List of primary legal arguments"],
  "questions": ["List of key research questions"]
}
</outline>

<sources>
[
  {
    "title": "Landmark Case or Statute Title",
    "citation": "Official citation if case, or article/section numbers if statute",
    "court": "Supreme Court of India, etc. (or null)",
    "year": 2026,
    "summary": "Brief summary of legal significance"
  }
]
</sources>

<assets>
{
  "case_matrix": {
    "headers": ["Case Name", "Citation", "Key Legal Principle / Ratio Decidendi"],
    "rows": [
      ["Case Name", "Citation", "Ratio Decidendi"]
    ]
  },
  "argument_map": {
    "nodes": [
      {"id": "issue-1", "label": "Core Issue", "type": "issue"},
      {"id": "arg-pet", "label": "Petitioner: ...", "type": "argument"},
      {"id": "arg-resp", "label": "Respondent: ...", "type": "argument"}
    ],
    "edges": [
      {"from": "arg-pet", "to": "issue-1"},
      {"from": "arg-resp", "to": "issue-1"}
    ]
  },
  "issue_checklist": {
    "items": [
      {"id": "chk-1", "text": "Verify statutory interpretation limits", "checked": false}
    ]
  },
  "flashcards": [
    {"question": "Flashcard Question", "answer": "Flashcard Answer"}
  ],
  "mcqs": [
    {"question": "MCQ Question", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "MCQ Explanation"}
  ],
  "viva_questions": [
    {"question": "Viva Question", "outline": "Detailed answer outline"}
  ],
  "revision_sheet": "Markdown text revision sheet summarizing the case principles, statutory grids, and key timelines."
}
</assets>

Follow the specifications strictly. The output inside <outline>, <sources>, and <assets> MUST be valid JSON (excluding comments).`;
        let responseText = '';
        let usedFallback = false;
        let providerUsed = providerName;
        const dynamicMaxTokens = this.tokenService.calculateMaxTokens('research', {
            userMode: depth,
            query: topic,
            contextSize: contextString ? contextString.length : 0,
        });
        try {
            const result = await this.generateLlmResponseWithFallback(providerName, prompt, dynamicMaxTokens, userId);
            responseText = result.responseText;
            usedFallback = result.usedFallback;
            providerUsed = result.providerUsed;
        }
        catch (err) {
            this.logger.error(`All LLM providers failed: ${err.message}. Running static local fallback...`);
            responseText = this.generateLocalFallbackReport(topic, researchMode, depth, userDocs);
            usedFallback = true;
            providerUsed = 'local-static-fallback';
        }
        const reportMatch = responseText.match(/<report>([\s\S]*?)<\/report>/);
        const outlineMatch = responseText.match(/<outline>([\s\S]*?)<\/outline>/);
        const sourcesMatch = responseText.match(/<sources>([\s\S]*?)<\/sources>/);
        const assetsMatch = responseText.match(/<assets>([\s\S]*?)<\/assets>/);
        const reportContent = reportMatch ? reportMatch[1].trim() : responseText;
        let outlineContent = { issues: [topic], arguments: [], questions: [] };
        let sourcesList = [];
        let assetsData = {};
        try {
            if (outlineMatch) {
                outlineContent = JSON.parse(outlineMatch[1].trim());
            }
        }
        catch (e) {
            this.logger.warn('Failed to parse outline JSON from model output');
        }
        try {
            if (sourcesMatch) {
                sourcesList = JSON.parse(sourcesMatch[1].trim());
            }
        }
        catch (e) {
            this.logger.warn('Failed to parse sources JSON from model output');
        }
        try {
            if (assetsMatch) {
                assetsData = JSON.parse(assetsMatch[1].trim());
            }
        }
        catch (e) {
            this.logger.warn('Failed to parse assets JSON from model output');
        }
        const topicMatchScore = this.calculateTopicMatchScore(reportContent, topic, scopeInfo.primaryDomain, scopeInfo.allowedKeywords, scopeInfo.forbiddenKeywords);
        const confidenceScore = this.calculateConfidenceScore(reportContent, retrieved.length);
        const wordCount = reportContent.split(/\s+/).length;
        const averageRelevance = retrieved.reduce((sum, item) => sum + item.relevanceScore, 0) / (retrieved.length || 1);
        const report = await this.reports.save(this.reports.create({
            userId,
            queryId: query.id,
            title: topic,
            summary: reportContent,
            researchMode,
            researchOutline: {
                ...outlineContent,
                primaryDomain: scopeInfo.primaryDomain,
                secondaryDomains: scopeInfo.secondaryDomains,
                relevanceScore: Math.round(averageRelevance * 100),
                confidenceScore,
                topicMatchScore,
                sourcesRetrieved: retrieved.length + sourcesFiltered,
                sourcesFiltered,
                wordCount,
                depth
            },
        }));
        if (sourcesList.length > 0) {
            for (const src of sourcesList) {
                await this.sources.save(this.sources.create({
                    reportId: report.id,
                    sourceType: src.court ? 'case' : 'act',
                    title: src.title,
                    citation: src.citation,
                    court: src.court || undefined,
                    year: src.year || undefined,
                    summary: src.summary,
                }));
            }
        }
        else {
            await this.seedWorkspace(report.id);
        }
        const assetTypes = ['case_matrix', 'argument_map', 'issue_checklist', 'flashcards', 'mcqs', 'viva_questions', 'revision_sheet'];
        for (const type of assetTypes) {
            const data = assetsData[type] || {};
            await this.assets.save(this.assets.create({
                reportId: report.id,
                assetType: type,
                assetData: typeof data === 'object' ? data : { content: data },
            }));
        }
        await this.assets.save(this.assets.create({
            reportId: report.id,
            assetType: 'retrieved_chunks',
            assetData: { chunks: retrieved },
        }));
        await this.notes.save(this.notes.create({
            reportId: report.id,
            userId,
            title: 'Executive Summary Note',
            content: `This deep research workspace focuses on: "${topic}" analyzed through a ${researchMode} lens. Locked Domain: ${scopeInfo.primaryDomain}. Match Score: ${topicMatchScore}%.`,
        }));
        query.status = 'completed';
        await this.queries.save(query);
        await this.notificationService.createNotification(userId, `Research Report Completed: ${topic}`, `Your research report on "${topic}" has been successfully generated under ${researchMode} mode.`);
        const finalReportResult = await this.getReport(userId, report.id);
        await this.cacheService.set('research', cacheKey, finalReportResult);
        return finalReportResult;
    }
    async challengeReport(userId, reportId) {
        const report = await this.reports.findOne({ where: { id: reportId, userId } });
        if (!report)
            throw new common_1.NotFoundException('Research report not found');
        let responseText = '';
        try {
            const prompt = `You are a critical legal opposing counsel powered by Opposing Counsel Engine.
We have generated a research report on topic: "${report.title}" in mode: ${report.researchMode}.
Analyze it and generate:
1. Counter Cases (with citations)
2. Opposing Arguments
3. Alternative Interpretations
4. Weakness Analysis of our current legal position.

You MUST output your response containing exactly these XML blocks:
<challenge>
{
  "counter_cases": [
    {"title": "Opposing Case Name", "citation": "Citation", "principle": "Alternative principle limiting the main position"}
  ],
  "opposing_arguments": ["Counter argument 1", "Counter argument 2"],
  "alternative_interpretations": ["Alternative view on the statutes or precedents"],
  "weakness_analysis": ["Vulnerabilities in our primary case strategy"]
}
</challenge>`;
            const result = await this.aiProvider.complete({
                temperature: 0.2,
                maxTokens: 2048,
                preferredModel: 'DeepSeek',
                module: 'research',
                userId,
                messages: [{ role: 'user', content: prompt }],
            });
            responseText = result.content;
            await this.cacheService.recordPipelineMetrics('deepseekHits');
        }
        catch (err) {
            this.logger.error(`Challenge API opponent Counsel failed: ${err.message}. Running fallback...`);
        }
        if (!responseText) {
            this.logger.log('All opposing counsel API attempts failed or keys missing. Running fallback...');
            responseText = this.generateLocalChallengeFallback(report.title);
        }
        const challengeMatch = responseText.match(/<challenge>([\s\S]*?)<\/challenge>/);
        let challengeData = {};
        try {
            if (challengeMatch) {
                challengeData = JSON.parse(challengeMatch[1].trim());
            }
        }
        catch {
            this.logger.warn('Failed to parse challenge JSON');
        }
        const existing = await this.assets.findOne({ where: { reportId, assetType: 'challenge_analysis' } });
        if (existing) {
            existing.assetData = challengeData;
            await this.assets.save(existing);
        }
        else {
            await this.assets.save(this.assets.create({
                reportId,
                assetType: 'challenge_analysis',
                assetData: challengeData,
            }));
        }
        return this.getReport(userId, reportId);
    }
    generatePointId(docId, chunkIndex) {
        const raw = `${docId}::chunk_${chunkIndex}`;
        const hash = crypto.createHash('sha256').update(raw).digest('hex');
        return [
            hash.substring(0, 8),
            hash.substring(8, 12),
            hash.substring(12, 16),
            hash.substring(16, 20),
            hash.substring(20, 32),
        ].join('-');
    }
    async retrieveContext(queryId, topic, sources, allowedKeywords, forbiddenKeywords) {
        const retrieved = [];
        let queryVector;
        try {
            queryVector = await this.bgeM3Provider.generateEmbedding(topic);
        }
        catch {
            return [];
        }
        const qdrantClient = this.qdrantService.getClient();
        if (sources.some((source) => ['constitution', 'bare_acts', 'acts'].includes(source))) {
            const legal = await this.legalRetrievalService.retrieveLegalContext(topic, 5);
            for (const provision of legal.provisions) {
                const keywordScore = this.calculateRelevanceScore(provision.content, allowedKeywords, forbiddenKeywords);
                retrieved.push({
                    text: provision.content,
                    source: `${provision.actName}${provision.section ? `, Section ${provision.section}` : ''} (central legal corpus)`,
                    relevanceScore: Math.max(provision.score, keywordScore),
                });
            }
        }
        for (const source of sources) {
            let collectionName = '';
            let filter = undefined;
            if (source === 'user_documents') {
                collectionName = 'user_documents';
                if (queryId) {
                    filter = {
                        must: [
                            { key: 'query_id', match: { value: queryId } },
                        ],
                    };
                }
            }
            else if (source === 'constitution' || source === 'bare_acts' || source === 'acts') {
                continue;
            }
            else if (source === 'judgments' || source === 'supreme_court_cases' || source === 'high_court_cases') {
                collectionName = 'judgments';
            }
            else if (source === 'research_papers') {
                collectionName = 'research_papers';
            }
            else if (source === 'law_commission_reports') {
                collectionName = 'law_commission_reports';
            }
            if (!collectionName)
                continue;
            try {
                const searchRes = await qdrantClient.search(collectionName, {
                    vector: queryVector,
                    limit: 3,
                    filter,
                    with_payload: true,
                });
                for (const hit of searchRes) {
                    if (hit.payload && typeof hit.payload.text === 'string') {
                        const text = hit.payload.text;
                        const keywordScore = this.calculateRelevanceScore(text, allowedKeywords, forbiddenKeywords);
                        const relevanceScore = (hit.score * 0.4) + (keywordScore * 0.6);
                        let sourceLabel = collectionName;
                        if (collectionName === 'user_documents' && hit.payload.name) {
                            sourceLabel = `Uploaded Document: ${hit.payload.name}`;
                        }
                        else if (collectionName === 'acts') {
                            sourceLabel = `Bare Acts & Statutes Database`;
                        }
                        else if (collectionName === 'judgments') {
                            sourceLabel = `Precedents & Judgments Database`;
                        }
                        else if (collectionName === 'research_papers') {
                            sourceLabel = `Scholarly Research Papers`;
                        }
                        else if (collectionName === 'law_commission_reports') {
                            sourceLabel = `Law Commission Reports`;
                        }
                        retrieved.push({
                            text,
                            source: `${sourceLabel} (Point: ${hit.id})`,
                            relevanceScore,
                        });
                    }
                }
            }
            catch (err) {
                this.logger.warn(`Qdrant search error in ${collectionName}: ${err.message}`);
            }
        }
        return retrieved;
    }
    async seedWorkspace(reportId) {
        const existing = await this.sources.count({ where: { reportId } });
        if (existing > 0)
            return;
        await this.sources.save([
            this.sources.create({ reportId, sourceType: 'case', title: 'Constitutional validity of reservation policy', citation: 'Indra Sawhney v. Union of India, 1992 Supp (3) SCC 217', court: 'Supreme Court of India', year: 1992, summary: 'Frames equality review, backward class identification, and the 50% ceiling.' }),
            this.sources.create({ reportId, sourceType: 'case', title: 'Basic structure limits on constitutional amendments', citation: 'Kesavananda Bharati v. State of Kerala, 1973 4 SCC 225', court: 'Supreme Court of India', year: 1973, summary: 'Controls judicial review and constitutional identity analysis.' }),
            this.sources.create({ reportId, sourceType: 'act', title: 'Constitution of India', citation: 'Articles 14, 15, 16, 21, 368', year: 1950, summary: 'Primary constitutional text for equality, liberty, and amendment power.' }),
        ]);
    }
    generateDetailedLegalText(topic, domain, paragraphsCount) {
        const openingPhrases = [
            "In analyzing the jurisprudence of this domain, we observe that",
            "Statutory provisions and judicial declarations confirm that",
            "A critical issue arises when evaluating the legal boundaries, specifically that",
            "Under established principles of common law and subsequent codification,",
            "It is a foundational tenet of legal interpretation that",
            "Regarding the procedural and substantive limits of these rules,",
            "Scholars have long debated the exact scope of this regulation, arguing that",
            "From a comparative standpoint, the application of this doctrine suggests that"
        ];
        const legalConcepts = {
            'Contract & Commercial Law': [
                "contracts are governed by the core requirement of free consent under Section 14, which restricts unconscionable terms",
                "liquidated damages under Section 74 are designed to prevent penalties while allowing reasonable compensation",
                "the doctrine of frustration under Section 56 discharges agreements when supervening events create absolute impossibility",
                "damages for breach of contract must flow naturally and be foreseeable under the rule in Hadley v. Baxendale",
                "unilateral offers made to the public at large are accepted by performance, as established in Carlill v. Carbolic Smoke Ball",
                "agreements in restraint of trade are declared void under Section 27 to protect economic freedom and trade liberties",
                "restitution under Section 64 and 65 requires that any party receiving advantages under a void agreement must restore it",
                "the Specific Relief Act amendments of 2018 have shifted specific performance from a discretionary remedy to a statutory right",
                "privity of contract prevents third parties from enforcing terms, though exceptions are carved out for family settlements",
                "standard form contracts signed under economic duress are subject to judicial review to verify if unequal bargaining power existed"
            ],
            'Constitutional & Administrative Law': [
                "the Basic Structure Doctrine serves as an absolute barrier against parliament using Article 368 to destroy the constitutional identity",
                "equality under Article 14 requires that any legislative classification must satisfy the twin tests of reasonable classification and rational nexus",
                "affirmative action and reservations under Article 16(4) are structured to achieve substantive equality rather than mere formal parity",
                "the right to life under Article 21 has been judicially expanded to include privacy, clean environment, and speedy trial guarantees",
                "judicial review is an inalienable basic feature of the Constitution, ensuring that executive actions are subject to courts' scrutiny",
                "center-state legislative competence is governed by Article 246 and the three lists of the Seventh Schedule",
                "the protection of minority educational institutions under Article 30 represents a critical aspect of secular pluralism",
                "writs of mandamus and certiorari under Articles 32 and 226 act as primary remedies against administrative excesses",
                "the amendment trajectory of the Constitution reflects a continuous dialogue between parliamentary sovereignty and judicial review",
                "the rule of law mandates that administrative actions must not be arbitrary, fanciful, or guided by extraneous considerations"
            ],
            'Criminal Jurisprudence & Penal Law': [
                "mens rea remains a fundamental prerequisite for penal liability unless explicitly excluded by statutory language",
                "the distinction between culpable homicide under Section 299 and murder under Section 300 depends entirely on the probability of death",
                "custodial interrogation is strictly bounded by Article 20(3) self-incrimination bar and Section 25 of the Evidence Act",
                "the right to bail is a vital facet of personal liberty under Article 21, establishing that bail is the rule and jail is the exception",
                "sentencing guidelines require courts to balance aggravating and mitigating circumstances under the rarest of rare doctrine",
                "the transition to the Bharatiya Nyaya Sanhita (BNS) aims to modernize penal definitions while preserving core liability limits",
                "the admissibility of electronic records under Section 65B requires strict certification to prevent evidence tampering",
                "criminal conspiracy under Section 120B requires a meeting of minds to commit an illegal act, separate from the act itself",
                "the right of private defense of the body and property is bounded by the rule of proportionality of the defensive force",
                "custodial violence represents a grave violation of human dignity and is checked by strict judicial guidelines in D.K. Basu"
            ],
            'Family & Personal Law': [
                "personal laws govern succession, marriage, and divorce, presenting a unique intersection of custom and statutory reforms",
                "the Hindu Succession Act amendment of 2005 granted daughters equal coparcenary rights by birth, ensuring gender parity",
                "maintenance under Section 125 of the Code of Criminal Procedure is a secular remedy designed to prevent destitution",
                "the welfare of the child is the paramount consideration in all judicial matters regarding custody and guardianship",
                "the debate over a Uniform Civil Code under Article 44 attempts to unify personal status laws under a secular code",
                "divorce under personal laws requires proving statutory grounds such as cruelty, desertion, or mutual consent breakdown",
                "customary practices can override statutory provisions only if they are ancient, continuous, and not opposed to public policy",
                "the validity of marriage requires compliance with ceremonies or registration mandates under the Special Marriage Act",
                "restitution of conjugal rights has faced constitutional challenges for violating bodily autonomy and privacy rights",
                "adoption laws under the Juvenile Justice Act provide a secular mechanism for child placement, running parallel to personal acts"
            ]
        };
        const judicialReasoning = [
            "In evaluating this issue, the courts have consistently held that the state must balance public interests with private expectations.",
            "The Supreme Court has emphasized that a literal reading of the statute must be avoided if it leads to manifest absurdity.",
            "This approach is justified by the doctrine of harmonious construction, which mandates that all provisions be read as a whole.",
            "Furthermore, the ratio decidendi of controlling authorities suggests that administrative discretion cannot be absolute.",
            "The judiciary functions as a guardian of statutory limits, ensuring that the legislative intent is not subverted by executive overreach.",
            "This reasoning aligns with the principle of legitimate expectation, protecting citizens from sudden and arbitrary policy shifts."
        ];
        const comparativeContext = [
            "Comparative analysis reveals that while the United Kingdom operates under parliamentary supremacy, India enforces constitutional supremacy.",
            "Similarly, in the United States, the Supreme Court applies strict scrutiny to state classifications, similar to the Indian proportionality test.",
            "In contrast, civil law jurisdictions rely strictly on codified statutory texts, avoiding the common law dependency on judicial precedents.",
            "Australian courts have developed a similar approach to commercial contracts, emphasizing good faith performance over rigid terms.",
            "This international alignment indicates a global shift toward substantive fairness and procedural transparency across major legal systems."
        ];
        const academicOpinion = [
            "Scholarly commentary suggests that this section must be revised to accommodate modern technological transactions.",
            "Pollock & Mulla argue that the retention of colonial definitions creates unnecessary friction in modern business contracts.",
            "Furthermore, reports of the Law Commission have repeatedly recommended that procedural codes be streamlined to avoid delays.",
            "Legal experts point out that the lack of clear guidelines often forces the judiciary to step in and formulate guidelines.",
            "This academic consensus emphasizes the need for continuous legislative updates to match the evolving societal needs."
        ];
        const practicalImpacts = [
            "For legal practitioners, this development highlights the necessity of drafting precise clauses to avoid litigation.",
            "For citizens, the enforcement of these rights guarantees a higher degree of protection against administrative excesses.",
            "For businesses, compliance tracking becomes paramount as regulatory agencies upgrade their audit mechanism.",
            "Additionally, the judicial delays in deciding these disputes continue to impact the ease-of-doing-business index.",
            "Therefore, alternative dispute resolution (ADR) mechanisms are increasingly recommended to resolve commercial and civil issues."
        ];
        const paragraphs = [];
        const domainKey = domain;
        const concepts = legalConcepts[domainKey] || legalConcepts['Contract & Commercial Law'];
        for (let i = 0; i < paragraphsCount; i++) {
            const opening = openingPhrases[i % openingPhrases.length];
            const concept = concepts[i % concepts.length];
            const reasoning = judicialReasoning[(i + 2) % judicialReasoning.length];
            const comparative = comparativeContext[(i + 1) % comparativeContext.length];
            const academic = academicOpinion[(i + 3) % academicOpinion.length];
            const practical = practicalImpacts[(i + 4) % practicalImpacts.length];
            const paragraph = `${opening} ${concept}. ${reasoning} ${comparative} ${academic} ${practical} This locally generated fallback does not cite external authorities unless sourced documents are supplied.`;
            paragraphs.push(paragraph);
        }
        return paragraphs.join('\n\n');
    }
    generateLocalFallbackReport(topic, mode, depth, userDocs) {
        const dateStr = new Date().toLocaleDateString();
        const scope = this.detectTopicScope(topic);
        const primaryDomain = scope.primaryDomain;
        const allowed = scope.allowedKeywords;
        const forbidden = scope.forbiddenKeywords;
        const cleanMode = (mode || 'Academic').toUpperCase();
        let textMultiplier = 1;
        if (depth === 'deep')
            textMultiplier = 2;
        if (depth === 'exhaustive')
            textMultiplier = 4;
        let abstractContent = '';
        let introContent = '';
        let researchQuestions = '';
        let objectivesContent = '';
        let methodologyContent = '';
        let constitutionalContent = '';
        let statutesContent = '';
        let timelineContent = '';
        let casesContent = '';
        let matrixContent = '';
        let comparativeContent = '';
        let conflictsContent = '';
        let academicContent = '';
        let practicalContent = '';
        let challengesContent = '';
        let findingsContent = '';
        let recommendationsContent = '';
        let conclusionContent = '';
        let bibliographyContent = '';
        let citationSheetContent = '';
        if (primaryDomain === 'Contract & Commercial Law') {
            abstractContent = `This legal research paper evaluates the modern statutory challenges and judicial adaptations within the domain of **${primaryDomain}**, focusing on the user query: **"${topic}"**. We analyze contract formation limits, consent validity, and statutory damages under Section 73 of the Indian Contract Act, 1872. [Carlill v. Carbolic Smoke Ball, 1893]. Our research indicates that digital transactions require expanded interpretation of Section 2(a) and 2(b) definitions to maintain commercial stability while protecting weaker bargaining parties.`;
            introContent = `The development of commercial relations is predicated upon the enforceability of promises. Codified in 1872, the Indian Contract Act provides the primary statutory framework. In analyzing **"${topic}"**, we address the core tension between freedom of contract and regulatory public policy limits. Over the past century, standard form contracts, e-commerce transactions, and smart contracts have challenged traditional concepts of mutual assent and consideration. This introduction establishes the background of common law principles (such as those in *Balfour v. Balfour*) and their modern statutory counterparts. Additionally, the economic implications of contractual defaults are evaluated, highlighting how default rules reduce transaction costs in commercial setups. We map the scope of this investigation across statutory clauses and judicial interpretations to establish a cohesive legal baseline. [Anson's Law of Contract, 2024].`;
            researchQuestions = `
1. Whether the unilateral terms in standard form contracts satisfy the requirements of free consent under Section 14 and Section 19A of the Indian Contract Act?
2. Whether the digital execution of commercial agreements via click-wrap or shrink-wrap formats constitutes valid communication of proposal and acceptance under Section 3 and Section 4?
3. Whether the judicial assessment of liquidated damages under Section 74 requires absolute proof of actual loss as a condition precedent for recovery?
4. What is the constitutional relationship between contract enforcement and the freedom of trade guaranteed under Article 19(1)(g)?
      `;
            objectivesContent = `
The key objectives of this doctrinal study are:
1. To trace the evolution of consent doctrines from common law precedents to current Indian statutory provisions.
2. To critique the judicial tests of reasonable notice applied to exemption clauses in commercial agreements.
3. To contrast the Indian approach to liquidated damages (Section 74) with the English common law penalty rules.
4. To evaluate the impact of contract enforceability on business ease-of-doing-business indices in major commercial hubs.
      `;
            methodologyContent = `
This study adopts a doctrinal and comparative research methodology. The primary sources include:
- The Indian Contract Act, 1872 and the Specific Relief Act, 1963.
- Landmark judgments of the Supreme Court of India and the House of Lords.
Secondary sources comprise:
- Scholarly commentaries (Pollock & Mulla, Anson on Contract).
- Reports of the Law Commission of India (Report No. 13 on Contract Act revisions).
- Comparative law reviews analyzing the Uniform Commercial Code (UCC) of the United States.
      `;
            constitutionalContent = `
Although contract law is primarily statutory, it operates within a constitutional framework. 
- **Article 19(1)(g)**: Guarantees the right to practice any profession, carry on any occupation, trade, or business. However, this is subject to Article 19(6) reasonable restrictions in the interest of the general public.
- **State Interference**: Courts have repeatedly held that while the state can regulate trade, arbitrary statutory restrictions that restrict contractual freedom without a rational nexus are unconstitutional. [Sodhi Devi v. State, 1952].
- **Article 14**: Guarantees equality before the law, which restricts the state from inserting unconscionable clauses in government contracts, treating public tenders with strict fairness limits.
      `;
            statutesContent = `
The statutory architecture governing contract disputes in India is defined by:
1. **Section 2 of the Indian Contract Act, 1872**: Outlines the definitions of proposal, acceptance, consideration, agreement, and contract.
2. **Section 10**: Details the essentials of a valid contract, requiring free consent, competent parties, lawful consideration, and lawful object.
3. **Section 23**: Identifies considerations and objects that are unlawful as being opposed to public policy.
4. **Section 56**: Formulates the doctrine of frustration and contract discharge due to supervening impossibility.
5. **Section 73**: Outlines the framework for recovering compensatory damages for breach of contract, incorporating the rule of foreseeability established in *Hadley v. Baxendale*.
6. **Section 74**: Removes the common law distinction between liquidated damages and penalty clauses, vesting broad judicial discretion to award reasonable compensation.
      `;
            timelineContent = `
* **1872**: Enactment of the Indian Contract Act, establishing general principles and special contracts.
* **1903**: Privy Council rules in *Mohori Bibee v. Dharmodas Ghose* that a minor's agreement is void ab initio.
* **1930**: Separation of the Sale of Goods provisions into a dedicated Act.
* **1932**: Separation of the Partnership provisions into the Indian Partnership Act.
* **1963**: Promulgation of the Specific Relief Act, outlining specific performance remedies.
* **2018**: Amendment of the Specific Relief Act, making specific performance a statutory rule rather than a discretionary remedy.
      `;
            casesContent = `
- **Case Name**: Mohori Bibee v. Dharmodas Ghose
  - **Citation**: (1903) 30 IA 114
  - **Facts**: A minor executed a mortgage in favor of a moneylender. The moneylender's agent was aware of the minority status of the borrower.
  - **Issues**: Whether a contract entered into by a minor is void or voidable?
  - **Arguments**: Appellant argued the minor must restore the money received under equity; Respondent argued the contract was completely void.
  - **Judgment**: The Privy Council held that Section 11 of the Contract Act is absolute; minor agreements are void ab initio.
  - **Ratio Decidendi**: A person incompetent to contract cannot make a valid agreement; equity of restitution does not apply to void minor agreements where minority was known.
  - **Obiter Dicta**: Expressed concern over moneylenders exploiting minors but upheld statutory boundaries.
  - **Impact**: Protected minor property rights across India.
  - **Criticism**: Rigid approach fails to prevent minor fraud against innocent third-parties.
  - **Legal Significance**: Primary precedent on capacity to contract.

- **Case Name**: Carlill v. Carbolic Smoke Ball Co.
  - **Citation**: [1893] 1 QB 256
  - **Facts**: Company advertised a reward for anyone catching influenza after using their product. Plaintiff complied and caught flu.
  - **Issues**: Whether an advertisement can constitute a binding offer?
  - **Arguments**: Defendant argued the ad was a mere puff and not a serious offer; Plaintiff argued it was a general offer accepted by performance.
  - **Judgment**: The Court of Appeal held that the general offer was valid and performance constituted acceptance without separate notification.
  - **Ratio Decidendi**: An offer made to the public at large (general offer) can ripen into a contract upon performance of the specified conditions.
  - **Obiter Dicta**: Depositing money in the bank proved the sincerity of the promise.
  - **Impact**: Formed the basis of modern consumer protection and general offer doctrines.
  - **Criticism**: Leads to wide exposure for commercial advertisements.
  - **Legal Significance**: Fundamental precedent on public proposals.
      `;
            matrixContent = `
| Case Name | Citation | Ratio Decidendi | Impact |
| --- | --- | --- | --- |
| Mohori Bibee v. Dharmodas Ghose | (1903) 30 IA 114 | Minor's agreement is void ab initio. | Absolute bar on minor contracting liabilities. |
| Carlill v. Carbolic Smoke Ball Co. | [1893] 1 QB 256 | Public offer accepted by performance creates contract. | Validated general offers and unilateral contracts. |
| Hadley v. Baxendale | (1854) 9 Exch 341 | Damages are recoverable only if naturally arising or foreseen. | Established the limits of remote damages for breach. |
      `;
            comparativeContent = `
- **India**: Governed strictly by the Indian Contract Act, 1872. Section 74 allows courts to award reasonable compensation not exceeding the named penalty.
- **United States**: Governed by state common law, the Restatement (Second) of Contracts, and the Uniform Commercial Code (UCC) for sales. Quotas are rejected; consideration remains mandatory but promissory estoppel is highly expanded.
- **United Kingdom**: Retains pure common law principles. Penalty clauses are invalid if they are unconscionable or out of proportion to the legitimate interest.
- **Canada**: Follows English common law but has codifications in Quebec (Civil Code). Promissory estoppel is applied as a shield.
- **Australia**: Highly influenced by English common law but incorporates robust statutory consumer guarantees under the Australian Consumer Law (ACL).
      `;
            conflictsContent = `
- **Majority View**: Section 74 requires that some proof of damage is shown unless estimating damage is impossible (*Fateh Chand v. Balkishan Dass*).
- **Minority View**: The named sum in a contract represents a genuine pre-estimate of loss and should be awarded automatically without proof.
- **Academic Criticism**: The retention of the strict common law consideration requirement restricts modern business swaps and option agreements.
- **Judicial Criticism**: The doctrine of frustration under Section 56 is often interpreted too rigidly, failing to address commercial hardship.
      `;
            academicContent = `
Pollock & Mulla suggest that Section 73 and 74 must be revised to incorporate indirect business impacts in the digital age. The Law Commission's 13th Report recommended expanding the definition of consideration to allow third-party beneficiaries (remit privity limits).
      `;
            practicalContent = `
- **Citizens**: Empowers consumers to challenge arbitrary click-wrap agreements.
- **Lawyers**: Focuses litigation strategies on showing foreseeability of loss under Section 73.
- **Judiciary**: Balances contractual certainty with equity in unconscionable commercial terms.
- **Government**: Mandates fair procurement terms under public tenders.
- **Businesses**: Requires compliance in drafting exemption and limitation of liability clauses.
      `;
            challengesContent = `
1. Enforcing smart contracts on decentralized ledgers where jurisdiction is undefined.
2. Assessing contractual frustration under global climate and regulatory disruptions.
3. Defining limits of algorithmic pricing and auto-generated assent.
      `;
            findingsContent = `
1. Contract law is locked to business predictability, but state public policy limits remain active.
2. The concept of reasonable notice is the primary check against arbitrary standard contract terms.
      `;
            recommendationsContent = `
- **Legislative**: Amend Section 28 to fully protect arbitration pacts in commercial transactions.
- **Judicial**: Expand the test of unconscionability to protect small businesses from dominant suppliers.
- **Administrative**: Mandate standard guidelines for e-contract platforms.
- **Policy**: Promote alternative dispute resolution (ADR) as the default breach remedy.
      `;
            conclusionContent = `
In summary, contract enforceability under **"${topic}"** requires a balanced approach. While commercial freedom must be preserved, statutory consent safeguards ensure that equity remains the foundation of commercial trade.
      `;
            bibliographyContent = `
### Cases
1. *Mohori Bibee v. Dharmodas Ghose*, (1903) 30 IA 114.
2. *Carlill v. Carbolic Smoke Ball Co.*, [1893] 1 QB 256.
3. *Hadley v. Baxendale*, (1854) 9 Exch 341.

### Statutes
1. The Indian Contract Act, 1872.
2. The Specific Relief Act, 1963.
3. The Information Technology Act, 2000.

### Books
1. Pollock & Mulla, *The Indian Contract Act and Specific Relief Act* (16th ed., LexisNexis).

### Reports
1. Law Commission of India, *13th Report on the Indian Contract Act, 1872*.
      `;
            citationSheetContent = `
- **Bluebook**: *Mohori Bibee v. Dharmodas Ghose*, 30 I.A. 114 (1903).
- **OSCOLA**: *Mohori Bibee v. Dharmodas Ghose* (1903) 30 IA 114.
- **ILI Citation**: *Mohori Bibee v. Dharmodas Ghose*, 30 I.A. 114 (1903).
      `;
        }
        else if (primaryDomain === 'Constitutional & Administrative Law') {
            abstractContent = `This deep research paper evaluates the core constitutional doctrines, equality guarantees, and legislative validity of policies surrounding: **"${topic}"**. Grounded in Part III of the Constitution of India, we examine Article 14 equal protection, Article 15 and 16 class classifications, and basic structure constraints. [Kesavananda Bharati v. State of Kerala, 1973]. The findings highlight that administrative classifications must satisfy the double test of reasonable classification and proportionality.`;
            introContent = `Constitutional supremacy is the core of the Indian legal order. The Constitution of India, 1950, establishes the limits of state action. In evaluating **"${topic}"**, we address how fundamental rights constrain legislative acts. Part III guarantees represent essential individual safeguards that cannot be overridden by majoritarian impulses without meeting strict scrutiny. This introduction outlines the historical framework, the debates of the Constituent Assembly (such as the drafting of draft Article 9 which became Article 15), and the evolution of judicial review. The scope of this paper maps out how the judiciary acts as a check against executive overreach, ensuring the rule of law. [Seervai's Constitutional Law of India, 2005].`;
            researchQuestions = `
1. Whether the simulated legislative quota or policy violates the equality clause under Article 14?
2. Whether the state classification meets the tests of reasonable classification and rational nexus?
3. Whether the Basic Structure Doctrine limits parliamentary constituent power under Article 368 in this area?
      `;
            objectivesContent = `
1. To trace the evolution of equal protection tests from classification to proportionality.
2. To critique the judicial limits on the state's amending power.
3. To evaluate the constitutional balance between individual merit and social equity goals.
      `;
            methodologyContent = `
This research employs a doctrinal methodology relying on:
- Constituent Assembly Debates.
- The Constitution of India, 1950.
- Supreme Court judgments and international human rights treaties.
- Reports of the Law Commission of India on constitutional amendments.
      `;
            constitutionalContent = `
The constitutional architecture governing this domain rests on:
- **Article 14**: Guarantees equality before the law and equal protection of laws. Outlaws arbitrary state actions (*E.P. Royappa*).
- **Article 15 & 16**: Prohibit discrimination on grounds of religion, race, caste, sex, or place of birth, while enabling positive discrimination for backward classes.
- **Article 21**: Personal liberty protection, incorporating substantive due process (*Maneka Gandhi*).
- **Article 368**: Procedure for amending the Constitution, bounded by the basic structure limits.
      `;
            statutesContent = `
Key statutory texts framing this domain include:
1. **The Constitution of India, 1950** (Articles 14, 15, 16, 21, 311, 368).
2. **The Constitution (First Amendment) Act, 1951**: Introducing Article 15(4) to protect backward classes.
3. **The Constitution (Seventy-Seventh Amendment) Act, 1995**: Permitting promotional quotas.
4. **The Constitution (One Hundred and Third Amendment) Act, 2019**: Introducing EWS reservations.
      `;
            timelineContent = `
* **1950**: Promulgation of the Constitution.
* **1951**: *State of Madras v. Champakam Dorairajan* leads to the First Amendment.
* **1973**: The 13-Judge bench in *Kesavananda Bharati* establishes the Basic Structure Doctrine.
* **1992**: Nine-Judge bench in *Indra Sawhney* caps reservations at 50% and excludes creamy layer.
* **2022**: Five-Judge bench in *Janhit Abhiyan* upholds the 10% EWS quota.
      `;
            casesContent = `
- **Case Name**: Kesavananda Bharati v. State of Kerala
  - **Citation**: (1973) 4 SCC 225
  - **Facts**: Landowner challenged the validity of the 24th, 25th, and 29th Constitutional Amendments under Article 32.
  - **Issues**: Scope of amending power under Article 368.
  - **Arguments**: Petitioner argued amending power is limited; Respondent argued it is absolute.
  - **Judgment**: A 7-6 majority upheld the amendments but declared that Parliament cannot alter the basic structure.
  - **Ratio Decidendi**: The word "amendment" implies alteration while preserving the identity of the Constitution.
  - **Obiter Dicta**: Judicial review is an essential element of the constitutional system.
  - **Impact**: Saved the democratic and secular character of the Indian state.
  - **Criticism**: The basic structure doctrine is not explicitly defined in the text of the Constitution.
  - **Legal Significance**: Supreme check on parliamentary sovereignty.

- **Case Name**: Indra Sawhney v. Union of India
  - **Citation**: 1992 Supp (3) SCC 217
  - **Facts**: Challenges to the Mandal Commission job reservation notifications.
  - **Issues**: Scope of Article 16(4); 50% ceiling limits; identification of backward classes.
  - **Arguments**: Petitioners argued quotas destroy merit; Respondents argued they achieve representation.
  - **Judgment**: Upheld 27% quota; capped reservations at 50%; excluded creamy layer.
  - **Ratio Decidendi**: Backward class classifications cannot be based solely on economic criteria; creamy layer must be excluded.
  - **Obiter Dicta**: Extraordinary situations may justify exceeding the 50% cap.
  - **Impact**: Governs all reservation policies across India.
  - **Criticism**: The 50% ceiling lacks clear textual support.
  - **Legal Significance**: Fundamental precedent on equal opportunity.
      `;
            matrixContent = `
| Case Name | Citation | Ratio Decidendi | Impact |
| --- | --- | --- | --- |
| Kesavananda Bharati | (1973) 4 SCC 225 | Parliament cannot amend the basic structure. | Secured constitutional identity. |
| Indra Sawhney | 1992 Supp (3) SCC 217 | Reservations capped at 50%; creamy layer excluded. | Framed modern reservation limits. |
| Janhit Abhiyan | (2023) 5 SCC 1 | 10% EWS quota upheld; 50% limit is not absolute for EWS. | Allowed economic-only reservations. |
      `;
            comparativeContent = `
- **India**: Uses explicit quota classifications and reservations under Article 16(4).
- **United States**: Affirmative action is subject to strict scrutiny under the 14th Amendment. Rigid quotas are illegal (*SFFA v. Harvard*).
- **Canada**: Section 15(2) of the Charter explicitly permits affirmative action programs.
- **United Kingdom**: Positive action is permitted under the Equality Act 2010, but quotas are banned.
      `;
            conflictsContent = `
- **Majority View**: Affirmative action is an index of real equality, not an exception to formal equality.
- **Minority View**: Group-based quotas restrict individual rights, violating the core principle of non-discrimination.
- **Academic Criticism**: The basic structure doctrine allows judicial overreach into legislative matters.
      `;
            academicContent = `
H.M. Seervai suggests that the Basic Structure Doctrine is necessary to protect fundamental freedoms from arbitrary legislative amendments.
      `;
            practicalContent = `
- **Citizens**: Empowers minority groups but increases competition in public services.
- **Lawyers**: Focuses litigation on showing proportionality of state classifications.
- **Judiciary**: Acts as a sentinel on the qui vive to protect fundamental rights.
      `;
            challengesContent = `
1. Balancing quota representations with administrative efficiency (Article 335).
2. Applying basic structure reviews to technological regulations and privacy claims.
      `;
            findingsContent = `
1. The basic structure doctrine remains the primary defense of Indian democracy.
2. Judicial review is an inalienable component of the constitutional order.
      `;
            recommendationsContent = `
- **Legislative**: Conduct rigorous empirical audits before enacting reservation laws.
- **Judicial**: Formulate a clear list of basic structure components.
- **Administrative**: Mandate regular reviews of backwardness data.
      `;
            conclusionContent = `
In conclusion, constitutional supremacy ensures that state actions remain aligned with democratic ideals. The topic **"${topic}"** highlights the ongoing dynamic between state policy and individual liberties.
      `;
            bibliographyContent = `
### Cases
1. *Kesavananda Bharati v. State of Kerala*, (1973) 4 SCC 225.
2. *Indra Sawhney v. Union of India*, 1992 Supp (3) SCC 217.
3. *Janhit Abhiyan v. Union of India*, (2023) 5 SCC 1.

### Statutes
1. The Constitution of India, 1950.
2. The Constitution (One Hundred and Third Amendment) Act, 2019.
      `;
            citationSheetContent = `
- **Bluebook**: *Kesavananda Bharati v. State of Kerala*, (1973) 4 SCC 225.
- **OSCOLA**: *Kesavananda Bharati v. State of Kerala* [1973] 4 SCC 225.
- **ILI Citation**: *Kesavananda Bharati v. State of Kerala*, (1973) 4 SCC 225.
      `;
        }
        else if (primaryDomain === 'Criminal Jurisprudence & Penal Law') {
            abstractContent = `This deep research paper examines penal liability, statutory defenses, and procedural due process governing: **"${topic}"**. Operating under the Bharatiya Nyaya Sanhita (BNS) and the Indian Penal Code (IPC), we analyze elements of crime (mens rea and actus reus), evidentiary standards, and custodial rights under Article 21. [K.M. Nanavati v. State of Maharashtra, 1962]. The paper outlines that state punitive powers must conform to natural justice.`;
            introContent = `The preservation of public order requires a codification of offenses and punishments. Under **"${topic}"**, we investigate the penal limits and legislative safeguards of criminal law. The state possesses a monopoly on violence, which must be strictly bounded by procedural requirements of double jeopardy (Article 20(2)) and self-incrimination (Article 20(3)). This introduction outlines the transition from the colonial Indian Penal Code, 1860 to the modern Bharatiya Nyaya Sanhita (BNS) and its impact on rights enforcement. [Gaur's Penal Law of India, 2023].`;
            researchQuestions = `
1. Whether the actus reus and mens rea requirements are satisfied under the impugned statutory offence?
2. Whether custodial statements meet the evidentiary admissibility test of the Bharatiya Sakshya Adhiniyam / Evidence Act?
3. Whether the death penalty guidelines under the "rarest of rare cases" doctrine satisfy Article 21?
      `;
            objectivesContent = `
1. To trace the evolution of general exceptions and statutory defenses.
2. To critique custodial interrogation limits under human rights frameworks.
3. To evaluate restorative justice versus retributive models of sentencing.
      `;
            methodologyContent = `
This study uses a doctrinal approach reviewing:
- Bharatiya Nyaya Sanhita (BNS) and Penal Code.
- Bharatiya Nagarik Suraksha Sanhita (BNSS) and Criminal Procedure Code.
- Landmark judgments on custodial violence, sentencing, and civil liberties.
      `;
            constitutionalContent = `
Criminal law is bounded by constitutional safeguards:
- **Article 20**: Protects against ex-post facto laws, double jeopardy, and self-incrimination.
- **Article 21**: Protects personal liberty, mandating that procedure established by law must be fair, just, and reasonable (*Maneka Gandhi*).
- **Article 22**: Guarantees arrest rights, access to counsel, and presentation before a magistrate within 24 hours.
      `;
            statutesContent = `
1. **Bharatiya Nyaya Sanhita (BNS) / Indian Penal Code (IPC)**: Establishes offenses, definitions, and exceptions.
2. **Bharatiya Nagarik Suraksha Sanhita (BNSS) / CrPC**: Outlines procedure from arrest to trial.
3. **Bharatiya Sakshya Adhiniyam (BSA) / Evidence Act**: Governs relevancy and admissibility of proofs.
      `;
            timelineContent = `
* **1860**: Promulgation of the Indian Penal Code.
* **1872**: Enactment of the Indian Evidence Act.
* **1973**: Enactment of the Code of Criminal Procedure.
* **1980**: *Bachan Singh* establishes the "rarest of rare" doctrine for death penalty.
* **2023**: Passage of the BNS, BNSS, and BSA to replace colonial criminal codes.
      `;
            casesContent = `
- **Case Name**: K.M. Nanavati v. State of Maharashtra
  - **Citation**: AIR 1962 SC 605
  - **Facts**: Naval Commander Nanavati was accused of murdering his wife's lover. He pleaded the defense of grave and sudden provocation.
  - **Issues**: Whether the provocation was grave and sudden enough to reduce murder to culpable homicide?
  - **Arguments**: Prosecution argued Nanavati planned the killing; Defense argued it occurred in a fit of passion.
  - **Judgment**: Upheld the conviction for murder, holding that the cooling-off period negated sudden provocation.
  - **Ratio Decidendi**: The test of provocation is whether a reasonable man in similar circumstances would lose self-control.
  - **Obiter Dicta**: Retained judicial skepticism over honor-based defense claims.
  - **Impact**: Led to the abolition of the jury system in India.
  - **Criticism**: Popular public sentiment clashed with strict legal standards of proof.
  - **Legal Significance**: Seminal case on general exceptions.
      `;
            matrixContent = `
| Case Name | Citation | Ratio Decidendi | Impact |
| --- | --- | --- | --- |
| K.M. Nanavati v. State | AIR 1962 SC 605 | Provocation test is based on reasonable man control limits. | Abolished jury trials in India. |
| Bachan Singh v. State | (1980) 2 SCC 684 | Death penalty only in the rarest of rare cases. | Structured judicial sentencing discretion. |
      `;
            comparativeContent = `
- **India**: Replaced IPC with BNS. Strict codification of general defenses.
- **United States**: Evidentiary exclusions are strictly enforced under the Fourth, Fifth, and Sixth Amendments.
- **United Kingdom**: Distinguishes murder and manslaughter under the Homicide Act 1957, with focus on diminished responsibility.
      `;
            conflictsContent = `
- **Majority View**: Capital punishment is constitutional as a deterrent, provided the sentencing court weighs all mitigating circumstances.
- **Minority View**: State execution violates the fundamental right to life under Article 21, regardless of procedural checks.
      `;
            academicContent = `
Law Commission Reports have repeatedly recommended reforms in the police system to separate investigation from law and order duties.
      `;
            practicalContent = `
- **Citizens**: Protects against arbitrary state arrests.
- **Lawyers**: Focuses defenses on proving absence of mens rea or invoking statutory exceptions.
- **Judiciary**: Mandates strict adherence to evidentiary rules.
      `;
            challengesContent = `
1. Managing cybercrimes and electronic evidence under BSA.
2. Balancing victim rehabilitation with reformative sentencing goals.
      `;
            findingsContent = `
1. Procedural due process is the primary check against state police overreach.
2. The standard of proof beyond reasonable doubt is essential for liberty protection.
      `;
            recommendationsContent = `
- **Legislative**: Clarify terms in BNS relating to corporate criminal liability.
- **Judicial**: Set strict timelines for criminal appeals.
- **Administrative**: Upgrade forensic investigation facilities.
      `;
            conclusionContent = `
Ultimately, criminal justice balances public safety with individual rights. The analysis of **"${topic}"** demonstrates the critical role of statutory defenses.
      `;
            bibliographyContent = `
### Cases
1. *K.M. Nanavati v. State of Maharashtra*, AIR 1962 SC 605.
2. *Bachan Singh v. State of Punjab*, (1980) 2 SCC 684.

### Statutes
1. Bharatiya Nyaya Sanhita, 2023.
2. Code of Criminal Procedure, 1973.
      `;
            citationSheetContent = `
- **Bluebook**: *K.M. Nanavati v. State of Maharashtra*, A.I.R. 1962 S.C. 605.
- **OSCOLA**: *K.M. Nanavati v. State of Maharashtra* AIR 1962 SC 605.
      `;
        }
        else {
            abstractContent = `This deep research paper examines the legal frameworks, statutory provisions, and judicial doctrines surrounding: **"${topic}"**. We analyze compliance requirements, comparative jurisprudence, and key case law. [Kesavananda Bharati v. State of Kerala, 1973]. The paper outlines that statutory interpretations must align with the rule of law.`;
            introContent = `Statutory systems provide order to modern society. In evaluating **"${topic}"**, we address the balance between state regulatory authority and individual rights. The scope of this doctrinal study involves assessing the codification history, judicial review standards, and the core principles of administrative fairness that govern this domain.`;
            researchQuestions = `
1. Whether the statutory notifications governing the policy are constitutionally valid?
2. Whether the current rules satisfy the test of administrative reasonableness?
      `;
            objectivesContent = `
1. To trace the legislative history of the governing enactments.
2. To evaluate the judicial approach and key doctrines applied by courts.
      `;
            methodologyContent = `
This study uses a doctrinal methodology, analyzing primary statutes, law reports, and standard academic commentaries.
      `;
            constitutionalContent = `
The constitutional framework governs state regulatory powers and protects fundamental rights under Articles 14, 19, and 21.
      `;
            statutesContent = `
1. The General Enactments and Rules framing this domain.
2. Relevant Administrative Guidelines and Notifications.
      `;
            timelineContent = `
* **1950**: Promulgation of the Constitution of India.
* **1973**: Formulation of the Basic Structure Doctrine.
* **2017**: Landmark privacy judgment in *K.S. Puttaswamy*.
      `;
            casesContent = `
- **Case Name**: Kesavananda Bharati v. State of Kerala
  - **Citation**: (1973) 4 SCC 225
  - **Facts**: Challenge to the validity of constitutional amendments.
  - **Issues**: Scope of amending power under Article 368.
  - **Ratio Decidendi**: Parliament cannot alter the basic structure.
  - **Legal Significance**: Seminal constitutional precedent on limits of state power.
      `;
            matrixContent = `
| Case Name | Citation | Ratio Decidendi | Impact |
| --- | --- | --- | --- |
| Kesavananda Bharati | (1973) 4 SCC 225 | Parliament cannot amend the basic structure. | Secured constitutional identity. |
      `;
            comparativeContent = `
- **India**: Codified statutory framework.
- **United States**: Common law principles with constitutional limits.
- **United Kingdom**: Parliamentary sovereignty bounds.
      `;
            conflictsContent = `
- **Majority View**: Strict compliance with statutory guidelines is mandatory.
- **Minority View**: Equity overrides strict statutory rules in extraordinary cases.
      `;
            academicContent = `
Scholarly opinions suggest that administrative regulations must undergo regular review to adapt to modern business needs.
      `;
            practicalContent = `
- **Citizens**: Protects rights.
- **Lawyers**: Focuses on showing procedural irregularities.
- **Businesses**: Compliance tracking.
      `;
            challengesContent = `
1. Adapting statutory guidelines to technology.
2. Maintaining administrative speed while ensuring transparency.
      `;
            findingsContent = `
1. The regulations must be interpreted in harmony with fundamental rights.
2. Lack of procedural clarity leads to excessive litigation.
      `;
            recommendationsContent = `
- **Legislative**: Codify clear guidelines.
- **Judicial**: Clarify standard of review.
      `;
            conclusionContent = `
In conclusion, the study of **"${topic}"** highlights the need for balanced statutory implementation.
      `;
            bibliographyContent = `
### Cases
1. *Kesavananda Bharati v. State of Kerala*, (1973) 4 SCC 225.

### Statutes
1. Constitution of India, 1950.
      `;
            citationSheetContent = `
- **Bluebook**: *Kesavananda Bharati v. State of Kerala*, (1973) 4 SCC 225.
      `;
        }
        const finalAbstract = abstractContent + '\n\n' + this.generateDetailedLegalText(topic, primaryDomain, textMultiplier * 1);
        const finalIntro = introContent + '\n\n' + this.generateDetailedLegalText(topic, primaryDomain, textMultiplier * 3);
        const finalConstitutional = constitutionalContent + '\n\n' + this.generateDetailedLegalText(topic, primaryDomain, textMultiplier * 3);
        const finalStatutes = statutesContent + '\n\n' + this.generateDetailedLegalText(topic, primaryDomain, textMultiplier * 3);
        const finalCases = casesContent + '\n\n' + this.generateDetailedLegalText(topic, primaryDomain, textMultiplier * 3);
        const finalComparative = comparativeContent + '\n\n' + this.generateDetailedLegalText(topic, primaryDomain, textMultiplier * 3);
        const finalConflicts = conflictsContent + '\n\n' + this.generateDetailedLegalText(topic, primaryDomain, textMultiplier * 3);
        const finalAcademic = academicContent + '\n\n' + this.generateDetailedLegalText(topic, primaryDomain, textMultiplier * 3);
        const finalPractical = practicalContent + '\n\n' + this.generateDetailedLegalText(topic, primaryDomain, textMultiplier * 3);
        const finalChallenges = challengesContent + '\n\n' + this.generateDetailedLegalText(topic, primaryDomain, textMultiplier * 2);
        const finalConclusion = conclusionContent + '\n\n' + this.generateDetailedLegalText(topic, primaryDomain, textMultiplier * 2);
        const reportText = `
# Deep Research Report: ${topic}
*Generated on ${dateStr} | Research Lens: ${mode}*

## 1. Cover Page
- **Research Title**: Deep Legal Analysis of ${topic}
- **Author**: Principal Legal Architect, LEGATRIXON
- **Date**: ${dateStr}
- **Research Lens**: ${mode} Mode
- **Generated by**: LEGATRIXON Deep Legal Research Engine

## 2. Abstract
${finalAbstract}

## 3. Table of Contents
1. Cover Page
2. Abstract
3. Table of Contents
4. Introduction
5. Research Questions
6. Objectives of Study
7. Research Methodology
8. Constitutional Framework
9. Relevant Statutes
10. Historical Evolution Timeline
11. Landmark Cases
12. Ratio Decidendi Matrix
13. Comparative Jurisprudence
14. Conflicting Judicial Views
15. Academic Commentary
16. Practical Implications
17. Emerging Challenges
18. Findings
19. Recommendations
20. Conclusion
21. Bibliography
22. Citation Sheet

## 4. Introduction
${finalIntro}

## 5. Research Questions
${researchQuestions}

## 6. Objectives of Study
${objectivesContent}

## 7. Research Methodology
${methodologyContent}
${userDocs && userDocs.length > 0 ? `\n\n### [Retrieved Reference Document Analysis]\nThis report directly references the user's uploaded document(s): ` +
            userDocs.map(d => `"${d.name}" (${d.docCategory})`).join(', ') +
            ` which have been ingested and cross-checked for domain relevance.\n\n` +
            `#### Key text/factual context retrieved from reference files:\n` +
            userDocs.map(d => {
                const contentSnippet = d.content ? d.content.substring(0, 1500) : 'No text content available';
                return `- **Document: ${d.name}**\n  *Category: ${d.docCategory}*\n  *Ingested Data:*\n  > ${contentSnippet}...`;
            }).join('\n\n') : ''}

## 8. Constitutional Framework
${finalConstitutional}

## 9. Relevant Statutes
${finalStatutes}

## 10. Historical Evolution Timeline
${timelineContent}

## 11. Landmark Cases
${finalCases}

## 12. Ratio Decidendi Matrix
${matrixContent}

## 13. Comparative Jurisprudence
${finalComparative}

## 14. Conflicting Judicial Views
${finalConflicts}

## 15. Academic Commentary
${finalAcademic}

## 16. Practical Implications
${finalPractical}

## 17. Emerging Challenges
${finalChallenges}

## 18. Findings
${findingsContent}

## 19. Recommendations
${recommendationsContent}

## 20. Conclusion
${finalConclusion}

## 21. Bibliography
${bibliographyContent}

## 22. Citation Sheet
${citationSheetContent}
`;
        const outlineJson = JSON.stringify({
            issues: [
                `Whether the legislative framework governing "${topic}" conforms to standards under Article 14.`,
                `Whether judicial review bounds restrict absolute majorities in this statutory domain.`
            ],
            arguments: [
                "Petitioner: The current statutory provisions violate Article 14 by imposing arbitrary restrictions.",
                "Respondent: The regulations represent a reasonable restriction designed to achieve a legitimate state interest."
            ],
            questions: [
                "What is the test of reasonable classification under Article 14?",
                "How has the Basic Structure Doctrine evolved?"
            ]
        });
        const sourcesJson = JSON.stringify([
            {
                title: "Kesavananda Bharati v. State of Kerala",
                citation: "1973 4 SCC 225",
                court: "Supreme Court of India",
                year: 1973,
                summary: "Established the landmark Basic Structure Doctrine limiting the amending power of Parliament."
            },
            {
                title: "Indra Sawhney v. Union of India",
                citation: "1992 Supp (3) SCC 217",
                court: "Supreme Court of India",
                year: 1992,
                summary: "Set the 50% limit on reservation policies and defined backward class classifications."
            },
            {
                title: "Constitution of India",
                citation: "Articles 14, 19, 21, 368",
                court: null,
                year: 1950,
                summary: "Primary constitutional source establishing fundamental rights and judicial review framework."
            }
        ]);
        const assetsJson = JSON.stringify({
            case_matrix: {
                headers: ["Case Name", "Citation", "Key Legal Principle / Ratio Decidendi"],
                rows: [
                    ["Kesavananda Bharati v. State of Kerala", "1973 4 SCC 225", "Parliament cannot alter or destroy the basic structure of the Constitution."],
                    ["Indra Sawhney v. Union of India", "1992 Supp (3) SCC 217", "Backward class identification must exclude the creamy layer; reservations capped at 50%."],
                    ["Maneka Gandhi v. Union of India", "1978 1 SCC 248", "Procedure under Article 21 must be fair, just, and reasonable, not arbitrary."]
                ]
            },
            argument_map: {
                nodes: [
                    { id: "issue-1", label: `Validity of statutory limits in "${topic}"`, type: "issue" },
                    { id: "arg-pet", label: "Petitioner: Violates Articles 14 and 19 by creating arbitrary trade barriers.", type: "argument" },
                    { id: "arg-resp", label: "Respondent: Valid classification with rational nexus to state objectives.", type: "argument" }
                ],
                edges: [
                    { from: "arg-pet", to: "issue-1" },
                    { from: "arg-resp", to: "issue-1" }
                ]
            },
            issue_checklist: {
                items: [
                    { id: "chk-1", text: "Analyze Article 14 reasonable classification test", checked: true },
                    { id: "chk-2", text: "Evaluate statutory compatibility with Article 21", checked: false },
                    { id: "chk-3", text: "Check precedents limiting liability in commercial contracts", checked: false }
                ]
            },
            flashcards: [
                { question: "What is the primary limit established by the Basic Structure Doctrine?", answer: "Parliament cannot amend the Constitution in a way that destroys its essential features." },
                { question: "Which case introduced the test of 'fair, just and reasonable' procedure?", answer: "Maneka Gandhi v. Union of India (1978)." },
                { question: "What is the ceiling limit on reservations under Indra Sawhney?", answer: "50%, except in extraordinary circumstances." }
            ],
            mcqs: [
                {
                    question: "The Basic Structure Doctrine was formulated in which case?",
                    options: ["Golaknath v. State of Punjab", "Kesavananda Bharati v. State of Kerala", "Minerva Mills v. Union of India", "Sajjan Singh v. State of Rajasthan"],
                    correct: 1,
                    explanation: "The 13-Judge bench in Kesavananda Bharati (1973) formulated the Basic Structure Doctrine by a 7-6 majority."
                },
                {
                    question: "Which Article governs the amendment procedure of the Constitution of India?",
                    options: ["Article 356", "Article 360", "Article 368", "Article 370"],
                    correct: 2,
                    explanation: "Article 368 contains the provisions and procedure for amending the Constitution."
                }
            ],
            viva_questions: [
                {
                    question: "Explain the genus-species relationship between Culpable Homicide and Murder.",
                    outline: "1. All murders are culpable homicides, but not vice-versa (Reg. v. Govinda).\n2. Culpable Homicide (Section 299) has a lower degree of probability of death.\n3. Murder (Section 300) requires a high degree of probability (sufficient in the ordinary course of nature)."
                },
                {
                    question: "What constitutes the 'Golden Triangle' of the Indian Constitution?",
                    outline: "Articles 14, 19, and 21 form a mutually inclusive grid. A law violating one must be tested against the others."
                }
            ],
            revision_sheet: `
# Revision Sheet: Deep Legal Analysis of ${topic}

## Core Statutes
- **Constitution of India**: Articles 14, 19, 21, 368
- **Indian Contract Act**: Section 27, Section 73

## Key Precedents
1. **Kesavananda Bharati (1973)**: Judicial review is part of the basic structure.
2. **Indra Sawhney (1992)**: Equality of opportunity capped at 50% for class reservations.
3. **Maneka Gandhi (1978)**: Procedure established by law equals due process.
`
        });
        return `
<report>
${reportText}
</report>
<outline>
${outlineJson}
</outline>
<sources>
${sourcesJson}
</sources>
<assets>
${assetsJson}
</assets>
`;
    }
    async generateMentorStep(userId, body) {
        const { topic, stepIndex } = body;
        let plan = body.researchPlan;
        if (!plan) {
            plan = await this.buildMentorPlan(topic, userId);
        }
        const totalSteps = plan.steps.length;
        const idx = Math.max(0, Math.min(stepIndex, totalSteps - 1));
        const stepDef = plan.steps[idx];
        const isLast = idx === totalSteps - 1;
        const scopeInfo = this.detectTopicScope(topic);
        const authorities = await this.mentorRetrieve(stepDef.queryFocus || topic, stepDef.sourceFocus, scopeInfo.allowedKeywords, scopeInfo.forbiddenKeywords);
        const content = await this.buildMentorStepContent(topic, plan.areaOfLaw, stepDef, authorities, idx, totalSteps, userId);
        return {
            stepIndex: idx,
            totalSteps,
            stepTitle: stepDef.title,
            whatToDo: content.whatToDo,
            whyItMatters: content.whyItMatters,
            mentorTip: content.mentorTip,
            authorities,
            isLast,
            notebookPatch: content.notebookPatch,
            ...(stepIndex === 0 ? { researchPlan: plan } : {}),
        };
    }
    async generateMentorMemo(userId, body) {
        const { topic, notebook } = body;
        const safe = (arr) => Array.isArray(arr) && arr.length ? arr.map((x) => `- ${x}`).join('\n') : '- To be confirmed from official sources';
        const notebookSummary = [
            notebook.researchQuestion ? `Research Question: ${notebook.researchQuestion}` : '',
            notebook.statutes?.length ? `Statutes: ${notebook.statutes.join(', ')}` : '',
            notebook.sections?.length ? `Sections: ${notebook.sections.join(', ')}` : '',
            notebook.cases?.length ? `Cases: ${notebook.cases.join(', ')}` : '',
            notebook.rules?.length ? `Rules: ${notebook.rules.join(', ')}` : '',
            notebook.issues?.length ? `Issues: ${notebook.issues.join(', ')}` : '',
            notebook.analysis?.length ? `Analysis: ${notebook.analysis.join('. ')}` : '',
            notebook.keywords?.length ? `Keywords: ${notebook.keywords.join(', ')}` : '',
        ].filter(Boolean).join('\n');
        const prompt = `You are a senior advocate generating a research memo for a law student who has just completed a step-by-step legal research session.

Research topic: "${topic}"

Research notebook compiled during the session:
${notebookSummary || 'No structured entries — topic only.'}

Generate a structured research memo in clean professional prose. Use these exact sections:

## Research Question
## Short Answer
## Statutory and Constitutional Framework
## Key Judicial Authorities
## Doctrinal Analysis
## Open Questions and Gaps
## Source Verification Checklist
## Research Methodology Notes

Rules:
- Never invent case names, citations, or section numbers not mentioned in the notebook
- If the notebook is sparse, acknowledge that and note what needs to be verified
- Mark every authority "— to be verified from official source" unless it came directly from the retrieved database
- Write in the voice of a professional legal memorandum, not a student essay
- Short Answer must state the tentative conclusion and its basis honestly`;
        try {
            const result = await this.aiProvider.complete({
                temperature: 0.15,
                maxTokens: 1800,
                preferredModel: 'GPT-4o-Mini',
                module: 'research',
                userId,
                messages: [
                    { role: 'system', content: 'You are drafting a professional legal research memorandum. Be precise and honest about verification status. No markdown code fences.' },
                    { role: 'user', content: prompt },
                ],
            });
            return { memo: result.content };
        }
        catch (err) {
            this.logger.warn(`Mentor memo generation failed: ${err.message}`);
            return {
                memo: `# Legal Research Memo\n\n## Research Question\n${notebook.researchQuestion || topic}\n\n## Statutory Framework\n${safe(notebook.statutes)}\n\n## Key Sections\n${safe(notebook.sections)}\n\n## Case Authorities\n${safe(notebook.cases)}\n\n## Rules\n${safe(notebook.rules)}\n\n## Issues Identified\n${safe(notebook.issues)}\n\n## Analysis Notes\n${safe(notebook.analysis)}\n\n---\n*All authorities must be verified from official sources before reliance.*`,
            };
        }
    }
    async buildMentorPlan(topic, userId) {
        const prompt = `You are a senior Indian advocate. A law student has brought this legal research topic: "${topic}".

Build a dynamic, adaptive research plan as valid JSON. The plan must have between 4 and 7 steps tailored to this specific legal topic. Adapt the number and sequence of steps to the complexity and nature of the topic.

Return ONLY valid JSON (no markdown) with this exact structure:
{
  "areaOfLaw": "Primary area of Indian law (e.g. Contract Law, Constitutional Law, Criminal Procedure)",
  "steps": [
    {
      "id": "unique_snake_case_id",
      "title": "Step title (4-6 words)",
      "queryFocus": "Specific search string optimised for retrieval from Indian legal databases",
      "sourceFocus": ["one or more of: constitution, acts, bare_acts, rules, judgments, supreme_court_cases, high_court_cases, law_commission_reports, government_notifications, official_publications, research_papers, user_documents"]
    }
  ]
}

Adaptation rules:
- Step 1 must always frame the precise research question
- Include a constitution step only if there is a genuine constitutional dimension
- Include a statute step only if a controlling Indian statute exists
- Include a case law step in almost every plan — judicial precedent almost always matters
- Include a law commission / academic step for unsettled or evolving areas
- Include rules, government notifications, or official publications where delegated legislation or executive material may affect the answer
- Final step should always be synthesis and memo structure
- queryFocus must be specific to this topic, not generic
- sourceFocus should target only the collections genuinely relevant to that step`;
        try {
            const result = await this.aiProvider.complete({
                temperature: 0.1,
                maxTokens: 900,
                preferredModel: 'GPT-4o-Mini',
                module: 'research',
                jsonMode: true,
                userId,
                messages: [
                    { role: 'system', content: 'Return only valid JSON. No markdown, no commentary.' },
                    { role: 'user', content: prompt },
                ],
            });
            const parsed = JSON.parse((result.content.match(/\{[\s\S]*\}/) || [result.content])[0]);
            if (parsed?.steps && Array.isArray(parsed.steps) && parsed.steps.length >= 3) {
                return parsed;
            }
        }
        catch (err) {
            this.logger.warn(`Mentor plan AI call failed: ${err.message}`);
        }
        return this.buildFallbackMentorPlan(topic);
    }
    buildFallbackMentorPlan(topic) {
        const scope = this.detectTopicScope(topic);
        return {
            areaOfLaw: scope.primaryDomain,
            steps: [
                { id: 'frame_question', title: 'Frame the Research Question', queryFocus: topic, sourceFocus: ['acts', 'judgments'] },
                { id: 'authority_map', title: 'Map the Authority Hierarchy', queryFocus: `constitution statute ${topic}`, sourceFocus: ['constitution', 'acts'] },
                { id: 'statute_reading', title: 'Read the Controlling Statute', queryFocus: `bare act section provision ${topic}`, sourceFocus: ['acts'] },
                { id: 'case_law', title: 'Identify Binding Precedents', queryFocus: `supreme court high court judgment ${topic}`, sourceFocus: ['judgments'] },
                { id: 'analysis', title: 'Analyse the Doctrine', queryFocus: `legal analysis doctrine ${topic}`, sourceFocus: ['research_papers', 'law_commission_reports'] },
                { id: 'synthesis', title: 'Synthesise and Structure the Memo', queryFocus: topic, sourceFocus: ['acts', 'judgments'] },
            ],
        };
    }
    async mentorRetrieve(queryFocus, sourceFocus, allowedKws, forbiddenKws) {
        let queryVector;
        try {
            queryVector = await this.bgeM3Provider.generateEmbedding(queryFocus);
        }
        catch {
            return [];
        }
        const qdrantClient = this.qdrantService.getClient();
        const centralLegal = sourceFocus.some((source) => ['constitution', 'acts', 'bare_acts', 'rules', 'government_notifications', 'official_publications'].includes(source))
            ? await this.legalRetrievalService.retrieveLegalContext(queryFocus, 6)
            : null;
        const collectionMap = {
            constitution: { collection: 'acts', type: 'Constitution', label: 'Constitution of India' },
            acts: { collection: 'acts', type: 'Statute / Bare Act', label: 'Bare Acts & Statutes' },
            bare_acts: { collection: 'acts', type: 'Statute / Bare Act', label: 'Bare Acts & Statutes' },
            judgments: { collection: 'judgments', type: 'Judgment', label: 'Precedents & Judgments Database' },
            supreme_court_cases: { collection: 'judgments', type: 'Supreme Court Judgment', label: 'Supreme Court of India' },
            high_court_cases: { collection: 'judgments', type: 'High Court Judgment', label: 'High Court' },
            research_papers: { collection: 'research_papers', type: 'Research Paper', label: 'Scholarly Research' },
            law_commission_reports: { collection: 'law_commission_reports', type: 'Law Commission Report', label: 'Law Commission of India' },
            rules: { collection: 'acts', type: 'Rules', label: 'Rules & Delegated Legislation' },
            government_notifications: { collection: 'acts', type: 'Government Notification', label: 'Government Notifications' },
            official_publications: { collection: 'acts', type: 'Official Publication', label: 'Official Publications' },
            user_documents: { collection: 'user_documents', type: 'Indexed Legal Material', label: 'Indexed Legal Materials' },
        };
        const raw = [];
        if (centralLegal) {
            for (const provision of centralLegal.provisions) {
                raw.push({
                    type: 'Statute / Bare Act',
                    title: `${provision.actName}${provision.section ? ` Section ${provision.section}` : ''}`.slice(0, 150),
                    excerpt: provision.content.slice(0, 450),
                    source: 'Central Legal Corpus',
                    score: provision.score,
                });
            }
        }
        for (const src of sourceFocus) {
            const mapping = collectionMap[src];
            if (!mapping)
                continue;
            if (['constitution', 'acts', 'bare_acts', 'rules', 'government_notifications', 'official_publications'].includes(src))
                continue;
            try {
                const hits = await qdrantClient.search(mapping.collection, {
                    vector: queryVector,
                    limit: 4,
                    with_payload: true,
                });
                for (const hit of hits) {
                    if (!hit.payload || typeof hit.payload.text !== 'string')
                        continue;
                    const text = hit.payload.text;
                    const kwScore = this.calculateRelevanceScore(text, allowedKws, forbiddenKws);
                    const relevance = hit.score * 0.5 + kwScore * 0.5;
                    if (relevance < 0.45)
                        continue;
                    const titleRaw = (hit.payload.title ?? hit.payload.name ?? hit.payload.source_title ?? '');
                    raw.push({
                        type: mapping.type,
                        title: String(titleRaw || mapping.label).slice(0, 150),
                        excerpt: text.slice(0, 450),
                        source: mapping.label,
                        score: relevance,
                    });
                }
            }
            catch (err) {
                this.logger.warn(`Mentor retrieval error (${mapping.collection}): ${err.message}`);
            }
        }
        const seen = new Set();
        return raw
            .sort((a, b) => b.score - a.score)
            .filter(r => {
            const key = r.excerpt.slice(0, 60);
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        })
            .slice(0, 6)
            .map(({ score: _score, ...rest }) => rest);
    }
    async buildMentorStepContent(topic, areaOfLaw, step, authorities, stepIndex, totalSteps, userId) {
        const authBlock = authorities.length > 0
            ? authorities
                .map((a, i) => `[${i + 1}] [${a.type}] ${a.title}\nExcerpt: "${a.excerpt.slice(0, 280)}"`)
                .join('\n\n')
            : 'No authoritative material was retrieved from the database for this step.';
        const prompt = `You are a senior advocate in the Supreme Court of India personally mentoring a junior law researcher.

Research topic: "${topic}"
Area of law: ${areaOfLaw}
Current step: Step ${stepIndex + 1} of ${totalSteps} — "${step.title}"

Authorities retrieved from the legal database for this step:
${authBlock}

Return ONLY valid JSON with exactly these four fields:
{
  "whatToDo": "2–4 sentences. Specific, actionable instruction for what the researcher should do at this exact step. Address them directly. Be concrete.",
  "whyItMatters": "1–2 sentences. Explain why this step is essential to sound legal research — not generic, tied to this topic.",
  "mentorTip": "One practical tip a senior advocate would give a junior. Specific to this step and this topic.",
  "notebookPatch": {
    "keywords": [],
    "statutes": [],
    "sections": [],
    "cases": [],
    "rules": [],
    "constitution": [],
    "reports": [],
    "issues": [],
    "analysis": [],
    "notes": []
  }
}

Critical rules:
- Never invent case names, citations, section numbers, or statute titles
- Populate notebookPatch ONLY with values directly supported by the retrieved authorities above
- If authorities say "No authoritative material retrieved", leave all notebookPatch arrays empty and say so in whatToDo
- whatToDo must feel like advice from a senior advocate, not a textbook description
- Do not refer to "Step X" or "this module" — write as if speaking directly to the researcher`;
        try {
            const result = await this.aiProvider.complete({
                temperature: 0.2,
                maxTokens: 750,
                preferredModel: 'GPT-4o-Mini',
                module: 'research',
                jsonMode: true,
                userId,
                messages: [
                    { role: 'system', content: 'Return only valid JSON. No markdown fences, no commentary.' },
                    { role: 'user', content: prompt },
                ],
            });
            const parsed = JSON.parse((result.content.match(/\{[\s\S]*\}/) || [result.content])[0]);
            return {
                whatToDo: parsed.whatToDo || `Proceed with: ${step.title} for the topic "${topic}".`,
                whyItMatters: parsed.whyItMatters || 'This step builds the foundation for the next stage of the research.',
                mentorTip: parsed.mentorTip || 'Write the key phrase from each source into your notebook before moving on.',
                notebookPatch: parsed.notebookPatch || {},
            };
        }
        catch (err) {
            this.logger.warn(`Mentor step content failed: ${err.message}`);
            return {
                whatToDo: `For "${topic}", the task for this step is: ${step.title}. Review any retrieved authorities listed below before proceeding.`,
                whyItMatters: 'Each step of the research process builds on the previous one. Skipping leads to gaps in the analysis.',
                mentorTip: 'Take one source at a time. Note the exact phrase before moving to the next authority.',
                notebookPatch: { notes: [`Step ${stepIndex + 1}: ${step.title}`] },
            };
        }
    }
    generateLocalChallengeFallback(topic) {
        const challengeJson = JSON.stringify({
            counter_cases: [
                {
                    title: "Minerva Mills v. Union of India",
                    citation: "1980 3 SCC 625",
                    principle: "Limited amending power is itself a basic feature of the Constitution."
                },
                {
                    title: "State of Karnataka v. Radha Krishna",
                    citation: "1990 1 SCR 112",
                    principle: "Strict statutory reading overrides broad constitutional definitions in commercial disputes."
                }
            ],
            opposing_arguments: [
                "The state has a sovereign duty to regulate trade under Article 19(6) which overrides absolute contract freedom.",
                "Equality under Article 14 allows for class classifications that are compensatory and don't require mathematical precision."
            ],
            alternative_interpretations: [
                "The 50% limit in Indra Sawhney is a rule of caution, not an absolute constitutional ceiling.",
                "Article 21 procedural requirements do not apply to commercial contracts governed by private statutes."
            ],
            weakness_analysis: [
                "Over-reliance on general rights doctrines rather than specific statutory provisions.",
                "Failure to account for sovereign immunity defenses in administrative classification challenges."
            ]
        });
        return `
<challenge>
${challengeJson}
</challenge>
`;
    }
};
exports.ResearchService = ResearchService;
exports.ResearchService = ResearchService = ResearchService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(research_entities_1.ResearchUser)),
    __param(1, (0, typeorm_1.InjectRepository)(research_entities_1.ResearchQuery)),
    __param(2, (0, typeorm_1.InjectRepository)(research_entities_1.ResearchReport)),
    __param(3, (0, typeorm_1.InjectRepository)(research_entities_1.ResearchSource)),
    __param(4, (0, typeorm_1.InjectRepository)(research_entities_1.ResearchNote)),
    __param(5, (0, typeorm_1.InjectRepository)(research_entities_1.SavedReport)),
    __param(6, (0, typeorm_1.InjectRepository)(research_entities_1.ResearchAsset)),
    __param(7, (0, typeorm_1.InjectRepository)(research_entities_1.ResearchDocument)),
    __param(8, (0, typeorm_1.InjectRepository)(research_entities_1.JudgmentReport)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        bge_m3_provider_1.BgeM3Provider,
        qdrant_service_1.QdrantService,
        legal_retrieval_service_1.LegalRetrievalService,
        notification_service_1.NotificationService,
        token_optimization_service_1.TokenOptimizationService,
        openrouter_ai_provider_service_1.OpenRouterAiProviderService,
        semantic_cache_service_1.SemanticCacheService])
], ResearchService);
//# sourceMappingURL=research.service.js.map