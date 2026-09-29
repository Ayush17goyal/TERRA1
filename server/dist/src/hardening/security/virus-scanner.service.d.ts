export interface VirusScanResult {
    clean: boolean;
    engine: string;
    details: string;
}
export declare class VirusScannerService {
    private readonly env;
    scanBuffer(buffer: Buffer, fileName: string): Promise<VirusScanResult>;
    private runScanner;
}
