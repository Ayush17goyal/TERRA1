import { DocumentEngineService } from './document-engine.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
export declare class DocumentEngineController {
    private readonly documentEngineService;
    constructor(documentEngineService: DocumentEngineService);
    upload(file: any, body: UploadDocumentDto, req: any): Promise<import("./entities/ingested-document.entity").IngestedDocumentEntity>;
    list(req: any): Promise<import("./entities/ingested-document.entity").IngestedDocumentEntity[]>;
    status(id: string, req: any): Promise<import("./entities/ingested-document.entity").IngestedDocumentEntity>;
    record(id: string, req: any): Promise<import("./entities/document-knowledge-record.entity").DocumentKnowledgeRecordEntity>;
}
