export interface ActRegistryEntry {
    actId: string;
    officialName: string;
    shortName: string;
    aliases: string[];
    year?: number;
    status: 'active' | 'repealed' | 'legacy';
}
export declare class ActRegistry {
    static all(): ActRegistryEntry[];
    static resolve(query: string): ActRegistryEntry | null;
    static resolveByName(name: string): ActRegistryEntry;
    static normalizeActId(value: string): string;
}
