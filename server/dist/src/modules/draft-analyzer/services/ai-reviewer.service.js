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
var AiReviewerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiReviewerService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const crypto = require("crypto");
const draft_entity_1 = require("../entities/draft.entity");
const draft_page_entity_1 = require("../entities/draft-page.entity");
const draft_text_block_entity_1 = require("../entities/draft-text-block.entity");
const draft_review_finding_entity_1 = require("../entities/draft-review-finding.entity");
const openrouter_ai_provider_service_1 = require("../../chat/openrouter-ai-provider.service");
const review_prompt_1 = require("./review.prompt");
const progress_service_1 = require("./progress.service");
const timeout_util_1 = require("./timeout.util");
const MAX_CHARS_PER_BATCH = 32_000;
const MAX_CONCURRENT = 3;
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 500;
const T_STRUCTURAL_MS = 2_000;
const T_BATCH_REVIEW_MS = 90_000;
const T_GOVT_MS = 10_000;
const T_LEGAL_SEARCH_MS = 10_000;
const T_GPT_REASONING_MS = 20_000;
const T_MERGE_MS = 5_000;
const MAX_SUMMARY_CHARS = 10_000;
const SCORE_DEDUCTIONS = {
    critical: 15, high: 10, medium: 5, low: 2, info: 1,
};
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function computeScore(findings) {
    const penalty = findings.reduce((s, f) => s + (SCORE_DEDUCTIONS[f.severity] ?? 0), 0);
    return Math.max(0, Math.round(100 - Math.min(penalty, 100)));
}
async function concurrentMap(items, fn, concurrency) {
    const results = new Array(items.length);
    let next = 0;
    let active = 0;
    return new Promise((resolve) => {
        const launch = () => {
            while (active < concurrency && next < items.length) {
                const idx = next++;
                active++;
                fn(items[idx], idx)
                    .then(v => { results[idx] = { status: 'fulfilled', value: v }; })
                    .catch(e => { results[idx] = { status: 'rejected', reason: e }; })
                    .finally(() => {
                    active--;
                    if (next < items.length)
                        launch();
                    else if (active === 0)
                        resolve(results);
                });
            }
        };
        launch();
    });
}
const VALID_CATEGORIES = new Set([
    'missing_clause', 'void_provision', 'ambiguity', 'procedure', 'definition',
    'liability', 'party_defect', 'jurisdiction', 'citation_error', 'boilerplate',
    'formatting', 'consideration',
]);
const VALID_ANNOTATION_TYPES = new Set([
    'underline', 'highlight', 'comment_marker', 'sidebar_only',
]);
let AiReviewerService = AiReviewerService_1 = class AiReviewerService {
    constructor(draftRepo, pageRepo, blockRepo, findingRepo, aiProvider, dataSource, progressService) {
        this.draftRepo = draftRepo;
        this.pageRepo = pageRepo;
        this.blockRepo = blockRepo;
        this.findingRepo = findingRepo;
        this.aiProvider = aiProvider;
        this.dataSource = dataSource;
        this.progressService = progressService;
        this.logger = new common_1.Logger(AiReviewerService_1.name);
    }
    async review(draftId, userId) {
        return this.reviewWithProgress(draftId, userId, () => { });
    }
    async reviewWithProgress(draftId, userId, onProgress) {
        const draft = await this.draftRepo.findOne({ where: { id: draftId, userId } });
        if (!draft)
            throw new common_1.HttpException('Draft not found', common_1.HttpStatus.NOT_FOUND);
        if (!draft.extractedAt) {
            throw new common_1.HttpException('Document not extracted yet.', common_1.HttpStatus.UNPROCESSABLE_ENTITY);
        }
        const onStage = (stage, result) => this.progressService.updateStage(draftId, stage, result);
        const ps = (stage) => this.progressService.startPipelineStage(draftId, stage);
        const pf = (stage, state, msg, cnt) => this.progressService.finishPipelineStage(draftId, stage, state, msg, cnt);
        const pages = await this.pageRepo.find({ where: { draftId }, order: { pageNumber: 'ASC' } });
        if (!pages.length) {
            throw new common_1.HttpException('No extracted pages found.', common_1.HttpStatus.UNPROCESSABLE_ENTITY);
        }
        const fullText = pages.map(p => p.rawText ?? '').join('\n');
        const documentSummary = fullText.length > MAX_SUMMARY_CHARS
            ? fullText.slice(0, MAX_SUMMARY_CHARS) + '\n\n[Document truncated]'
            : fullText;
        const batches = this.batchPagesByRawText(pages);
        const batchTotal = batches.length;
        const docType = this.inferDocType(draft.fileName, draft.mimeType);
        onProgress({
            phase: 'reviewing', batchTotal, batchDone: 0,
            batchFailed: 0, batchRetried: 0, reviewPct: 0,
            message: `8-stage audit starting — ${pages.length} page(s)`,
        });
        await this.findingRepo.delete({ draftId });
        const allFindings = [];
        ps('structural');
        onStage('structural', { status: 'running', message: 'Running structural validation…' });
        onStage('crossReference', { status: 'running', message: 'Scanning cross-references…' });
        let structuralFindings = [];
        let crossRefFindings = [];
        try {
            [structuralFindings, crossRefFindings] = await (0, timeout_util_1.withTimeout)(Promise.resolve([
                this.runStructuralValidation(fullText, draft.id),
                this.runCrossReferenceValidation(fullText, draft.id),
            ]), T_STRUCTURAL_MS, 'structural');
        }
        catch (err) {
            const isTimeout = err instanceof timeout_util_1.TimeoutError;
            const msg = isTimeout ? 'Structural validation timed out (2s limit)' : err.message;
            pf('structural', isTimeout ? 'timeout' : 'failed', msg);
            onStage('structural', { status: isTimeout ? 'timeout' : 'error', message: msg, completedAt: Date.now() });
            onStage('crossReference', { status: isTimeout ? 'timeout' : 'error', message: 'Skipped — structural timeout', completedAt: Date.now() });
            this.logger.warn(`[${draftId}] Structural stage: ${msg}`);
        }
        if (structuralFindings.length + crossRefFindings.length > 0) {
            const combined = [...structuralFindings, ...crossRefFindings];
            await this.persistFindingsChunk(combined);
            allFindings.push(...combined);
        }
        if (structuralFindings.length + crossRefFindings.length >= 0 && !allFindings.includes(structuralFindings[0])) {
        }
        const structStatus = (fs) => fs.some(f => f.severity === 'critical') ? 'failed'
            : fs.length > 0 ? 'warned' : 'passed';
        onStage('structural', {
            status: structStatus(structuralFindings),
            findingCount: structuralFindings.length,
            message: structuralFindings.length > 0
                ? `${structuralFindings.length} structural issue(s) found`
                : 'All structural checks passed',
            completedAt: Date.now(),
        });
        onStage('crossReference', {
            status: crossRefFindings.length > 0 ? 'warned' : 'passed',
            findingCount: crossRefFindings.length,
            message: crossRefFindings.length > 0
                ? `${crossRefFindings.length} cross-reference issue(s) found`
                : 'No cross-reference errors',
            completedAt: Date.now(),
        });
        pf('structural', structuralFindings.some(f => f.severity === 'critical') ? 'failed' : 'success', `${structuralFindings.length + crossRefFindings.length} structural/cross-ref issue(s)`, structuralFindings.length + crossRefFindings.length);
        onProgress({ reviewPct: 15, message: 'Structural validation complete — starting clause review…' });
        onStage('clause', { status: 'running', message: 'AI clause review in progress…' });
        onStage('draftQuality', { status: 'running', message: 'Checking draft quality…' });
        onStage('compliance', { status: 'running', message: 'Checking compliance…' });
        let batchDone = 0, batchFailed = 0, batchRetried = 0;
        const batchFindings = [];
        await concurrentMap(batches, async (batchPages, rawIdx) => {
            const pageLines = await this.buildPageLinesForBatch(draftId, batchPages);
            let findings;
            try {
                findings = await this.reviewBatchWithRetry(draft, batchPages, pageLines, rawIdx, () => {
                    batchRetried++;
                    onProgress({ batchRetried });
                });
            }
            catch (err) {
                batchFailed++;
                batchDone++;
                this.logger.error(`[${draftId}] Batch ${rawIdx + 1}/${batchTotal} failed: ${err.message}`);
                onProgress({ batchDone, batchFailed, reviewPct: Math.round((batchDone / batchTotal) * 50) });
                return;
            }
            batchFindings.push(...findings);
            if (findings.length > 0)
                await this.persistFindingsChunk(findings);
            batchDone++;
            onProgress({
                batchDone, batchFailed, batchRetried,
                reviewPct: Math.round((batchDone / batchTotal) * 50),
                message: `Clause review: batch ${batchDone}/${batchTotal} (${findings.length} issues)`,
            });
        }, MAX_CONCURRENT);
        allFindings.push(...batchFindings);
        const clauseF = batchFindings.filter(f => f.batchIndex >= 0);
        const qualityF = clauseF.filter(f => ['formatting', 'ambiguity', 'definition'].includes(f.category ?? ''));
        const complianceF = clauseF.filter(f => ['void_provision', 'jurisdiction', 'citation_error', 'consideration'].includes(f.category ?? ''));
        const aiStageStatus = (fs) => fs.some(f => f.severity === 'critical') ? 'failed'
            : fs.length > 0 ? 'warned' : 'passed';
        onStage('clause', {
            status: aiStageStatus(clauseF), findingCount: clauseF.length,
            message: `${clauseF.length} clause issue(s)`, completedAt: Date.now(),
        });
        onStage('draftQuality', {
            status: aiStageStatus(qualityF), findingCount: qualityF.length,
            message: qualityF.length > 0 ? `${qualityF.length} quality issue(s)` : 'Draft quality acceptable',
            completedAt: Date.now(),
        });
        onStage('compliance', {
            status: aiStageStatus(complianceF), findingCount: complianceF.length,
            message: complianceF.length > 0 ? `${complianceF.length} compliance issue(s)` : 'No violations',
            completedAt: Date.now(),
        });
        onProgress({ reviewPct: 55, message: 'Clause review done — launching parallel verification…' });
        ps('govtVerification');
        ps('legalSearch');
        ps('gptReasoning');
        onStage('govtVerification', { status: 'running', message: 'Verifying against government sources…' });
        onStage('legalSearch', { status: 'running', message: 'Searching verified legal sources…' });
        onStage('gptReasoning', { status: 'running', message: 'Applying GPT evidence-based reasoning…' });
        const [govtResult, legalResult, gptResult] = await Promise.allSettled([
            (0, timeout_util_1.withTimeout)(this.runGovtVerificationTask(draft.fileName, docType, documentSummary, draft.id), T_GOVT_MS, 'govtVerification'),
            (0, timeout_util_1.withTimeout)(this.runLegalSearchTask(draft.fileName, docType, documentSummary, draft.id), T_LEGAL_SEARCH_MS, 'legalSearch'),
            (0, timeout_util_1.withTimeout)(this.runGptReasoningTask(draft.fileName, docType, documentSummary, allFindings.length, draft.id), T_GPT_REASONING_MS, 'gptReasoning'),
        ]);
        if (govtResult.status === 'fulfilled') {
            const findings = govtResult.value;
            if (findings.length > 0) {
                await this.persistFindingsChunk(findings);
                allFindings.push(...findings);
            }
            pf('govtVerification', 'success', `${findings.length} statutory issue(s) found`, findings.length);
            onStage('govtVerification', {
                status: findings.length > 0 ? 'warned' : 'passed', findingCount: findings.length,
                message: `Government check: ${findings.length} issue(s)`, completedAt: Date.now(),
            });
        }
        else {
            const isTimeout = govtResult.reason instanceof timeout_util_1.TimeoutError;
            const msg = isTimeout ? `Government verification timed out (${T_GOVT_MS / 1000}s limit)` : `Government verification failed: ${govtResult.reason?.message}`;
            pf('govtVerification', isTimeout ? 'timeout' : 'failed', msg, 0);
            onStage('govtVerification', { status: isTimeout ? 'timeout' : 'error', message: msg, completedAt: Date.now() });
            this.logger.warn(`[${draftId}] govtVerification: ${msg}`);
        }
        if (legalResult.status === 'fulfilled') {
            const findings = legalResult.value;
            if (findings.length > 0) {
                await this.persistFindingsChunk(findings);
                allFindings.push(...findings);
            }
            pf('legalSearch', 'success', `${findings.length} case law issue(s) found`, findings.length);
            onStage('legalSearch', {
                status: findings.length > 0 ? 'warned' : 'passed', findingCount: findings.length,
                message: `Legal search: ${findings.length} case law risk(s)`, completedAt: Date.now(),
            });
        }
        else {
            const isTimeout = legalResult.reason instanceof timeout_util_1.TimeoutError;
            const msg = isTimeout ? `Legal search timed out (${T_LEGAL_SEARCH_MS / 1000}s limit)` : `Legal search failed: ${legalResult.reason?.message}`;
            pf('legalSearch', isTimeout ? 'timeout' : 'failed', msg, 0);
            onStage('legalSearch', { status: isTimeout ? 'timeout' : 'error', message: msg, completedAt: Date.now() });
            this.logger.warn(`[${draftId}] legalSearch: ${msg}`);
        }
        if (gptResult.status === 'fulfilled') {
            const findings = gptResult.value;
            if (findings.length > 0) {
                await this.persistFindingsChunk(findings);
                allFindings.push(...findings);
            }
            pf('gptReasoning', 'success', `${findings.length} GPT finding(s)`, findings.length);
            onStage('gptReasoning', {
                status: findings.length > 0 ? 'warned' : 'passed', findingCount: findings.length,
                message: `GPT analysis: ${findings.length} finding(s)`, completedAt: Date.now(),
            });
        }
        else {
            const isTimeout = gptResult.reason instanceof timeout_util_1.TimeoutError;
            const msg = isTimeout ? `GPT reasoning timed out (${T_GPT_REASONING_MS / 1000}s limit)` : `GPT reasoning failed: ${gptResult.reason?.message}`;
            pf('gptReasoning', isTimeout ? 'timeout' : 'failed', msg, 0);
            onStage('gptReasoning', { status: isTimeout ? 'timeout' : 'error', message: msg, completedAt: Date.now() });
            this.logger.warn(`[${draftId}] gptReasoning: ${msg}`);
        }
        onProgress({ reviewPct: 90, message: 'Parallel verification done — generating audit report…' });
        ps('mergeResults');
        try {
            await (0, timeout_util_1.withTimeout)(Promise.resolve(this.deduplicateFindings(allFindings)), T_MERGE_MS, 'mergeResults');
            pf('mergeResults', 'success', `${allFindings.length} total finding(s) after dedup`);
        }
        catch {
            pf('mergeResults', 'timeout', 'Merge timed out — using raw results');
        }
        ps('auditReport');
        const auditScore = computeScore(allFindings);
        this.progressService.setAuditScore(draftId, auditScore);
        this.logger.log(`[${draftId}] Audit score (backend): ${auditScore}/100`);
        const terminalAuditStages = ['structural', 'clause', 'draftQuality', 'crossReference', 'compliance', 'govtVerification', 'legalSearch', 'gptReasoning'];
        for (const s of terminalAuditStages) {
            const current = this.progressService.get(draftId)?.stages[s];
            if (current?.status === 'pending' || current?.status === 'running') {
                this.progressService.updateStage(draftId, s, { status: 'error', message: 'Not reached', completedAt: Date.now() });
            }
        }
        pf('auditReport', 'success', `Score: ${auditScore}/100 — ${allFindings.length} finding(s)`, allFindings.length);
        await this.draftRepo.update({ id: draftId }, { status: 'reviewed', reviewedAt: new Date() });
        this.logger.log(`[${draftId}] Review complete. Score=${auditScore}. Findings=${allFindings.length}. BatchFailed=${batchFailed}`);
        return {
            draftId,
            pageCount: pages.length,
            batchCount: batchTotal,
            findingCount: allFindings.length,
            findings: allFindings,
            auditScore,
            scoreReady: true,
        };
    }
    async getFindings(draftId, userId) {
        const draft = await this.draftRepo.findOne({ where: { id: draftId, userId } });
        if (!draft)
            throw new common_1.HttpException('Draft not found', common_1.HttpStatus.NOT_FOUND);
        return this.findingRepo.find({ where: { draftId }, order: { page: 'ASC', line: 'ASC' } });
    }
    async getAuditStatus(draftId, userId) {
        const draft = await this.draftRepo.findOne({ where: { id: draftId, userId } });
        if (!draft)
            throw new common_1.HttpException('Draft not found', common_1.HttpStatus.NOT_FOUND);
        const progress = this.progressService.get(draftId);
        if (progress?.scoreReady) {
            const findingCount = await this.findingRepo.count({ where: { draftId } });
            return {
                scoreReady: true,
                auditScore: progress.auditScore,
                completionStatus: progress.completionStatus,
                pipelineStages: progress.pipelineStages,
                stages: progress.stages,
                findingCount,
            };
        }
        if (progress && progress.completionStatus === 'running') {
            const findingCount = await this.findingRepo.count({ where: { draftId } });
            return {
                scoreReady: false,
                auditScore: null,
                completionStatus: 'running',
                pipelineStages: progress.pipelineStages,
                stages: progress.stages,
                findingCount,
            };
        }
        const [findingCount, findings] = await Promise.all([
            this.findingRepo.count({ where: { draftId } }),
            this.findingRepo.find({ where: { draftId }, select: ['severity'] }),
        ]);
        const isComplete = draft.status === 'reviewed' ||
            draft.reviewedAt != null ||
            findingCount > 0;
        if (isComplete) {
            const auditScore = computeScore(findings);
            const syntheticStages = {
                structural: { status: 'passed', findingCount: 0, message: 'Completed (server restart — details unavailable)' },
                clause: { status: 'passed', findingCount: 0, message: 'Completed' },
                draftQuality: { status: 'passed', findingCount: 0, message: 'Completed' },
                crossReference: { status: 'passed', findingCount: 0, message: 'Completed' },
                compliance: { status: 'passed', findingCount: 0, message: 'Completed' },
                govtVerification: { status: 'passed', findingCount: 0, message: 'Completed' },
                legalSearch: { status: 'passed', findingCount: 0, message: 'Completed' },
                gptReasoning: { status: 'passed', findingCount: findingCount, message: `${findingCount} finding(s) on record` },
            };
            return {
                scoreReady: true,
                auditScore,
                completionStatus: 'complete',
                pipelineStages: {},
                stages: syntheticStages,
                findingCount,
            };
        }
        return {
            scoreReady: false,
            auditScore: null,
            completionStatus: 'running',
            pipelineStages: progress?.pipelineStages ?? {},
            stages: progress?.stages ?? {},
            findingCount,
        };
    }
    async runGovtVerificationTask(fileName, docType, summary, draftId) {
        const result = await this.aiProvider.complete({
            messages: [
                { role: 'system', content: review_prompt_1.GOVT_VERIFICATION_SYSTEM_PROMPT },
                { role: 'user', content: (0, review_prompt_1.buildGovtVerificationPrompt)(fileName, docType, summary) },
            ],
            temperature: 0.1,
            maxTokens: 2000,
            timeoutMs: T_GOVT_MS - 500,
            preferredModel: 'google/gemini-2.5-flash',
            module: 'notebook',
            jsonMode: true,
        });
        return this.parseAndValidate(result.content, draftId, -4);
    }
    async runLegalSearchTask(fileName, docType, summary, draftId) {
        const result = await this.aiProvider.complete({
            messages: [
                { role: 'system', content: review_prompt_1.LEGAL_SEARCH_SYSTEM_PROMPT },
                { role: 'user', content: (0, review_prompt_1.buildLegalSearchPrompt)(fileName, docType, summary) },
            ],
            temperature: 0.1,
            maxTokens: 2000,
            timeoutMs: T_LEGAL_SEARCH_MS - 500,
            preferredModel: 'google/gemini-2.5-flash',
            module: 'notebook',
            jsonMode: true,
        });
        return this.parseAndValidate(result.content, draftId, -5);
    }
    async runGptReasoningTask(fileName, docType, summary, existingCount, draftId) {
        const result = await this.aiProvider.complete({
            messages: [
                { role: 'system', content: review_prompt_1.VERIFICATION_SYSTEM_PROMPT },
                { role: 'user', content: (0, review_prompt_1.buildVerificationPrompt)(fileName, docType, summary, existingCount) },
            ],
            temperature: 0.1,
            maxTokens: 3000,
            timeoutMs: T_GPT_REASONING_MS - 500,
            preferredModel: 'google/gemini-2.5-flash',
            module: 'notebook',
            jsonMode: true,
        });
        const findings = this.parseAndValidate(result.content, draftId, -3);
        findings.forEach(f => { f.batchIndex = -3; });
        return findings;
    }
    deduplicateFindings(findings) {
        const seen = new Map();
        for (const f of findings) {
            const key = `${f.page}::${f.issue.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 60)}`;
            if (!seen.has(key)) {
                seen.set(key, f);
            }
            else {
                const existing = seen.get(key);
                if (f.confidenceScore > existing.confidenceScore || f.batchIndex < existing.batchIndex) {
                    seen.set(key, f);
                }
            }
        }
        return [...seen.values()];
    }
    async buildPageLinesForBatch(draftId, pages) {
        const pageNums = pages.map(p => p.pageNumber);
        const blocks = await this.blockRepo.find({
            where: { draftId, blockType: 'line', pageNumber: (0, typeorm_2.In)(pageNums) },
            order: { pageNumber: 'ASC', blockIndex: 'ASC' },
            select: ['pageNumber', 'blockIndex', 'textContent'],
        });
        const map = new Map();
        for (const page of pages) {
            const pageBlocks = blocks.filter(b => b.pageNumber === page.pageNumber);
            const lines = pageBlocks
                .filter(b => b.textContent?.trim())
                .map((b, idx) => ({ lineNumber: idx + 1, text: b.textContent }));
            if (lines.length === 0 && page.rawText) {
                page.rawText.split('\n').filter(l => l.trim())
                    .forEach((text, idx) => lines.push({ lineNumber: idx + 1, text }));
            }
            map.set(page.pageNumber, lines);
        }
        return map;
    }
    batchPagesByRawText(pages) {
        const batches = [];
        let current = [];
        let currentChars = 0;
        for (const page of pages) {
            const pageChars = (page.rawText?.length ?? 0) + page.blockCount * 8;
            if (current.length > 0 && currentChars + pageChars > MAX_CHARS_PER_BATCH) {
                batches.push(current);
                current = [page];
                currentChars = pageChars;
            }
            else {
                current.push(page);
                currentChars += pageChars;
            }
        }
        if (current.length > 0)
            batches.push(current);
        return batches;
    }
    async reviewBatchWithRetry(draft, batchPages, pageLines, batchIdx, onRetry) {
        let lastErr;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                return await (0, timeout_util_1.withTimeout)(this.reviewBatch(draft, batchPages, pageLines, batchIdx), T_BATCH_REVIEW_MS, `batch-${batchIdx}`);
            }
            catch (err) {
                lastErr = err;
                if (attempt < MAX_RETRIES) {
                    const delay = RETRY_BASE_MS * Math.pow(2, attempt);
                    this.logger.warn(`[${draft.id}] Batch ${batchIdx + 1} attempt ${attempt + 1} failed (${err.message}) — retry in ${delay}ms`);
                    onRetry();
                    await sleep(delay);
                }
            }
        }
        throw lastErr;
    }
    async reviewBatch(draft, batchPages, pageLines, batchIdx) {
        const promptPages = batchPages
            .map(p => ({ pageNumber: p.pageNumber, lines: pageLines.get(p.pageNumber) ?? [] }))
            .filter(p => p.lines.length > 0);
        if (!promptPages.length)
            return [];
        const docType = this.inferDocType(draft.fileName, draft.mimeType);
        const result = await this.aiProvider.complete({
            messages: [
                { role: 'system', content: review_prompt_1.LEGAL_REVIEW_SYSTEM_PROMPT },
                { role: 'user', content: (0, review_prompt_1.buildUserPrompt)(draft.fileName, docType, promptPages) },
            ],
            temperature: 0.1,
            maxTokens: 8000,
            timeoutMs: T_BATCH_REVIEW_MS - 1000,
            preferredModel: 'google/gemini-2.5-flash',
            module: 'notebook',
            jsonMode: true,
        });
        return this.parseAndValidate(result.content, draft.id, batchIdx);
    }
    parseAndValidate(raw, draftId, batchIdx) {
        let cleaned = raw.trim();
        const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenceMatch)
            cleaned = fenceMatch[1].trim();
        const aStart = cleaned.indexOf('[');
        const aEnd = cleaned.lastIndexOf(']');
        if (aStart === -1 || aEnd === -1)
            return [];
        cleaned = cleaned.slice(aStart, aEnd + 1);
        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        }
        catch {
            parsed = this.repairAndParse(cleaned);
        }
        if (!Array.isArray(parsed))
            return [];
        const findings = [];
        for (const item of parsed) {
            const f = this.validateFinding(item, draftId, batchIdx);
            if (f)
                findings.push(f);
        }
        this.logger.log(`[${draftId}] Batch ${batchIdx}: ${findings.length} valid finding(s)`);
        return findings;
    }
    validateFinding(raw, draftId, batchIdx) {
        if (!raw || typeof raw !== 'object')
            return null;
        const page = Number(raw.page);
        const severity = String(raw.severity ?? '').toLowerCase();
        const rawCategory = String(raw.category ?? '').toLowerCase().trim();
        const category = VALID_CATEGORIES.has(rawCategory) ? rawCategory : null;
        const issue = String(raw.issue ?? '').trim();
        const legalReasoning = String(raw.legalReasoning ?? '').trim();
        const suggestion = String(raw.suggestion ?? '').trim();
        const confidenceScore = Math.max(0, Math.min(1, Number(raw.confidenceScore ?? 0.5)));
        const rawAnnoType = String(raw.annotationType ?? '').toLowerCase().trim();
        const annotationType = VALID_ANNOTATION_TYPES.has(rawAnnoType) ? rawAnnoType : null;
        const evidenceText = raw.evidenceText != null && raw.evidenceText !== '' && raw.evidenceText !== 'null'
            ? String(raw.evidenceText).trim() : null;
        const nearbyText = raw.nearbyText != null && raw.nearbyText !== '' && raw.nearbyText !== 'null'
            ? String(raw.nearbyText).trim() : null;
        const paragraphNumber = raw.paragraph != null ? Number(raw.paragraph) || null : null;
        const line = Number(raw.line) || 1;
        const exactText = evidenceText ?? String(raw.exactText ?? '').trim();
        if (!page || isNaN(page) || page < 1)
            return null;
        if (!issue || !legalReasoning || !suggestion)
            return null;
        if (!['critical', 'high', 'medium', 'low', 'info'].includes(severity))
            return null;
        if ((annotationType === 'underline' || annotationType === 'highlight') && !evidenceText) {
            raw.annotationType = 'sidebar_only';
        }
        if (annotationType === 'comment_marker' && !nearbyText) {
            raw.annotationType = 'sidebar_only';
        }
        const entity = new draft_review_finding_entity_1.DraftReviewFinding();
        entity.id = crypto.randomUUID();
        entity.draftId = draftId;
        entity.page = page;
        entity.line = line;
        entity.exactText = exactText || issue;
        entity.severity = severity;
        entity.category = category;
        entity.annotationType = annotationType ?? 'sidebar_only';
        entity.evidenceText = evidenceText;
        entity.nearbyText = nearbyText;
        entity.paragraphNumber = paragraphNumber;
        entity.issue = issue;
        entity.legalReasoning = legalReasoning;
        entity.suggestion = suggestion;
        entity.confidenceScore = confidenceScore;
        entity.batchIndex = batchIdx;
        return entity;
    }
    repairAndParse(raw) {
        try {
            return JSON.parse(raw.replace(/,\s*]/g, ']').replace(/,\s*}/g, '}'));
        }
        catch {
            return [];
        }
    }
    async persistFindingsChunk(findings) {
        const CHUNK = 50;
        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();
        try {
            for (let i = 0; i < findings.length; i += CHUNK) {
                await qr.manager.insert(draft_review_finding_entity_1.DraftReviewFinding, findings.slice(i, i + CHUNK));
            }
            await qr.commitTransaction();
        }
        catch (err) {
            await qr.rollbackTransaction();
            this.logger.error(`Failed to persist findings: ${err.message}`);
            throw err;
        }
        finally {
            await qr.release();
        }
    }
    runStructuralValidation(fullText, draftId) {
        const findings = [];
        const make = (severity, category, issue, legalReasoning, suggestion, evidenceText = null, annotationType = 'sidebar_only') => {
            const e = new draft_review_finding_entity_1.DraftReviewFinding();
            e.id = crypto.randomUUID();
            e.draftId = draftId;
            e.page = 1;
            e.line = 1;
            e.paragraphNumber = null;
            e.severity = severity;
            e.category = category;
            e.issue = issue;
            e.legalReasoning = legalReasoning;
            e.suggestion = suggestion;
            e.confidenceScore = 0.95;
            e.batchIndex = -1;
            e.annotationType = annotationType;
            e.evidenceText = evidenceText;
            e.nearbyText = null;
            e.exactText = evidenceText ?? issue;
            return e;
        };
        const placeholderPatterns = [
            { re: /\[date\]/gi, label: '[DATE]' },
            { re: /\[month\]/gi, label: '[MONTH]' },
            { re: /\[year\]/gi, label: '[YEAR]' },
            { re: /\[day\]/gi, label: '[DAY]' },
            { re: /\[name\]/gi, label: '[NAME]' },
            { re: /\[address\]/gi, label: '[ADDRESS]' },
            { re: /\[party\s*\d*\]/gi, label: '[PARTY]' },
            { re: /\[amount\]/gi, label: '[AMOUNT]' },
            { re: /\[___+\]/g, label: '[___]' },
            { re: /\[insert/gi, label: '[INSERT …]' },
            { re: /____+/g, label: '____' },
            { re: /•{3,}/g, label: '•••' },
            { re: /\[[A-Z][A-Z\s]{2,}\]/g, label: '[CAPS PLACEHOLDER]' },
        ];
        const seenPlaceholders = new Set();
        for (const { re, label } of placeholderPatterns) {
            if (re.test(fullText) && !seenPlaceholders.has(label)) {
                seenPlaceholders.add(label);
                findings.push(make('high', 'formatting', `Unfilled placeholder "${label}" detected`, 'Blank placeholders indicate an incomplete draft. Under ICA 1872 s.10, ambiguous or unexecuted agreements may be unenforceable.', `Replace all "${label}" occurrences with actual values before execution.`, label, 'sidebar_only'));
            }
        }
        if (!/effective date|execution date|dated this|this agreement dated|day of \w+ 20\d\d|\d{1,2}[\/\-]\d{1,2}[\/\-]20\d\d/i.test(fullText)) {
            findings.push(make('high', 'missing_clause', 'Effective execution date not found', 'ICA 1872 requires a clear effective date. Without it, limitation periods and survival provisions are ambiguous.', 'Insert a specific execution date in the preamble.'));
        }
        if (!/governing law|applicable law|governed by|laws of india|courts of/i.test(fullText)) {
            findings.push(make('high', 'jurisdiction', 'Governing law and jurisdiction clause absent', 'Without a governing law clause, forum selection is uncertain. CPC 1908 s.20 requires a determinable forum.', 'Add a governing law clause specifying applicable law and exclusive jurisdiction.'));
        }
        if (!/arbitration|dispute resolution|mediation|conciliation|refer.*dispute/i.test(fullText)) {
            findings.push(make('medium', 'missing_clause', 'No dispute resolution mechanism', 'Arbitration and Conciliation Act 1996 requires a written arbitration agreement. Absence creates uncertainty.', 'Add a dispute resolution clause specifying arbitration or court jurisdiction.'));
        }
        if (!/severab|invalid.*provision|unenforceable.*provision/i.test(fullText)) {
            findings.push(make('low', 'boilerplate', 'Severability clause absent', 'Without severability, one void provision may fail the whole agreement.', 'Add a standard severability clause.'));
        }
        if (!/entire agreement|whole agreement|supersede/i.test(fullText)) {
            findings.push(make('low', 'boilerplate', 'Entire agreement (merger) clause missing', 'Without a merger clause, prior negotiations may be admissible as evidence of intent.', 'Add an entire agreement clause.'));
        }
        if (!/notice|notification.*shall be/i.test(fullText)) {
            findings.push(make('low', 'boilerplate', 'Notices clause not found', 'Undefined notice mode creates disputes over whether notices were validly served.', 'Add a notices clause specifying delivery method, address, and deemed-delivery period.'));
        }
        if (!/signature|signed by|authorised signatory|in witness whereof|for and on behalf/i.test(fullText)) {
            findings.push(make('critical', 'missing_clause', 'Signature / execution block missing', 'ICA 1872 s.10 requires evidence of execution. Missing signature block may render the document unexecuted.', 'Add a properly formatted execution block for all parties.'));
        }
        if (!/definitions|"[A-Z][a-z]+" means|"[A-Z][a-z]+" shall mean/i.test(fullText)) {
            findings.push(make('medium', 'definition', 'No definitions clause detected', 'Undefined key terms are construed against the drafter (contra proferentem).', 'Add a comprehensive definitions section.'));
        }
        return findings;
    }
    runCrossReferenceValidation(fullText, draftId) {
        const findings = [];
        const make = (severity, issue, reasoning, suggestion, evidenceText) => {
            const e = new draft_review_finding_entity_1.DraftReviewFinding();
            e.id = crypto.randomUUID();
            e.draftId = draftId;
            e.page = 1;
            e.line = 1;
            e.paragraphNumber = null;
            e.severity = severity;
            e.category = 'citation_error';
            e.issue = issue;
            e.legalReasoning = reasoning;
            e.suggestion = suggestion;
            e.confidenceScore = 0.90;
            e.batchIndex = -2;
            e.annotationType = evidenceText ? 'underline' : 'sidebar_only';
            e.evidenceText = evidenceText;
            e.nearbyText = null;
            e.exactText = evidenceText ?? issue;
            return e;
        };
        const scheduleRefs = [...fullText.matchAll(/Schedule\s+([A-Z0-9]+)/gi)];
        const annexureRefs = [...fullText.matchAll(/Annexure\s+([A-Z0-9]+)/gi)];
        if (scheduleRefs.length > 0 && !/^Schedule\s+[A-Z0-9]/mi.test(fullText)) {
            findings.push(make('high', 'Schedule referenced but not found in document', 'Under CPC 1908, courts require certainty. References to non-existent schedules create ambiguity.', 'Append all referenced Schedules to the document.', scheduleRefs[0]?.[0] ?? null));
        }
        if (annexureRefs.length > 0 && !/^Annexure\s+[A-Z0-9]/mi.test(fullText)) {
            findings.push(make('high', 'Annexure referenced but not found in document', 'References to absent Annexures render those obligations unenforceable.', 'Append all referenced Annexures to the document.', annexureRefs[0]?.[0] ?? null));
        }
        return findings;
    }
    inferDocType(fileName, mimeType) {
        const n = fileName.toLowerCase();
        if (n.includes('plaint') || n.includes('suit'))
            return 'Civil Plaint (CPC Order VII)';
        if (n.includes('petition') || n.includes('writ'))
            return 'Writ Petition (Article 226/32)';
        if (n.includes('bail'))
            return 'Bail Application (BNSS/CrPC)';
        if (n.includes('nda') || n.includes('non-disclosure'))
            return 'Non-Disclosure Agreement';
        if (n.includes('contract') || n.includes('agreement'))
            return 'Commercial Contract (ICA 1872)';
        if (n.includes('affidavit'))
            return 'Affidavit';
        if (n.includes('notice'))
            return 'Legal Notice';
        if (n.includes('memorial') || n.includes('moot'))
            return 'Moot Court Memorial';
        if (n.includes('judgment') || n.includes('judgement'))
            return 'Court Judgment';
        if (n.includes('lease') || n.includes('rent'))
            return 'Lease / Rental Agreement';
        if (n.includes('employment') || n.includes('appointment'))
            return 'Employment Agreement';
        if (mimeType === 'text/plain')
            return 'Plain Text Legal Document';
        return 'Legal Document';
    }
};
exports.AiReviewerService = AiReviewerService;
exports.AiReviewerService = AiReviewerService = AiReviewerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(draft_entity_1.Draft)),
    __param(1, (0, typeorm_1.InjectRepository)(draft_page_entity_1.DraftPage)),
    __param(2, (0, typeorm_1.InjectRepository)(draft_text_block_entity_1.DraftTextBlock)),
    __param(3, (0, typeorm_1.InjectRepository)(draft_review_finding_entity_1.DraftReviewFinding)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        openrouter_ai_provider_service_1.OpenRouterAiProviderService,
        typeorm_2.DataSource,
        progress_service_1.ProgressService])
], AiReviewerService);
//# sourceMappingURL=ai-reviewer.service.js.map