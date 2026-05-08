import { useState } from 'react'
import type { ExecutionPlan } from '../types'

interface PlanViewProps {
  plan: ExecutionPlan
  onConfirm: () => void
  onCancel: () => void
  onAbort?: () => void  // Abort execution mid-way
  isExecuting?: boolean  // Whether plan is currently executing
}

function PlanView({ plan, onConfirm, onCancel, onAbort, isExecuting }: PlanViewProps) {
  const [expandedWarnings, setExpandedWarnings] = useState<Set<string>>(new Set())

  const getStepStatusClass = (status: string) => {
    switch (status) {
      case 'completed': return 'completed'
      case 'executing': return 'executing'
      case 'failed': return 'failed'
      case 'skipped': return 'skipped'
      default: return 'pending'
    }
  }

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✓'
      case 'executing': return '⟳'
      case 'failed': return '✗'
      case 'skipped': return '○'
      default: return '○'
    }
  }

  const getVerificationIcon = (verificationStatus?: string) => {
    switch (verificationStatus) {
      case 'passed': return '✓'
      case 'warning': return '⚠'
      case 'failed': return '✗'
      default: return null
    }
  }

  const getVerificationClass = (verificationStatus?: string) => {
    switch (verificationStatus) {
      case 'passed': return 'verification-passed'
      case 'warning': return 'verification-warning'
      case 'failed': return 'verification-failed'
      default: return ''
    }
  }

  const toggleWarnings = (stepId: string) => {
    setExpandedWarnings(prev => {
      const next = new Set(prev)
      if (next.has(stepId)) {
        next.delete(stepId)
      } else {
        next.add(stepId)
      }
      return next
    })
  }

  // Calculate verification summary
  const verificationSummary = {
    total: plan.steps.length,
    passed: plan.steps.filter(s => s.verificationStatus === 'passed').length,
    warnings: plan.steps.filter(s => s.verificationStatus === 'warning').length,
    failed: plan.steps.filter(s => s.verificationStatus === 'failed').length
  }

  return (
    <div className="plan-container" style={{ margin: '0 20px 16px' }}>
      <div className="plan-header">
        📋 Execution Plan — {plan.taskDescription}
      </div>

      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
        {plan.totalSteps} step(s) required
        {plan.risks.length > 0 && (
          <span style={{ color: 'var(--warning)', marginLeft: '12px' }}>
            ⚠️ {plan.risks.length} risk(s) identified
          </span>
        )}
        {isExecuting && (
          <span style={{ marginLeft: '12px' }}>
            | <span style={{ color: 'var(--success)' }}>{verificationSummary.passed} passed</span>
            {verificationSummary.warnings > 0 && <span style={{ color: 'var(--warning)' }}>, {verificationSummary.warnings} warnings</span>}
            {verificationSummary.failed > 0 && <span style={{ color: 'var(--error)' }}>, {verificationSummary.failed} failed</span>}
          </span>
        )}
      </div>

      <div>
        {plan.steps.map((step, index) => (
          <div key={step.id} className="plan-step">
            <div className="plan-step-number" style={{
              background: step.status === 'completed' ? 'var(--success)' :
                         step.status === 'failed' ? 'var(--error)' :
                         step.status === 'executing' ? 'var(--accent)' :
                         'var(--bg-tertiary)'
            }}>
              {getStepStatusIcon(step.status)}
            </div>
            <div className="plan-step-content">
              <div className="plan-step-tool" style={{ marginBottom: '4px' }}>
                {step.toolName}
                <span className={`risk-badge risk-${step.riskLevel}`} style={{ marginLeft: '8px' }}>
                  {step.riskLevel}
                </span>
                {step.verificationStatus && (
                  <span
                    className={`verification-badge ${getVerificationClass(step.verificationStatus)}`}
                    title={step.verificationMessage || `Verification ${step.verificationStatus}`}
                    style={{ marginLeft: '8px', cursor: 'pointer' }}
                    onClick={() => step.warnings && step.warnings.length > 0 && toggleWarnings(step.id)}
                  >
                    {getVerificationIcon(step.verificationStatus)}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {step.description}
              </div>
              {Object.keys(step.arguments).length > 0 && (
                <div className="tool-call-args" style={{ marginTop: '6px', fontSize: '11px' }}>
                  {Object.entries(step.arguments).slice(0, 3).map(([key, value]) => (
                    <div key={key}>
                      <span style={{ color: 'var(--text-muted)' }}>{key}:</span>{' '}
                      <span>{String(value).slice(0, 50)}{String(value).length > 50 ? '...' : ''}</span>
                    </div>
                  ))}
                </div>
              )}
              {step.error && (
                <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--error)' }}>
                  Error: {step.error}
                </div>
              )}
              {/* Expandable warnings */}
              {step.warnings && step.warnings.length > 0 && (
                <div style={{ marginTop: '6px' }}>
                  <div
                    style={{ fontSize: '11px', color: 'var(--warning)', cursor: 'pointer' }}
                    onClick={() => toggleWarnings(step.id)}
                  >
                    {expandedWarnings.has(step.id) ? '▼' : '▶'} {step.warnings.length} warning(s)
                  </div>
                  {expandedWarnings.has(step.id) && (
                    <div style={{ marginTop: '4px', paddingLeft: '12px' }}>
                      {step.warnings.map((w, i) => (
                        <div key={i} style={{ fontSize: '11px', color: 'var(--warning)', marginBottom: '2px' }}>
                          ⚠ {w}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {plan.risks.length > 0 && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: 'rgba(255, 152, 0, 0.1)',
          borderRadius: '6px',
          border: '1px solid var(--warning)'
        }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--warning)', marginBottom: '8px' }}>
            ⚠️ Risk Assessment
          </div>
          <ul style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, paddingLeft: '20px' }}>
            {plan.risks.map((risk, idx) => (
              <li key={idx}>{risk}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="plan-confirm-bar">
        {!isExecuting ? (
          <>
            <button
              className="btn-primary"
              onClick={onConfirm}
              disabled={plan.steps.some(s => s.status === 'executing')}
              style={{ flex: 1 }}
            >
              ✓ Confirm & Execute
            </button>
            <button
              className="btn-secondary"
              onClick={onCancel}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              className="btn-danger"
              onClick={onAbort}
              style={{ flex: 1 }}
            >
              ■ Abort Execution
            </button>
            <div style={{ flex: 1, textAlign: 'center', padding: '10px', color: 'var(--text-secondary)' }}>
              Executing... {plan.steps.filter(s => s.status === 'completed').length}/{plan.steps.length} steps
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default PlanView
