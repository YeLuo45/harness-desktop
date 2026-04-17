import { useConfigStore } from '../store/configStore'

interface WelcomeScreenProps {
  onStart: () => void
}

function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  const { config } = useConfigStore()

  const isConfigured = config.apiKey && config.model

  const examplePrompts = [
    'Read the package.json file and explain the project structure',
    'List all TypeScript files in the src directory',
    'Search for TODO comments in the codebase',
    'Create a simple hello world script'
  ]

  return (
    <div className="empty-state">
      <div className="empty-state-icon">⚡</div>
      <div className="empty-state-title">Welcome to Harness Desktop</div>
      <div className="empty-state-desc">
        {isConfigured
          ? 'Your AI programming assistant is ready. Ask me anything about your project.'
          : 'Configure your API key in Settings to get started.'}
      </div>

      {isConfigured && (
        <div style={{ marginTop: '32px', textAlign: 'left', maxWidth: '500px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Try these examples:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {examplePrompts.map((prompt, idx) => (
              <button
                key={idx}
                className="btn-secondary"
                onClick={onStart}
                style={{
                  textAlign: 'left',
                  padding: '10px 14px',
                  fontSize: '13px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px'
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{
        marginTop: '48px',
        padding: '16px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        maxWidth: '500px'
      }}>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
          Available Tools (MVP)
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '8px',
          fontSize: '12px'
        }}>
          {[
            { name: 'file_read', desc: 'Read files' },
            { name: 'file_write', desc: 'Write files' },
            { name: 'dir_list', desc: 'List directories' },
            { name: 'bash_execute', desc: 'Run commands' },
            { name: 'grep_search', desc: 'Search in files' },
            { name: 'glob', desc: 'Find files' }
          ].map(tool => (
            <div key={tool.name} style={{
              padding: '6px 10px',
              background: 'var(--bg-tertiary)',
              borderRadius: '4px'
            }}>
              <code style={{ color: 'var(--accent)', fontSize: '11px' }}>{tool.name}</code>
              <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '2px' }}>
                {tool.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default WelcomeScreen
