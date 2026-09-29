export declare class DocumentUploadTester {
    private documentProcessor;
    private vectorStore;
    private uploadService;
    private embeddingService;
    private testResults;
    constructor();
    runAllTests(): Promise<void>;
    private testTextExtraction;
    private testPDFExtraction;
    private testDOCXExtraction;
    private testQualityValidation;
    private testChunking;
    private testMetadataExtraction;
    private testEndToEndUpload;
    private testErrorHandling;
    private testVectorStorage;
    private testQualityScoring;
    private createMockPDFBuffer;
    private createMockDOCXBuffer;
    private printResults;
}
export default DocumentUploadTester;
