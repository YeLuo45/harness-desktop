import type { ExecutionPlan } from '../types'

interface PlanViewProps {
  plan: ExecutionPlan
  onConfirm: () => void
  onCancel: () => void
}

function PlanView({ plan, onConfirm, onCancel }: PlanViewProps) {
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
      </div>
    </div>
  )
}

export default PlanView
