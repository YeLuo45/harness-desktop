import { useAppStore } from '../store/appStore'
import type { Message, ToolResult } from '../types'

interface ChatMessagesProps {
  messages: Message[]
}

function ChatMessages({ messages }: ChatMessagesProps) {
  const { isLoading, verificationWarnings } = useAppStore()

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const renderToolCall = (toolName: string, args: Record<string, unknown>, index: number) => (
    <div key={`tool-${index}`} className="tool-call">
      <div className="tool-call-header">
        <span className="tool-call-name">{toolName}</span>
        <span className={`risk-badge risk-${['file_write', 'file_append'].includes(toolName) ? 'medium' : toolName === 'bash_execute' ? 'high' : 'low'}`}>
          {['file_write', 'file_append'].includes(toolName) ? 'MEDIUM' : toolName === 'bash_execute' ? 'HIGH' : 'LOW'}
        </span>
      </div>
      <div className="tool-call-args">
        {Object.entries(args).map(([key, value]) => (
          <div key={key}>
            <span style={{ color: 'var(--text-muted)' }}>{key}:</span>{' '}
            <span>{typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}</span>
          </div>
        ))}
      </div>
    </div>
  )

  const renderToolResult = (result: ToolResult) => {
    const isSuccess = result.success
    const preview = isSuccess
      ? typeof result.result === 'object'
        ? JSON.stringify(result.result, null, 2).slice(0, 300)
        : String(result.result).slice(0, 300)
      : (result.error || 'Unknown error')

    return (
      <div
        key={`result-${result.toolName}-${result.timestamp}`}
        className="tool-call-result"
        style={{ borderLeftColor: isSuccess ? 'var(--success)' : 'var(--error)' }}
      >
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
          {isSuccess ? '✓ Success' : '✗ Failed'} — {result.toolName}
        </div>
        <pre style={{
          fontSize: '12px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: '150px',
          overflow: 'auto'
        }}>
          {preview}
          {(typeof result.result === 'string' ? result.result : JSON.stringify(result.result)).length > 300 || (preview.length >= 300) ? '...' : ''}
        </pre>
      </div>
    )
  }

  return (
    <div className="chat-messages">
      {messages.map((message) => (
        <div key={message.id} className={`message message-${message.role}`}>
          <div className="message-user">
            <div className="message-avatar">
              {message.role === 'user' ? '👤' : message.role === 'assistant' ? '🤖' : '🔧'}
            </div>
            <div className="message-content">
              {message.role === 'user' ? (
                <div>{message.content}</div>
              ) : (
                <>
                  {/* Show mode indicator if in planning mode */}
                  {message.mode && (
                    <div style={{ marginBottom: '8px' }}>
                      <span className={`mode-indicator ${message.mode}`}>
                        {message.mode === 'planning' ? '📋 Planning Mode' : '⚡ Execution Mode'}
                      </span>
                    </div>
                  )}

                  {/* Show plan if present */}
                  {message.plan && !message.plan.confirmed && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--accent)', marginBottom: '8px' }}>
                        📋 Execution Plan ({message.plan.totalSteps} steps)
                      </div>
                      {message.plan.steps.map((step, idx) => (
                        <div key={step.id} style={{
                          display: 'flex',
                          gap: '8px',
                          marginBottom: '6px',
                          fontSize: '13px'
                        }}>
                          <span style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: 'var(--accent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            flexShrink: 0
                          }}>
                            {idx + 1}
                          </span>
                          <span>
                            <code style={{ color: 'var(--accent)', marginRight: '6px' }}>{step.toolName}</code>
                            {step.description}
                          </span>
                        </div>
                      ))}
                      {message.plan.risks.length > 0 && (
                        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--warning)' }}>
                          ⚠️ Risks: {message.plan.risks.join(', ')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Main content */}
                  <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>

                  {/* Tool calls */}
                  {message.toolCalls && message.toolCalls.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      {message.toolCalls.map((tc, idx) =>
                        renderToolCall(tc.name, tc.arguments, idx)
                      )}
                    </div>
                  )}

                  {/* Tool results */}
                  {message.toolResults && message.toolResults.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      {message.toolResults.map(renderToolResult)}
                    </div>
                  )}
                </>
              )}
              <div className="message-time">{formatTime(message.timestamp)}</div>
            </div>
          </div>
        </div>
      ))}

      {/* Verification warnings */}
      {verificationWarnings.map((warning) => (
        <div
          key={warning.id}
          className={warning.severity === 'error' ? 'verification-error' : 'verification-warning'}
        >
          <strong>{warning.toolName}:</strong> {warning.message}
        </div>
      ))}

      {/* Loading indicator */}
      {isLoading && messages.length > 0 && messages[messages.length - 1].role !== 'assistant' && (
        <div className="message message-assistant">
          <div className="message-user">
            <div className="message-avatar">🤖</div>
            <div className="message-content">
              <div className="loading-indicator">
                <div className="loading-dots">
                  <div className="loading-dot" />
                  <div className="loading-dot" />
                  <div className="loading-dot" />
                </div>
                <span>Thinking...</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatMessages
