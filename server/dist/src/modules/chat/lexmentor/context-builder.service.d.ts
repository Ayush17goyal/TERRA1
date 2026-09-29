import { BuiltLegalContext, LegalIntent, RetrievedAuthority } from './pipeline.types';
export declare class ContextBuilder {
    build(query: string, intent: LegalIntent, authorities: RetrievedAuthority[]): BuiltLegalContext;
    private selectWithinBudget;
    private truncate;
}
