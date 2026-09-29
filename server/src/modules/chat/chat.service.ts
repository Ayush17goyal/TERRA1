import { BadRequestException, Injectable } from '@nestjs/common';
import {
  LegalDomainClassifierService,
  LEXMENTOR_REJECTION_RESPONSE,
  LEXMENTOR_WELCOME_MESSAGE,
} from '../legal-domain/legal-domain-classifier.service';
import { LexMentorAiService } from './lexmentor-ai.service';
import { SettingsService } from '../settings/settings.service';
import { FallbackMetricsService } from './fallback-metrics.service';
import { TokenOptimizationService } from './token-optimization.service';
import { SemanticCacheService } from './semantic-cache.service';

@Injectable()
export class ChatService {
  private sessionsCache = new Map<string, any[]>();
  private messageCitationsCache = new Map<string, any[]>();

  constructor(
    private readonly lexMentorAi: LexMentorAiService,
    private readonly legalClassifier: LegalDomainClassifierService,
    private readonly settings: SettingsService,
    private readonly metricsService: FallbackMetricsService,
    private readonly tokenService: TokenOptimizationService,
    private readonly cacheService: SemanticCacheService,
  ) {}

  getFallbackMetrics() {
    return this.metricsService.getMetrics();
  }

  getTokenAnalytics() {
    return this.tokenService.getAnalytics();
  }

  getCacheAnalytics() {
    return this.cacheService.getAnalytics();
  }

  async sendMessage(
    userId: string,
    sessionId: string,
    message: string,
    depth: string,
    references?: Array<{ id: string; content: string }>,
  ) {
    const startedAt = Date.now();
    const cleanMessage = this.normalizeInput(message);
    const activeSessionId = sessionId || `session_${Math.random().toString(36).substring(2, 11)}`;
    const scopedSessionId = this.scopedSessionId(userId, activeSessionId);
    const history = this.sessionsCache.get(scopedSessionId) || [];
    const messageId = `msg_${Math.random().toString(36).substring(2, 11)}`;
    let citations = [];
    const priorHistory = history
      .filter((entry) => entry.role === 'user' || entry.role === 'assistant')
      .slice(-16)
      .map((entry) => ({ role: entry.role, content: entry.content }));

    history.push({ role: 'user', content: cleanMessage, timestamp: new Date() });

    if (this.isGreetingOnly(cleanMessage)) {
      const greetingResponse = `Hello! Welcome to LEGATRIXON AI.

I am your AI legal learning and research assistant. I can help you with legal research, case analysis, judgments, Bare Acts, drafting, mock tests, legal concepts, and other features available within the LEGATRIXON platform.

My responses are grounded in the legal resources available in LEGATRIXON, and I use the appropriate module based on your query.

How can I assist you today?`;

      history.push({
        id: messageId,
        role: 'assistant',
        content: greetingResponse,
        citations,
        timestamp: new Date(),
        provider: 'lexmentor-greeting',
        model: 'local-greeting',
      });

      this.sessionsCache.set(scopedSessionId, history);
      this.messageCitationsCache.set(this.scopedMessageId(userId, messageId), citations);
      await this.logQuestion(userId, cleanMessage, depth, startedAt, activeSessionId);

      return {
        sessionId: activeSessionId,
        messageId,
        content: greetingResponse,
        citations,
        provider: 'lexmentor-greeting',
        model: 'local-greeting',
      };
    }

    const classification = await this.legalClassifier.classifySemantic(cleanMessage);
    if (!classification.isLegal) {
      console.log(`Incoming query:\n"${cleanMessage}"\n\nClassifier result:\nfalse\n\nReason:\n"${classification.reason}"\n\nPipeline decision:\nREJECT\n\nRAG decision:\nN/A\n\nReasoning engine called?\nNO\n\nModel called?\nNO\n`);
      history.push({
        id: messageId,
        role: 'assistant',
        content: LEXMENTOR_REJECTION_RESPONSE,
        citations,
        timestamp: new Date(),
        provider: 'legal-domain-classifier',
        model: classification.reason,
      });

      this.sessionsCache.set(scopedSessionId, history);
      this.messageCitationsCache.set(this.scopedMessageId(userId, messageId), citations);
      await this.logQuestion(userId, cleanMessage, depth, startedAt, activeSessionId);

      return {
        sessionId: activeSessionId,
        messageId,
        content: LEXMENTOR_REJECTION_RESPONSE,
        citations,
        provider: 'legal-domain-classifier',
        model: classification.reason,
      };
    }

    const aiResult = await this.lexMentorAi.generateResponse({
      query: cleanMessage,
      depth: depth || 'Intermediate',
      history: priorHistory,
      userId,
      references,
    });
    const ragDecision = aiResult.legalEvidenceValidation
      ? (aiResult.legalEvidenceValidation.canGenerateDefinitiveAnswer ? 'Definitive Answer supported' : `Fallback using verified knowledge: ${aiResult.legalEvidenceValidation.reason}`)
      : 'N/A';
    const modelCalled = aiResult.provider !== 'rag-gate' ? 'YES' : 'NO';
    console.log(`Incoming query:\n"${cleanMessage}"\n\nClassifier result:\ntrue\n\nReason:\n"${classification.reason}"\n\nPipeline decision:\nACCEPT\n\nRAG decision:\n"${ragDecision}"\n\nReasoning engine called?\n${modelCalled}\n\nModel called?\n${modelCalled}\n`);
    citations = aiResult.citations || [];

    history.push({
      id: messageId,
      role: 'assistant',
      content: aiResult.content,
      citations,
      supportingCitations: aiResult.supportingCitations,
      retrievedAuthorities: aiResult.retrievedAuthorities,
      verification: aiResult.verification,
      verificationPanelAvailable: aiResult.verificationPanelAvailable,
      intent: aiResult.intent,
      timestamp: new Date(),
      provider: aiResult.provider,
      model: aiResult.model,
    });

    this.sessionsCache.set(scopedSessionId, history);
    this.messageCitationsCache.set(this.scopedMessageId(userId, messageId), citations);
    await this.logQuestion(userId, cleanMessage, depth, startedAt, activeSessionId);

    return {
      sessionId: activeSessionId,
      messageId,
      content: aiResult.content,
      citations,
      supportingCitations: aiResult.supportingCitations,
      retrievedAuthorities: aiResult.retrievedAuthorities,
      verification: aiResult.verification,
      verificationPanelAvailable: aiResult.verificationPanelAvailable,
      intent: aiResult.intent,
      provider: aiResult.provider,
      model: aiResult.model,
    };
  }

  async getHistory(userId: string, sessionId: string) {
    const history = this.sessionsCache.get(this.scopedSessionId(userId, sessionId));
    if (history) return history;
    return [{
      role: 'assistant',
      content: LEXMENTOR_WELCOME_MESSAGE,
      timestamp: new Date(),
    }];
  }

  async clearSession(userId: string, sessionId: string) {
    this.sessionsCache.delete(this.scopedSessionId(userId, sessionId));
    return { success: true };
  }

  async search(query: string) {
    return [];
  }

  async getCitations(userId: string, messageId: string) {
    return this.messageCitationsCache.get(this.scopedMessageId(userId, messageId)) || [];
  }

  private scopedSessionId(userId: string, sessionId: string): string {
    return `${userId}:${sessionId}`;
  }

  private scopedMessageId(userId: string, messageId: string): string {
    return `${userId}:${messageId}`;
  }
  private isGreetingOnly(message: string): boolean {
    const normalized = (message || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const greetings = [
      'hi',
      'hello',
      'hey',
      'good morning',
      'good evening',
      'good afternoon',
      'namaste',
      'how are you',
      'who are you',
      'what can you do',
    ];

    if (greetings.includes(normalized)) return true;
    if (/^(hi+|hello+|hey+|namaste|greetings|good morning|good evening|good afternoon)\b/i.test(normalized) && normalized.length <= 30) return true;
    if (/^how (are you|s it going|are you doing|r u)/i.test(normalized)) return true;
    if (/^who (are you|r u|is this)/i.test(normalized)) return true;
    if (/^what (can you do|are you|is your role|do you do)/i.test(normalized)) return true;

    return false;
  }

  private normalizeInput(message: string): string {
    const normalized = (message || '').replace(/\s+/g, ' ').trim();
    if (!normalized) {
      throw new BadRequestException('Please enter a legal question.');
    }

    if (normalized.length > 8000) {
      throw new BadRequestException('Your question is too long. Please shorten it to 8,000 characters or less.');
    }

    return normalized;
  }

  private async logQuestion(userId: string, message: string, depth: string, startedAt: number, sessionId: string) {
    await this.settings.log({
      userId,
      module: 'LexMentor AI',
      action: 'Asked Question',
      metadata: {
        depth: depth || 'Intermediate',
        characters: message.length,
        sessionId,
        durationMinutes: Math.max(0, (Date.now() - startedAt) / 60000),
      },
    });
  }
}



