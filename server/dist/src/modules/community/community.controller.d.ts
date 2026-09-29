import { Repository } from 'typeorm';
import { CommunityMessage } from './community.entity';
export declare class CommunityController {
    private readonly repo;
    constructor(repo: Repository<CommunityMessage>);
    getMessages(): Promise<{
        id: string;
        userName: string;
        text: string;
        topic: string;
        createdAt: Date;
    }[]>;
    sendMessage(body: any, req: any): Promise<{
        error: string;
        id?: undefined;
        userName?: undefined;
        text?: undefined;
        topic?: undefined;
        createdAt?: undefined;
    } | {
        id: string;
        userName: string;
        text: string;
        topic: string;
        createdAt: Date;
        error?: undefined;
    }>;
}
