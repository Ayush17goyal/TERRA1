import { Injectable } from '@nestjs/common';

@Injectable()
export class TokenOptimizationService {
  private stats = {
    lexmentor: {
      totalRequests: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
    },
    research: {
      totalRequests: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
    },
    judgment: {
      totalRequests: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
    },
    notebook: {
      totalRequests: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
    },
  };

  calculateMaxTokens(
    moduleName: 'lexmentor' | 'research' | 'judgment' | 'notebook',
    options: {
      userMode?: string; // Beginner, Intermediate, Expert, standard, deep, exhaustive
      query?: string;
      contextSize?: number; // character count of context
    }
  ): number {
    let baseBudget = 800; // default intermediate

    if (moduleName === 'lexmentor') {
      const mode = options.userMode || 'Intermediate';
      if (mode === 'Beginner') baseBudget = 900;
      else if (mode === 'Expert') baseBudget = 1600;
      else baseBudget = 1200;
    } else if (moduleName === 'research') {
      const mode = options.userMode || 'standard';
      if (mode === 'deep' || mode === 'exhaustive') baseBudget = 1500;
      else baseBudget = 1000;
    } else if (moduleName === 'judgment') {
      baseBudget = 2000; // Memorial Generation
    } else if (moduleName === 'notebook') {
      baseBudget = 1200; // Study Forge / Notebook RAG
    }

    // 1. Query Complexity Factor
    const queryText = options.query || '';
    const wordCount = queryText.trim().split(/\s+/).filter(Boolean).length;
    
    // Base complexity scales from 0.5 to 1.0 based on words (up to 25 words)
    let complexityFactor = 0.5 + Math.min(0.5, wordCount * 0.02);

    // Boost factor if the query contains complex legal instructions
    const complexKeywords = [
      'compare', 'difference', 'distinguish', 'versus', 'vs',
      'draft', 'prepare', 'write', 'agreement', 'contract', 'nda',
      'detailed', 'comprehensive', 'exhaustive', 'analysis', 'doctrine',
      'landmark', 'precedent', 'judicial', 'constitutional'
    ];
    const lowercaseQuery = queryText.toLowerCase();
    const hasComplexKeywords = complexKeywords.some(keyword => lowercaseQuery.includes(keyword));
    if (hasComplexKeywords) {
      complexityFactor = Math.min(1.0, complexityFactor + 0.15);
    }

    // 2. Context Size Factor
    const contextSize = options.contextSize || 0;
    let contextFactor = 1.0;
    if (contextSize === 0) {
      contextFactor = 0.6; // No context, reduce budget since response will be generic/shorter
    } else {
      // Scale from 0.6 to 1.0 based on context size (up to 10,000 characters)
      contextFactor = 0.6 + Math.min(0.4, contextSize / 10000 * 0.4);
    }

    // 3. Dynamic token limit calculation
    const calculatedTokens = Math.round(baseBudget * complexityFactor * contextFactor);

    // Enforce dynamic minimum budget to prevent starving the answer, and an upper ceiling that allows long-form legal explanations
    const finalTokens = Math.max(900, Math.min(2400, calculatedTokens));

    return finalTokens;
  }

  logUsage(
    moduleName: 'lexmentor' | 'research' | 'judgment' | 'notebook',
    promptTokens: number,
    completionTokens: number
  ) {
    if (!this.stats[moduleName]) return;
    this.stats[moduleName].totalRequests++;
    this.stats[moduleName].totalPromptTokens += promptTokens;
    this.stats[moduleName].totalCompletionTokens += completionTokens;
  }

  getAverageUsage(moduleName: 'lexmentor' | 'research' | 'judgment' | 'notebook') {
    const s = this.stats[moduleName];
    if (!s || s.totalRequests === 0) return 0;
    return Math.round(s.totalCompletionTokens / s.totalRequests);
  }

  getAnalytics() {
    return {
      lexmentor: {
        totalRequests: this.stats.lexmentor.totalRequests,
        totalPromptTokens: this.stats.lexmentor.totalPromptTokens,
        totalCompletionTokens: this.stats.lexmentor.totalCompletionTokens,
        averageCompletionTokens: this.getAverageUsage('lexmentor'),
      },
      research: {
        totalRequests: this.stats.research.totalRequests,
        totalPromptTokens: this.stats.research.totalPromptTokens,
        totalCompletionTokens: this.stats.research.totalCompletionTokens,
        averageCompletionTokens: this.getAverageUsage('research'),
      },
      judgment: {
        totalRequests: this.stats.judgment.totalRequests,
        totalPromptTokens: this.stats.judgment.totalPromptTokens,
        totalCompletionTokens: this.stats.judgment.totalCompletionTokens,
        averageCompletionTokens: this.getAverageUsage('judgment'),
      },
      notebook: {
        totalRequests: this.stats.notebook.totalRequests,
        totalPromptTokens: this.stats.notebook.totalPromptTokens,
        totalCompletionTokens: this.stats.notebook.totalCompletionTokens,
        averageCompletionTokens: this.getAverageUsage('notebook'),
      },
    };
  }
}
