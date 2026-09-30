import { ResearchAuthority } from './memorial.types';
export type AuthorityCatalogItem = Omit<ResearchAuthority, 'id' | 'issueId' | 'sideUsefulness' | 'relevanceReason'> & {
    catalogId: string;
    keywords: string[];
    defaultSide: ResearchAuthority['sideUsefulness'];
};
export declare const MEMORIAL_AUTHORITY_CATALOG: AuthorityCatalogItem[];
