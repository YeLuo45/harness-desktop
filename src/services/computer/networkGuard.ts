/**
 * Network Guard
 * Controls and monitors network access within sandboxed environments
 */

import { NetworkRequest } from './types';

export interface NetworkGuardConfig {
  enabled: boolean;
  allowedDomains: string[];
  blockedDomains: string[];
  logRequests: boolean;
  maxRequestsPerMinute: number;
}

export class NetworkGuard {
  private config: NetworkGuardConfig;
  private requestLog: NetworkRequest[] = [];
  private requestCounts: Map<string, number[]> = new Map();

  constructor(config: NetworkGuardConfig) {
    this.config = config;
  }

  /**
   * Check if a domain is allowed
   */
  isDomainAllowed(domain: string): boolean {
    if (!this.config.enabled) {
      return true; // All allowed when disabled
    }

    // Check blocked domains first
    if (this.config.blockedDomains.some(blocked => this.matchDomain(domain, blocked))) {
      return false;
    }

    // Check allowed domains
    if (this.config.allowedDomains.length > 0) {
      return this.config.allowedDomains.some(allowed => this.matchDomain(domain, allowed));
    }

    // If no allowed list, allow all except blocked
    return true;
  }

  /**
   * Match domain against pattern (supports wildcards)
   */
  private matchDomain(domain: string, pattern: string): boolean {
    const normalizedDomain = domain.toLowerCase();
    const normalizedPattern = pattern.toLowerCase();

    if (normalizedPattern === '*') {
      return true;
    }

    if (normalizedPattern.startsWith('*.')) {
      const suffix = normalizedPattern.slice(2);
      return normalizedDomain.endsWith(suffix) || normalizedDomain === suffix.slice(1);
    }

    return normalizedDomain === normalizedPattern || normalizedDomain.endsWith(`.${normalizedPattern}`);
  }

  /**
   * Check request rate limit
   */
  checkRateLimit(domain: string): boolean {
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window

    // Clean old entries
    const existing = this.requestCounts.get(domain);
    const timestamps = Array.isArray(existing) ? existing : [];
    const recentTimestamps = timestamps.filter((t: number) => t > windowStart);
    
    if (recentTimestamps.length >= this.config.maxRequestsPerMinute) {
      return false;
    }

    recentTimestamps.push(now);
    this.requestCounts.set(domain, recentTimestamps);
    return true;
  }

  /**
   * Process a network request
   */
  async processRequest(
    sandboxId: string,
    domain: string,
    ip: string,
    port: number,
    protocol: 'http' | 'https' | 'tcp' | 'udp'
  ): Promise<NetworkRequest> {
    const request: NetworkRequest = {
      id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sandboxId,
      domain,
      ip,
      port,
      protocol,
      allowed: false,
      timestamp: new Date()
    };

    // Check domain whitelist
    if (!this.isDomainAllowed(domain)) {
      request.allowed = false;
      this.logRequest(request);
      return request;
    }

    // Check rate limit
    if (!this.checkRateLimit(domain)) {
      request.allowed = false;
      this.logRequest(request);
      return request;
    }

    request.allowed = true;
    this.logRequest(request);
    return request;
  }

  /**
   * Log a network request
   */
  private logRequest(request: NetworkRequest): void {
    if (this.config.logRequests) {
      this.requestLog.push(request);
    }
  }

  /**
   * Get request logs
   */
  getRequestLogs(limit: number = 100): NetworkRequest[] {
    return this.requestLog.slice(-limit);
  }

  /**
   * Get logs for a specific sandbox
   */
  getSandboxLogs(sandboxId: string): NetworkRequest[] {
    return this.requestLog.filter(r => r.sandboxId === sandboxId);
  }

  /**
   * Clear request logs
   */
  clearLogs(): void {
    this.requestLog = [];
  }

  /**
   * Add domain to whitelist
   */
  addAllowedDomain(domain: string): void {
    if (!this.config.allowedDomains.includes(domain)) {
      this.config.allowedDomains.push(domain);
    }
  }

  /**
   * Remove domain from whitelist
   */
  removeAllowedDomain(domain: string): void {
    this.config.allowedDomains = this.config.allowedDomains.filter(d => d !== domain);
  }

  /**
   * Add domain to blacklist
   */
  addBlockedDomain(domain: string): void {
    if (!this.config.blockedDomains.includes(domain)) {
      this.config.blockedDomains.push(domain);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<NetworkGuardConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Check if network is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}

/**
 * Default network guard config for sandboxed environments
 */
export function createSandboxNetworkGuard(): NetworkGuard {
  return new NetworkGuard({
    enabled: true,
    allowedDomains: [
      'api.openai.com',
      'api.anthropic.com',
      'localhost',
      '127.0.0.1'
    ],
    blockedDomains: [
      'evil.com',
      'malware.test'
    ],
    logRequests: true,
    maxRequestsPerMinute: 60
  });
}
