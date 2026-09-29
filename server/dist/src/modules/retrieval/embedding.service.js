"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var EmbeddingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("axios");
let EmbeddingService = EmbeddingService_1 = class EmbeddingService {
    constructor() {
        this.logger = new common_1.Logger(EmbeddingService_1.name);
    }
    getProvider() {
        const openAiKey = process.env.OPENAI_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;
        if (openAiKey && openAiKey !== 'sk_openai_key_placeholder') {
            return 'openai';
        }
        if (geminiKey && geminiKey !== 'ai_gemini_key_placeholder') {
            return 'gemini';
        }
        return 'mock';
    }
    getVectorSize() {
        const provider = this.getProvider();
        if (provider === 'gemini') {
            return 768;
        }
        return 1536;
    }
    async generateEmbedding(text) {
        const provider = this.getProvider();
        if (provider === 'openai') {
            try {
                const response = await axios_1.default.post('https://api.openai.com/v1/embeddings', {
                    model: 'text-embedding-3-small',
                    input: text,
                }, {
                    headers: {
                        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                });
                return response.data.data[0].embedding;
            }
            catch (error) {
                this.logger.error(`OpenAI Embedding generation failed: ${error.message}. Falling back to mock.`, error.stack);
            }
        }
        if (provider === 'gemini') {
            try {
                const response = await axios_1.default.post(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${process.env.GEMINI_API_KEY}`, {
                    model: 'models/text-embedding-004',
                    content: {
                        parts: [{ text }],
                    },
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
                return response.data.embedding.values;
            }
            catch (error) {
                this.logger.error(`Gemini Embedding generation failed: ${error.message}. Falling back to mock.`, error.stack);
            }
        }
        return this.generateMockEmbedding(text, this.getVectorSize());
    }
    async generateEmbeddings(texts) {
        const provider = this.getProvider();
        const vectorSize = this.getVectorSize();
        if (provider === 'openai') {
            try {
                const response = await axios_1.default.post('https://api.openai.com/v1/embeddings', {
                    model: 'text-embedding-3-small',
                    input: texts,
                }, {
                    headers: {
                        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                });
                return response.data.data.map((item) => item.embedding);
            }
            catch (error) {
                this.logger.error(`OpenAI Batch Embedding generation failed: ${error.message}. Falling back to mock.`, error.stack);
            }
        }
        if (provider === 'gemini') {
            try {
                const embeddings = await Promise.all(texts.map((text) => this.generateEmbedding(text)));
                return embeddings;
            }
            catch (error) {
                this.logger.error(`Gemini Batch Embedding generation failed: ${error.message}. Falling back to mock.`, error.stack);
            }
        }
        return texts.map((text) => this.generateMockEmbedding(text, vectorSize));
    }
    generateMockEmbedding(text, size) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash |= 0;
        }
        const random = this.getSeedRandom(hash);
        const vector = new Array(size);
        let sumSquares = 0;
        for (let i = 0; i < size; i++) {
            const val = random() * 2 - 1;
            vector[i] = val;
            sumSquares += val * val;
        }
        const magnitude = Math.sqrt(sumSquares);
        for (let i = 0; i < size; i++) {
            vector[i] = vector[i] / (magnitude || 1);
        }
        return vector;
    }
    getSeedRandom(seed) {
        let s = seed;
        return () => {
            s = (s * 1664525 + 1013904223) % 4294967296;
            return s / 4294967296;
        };
    }
};
exports.EmbeddingService = EmbeddingService;
exports.EmbeddingService = EmbeddingService = EmbeddingService_1 = __decorate([
    (0, common_1.Injectable)()
], EmbeddingService);
//# sourceMappingURL=embedding.service.js.map