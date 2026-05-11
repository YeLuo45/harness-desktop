/**
 * Built-in Validation Hooks
 * - XSS (Cross-Site Scripting) prevention
 * - SQL Injection detection
 */

import { HookPhase, HookContext, HookResult, HookDefinition } from '../types';

/** XSS attack patterns */
const XSS_PATTERNS = [
  /<script[^>]*>[\s\S]*?<\/script>/gi,
  /<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi, // event handlers like onclick=
  /<object[^>]*>/gi,
  /<embed[^>]*>/gi,
  /<link[^>]*>/gi,
  /<meta[^>]*>/gi,
  /<base[^>]*>/gi,
  /<form[^>]*>/gi,
  /<svg[^>]*>[\s\S]*?<\/svg>/gi,
  /<math[^>]*>[\s\S]*?<\/math>/gi,
  /%3Cscript/g, // URL encoded <
  /%3Ciframe/g,
  /&#60;script/g, // HTML entity
  /&#x3C;script/g,
];

/** SQL injection patterns */
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE|UNION)\b)/i,
  /('|"|;|--|\/\*|\*\/|@@|@)/,
  /(\bOR\b|\bAND\b).*(=|>|<|!)/i,
  /\bUNION\s+(ALL\s+)?SELECT\b/i,
  /\bINTO\s+(OUTFILE|DUMPFILE)\b/i,
  /\bLOAD_FILE\s*\(/i,
  /\bBENCHMARK\s*\(/i,
  /\bSLEEP\s*\(/i,
  /0x[0-9a-f]+/i, // hex values
  /\\x[0-9a-f]{2}/i,
  /\\u[0-9a-f]{4}/i,
];

/**
 * Sanitize HTML to prevent XSS
 */
function sanitizeHtml(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Check for XSS patterns
 */
function containsXSS(input: string): boolean {
  // First try pattern matching
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }
  return false;
}

/**
 * Check for SQL injection patterns
 */
function containsSQLInjection(input: string): boolean {
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }
  return false;
}

/**
 * XSS prevention hook
 */
export const xssPreventionHook: HookDefinition = {
  name: 'validation:xss',
  operations: [
    'html:render',
    'html:write',
    'template:render',
    'response:send',
    'file:write',
  ],
  phase: HookPhase.BEFORE,
  priority: 300,
  handler: (context: HookContext): HookResult => {
    const params = context.params ?? {};
    const content = (params.content as string) ?? 
                    (params.html as string) ?? 
                    (params.body as string) ?? 
                    '';

    if (containsXSS(content)) {
      return {
        allowed: false,
        error: 'Potential XSS attack detected',
      };
    }

    return { allowed: true };
  },
};

/**
 * SQL injection prevention hook
 */
export const sqlInjectionPreventionHook: HookDefinition = {
  name: 'validation:sql-injection',
  operations: [
    'db:query',
    'db:execute',
    'sql:query',
    'sql:execute',
  ],
  phase: HookPhase.BEFORE,
  priority: 300,
  handler: (context: HookContext): HookResult => {
    const params = context.params ?? {};
    const query = (params.query as string) ?? 
                  (params.sql as string) ?? 
                  (params.statement as string) ?? 
                  '';

    if (containsSQLInjection(query)) {
      return {
        allowed: false,
        error: 'Potential SQL injection detected',
      };
    }

    return { allowed: true };
  },
};

/**
 * Input validation hook - general
 */
export const inputValidationHook: HookDefinition = {
  name: 'validation:input',
  operations: ['*'],
  phase: HookPhase.BEFORE,
  priority: 10,
  handler: (context: HookContext): HookResult => {
    const params = context.params ?? {};

    // Check all string parameters
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        if (containsXSS(value)) {
          return {
            allowed: false,
            error: `XSS detected in parameter: ${key}`,
          };
        }
        if (containsSQLInjection(value)) {
          return {
            allowed: false,
            error: `SQL injection detected in parameter: ${key}`,
          };
        }
      }
    }

    return { allowed: true };
  },
};

/**
 * All built-in validation hooks
 */
export const validationHooks: HookDefinition[] = [
  xssPreventionHook,
  sqlInjectionPreventionHook,
  inputValidationHook,
];

/**
 * Register all validation hooks
 */
export function registerValidationHooks(
  registry: { register: (hook: HookDefinition) => void }
): void {
  for (const hook of validationHooks) {
    registry.register(hook);
  }
}
