import type { ToolResult, VerificationConfig, VerificationReport, VerificationLevel, ValidationResult } from '../types'

export interface VerificationResult {
  passed: boolean
  warnings: string[]
  errors: string[]
  retryRecommended: boolean
  degradeRecommended: boolean
}

interface VerificationRuleSet {
  file_read: RuleSet
  file_write: RuleSet
  file_append: RuleSet
  dir_list: RuleSet
  bash_execute: RuleSet
  grep_search: RuleSet
  glob: RuleSet
  tool_status: RuleSet
  edit_code: RuleSet
  project_tree: RuleSet
  web_search: RuleSet
  task_plan: RuleSet
}

interface RuleSet {
  critical: Array<(result: ToolResult, config: VerificationConfig) => ValidationResult>
  warnings: Array<(result: ToolResult) => ValidationResult>
}

const pass = (): ValidationResult => ({ passed: true })
const fail = (message: string, severity: 'error' | 'warning' | 'info' = 'error'): ValidationResult => ({
  passed: false,
  message,
  severity
})

export class VerificationHooks {
  private _config: VerificationConfig
  private ruleSets: VerificationRuleSet

  constructor(config: VerificationConfig = { level: 'loose', autoRetry: true, maxRetries: 3, degradeOnFailure: true }) {
    this._config = config
    this.ruleSets = this.buildRuleSets()
  }

  setConfig(config: Partial<VerificationConfig>): void {
    this._config = { ...this._config, ...config }
  }

  getConfig(): VerificationConfig {
    return { ...this._config }
  }

  private buildRuleSets(): VerificationRuleSet {
    return {
      file_read: {
        critical: [
          (r) => r.success ? pass() : fail('File read failed: ' + r.error, 'error'),
          (r, cfg) => {
            const data = r.result as { content?: string; size?: number; lines?: number }
            if (data.size === 0 && data.content !== undefined) {
              return { passed: cfg.level !== 'strict', message: 'File is empty', severity: 'warning' as const }
            }
            return pass()
          },
          (r) => {
            const data = r.result as { size?: number }
            if (data.size && data.size > 10 * 1024 * 1024) {
              return fail('File too large (' + (data.size / 1024 / 1024).toFixed(2) + ' MB). Use selective reading.', 'error')
            }
            return pass()
          }
        ],
        warnings: [
          (r) => {
            const data = r.result as { content?: string }
            if (data.content && /[\x00-\x08\x0E-\x1F]/.test(data.content.slice(0, 1000))) {
              return fail('File may contain binary data', 'warning')
            }
            return pass()
          }
        ]
      },
      file_write: {
        critical: [
          (r) => r.success ? pass() : fail('File write failed: ' + r.error, 'error'),
          (r) => {
            const data = r.result as { path?: string }
            if (data.path && data.path.includes('..')) {
              return fail('Path contains directory traversal', 'error')
            }
            return pass()
          }
        ],
        warnings: [
          (r) => {
            const data = r.result as { bytesWritten?: number }
            if (data.bytesWritten === 0) {
              return fail('File was written but contains no data', 'warning')
            }
            return pass()
          }
        ]
      },
      file_append: {
        critical: [
          (r) => r.success ? pass() : fail('File append failed: ' + r.error, 'error')
        ],
        warnings: []
      },
      dir_list: {
        critical: [
          (r) => r.success ? pass() : fail('Directory listing failed: ' + r.error, 'error')
        ],
        warnings: [
          (r) => {
            const data = r.result as Array<{ name: string; type: string }>
            if (data && data.length > 10000) {
              return fail('Very large directory (' + data.length + ' entries). Results may be truncated.', 'warning')
            }
            return pass()
          }
        ]
      },
      bash_execute: {
        critical: [
          (r) => {
            if (!r.success || (r.result as any)?.timedOut) {
              return fail((r.result as any)?.timedOut ? 'Command timed out' : 'Command failed: ' + r.error, 'error')
            }
            return pass()
          },
          (r) => {
            const stderr = (r.result as any)?.stderr || ''
            if (stderr) {
              const errorPatterns = ['error:', 'Error:', 'ERROR', 'failed', 'Failed', 'exception']
              const hasError = errorPatterns.some(p => stderr.includes(p))
              if (hasError) {
                return fail('stderr contains errors: ' + stderr.slice(0, 200), 'error')
              }
            }
            return pass()
          }
        ],
        warnings: [
          (r) => {
            const exitCode = (r.result as any)?.exitCode
            if (exitCode !== undefined && exitCode !== 0 && r.success) {
              return fail('Command exited with code ' + exitCode, 'warning')
            }
            return pass()
          },
          (r) => {
            const stdout = (r.result as any)?.stdout || ''
            if (stdout.length > 100000) {
              return fail('Large output (>100KB). Consider more specific commands.', 'warning')
            }
            return pass()
          }
        ]
      },
      grep_search: {
        critical: [
          (r) => r.success ? pass() : fail('Search failed: ' + r.error, 'error')
        ],
        warnings: [
          (r) => {
            const data = r.result as { matches?: unknown[]; total?: number }
            if (data.total === 0) {
              return fail('No matches found', 'warning')
            }
            if (data.total && data.total > 1000) {
              return fail('Large result set (' + data.total + ' matches). Consider refining the search.', 'warning')
            }
            return pass()
          }
        ]
      },
      glob: {
        critical: [
          (r) => r.success ? pass() : fail('Glob search failed: ' + r.error, 'error')
        ],
        warnings: [
          (r) => {
            const data = r.result as { matches?: string[]; total?: number }
            if (data.total === 0) {
              return fail('No files matched the pattern', 'warning')
            }
            return pass()
          }
        ]
      },
      tool_status: {
        critical: [
          (r) => r.success ? pass() : fail('Status check failed: ' + r.error, 'error')
        ],
        warnings: []
      },
      edit_code: {
        critical: [
          (r) => r.success ? pass() : fail('Code edit failed: ' + r.error, 'error'),
          (r, cfg) => {
            const data = r.result as { applied?: boolean; patches?: number }
            if (r.success && data.patches !== undefined && data.patches === 0) {
              return { passed: cfg.level !== 'strict', message: 'No patches were applied', severity: 'warning' as const }
            }
            return pass()
          }
        ],
        warnings: [
          (r) => {
            const data = r.result as { conflicts?: string[] }
            if (data.conflicts && data.conflicts.length > 0) {
              return fail('Edit conflicts detected: ' + data.conflicts.join(', '), 'warning')
            }
            return pass()
          }
        ]
      },
      project_tree: {
        critical: [
          (r) => r.success ? pass() : fail('Project tree generation failed: ' + r.error, 'error')
        ],
        warnings: [
          (r) => {
            const data = r.result as { files?: number; depth?: number }
            if (data.files && data.files > 10000) {
              return fail('Large project (' + data.files + ' files). Tree may be truncated.', 'warning')
            }
            return pass()
          }
        ]
      },
      web_search: {
        critical: [
          (r) => r.success ? pass() : fail('Web search failed: ' + r.error, 'error')
        ],
        warnings: [
          (r) => {
            const data = r.result as { results?: unknown[] }
            if (data.results && data.results.length === 0) {
              return fail('No search results returned', 'warning')
            }
            return pass()
          }
        ]
      },
      task_plan: {
        critical: [
          (r) => r.success ? pass() : fail('Task planning failed: ' + r.error, 'error')
        ],
        warnings: [
          (r) => {
            const data = r.result as { tasks?: unknown[] }
            if (data.tasks && data.tasks.length === 0) {
              return fail('No subtasks generated', 'warning')
            }
            return pass()
          }
        ]
      }
    }
  }

  verify(result: ToolResult): VerificationResult {
    if (this._config.level === 'disabled') {
      return {
        passed: true,
        warnings: [],
        errors: [],
        retryRecommended: false,
        degradeRecommended: false
      }
    }

    const warnings: string[] = []
    const errors: string[] = []
    let retryRecommended = false
    let degradeRecommended = false

    const ruleSet = this.ruleSets[result.toolName as keyof VerificationRuleSet]
    if (!ruleSet) {
      if (!result.success) {
        errors.push('Unknown tool failed: ' + result.error)
      }
      return {
        passed: errors.length === 0,
        warnings,
        errors,
        retryRecommended: false,
        degradeRecommended: false
      }
    }

    for (const check of ruleSet.critical) {
      const validation = check(result, this._config)
      if (!validation.passed) {
        if (validation.severity === 'error') {
          errors.push(validation.message || 'Critical check failed')
        } else {
          warnings.push(validation.message || 'Check failed')
        }
      }
    }

    for (const check of ruleSet.warnings) {
      const validation = check(result)
      if (!validation.passed) {
        warnings.push(validation.message || 'Warning')
      }
    }

    if (!result.success && this._config.autoRetry) {
      retryRecommended = true
    }

    if (errors.length > 0 && this._config.degradeOnFailure) {
      degradeRecommended = true
    }

    const passed = errors.length === 0 && (this._config.level !== 'strict' || warnings.length === 0)

    return {
      passed,
      warnings,
      errors,
      retryRecommended,
      degradeRecommended
    }
  }

  verifyBatch(results: ToolResult[]): VerificationReport[] {
    return results.map(result => {
      const verification = this.verify(result)
      return {
        toolName: result.toolName,
        results: [
          ...verification.errors.map(m => ({ passed: false, message: m, severity: 'error' as const })),
          ...verification.warnings.map(m => ({ passed: true, message: m, severity: 'warning' as const }))
        ],
        overallPassed: verification.passed,
        retryRecommended: verification.retryRecommended,
        degradeRecommended: verification.degradeRecommended
      }
    })
  }

  getBatchSummary(results: ToolResult[]): {
    totalTools: number
    passed: number
    failed: number
    warnings: number
    retriesRecommended: number
    degradesRecommended: number
  } {
    const reports = this.verifyBatch(results)

    return {
      totalTools: results.length,
      passed: reports.filter(r => r.overallPassed).length,
      failed: reports.filter(r => !r.overallPassed).length,
      warnings: reports.reduce((sum, r) => sum + r.results.filter(v => v.severity === 'warning').length, 0),
      retriesRecommended: reports.filter(r => r.retryRecommended).length,
      degradesRecommended: reports.filter(r => r.degradeRecommended).length
    }
  }

  formatVerificationMessage(result: VerificationResult): string {
    if (result.passed && result.warnings.length === 0) {
      return ''
    }

    const parts: string[] = []

    if (!result.passed) {
      parts.push('Errors: ' + result.errors.join('; '))
    }

    if (result.warnings.length > 0) {
      parts.push('Warnings: ' + result.warnings.join('; '))
    }

    return parts.join('\n')
  }

  formatBatchReport(reports: VerificationReport[]): string {
    const summary = this.getBatchSummary(reports.map(r => ({ toolName: r.toolName, arguments: {}, result: null, success: r.overallPassed, timestamp: 0 } as any)))

    const lines: string[] = []
    lines.push('Verification Report: ' + summary.passed + '/' + summary.totalTools + ' passed')

    if (summary.warnings > 0) {
      lines.push('' + summary.warnings + ' warning(s)')
    }

    if (summary.retriesRecommended > 0) {
      lines.push('' + summary.retriesRecommended + ' retry(s) recommended')
    }

    if (summary.degradesRecommended > 0) {
      lines.push('' + summary.degradesRecommended + ' degrade(s) recommended')
    }

    const failures = reports.filter(r => !r.overallPassed)
    if (failures.length > 0) {
      lines.push('\nFailures:')
      for (const failure of failures) {
        const errorMsgs = failure.results.filter(r => r.severity === 'error').map(r => r.message)
        if (errorMsgs.length > 0) {
          lines.push('  - ' + failure.toolName + ': ' + errorMsgs.join(', '))
        }
      }
    }

    return lines.join('\n')
  }
}

let verificationHooksInstance: VerificationHooks | null = null

export function getVerificationHooks(): VerificationHooks {
  if (!verificationHooksInstance) {
    verificationHooksInstance = new VerificationHooks()
  }
  return verificationHooksInstance
}

export function initVerificationHooks(config?: VerificationConfig): VerificationHooks {
  verificationHooksInstance = new VerificationHooks(config)
  return verificationHooksInstance
}
