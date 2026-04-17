import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { useConfigStore } from '../store/configStore'

function Sidebar() {
  const { messages, clearMessages, totalTokens, setTotalTokens } = useAppStore()
  const { config } = useConfigStore()
  const [sandboxStatus, setSandboxStatus] = useState<any>(null)

  useEffect(() => {
    const loadSandboxStatus = async () => {
      const electronAPI = (window as any).electronAPI
      if (electronAPI) {
        const status = await electronAPI.sandbox.getStatus()
        setSandboxStatus(status)
      }
    }
    loadSandboxStatus()
  }, [])

  const handleSelectWorkDir = async () => {
    const electronAPI = (window as any).electronAPI
    if (electronAPI) {
      const dir = await electronAPI.dialog.selectWorkDir()
      if (dir) {
        // Reload sandbox status
        const status = await electronAPI.sandbox.getStatus()
        setSandboxStatus(status)
      }
    }
  }

  const contextUsage = config.contextWindow > 0
    ? Math.round((totalTokens / config.contextWindow) * 100)
    : 0

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-section-title">Mode</div>
        <div className="mode-indicator execution">
          ⚡ Execution Mode
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">Working Directory</div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', wordBreak: 'break-all' }}>
          {config.workDir || 'Not set'}
        </div>
        <button
          className="btn-secondary"
          style={{ width: '100%', fontSize: '12px', padding: '6px 10px' }}
          onClick={handleSelectWorkDir}
        >
          Change Directory
        </button>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">Context</div>
        <div style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span>Tokens</span>
            <span>{totalTokens.toLocaleString()} / {config.contextWindow.toLocaleString()}</span>
          </div>
          <div style={{
            height: '4px',
            background: 'var(--bg-primary)',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${Math.min(contextUsage, 100)}%`,
              height: '100%',
              background: contextUsage > 80 ? 'var(--warning)' : 'var(--accent)',
              transition: 'width 0.3s'
            }} />
          </div>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {messages.length} messages in context
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">Sandbox Status</div>
        {sandboxStatus ? (
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: sandboxStatus.initialized ? 'var(--success)' : 'var(--error)'
              }} />
              {sandboxStatus.initialized ? 'Active' : 'Inactive'}
            </div>
            <div style={{ color: 'var(--text-muted)' }}>
              {sandboxStatus.dangerousCommandsCount || 0} protected commands
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading...</div>
        )}
      </div>

      <div className="sidebar-section" style={{ marginTop: 'auto' }}>
        <button
          className="btn-secondary"
          style={{ width: '100%', fontSize: '12px', padding: '6px 10px' }}
          onClick={() => {
            if (confirm('Clear all messages?')) {
              clearMessages()
            }
          }}
        >
          Clear Conversation
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
