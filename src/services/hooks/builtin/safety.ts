/**
 * Built-in Safety Hooks
 * - Path traversal detection
 * - Dangerous command blocking
 * - Sensitive data detection
 */

import { HookPhase, HookContext, HookResult, HookDefinition } from '../types';

/** Patterns for path traversal attacks */
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//,
  /\.\.\\/,
  /%2e%2e/i,
  /%2e/i,
  /\.\./,
];

/** Dangerous system commands */
const DANGEROUS_COMMANDS = new Set([
  'rm', 'rmdir', 'del', 'erase', 'format',
  'shutdown', 'reboot', 'halt', 'poweroff',
  'dd', 'mkfs', 'fdisk', 'sfdisk',
  'chmod', 'chown', 'chgrp',
  'wget', 'curl', 'nc', 'netcat',
  'bash', 'sh', 'cmd', 'powershell',
  'python', 'perl', 'ruby', 'php',
  'vim', 'vi', 'nano', 'emacs',
  'sudo', 'su', 'passwd',
  'ssh', 'scp', 'sftp',
  'mount', 'umount', 'loops',
]);

/** Patterns for sensitive data detection */
const SENSITIVE_DATA_PATTERNS = {
  /** AWS keys */
  awsKey: /AKIA[0-9A-Z]{16}/,
  /** Generic API key */
  apiKey: /(?:api[_-]?key|apikey)["\s:=]+["']?([a-zA-Z0-9_\-]{20,})/i,
  /** Private key header */
  privateKey: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  /** JWT token */
  jwt: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/,
  /** Generic secret */
  secret: /(?:password|passwd|pwd|secret)["\s:=]+["']?([^\s"']{8,})/i,
  /** Connection string with password */
  connectionString: /\/\/[^:]+:[^@]+@/,
};

/**
 * Check for path traversal patterns
 */
function containsPathTraversal(path: string): boolean {
  return PATH_TRAVERSAL_PATTERNS.some((pattern) => pattern.test(path));
}

/**
 * Check for dangerous commands
 */
function containsDangerousCommand(cmd: string): boolean {
  const parts = cmd.trim().split(/\s+/);
  const base = parts[0].split('/').pop()?.toLowerCase() ?? '';
  return DANGEROUS_COMMANDS.has(base);
}

/**
 * Detect sensitive data in string
 */
function detectSensitiveData(content: string): string[] {
  const found: string[] = [];
  for (const [name, pattern] of Object.entries(SENSITIVE_DATA_PATTERNS)) {
    if (pattern.test(content)) {
      found.push(name);
    }
  }
  return found;
}

/**
 * Path traversal safety hook
 */
export const pathTraversalHook: HookDefinition = {
  name: 'safety:path-traversal',
  operations: ['file:read', 'file:write', 'file:delete', 'file:list'],
  phase: HookPhase.BEFORE,
  priority: 200,
  handler: (context: HookContext): HookResult => {
    const resource = context.resource ?? '';

    if (containsPathTraversal(resource)) {
      return {
        allowed: false,
        error: `Path traversal detected in resource: ${resource}`,
      };
    }

    return { allowed: true };
  },
};

/**
 * Dangerous command hook
 */
export const dangerousCommandHook: HookDefinition = {
  name: 'safety:dangerous-command',
  operations: ['command:execute', 'shell:execute', 'exec'],
  phase: HookPhase.BEFORE,
  priority: 200,
  handler: (context: HookContext): HookResult => {
    const params = context.params ?? {};
    const command = (params.command as string) ?? (params.cmd as string) ?? '';

    if (containsDangerousCommand(command)) {
      return {
        allowed: false,
        error: `Dangerous command blocked: ${command.split(' ')[0]}`,
      };
    }

    return { allowed: true };
  },
};

/**
 * Sensitive data detection hook
 */
export const sensitiveDataHook: HookDefinition = {
  name: 'safety:sensitive-data',
  operations: ['file:read', 'file:write', 'log:write'],
  phase: HookPhase.BEFORE,
  priority: 150,
  handler: (context: HookContext): HookResult => {
    const params = context.params ?? {};
    const content = (params.content as string) ?? (params.data as string) ?? '';

    const detected = detectSensitiveData(content);
    if (detected.length > 0) {
      return {
        allowed: false,
        error: `Sensitive data detected: ${detected.join(', ')}`,
      };
    }

    return { allowed: true };
  },
};

/**
 * All built-in safety hooks
 */
export const safetyHooks: HookDefinition[] = [
  pathTraversalHook,
  dangerousCommandHook,
  sensitiveDataHook,
];

/**
 * Register all safety hooks to a registry
 */
export function registerSafetyHooks(registry: { register: (hook: HookDefinition) => void }): void {
  for (const hook of safetyHooks) {
    registry.register(hook);
  }
}
