/**
 * Network Isolator - Handles network access control and DNS pollution prevention
 */

import { AuditEntry, NetworkIsolatorConfig, AuditEventType } from './types';
import * as dns from 'dns';
import * as net from 'net';

export class NetworkIsolator {
  private config: NetworkIsolatorConfig;
  private originalLookup: typeof dns.lookup | null = null;
  private dnsServers: string[];

  constructor(config: NetworkIsolatorConfig) {
    this.config = config;
    this.dnsServers = config.dnsServers || ['8.8.8.8', '8.8.4.4'];
  }

  /**
   * Check if network access is allowed
   */
  isNetworkAllowed(): boolean {
    return this.config.allowNetwork;
  }

  /**
   * Validate a hostname or IP address
   */
  isHostAllowed(host: string, port?: number): boolean {
    if (!this.config.allowNetwork) {
      return false;
    }

    // Check for localhost bindings
    const blockedHosts = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];
    if (blockedHosts.includes(host.toLowerCase())) {
      return false;
    }

    // Check for private IP ranges
    if (this.isPrivateIP(host)) {
      return false;
    }

    // Validate port if provided
    if (port !== undefined) {
      return this.isPortAllowed(port);
    }

    return true;
  }

  /**
   * Check if an IP is in a private range
   */
  private isPrivateIP(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return false;

    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;

    return false;
  }

  /**
   * Check if a port is allowed
   */
  private isPortAllowed(port: number): boolean {
    // Block privileged ports (< 1024)
    if (port > 0 && port < 1024) {
      return false;
    }
    return true;
  }

  /**
   * Validate network access and create audit entry
   */
  validateConnection(host: string, port: number, onAudit: (entry: AuditEntry) => void): boolean {
    const isAllowed = this.isHostAllowed(host, port);

    if (isAllowed) {
      onAudit({
        timestamp: new Date().toISOString(),
        event: 'NETWORK_ALLOWED' as AuditEventType,
        details: `Network connection allowed: ${host}:${port}`,
      });
    } else {
      onAudit({
        timestamp: new Date().toISOString(),
        event: 'NETWORK_DENIED' as AuditEventType,
        details: `Network connection denied: ${host}:${port}`,
      });
    }

    return isAllowed;
  }

  /**
   * Create a custom DNS resolver to prevent DNS pollution
   */
  createSecureDNS(): { lookup: typeof dns.lookup } {
    const self = this;

    const secureLookup = (
      hostname: string,
      options: dns.LookupOptions,
      callback: (err: Error | null, address: string | undefined, family: number | undefined) => void
    ): void => {
      if (!self.config.allowNetwork) {
        callback(new Error('Network access is disabled'), undefined, undefined);
        return;
      }

      // Check if hostname is allowed
      if (!self.isHostAllowed(hostname)) {
        callback(new Error(`Hostname blocked: ${hostname}`), undefined, undefined);
        return;
      }

      // Use the first DNS server from the list
      const resolver = new dns.Resolver();
      resolver.setServers(self.dnsServers);

      resolver.resolve4(hostname, (err, addresses) => {
        if (err) {
          callback(err, undefined, undefined);
          return;
        }

        // Return first address
        const address = addresses?.[0];
        const family = address ? 4 : undefined;
        callback(null, address, family);
      });
    };

    return { lookup: secureLookup as typeof dns.lookup };
  }

  /**
   * Create a socket factory with network restrictions
   */
  createSecureSocketFactory(): () => net.Socket {
    const self = this;
    return () => {
      const socket = new net.Socket();
      const originalConnect = socket.connect.bind(socket);
      socket.connect = ((port: number, host?: string, connectionListener?: () => void) => {
        if (host && !self.isHostAllowed(host, port)) {
          socket.destroy();
          return socket;
        }
        return originalConnect(port, host!, connectionListener);
      }) as typeof net.Socket.prototype.connect;
      return socket;
    };
  }

  /**
   * Get the configured DNS servers
   */
  getDNSServers(): string[] {
    return [...this.dnsServers];
  }

  /**
   * Enable or disable network
   */
  setNetworkAllowed(allowed: boolean): void {
    this.config.allowNetwork = allowed;
  }
}
