import { GateResult, NormalizedDocument } from '../types/document-graph.types';
export declare class LanguageDetectionGate {
    detect(doc: NormalizedDocument): {
        language: string;
        mixed: boolean;
    };
    check(doc: NormalizedDocument): GateResult & {
        language: string;
    };
}
