/**
 * Explanation Service - P14
 * 
 * Generates and stores natural language explanations for AI decisions and actions.
 * Provides users with understandable reasons for AI behavior.
 */

import type { PersonaRole } from '../collaboration/types';

// ============================================================================
// Types
// ============================================================================

export type ExplanationType = 
  | 'decision'        // Why AI made a specific decision
  | 'action'          // Why AI performed an action
  | 'recommendation'  // Why AI recommended something
  | 'reasoning'       // Chain of reasoning
  | 'constraint'      // Why AI is constrained
  | 'fallback';       // Why AI fell back to default behavior

export type ExplanationLevel = 'brief' | 'standard' | 'detailed' | 'technical';

export interface ExplanationContext {
  sessionId?: string;
  taskId?: string;
  personaId?: string;
  confidence?: number;
  modelUsed?: string;
  alternatives?: string[];
  constraints?: string[];
}

export interface Explanation {
  id: string;
  type: ExplanationType;
  level: ExplanationLevel;
  query: string;              // What the user asked
  response: string;            // The AI's response/action
  explanation: string;         // The natural language explanation
  reasoningChain?: string[];   // Step-by-step reasoning
  context: ExplanationContext;
  role: PersonaRole;
  agentId: string;
  createdAt: number;
  helpful?: boolean;           // User feedback
  expiresAt?: number;
}

export interface ExplanationRequest {
  type: ExplanationType;
  query: string;
  response: string;
  reasoningChain?: string[];
  context?: Partial<ExplanationContext>;
  level?: ExplanationLevel;
}

export interface ExplanationConfig {
  autoGenerate?: boolean;
  defaultLevel?: ExplanationLevel;
  storeExplanations?: boolean;
  explanationRetentionDays?: number;
  maxExplanations?: number;
}

// ============================================================================
// Storage Keys
// ============================================================================

const EXPLANATION_STORAGE_KEY = 'pixelpal_explainability_explanations';
const EXPLANATION_CONFIG_KEY = 'pixelpal_explainability_explanation_config';

// ============================================================================
// Config Management
// ============================================================================

const defaultConfig: Required<ExplanationConfig> = {
  autoGenerate: true,
  defaultLevel: 'standard',
  storeExplanations: true,
  explanationRetentionDays: 30,
  maxExplanations: 500,
};

export function getExplanationConfig(): Required<ExplanationConfig> {
  try {
    const stored = localStorage.getItem(EXPLANATION_CONFIG_KEY);
    if (stored) {
      return { ...defaultConfig, ...JSON.parse(stored) };
    }
  } catch {
    // ignore
  }
  return defaultConfig;
}

export function setExplanationConfig(config: ExplanationConfig): void {
  const current = getExplanationConfig();
  const updated = { ...current, ...config };
  localStorage.setItem(EXPLANATION_CONFIG_KEY, JSON.stringify(updated));
}

// ============================================================================
// Storage Functions
// ============================================================================

function loadExplanations(): Explanation[] {
  try {
    const raw = localStorage.getItem(EXPLANATION_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return [];
}

function saveExplanations(explanations: Explanation[]): void {
  localStorage.setItem(EXPLANATION_STORAGE_KEY, JSON.stringify(explanations));
}

// ============================================================================
// Explanation Templates
// ============================================================================

const EXPLANATION_TEMPLATES: Record<ExplanationType, string[]> = {
  decision: [
    'Based on the context and goals, I decided to {action} because {reason}.',
    'My decision to {action} was driven by {factor1} and {factor2}.',
    'After considering {aspects}, I determined that {action} was the best approach.',
  ],
  action: [
    'I performed {action} to address {goal}.',
    'The action {action} was taken because {condition}.',
    'To achieve {outcome}, I executed {action}.',
  ],
  recommendation: [
    'I recommend {recommendation} based on {evidence}.',
    'Given {context}, my recommendation is {recommendation} because {justification}.',
    'Based on analysis of {factors}, I suggest {recommendation}.',
  ],
  reasoning: [
    'Step 1: {premise} → Step 2: {inference} → Step 3: {conclusion}',
    'Starting from {initial}, I derived {result} through {process}.',
    'My reasoning: {chain}',
  ],
  constraint: [
    'I am constrained by {constraint}, which limits my options to {allowed}.',
    'Due to {limitation}, I could not {desired} and instead {alternative}.',
    'The {rule} prevents me from {prohibited}, so I {allowed}.',
  ],
  fallback: [
    'When {ideal} was unavailable, I fell back to {alternative}.',
    'Since {primary} failed/returned no results, I used {backup} instead.',
    'Default behavior activated: {default} (reason: {reason}).',
  ],
};

// ============================================================================
// ExplanationService Implementation
// ============================================================================

class ExplanationServiceImpl {
  private explanationCache: Explanation[] | null = null;
  private listeners: Set<(explanation: Explanation) => void> = new Set();
  private config: Required<ExplanationConfig>;

  constructor() {
    this.config = getExplanationConfig();
  }

  private getExplanations(): Explanation[] {
    if (!this.explanationCache) {
      this.explanationCache = loadExplanations();
    }
    return this.explanationCache;
  }

  private notifyListeners(explanation: Explanation): void {
    for (const listener of this.listeners) {
      try {
        listener(explanation);
      } catch {
        // ignore listener errors
      }
    }
  }

  /**
   * Generate and store an explanation
   */
  async generateExplanation(params: {
    type: ExplanationType;
    query: string;
    response: string;
    reasoningChain?: string[];
    context?: Partial<ExplanationContext>;
    level?: ExplanationLevel;
    role: PersonaRole;
    agentId: string;
  }): Promise<Explanation> {
    const config = this.config;
    const level = params.level ?? config.defaultLevel;

    // Generate natural language explanation
    const explanation = this.buildExplanation(
      params.type,
      params.query,
      params.response,
      params.reasoningChain,
      level
    );

    const newExplanation: Explanation = {
      id: `explain_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: params.type,
      level,
      query: params.query,
      response: params.response,
      explanation,
      reasoningChain: params.reasoningChain,
      context: {
        sessionId: params.context?.sessionId,
        taskId: params.context?.taskId,
        personaId: params.context?.personaId,
        confidence: params.context?.confidence,
        modelUsed: params.context?.modelUsed,
        alternatives: params.context?.alternatives,
        constraints: params.context?.constraints,
      },
      role: params.role,
      agentId: params.agentId,
      createdAt: Date.now(),
      expiresAt: config.explanationRetentionDays 
        ? Date.now() + (config.explanationRetentionDays * 24 * 60 * 60 * 1000)
        : undefined,
    };

    if (config.storeExplanations) {
      const all = this.getExplanations();
      all.push(newExplanation);
      
      // Enforce max limit
      if (all.length > config.maxExplanations) {
        all.splice(0, all.length - config.maxExplanations);
      }
      
      this.explanationCache = all;
      saveExplanations(all);
    }

    this.notifyListeners(newExplanation);
    return newExplanation;
  }

  /**
   * Build natural language explanation from template
   */
  private buildExplanation(
    type: ExplanationType,
    query: string,
    response: string,
    reasoningChain?: string[],
    level: ExplanationLevel = 'standard'
  ): string {
    const templates = EXPLANATION_TEMPLATES[type];
    const template = templates[Math.floor(Math.random() * templates.length)];

    // For detailed/technical levels, include reasoning chain
    if ((level === 'detailed' || level === 'technical') && reasoningChain && reasoningChain.length > 0) {
      const chainText = reasoningChain.map((step, i) => `(${i + 1}) ${step}`).join(' → ');
      return `${template}\n\n Reasoning chain: ${chainText}`;
    }

    // For brief level, keep it short
    if (level === 'brief') {
      return `I chose this because it best matches your request about "${query.substring(0, 50)}..."`;
    }

    return template.replace(/\{[^}]+\}/g, (match) => {
      switch (match) {
        case '{action}': return response.substring(0, 100);
        case '{reason}': return 'it aligns with your goals and context';
        case '{factor1}': return 'relevance';
        case '{factor2}': return 'accuracy';
        case '{aspects}': return 'the available options and constraints';
        case '{goal}': return 'your request';
        case '{condition}': return 'it addresses the core need';
        case '{outcome}': return 'the best result';
        case '{recommendation}': return response.substring(0, 80);
        case '{evidence}': return 'the information provided';
        case '{justification}': return 'it maximizes value';
        case '{context}': return 'your situation';
        case '{factors}': return 'relevant considerations';
        case '{premise}': return reasoningChain?.[0] ?? 'the initial context';
        case '{inference}': return reasoningChain?.[1] ?? 'reasoning step';
        case '{conclusion}': return reasoningChain?.[2] ?? response.substring(0, 50);
        case '{initial}': return 'the given context';
        case '{result}': return 'this conclusion';
        case '{process}': return 'logical deduction';
        case '{chain}': return reasoningChain?.join(', ') ?? 'analysis';
        case '{constraint}': return 'system guidelines';
        case '{allowed}': return 'available options';
        case '{limitation}': return 'certain constraints';
        case '{desired}': return 'what was originally requested';
        case '{alternative}': return 'an acceptable alternative';
        case '{rule}': return 'operational guidelines';
        case '{prohibited}': return 'certain actions';
        case '{ideal}': return 'the ideal solution';
        case '{primary}': return 'primary approach';
        case '{backup}': return 'a fallback option';
        case '{default}': return response.substring(0, 60);
        default: return match;
      }
    });
  }

  /**
   * Get explanation by ID
   */
  getExplanation(id: string): Explanation | undefined {
    return this.getExplanations().find(e => e.id === id);
  }

  /**
   * Get all explanations
   */
  getAllExplanations(): Explanation[] {
    return this.getExplanations();
  }

  /**
   * Get explanations for a session
   */
  getExplanationsForSession(sessionId: string): Explanation[] {
    return this.getExplanations().filter(e => e.context.sessionId === sessionId);
  }

  /**
   * Get explanations for a task
   */
  getExplanationsForTask(taskId: string): Explanation[] {
    return this.getExplanations().filter(e => e.context.taskId === taskId);
  }

  /**
   * Get explanations by type
   */
  getExplanationsByType(type: ExplanationType): Explanation[] {
    return this.getExplanations().filter(e => e.type === type);
  }

  /**
   * Get recent explanations
   */
  getRecentExplanations(limit = 20): Explanation[] {
    const sorted = [...this.getExplanations()].sort((a, b) => b.createdAt - a.createdAt);
    return sorted.slice(0, limit);
  }

  /**
   * Mark explanation as helpful/not helpful
   */
  markHelpful(id: string, helpful: boolean): void {
    const explanations = this.getExplanations();
    const explanation = explanations.find(e => e.id === id);
    if (explanation) {
      explanation.helpful = helpful;
      this.explanationCache = explanations;
      saveExplanations(explanations);
    }
  }

  /**
   * Delete explanation by ID
   */
  deleteExplanation(id: string): boolean {
    const explanations = this.getExplanations();
    const index = explanations.findIndex(e => e.id === id);
    if (index === -1) return false;

    explanations.splice(index, 1);
    this.explanationCache = explanations;
    saveExplanations(explanations);
    return true;
  }

  /**
   * Clear expired explanations
   */
  clearExpired(): number {
    const now = Date.now();
    const explanations = this.getExplanations();
    const initialCount = explanations.length;
    
    const filtered = explanations.filter(e => !e.expiresAt || e.expiresAt > now);
    const removed = initialCount - filtered.length;
    
    if (removed > 0) {
      this.explanationCache = filtered;
      saveExplanations(filtered);
    }
    
    return removed;
  }

  /**
   * Get explanation statistics
   */
  getStats(): {
    total: number;
    byType: Record<ExplanationType, number>;
    byLevel: Record<ExplanationLevel, number>;
    averageConfidence: number;
    helpfulRate: number;
  } {
    const explanations = this.getExplanations();
    
    const byType: Record<ExplanationType, number> = {
      decision: 0, action: 0, recommendation: 0,
      reasoning: 0, constraint: 0, fallback: 0,
    };
    
    const byLevel: Record<ExplanationLevel, number> = {
      brief: 0, standard: 0, detailed: 0, technical: 0,
    };

    let totalConfidence = 0;
    let confidenceCount = 0;
    let helpfulCount = 0;

    for (const exp of explanations) {
      byType[exp.type]++;
      byLevel[exp.level]++;
      if (exp.context.confidence !== undefined) {
        totalConfidence += exp.context.confidence;
        confidenceCount++;
      }
      if (exp.helpful === true) helpfulCount++;
    }

    return {
      total: explanations.length,
      byType,
      byLevel,
      averageConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
      helpfulRate: explanations.length > 0 ? helpfulCount / explanations.length : 0,
    };
  }

  /**
   * Subscribe to new explanations
   */
  subscribe(listener: (explanation: Explanation) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Clear all explanations (admin use)
   */
  clearAllExplanations(): void {
    this.explanationCache = [];
    saveExplanations([]);
  }
}

// Singleton instance
export const explanationService = new ExplanationServiceImpl();
