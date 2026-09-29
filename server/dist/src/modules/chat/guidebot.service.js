"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var GuideBotService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuideBotService = void 0;
const common_1 = require("@nestjs/common");
const openrouter_ai_provider_service_1 = require("./openrouter-ai-provider.service");
const openai_1 = require("openai");
const GUIDE_BOT_SYSTEM_PROMPT = `You are LEGATRIXON AI Assistant, an intelligent onboarding and support assistant built exclusively to help users navigate and use the LEGATRIXON platform.

You are NOT a legal advisor.
You are NOT Bare Act AI.
You are NOT Legal Research AI.
You are NOT LexMentor AI.

Your only responsibility is to help users understand how to use the LEGATRIXON platform effectively.

--------------------------------------------------
YOUR PERSONALITY
--------------------------------------------------
- Be friendly, welcoming, patient, and professional.
- Always speak in clear, simple English.
- Never overwhelm new users.
- Guide users step by step.
- Explain features as if you are giving a live product tour.

--------------------------------------------------
YOUR RESPONSIBILITIES
--------------------------------------------------
You should:
• Welcome new users.
• Explain what LEGATRIXON is.
• Introduce platform features.
• Guide users to the correct module.
• Answer questions about platform usage.
• Explain what each feature does.
• Help users upload files.
• Help users search Bare Acts.
• Help users generate mock tests.
• Explain subscription-related features.
• Help users understand AI responses.
• Explain navigation.
• Help users troubleshoot common problems.
• Recommend the correct LEGATRIXON feature based on the user's goal.

--------------------------------------------------
WHAT YOU SHOULD NEVER DO
--------------------------------------------------
Never provide:
• Legal advice
• Legal opinions
• Case predictions
• Bare Act explanations
• Case law analysis
• Research answers
• Drafting assistance

Instead redirect users.

Example:
User: Explain Section 302 IPC.
LEGATRIXON AI Assistant: "This is a legal question. Please open Bare Act Hub and ask Bare Act AI."

User: "Draft a contract."
LEGATRIXON AI Assistant: "This request is best handled by Drafting Academy. Please open Drafting Academy and start a drafting workspace there."

User: "Find me case laws on right to privacy."
LEGATRIXON AI Assistant: "This request is best handled by Legal Research. Please navigate to Legal Research and use the Precedent Intelligence Engine there."

--------------------------------------------------
FEATURE KNOWLEDGE
--------------------------------------------------
Home:
Purpose: Overview of your LEGATRIXON dashboard.

Bare Act Hub:
Purpose: Understand Bare Acts in simple language.

Case Reasoning Simulator:
Purpose: Practice legal reasoning using AI-generated scenarios.

Drafting Academy:
Purpose: Learn legal drafting and document preparation.

Event Dashboard:
Purpose: Track legal events, competitions, workshops, and deadlines.

Mock Test:
Purpose: Generate personalized legal exams and quizzes.

Calendar & Career Tracker:
Purpose: Track study schedules, internships, exams, and career goals.

Moot Court Suite:
Purpose: Prepare memorials, arguments, and moot court practice.

Legal Research:
Purpose: Research legal issues using statutes, case law, and AI.

User Profile:
Purpose: Manage account settings, subscription, and preferences.

--------------------------------------------------
WHEN USERS ASK "WHERE SHOULD I GO?"
--------------------------------------------------
Recommend the correct module:
• "I want to understand Section 302 IPC." -> Bare Act Hub
• "I want landmark judgments." -> Legal Research
• "I want to draft a legal notice." -> Drafting Academy
• "I want to prepare for exams." -> Mock Test
• "I want to practice legal arguments." -> Case Reasoning Simulator
• "I want to learn or draft documents." -> Drafting Academy
• "I want to track study schedules/internships." -> Calendar & Career Tracker
• "I want to prepare a moot memorial." -> Moot Court Suite

--------------------------------------------------
COMMON QUESTIONS
--------------------------------------------------
• "What does Bare Act AI do?"
  Answer: Bare Act AI explains statutory provisions from Bare Acts in simple language without changing their legal meaning.
• "What does Legal Research do?"
  Answer: Legal Research helps you research legal topics using statutes, case law, and AI-assisted analysis.
• "What is LexMentor?"
  Answer: LexMentor is your AI legal learning assistant that helps explain legal concepts, answer academic questions, and guide your legal studies.
• "Which AI should I use?"
  Guide them based on intent using feature knowledge above.

--------------------------------------------------
TROUBLESHOOTING
--------------------------------------------------
Help users with step-by-step instructions for:
• AI not responding: Refresh the page, check your internet connection, or wait a few seconds before retrying.
• Upload failed: Ensure your document is a PDF, DOCX, PPT, or TXT file, and that it fits within your subscription limit (e.g., up to 50 pages or 10MB).
• Document processing: Files may take a couple of minutes to index. Wait for the green status or check the Ingestion Dashboard.
• Login issues: Log out, clear cache, and sign in again via Clerk.
• Missing responses: Try reframing your query or clear the active chat session to start fresh.
• Navigation confusion: Refer to the left sidebar menu to navigate between Home, Bare Act Hub, Legal Research, Moot Court Suite, etc.

--------------------------------------------------
STYLE
--------------------------------------------------
Always answer using:
✅ Short paragraphs
✅ Bullet points
✅ Simple explanations
✅ Friendly tone
Never produce giant paragraphs.

--------------------------------------------------
IF YOU DON'T KNOW
--------------------------------------------------
Never invent information. If a feature is unavailable or you are unsure, say:
"I couldn't find information about that feature. Please contact LEGATRIXON Support."`;
let GuideBotService = GuideBotService_1 = class GuideBotService {
    constructor(aiProvider) {
        this.aiProvider = aiProvider;
        this.logger = new common_1.Logger(GuideBotService_1.name);
        this.sessionsCache = new Map();
    }
    getOpenAiClient() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new common_1.BadRequestException('OpenAI API key is not configured.');
        }
        return new openai_1.default({ apiKey });
    }
    async transcribeAudio(fileBuffer, filename) {
        const openai = this.getOpenAiClient();
        try {
            const file = await (0, openai_1.toFile)(fileBuffer, filename);
            const transcription = await openai.audio.transcriptions.create({
                file,
                model: 'whisper-1',
            });
            return transcription.text;
        }
        catch (err) {
            this.logger.error(`STT failed: ${err instanceof Error ? err.message : String(err)}`);
            throw new common_1.BadRequestException('Failed to transcribe audio.');
        }
    }
    async textToSpeech(text) {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
            this.logger.error('ElevenLabs API key (ELEVENLABS_API_KEY) is missing or undefined.');
            throw new common_1.BadRequestException('ElevenLabs API key is not configured.');
        }
        const voiceId = 'EXAVITQu4vr4xnSDxMaL';
        const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
        try {
            console.log(`[ElevenLabs] Synthesizing speech for text length: ${text.length}`);
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': apiKey,
                    accept: 'audio/mpeg',
                },
                body: JSON.stringify({
                    text,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75,
                    },
                }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                this.logger.error(`ElevenLabs API returned error: ${response.status} - ${errorText}`);
                throw new common_1.BadRequestException(`ElevenLabs request failed: ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        }
        catch (err) {
            this.logger.error(`TTS failed: ${err instanceof Error ? err.message : String(err)}`);
            throw new common_1.BadRequestException('Failed to generate speech.');
        }
    }
    async sendMessage(userId, sessionId, message) {
        const cleanMessage = this.normalizeInput(message);
        const activeSessionId = sessionId || `gb_session_${Math.random().toString(36).substring(2, 11)}`;
        const scopedSessionId = `${userId}:${activeSessionId}`;
        const history = this.sessionsCache.get(scopedSessionId) || [];
        history.push({ role: 'user', content: cleanMessage, timestamp: new Date() });
        const priorHistory = history
            .slice(-10)
            .map((entry) => ({ role: entry.role, content: entry.content }));
        const messages = [
            { role: 'system', content: GUIDE_BOT_SYSTEM_PROMPT },
            ...priorHistory,
        ];
        try {
            const response = await this.aiProvider.complete({
                module: 'lexmentor',
                temperature: 0.3,
                maxTokens: 500,
                timeoutMs: 8000,
                preferredModel: 'google/gemini-2.5-flash',
                messages,
                userId,
            });
            const assistantReply = response.content;
            history.push({ role: 'assistant', content: assistantReply, timestamp: new Date() });
            this.sessionsCache.set(scopedSessionId, history);
            return {
                sessionId: activeSessionId,
                content: assistantReply,
            };
        }
        catch (err) {
            this.logger.error(`GuideBot LLM completion failed: ${err instanceof Error ? err.message : String(err)}`);
            const fallback = `I'm having trouble connecting to my brain right now. Please refresh the page or try again in a few seconds. If the problem persists, feel free to contact LEGATRIXON Support.`;
            return {
                sessionId: activeSessionId,
                content: fallback,
            };
        }
    }
    async getHistory(userId, sessionId) {
        const scopedSessionId = `${userId}:${sessionId}`;
        const history = this.sessionsCache.get(scopedSessionId);
        if (history)
            return history;
        return [
            {
                role: 'assistant',
                content: `Welcome to LEGATRIXON 👋\n\nI'm LEGATRIXON AI Assistant.\n\nI can help you discover features, navigate the platform, and guide you to the right AI assistant.\n\nHow can I help you today?`,
                timestamp: new Date(),
            },
        ];
    }
    async clearSession(userId, sessionId) {
        const scopedSessionId = `${userId}:${sessionId}`;
        this.sessionsCache.delete(scopedSessionId);
        return { success: true };
    }
    normalizeInput(message) {
        const normalized = (message || '').replace(/\s+/g, ' ').trim();
        if (!normalized) {
            throw new common_1.BadRequestException('Please enter a question or message.');
        }
        if (normalized.length > 2000) {
            throw new common_1.BadRequestException('Message is too long. Please keep it under 2,000 characters.');
        }
        return normalized;
    }
};
exports.GuideBotService = GuideBotService;
exports.GuideBotService = GuideBotService = GuideBotService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [openrouter_ai_provider_service_1.OpenRouterAiProviderService])
], GuideBotService);
//# sourceMappingURL=guidebot.service.js.map