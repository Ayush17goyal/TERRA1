import { GateResult, DocumentTree } from '../types/document-graph.types';
export declare class NonLegalContentGate {
    check(fullText: string, tree: DocumentTree): GateResult;
}
