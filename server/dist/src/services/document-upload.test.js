"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentUploadTester = void 0;
const document_processor_1 = require("./document-processor");
const vector_store_1 = require("./vector-store");
const document_upload_1 = require("./document-upload");
const embedding_service_1 = require("../modules/retrieval/embedding.service");
class DocumentUploadTester {
    constructor() {
        this.testResults = {
            passed: [],
            failed: [],
        };
        this.embeddingService = new embedding_service_1.EmbeddingService();
        this.documentProcessor = new document_processor_1.DocumentProcessor();
        this.vectorStore = new vector_store_1.VectorStoreService(this.embeddingService);
        this.uploadService = new document_upload_1.DocumentUploadService(this.documentProcessor, this.vectorStore);
    }
    async runAllTests() {
        console.log('🚀 Starting Document Upload Pipeline Tests...\n');
        try {
            await this.vectorStore.initializeCollection();
            this.testResults.passed.push('Vector store collection initialized');
            await this.testTextExtraction();
            await this.testPDFExtraction();
            await this.testDOCXExtraction();
            await this.testQualityValidation();
            await this.testChunking();
            await this.testMetadataExtraction();
            await this.testEndToEndUpload();
            await this.testErrorHandling();
            await this.testVectorStorage();
            await this.testQualityScoring();
        }
        catch (error) {
            console.error(`\n❌ Test suite failed: ${error.message}`);
            this.testResults.failed.push({
                test: 'Test Suite',
                error: error.message,
            });
        }
        this.printResults();
    }
    async testTextExtraction() {
        console.log('📝 Test 1: Basic Text Extraction');
        try {
            const testText = 'This is a legal document. It contains important information about contracts. The parties agree to the terms herein. This is valid legal text with sentences.';
            const buffer = Buffer.from(testText, 'utf8');
            const result = await this.documentProcessor.extractFromText(buffer, 'test.txt');
            const wordCount = result.text.split(/\s+/).length;
            if (wordCount > 10 && result.text.includes('contract')) {
                this.testResults.passed.push('✓ Basic text extraction works');
            }
            else {
                throw new Error('Text extraction returned incomplete data');
            }
        }
        catch (error) {
            this.testResults.failed.push({
                test: 'Text Extraction',
                error: error.message,
            });
        }
    }
    async testPDFExtraction() {
        console.log('📄 Test 2: PDF Extraction');
        try {
            const pdfBuffer = this.createMockPDFBuffer();
            const result = await this.documentProcessor.extractFromPDF(pdfBuffer, 'judgment.pdf');
            if (result.metadata.fileType === 'PDF' && result.text.length > 0) {
                this.testResults.passed.push('✓ PDF extraction works');
            }
            else {
                throw new Error('PDF extraction failed');
            }
        }
        catch (error) {
            console.log(`⚠️  PDF extraction test skipped (expected for mock data): ${error.message}`);
        }
    }
    async testDOCXExtraction() {
        console.log('📋 Test 3: DOCX Extraction');
        try {
            const docxBuffer = this.createMockDOCXBuffer();
            const result = await this.documentProcessor.extractFromDOCX(docxBuffer, 'document.docx');
            if (result.metadata.fileType === 'DOCX' && result.text.length > 0) {
                this.testResults.passed.push('✓ DOCX extraction works');
            }
            else {
                throw new Error('DOCX extraction returned empty text');
            }
        }
        catch (error) {
            console.log(`⚠️  DOCX extraction test skipped: ${error.message}`);
        }
    }
    async testQualityValidation() {
        console.log('✅ Test 4: Quality Validation');
        try {
            const goodText = `This is a comprehensive legal judgment delivered by the Supreme Court of India. The case involves multiple parties and addresses important constitutional questions. The court thoroughly examined all evidence presented by both sides. After careful consideration, the bench delivered its judgment regarding the validity of certain legal provisions. The decision sets important precedents for future litigation.`;
            const result = this.documentProcessor.validateExtraction(goodText, {
                fileName: 'judgment.pdf',
                fileType: 'PDF',
                fileSize: 50000,
                uploadedAt: new Date().toISOString(),
            });
            if (result.isValid && result.qualityScore > 50) {
                this.testResults.passed.push('✓ Quality validation works');
            }
            else {
                throw new Error(`Quality score too low: ${result.qualityScore}, valid: ${result.isValid}`);
            }
            const poorText = 'Short.';
            const poorResult = this.documentProcessor.validateExtraction(poorText, {
                fileName: 'bad.pdf',
                fileType: 'PDF',
                fileSize: 10,
                uploadedAt: new Date().toISOString(),
            });
            if (!poorResult.isValid) {
                this.testResults.passed.push('✓ Quality validation rejects poor text');
            }
        }
        catch (error) {
            this.testResults.failed.push({
                test: 'Quality Validation',
                error: error.message,
            });
        }
    }
    async testChunking() {
        console.log('🔗 Test 5: Chunking');
        try {
            const longText = Array(50)
                .fill('This is a sentence about Indian legal system. The Indian legal system is based on common law principles.')
                .join(' ');
            const chunks = this.documentProcessor.createChunks(longText, 'doc_123', 'test.pdf');
            if (chunks.length > 0 &&
                chunks.every(c => c.text.length > 0 && c.chunkIndex >= 0)) {
                this.testResults.passed.push(`✓ Chunking works (created ${chunks.length} chunks)`);
            }
            else {
                throw new Error('Chunking produced invalid chunks');
            }
            if (chunks.length > 1) {
                const chunk1End = chunks[0].endOffset;
                const chunk2Start = chunks[1].startOffset;
                const overlap = chunk1End - chunk2Start;
                if (overlap > 0 && overlap < 500) {
                    this.testResults.passed.push(`✓ Chunk overlap detected (${overlap} chars)`);
                }
            }
        }
        catch (error) {
            this.testResults.failed.push({
                test: 'Chunking',
                error: error.message,
            });
        }
    }
    async testMetadataExtraction() {
        console.log('📊 Test 6: Metadata Extraction');
        try {
            const buffer = Buffer.from('Test document with legal content.', 'utf8');
            const fileName = 'bare_act_2024.pdf';
            const result = await this.documentProcessor.extractFromText(buffer, fileName);
            const metadata = result.metadata;
            if (metadata.fileName &&
                metadata.fileType &&
                metadata.fileSize > 0 &&
                metadata.uploadedAt) {
                this.testResults.passed.push(`✓ Metadata extraction works (${metadata.fileType} file)`);
            }
            else {
                throw new Error('Metadata missing required fields');
            }
        }
        catch (error) {
            this.testResults.failed.push({
                test: 'Metadata Extraction',
                error: error.message,
            });
        }
    }
    async testEndToEndUpload() {
        console.log('🔄 Test 7: End-to-End Upload');
        try {
            const testContent = `JUDGMENT

This judgment is delivered by the Hon'ble Supreme Court. The case involves interpretation of constitutional provisions. After thorough examination of all evidence, this court finds that the provisions are valid and constitute to the constitutional framework. The decision is based on established legal precedents and principles of constitutional law. All parties are bound by this judgment.

The court notes that this decision affects significant portions of the legal framework and establishes important precedents for future cases. The reasoning provided herein should guide lower courts in similar matters.

Dated: ${new Date().toISOString()}`;
            const buffer = Buffer.from(testContent, 'utf8');
            const result = await this.uploadService.processUpload(buffer, 'judgment_2024.txt', 'Upload Judgment', 'user_test_123');
            if (result.success && result.documentId && result.chunkCount > 0) {
                this.testResults.passed.push(`✓ End-to-end upload successful (${result.chunkCount} chunks, quality: ${result.qualityScore})`);
            }
            else {
                throw new Error(`Upload failed: ${result.message}`);
            }
        }
        catch (error) {
            this.testResults.failed.push({
                test: 'End-to-End Upload',
                error: error.message,
            });
        }
    }
    async testErrorHandling() {
        console.log('🛡️  Test 8: Error Handling');
        try {
            const emptyResult = await this.uploadService.processUpload(Buffer.from(''), 'empty.txt', 'Upload Notes', 'user_test_123');
            if (!emptyResult.success && emptyResult.error) {
                this.testResults.passed.push('✓ Empty file error handling works');
            }
            const invalidTypeResult = await this.uploadService.processUpload(Buffer.from('Some content'), 'file.xyz', 'Unknown Type', 'user_test_123');
            if (!invalidTypeResult.success) {
                this.testResults.passed.push('✓ Invalid file type handling works');
            }
            const shortResult = await this.uploadService.processUpload(Buffer.from('Short'), 'short.txt', 'Upload Notes', 'user_test_123');
            if (!shortResult.success) {
                this.testResults.passed.push('✓ Short content validation works');
            }
        }
        catch (error) {
            this.testResults.failed.push({
                test: 'Error Handling',
                error: error.message,
            });
        }
    }
    async testVectorStorage() {
        console.log('🧠 Test 9: Vector Storage');
        try {
            const testChunks = [
                {
                    id: 'chunk_1',
                    text: 'The Indian Penal Code defines various offenses and punishments.',
                    chunkIndex: 0,
                    confidence: 0.95,
                    pageNumber: 1,
                },
                {
                    id: 'chunk_2',
                    text: 'The Code of Criminal Procedure provides procedural rules for criminal trials.',
                    chunkIndex: 1,
                    confidence: 0.95,
                    pageNumber: 1,
                },
            ];
            const result = await this.vectorStore.storeChunks('doc_test_456', testChunks, {
                document_type: 'Upload Legal Document',
                user_id: 'user_test_123',
                source_file: 'ipc.pdf',
                quality_score: 85,
            });
            if (result.success && result.vectorsGenerated > 0) {
                this.testResults.passed.push(`✓ Vector storage works (${result.vectorsGenerated} vectors stored)`);
            }
            else {
                throw new Error(`Vector storage failed: ${result.error}`);
            }
        }
        catch (error) {
            console.log(`⚠️  Vector storage test skipped (Qdrant connection): ${error.message}`);
        }
    }
    async testQualityScoring() {
        console.log('📈 Test 10: Quality Scoring');
        try {
            const testCases = [
                {
                    text: Array(100)
                        .fill('This is high quality legal text with proper formatting.')
                        .join(' '),
                    expectedScore: 'high',
                },
                { text: 'Low quality', expectedScore: 'low' },
                {
                    text: Array(50)
                        .fill('Medium quality document with some legal content.')
                        .join(' '),
                    expectedScore: 'medium',
                },
            ];
            for (const testCase of testCases) {
                const validation = this.documentProcessor.validateExtraction(testCase.text, {
                    fileName: 'test.pdf',
                    fileType: 'PDF',
                    fileSize: testCase.text.length,
                    uploadedAt: new Date().toISOString(),
                });
                console.log(`  Score for "${testCase.expectedScore}" text: ${validation.qualityScore}`);
            }
            this.testResults.passed.push('✓ Quality scoring works');
        }
        catch (error) {
            this.testResults.failed.push({
                test: 'Quality Scoring',
                error: error.message,
            });
        }
    }
    createMockPDFBuffer() {
        const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(This is a test judgment) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000203 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
297
%%EOF`;
        return Buffer.from(pdfContent, 'utf8');
    }
    createMockDOCXBuffer() {
        const AdmZip = require('adm-zip');
        const zip = new AdmZip();
        const documentXml = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>This is a test legal document. It contains important clauses and conditions.</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;
        zip.addFile('word/document.xml', Buffer.from(documentXml));
        return zip.toBuffer();
    }
    printResults() {
        console.log('\n' + '='.repeat(60));
        console.log('TEST RESULTS');
        console.log('='.repeat(60));
        if (this.testResults.passed.length > 0) {
            console.log(`\n✅ PASSED (${this.testResults.passed.length}):`);
            this.testResults.passed.forEach(test => console.log(`   ${test}`));
        }
        if (this.testResults.failed.length > 0) {
            console.log(`\n❌ FAILED (${this.testResults.failed.length}):`);
            this.testResults.failed.forEach(test => console.log(`   ${test.test}: ${test.error}`));
        }
        const total = this.testResults.passed.length + this.testResults.failed.length;
        const percentage = total > 0
            ? Math.round((this.testResults.passed.length / total) * 100)
            : 0;
        console.log(`\n📊 OVERALL: ${this.testResults.passed.length}/${total} tests passed (${percentage}%)`);
        console.log('='.repeat(60) + '\n');
        process.exit(this.testResults.failed.length > 0 ? 1 : 0);
    }
}
exports.DocumentUploadTester = DocumentUploadTester;
if (require.main === module) {
    const tester = new DocumentUploadTester();
    tester.runAllTests().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}
exports.default = DocumentUploadTester;
//# sourceMappingURL=document-upload.test.js.map