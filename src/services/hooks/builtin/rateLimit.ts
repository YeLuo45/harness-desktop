/**
 * Built-in Rate Limiting Hook
 * Token bucket algorithm for request throttling
 */

import { HookPhase, HookContext, HookResult, HookDefinition } from '../types';

export interface RateLimitConfig {
  /** Max requests per window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Delay to apply when rate limited (ms) */
  delayMs?: number;
}

/** Per-client state */
interface ClientBucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private buckets: Map<string, ClientBucket> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = {
      delayMs: 1000,
      ...config,
    };
  }

  /**
   * Check and consume a token
   */
  check(clientId: string): { allowed: boolean; delay?: number } {
    this.refill(clientId);

    const bucket = this.buckets.get(clientId);
    if (!bucket) {
      return { allowed: true };
    }

    if (bucket.tokens > 0) {
      bucket.tokens--;
      return { allowed: true };
    }

    return {
      allowed: false,
      delay: this.config.delayMs,
    };
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(clientId: string): void {
    const now = Date.now();
    let bucket = this.buckets.get(clientId);

    if (!bucket) {
      bucket = {
        tokens: this.config.maxRequests,
        lastRefill: now,
      };
      this.buckets.set(clientId, bucket);
      return;
    }

    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor((elapsed / this.config.windowMs) * this.config.maxRequests);

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(
        this.config.maxRequests,
        bucket.tokens + tokensToAdd
      );
      bucket.lastRefill = now;
    }
  }

  /**
   * Reset bucket for a client
   */
  reset(clientId: string): void {
    this.buckets.delete(clientId);
  }

  /**
   * Clear all buckets
   */
  clear(): void {
    this.buckets.clear();
  }

  /**
   * Get current bucket state
   */
  getState(clientId: string): { tokens: number; maxTokens: number } | null {
    const bucket = this.buckets.get(clientId);
    if (!bucket) return null;
    return {
      tokens: bucket.tokens,
      maxTokens: this.config.maxRequests,
    };
  }
}

/**
 * Create a rate limit hook
 */
export function createRateLimitHook(
  name: string,
  operation: string,
  config: RateLimitConfig
): HookDefinition {
  const limiter = new RateLimiter(config);

  return {
    name,
    operations: [operation],
    phase: HookPhase.BEFORE,
    priority: 50,
    config: { limiter },
    handler: (context: HookContext): HookResult => {
      // Use client ID from context or default
      const clientId = (context.params?.clientId as string) ?? 
                       (context.params?.ip as string) ?? 
                       context.id;

      const result = limiter.check(clientId);

      if (!result.allowed) {
        return {
          allowed: false,
          error: `Rate limit exceeded. Try again in ${result.delay}ms`,
          delay: result.delay,
        };
      }

      return { allowed: true };
    },
  };
}

/**
 * Default rate limit hook for general operations
 */
export const defaultRateLimitHook: HookDefinition = createRateLimitHook(
  'rate-limit:default',
  '*',
  {
    maxRequests: 100,
    windowMs: 60000, // 1 minute
    delayMs: 1000,
  }
);

/**
 * Strict rate limit hook for sensitive operations
 */
export const strictRateLimitHook: HookDefinition = createRateLimitHook(
  'rate-limit:strict',
  '*',
  {
    maxRequests: 10,
    windowMs: 60000,
    delayMs: 5000,
  }
);

/**
 * All built-in rate limit hooks
 */
export const rateLimitHooks: HookDefinition[] = [
  defaultRateLimitHook,
  strictRateLimitHook,
];

/**
 * Register rate limit hooks
 */
export function registerRateLimitHooks(
  registry: { register: (hook: HookDefinition) => void },
  options?: { defaultLimit?: RateLimitConfig; strictLimit?: RateLimitConfig }
): void {
  const defaultLimit = options?.defaultLimit ?? {
    maxRequests: 100,
    windowMs: 60000,
    delayMs: 1000,
  };
  const strictLimit = options?.strictLimit ?? {
    maxRequests: 10,
    windowMs: 60000,
    delayMs: 5000,
  };

  registry.register(createRateLimitHook('rate-limit:default', '*', defaultLimit));
  registry.register(createRateLimitHook('rate-limit:strict', '*', strictLimit));
}
