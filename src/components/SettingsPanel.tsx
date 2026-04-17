import { useState, useEffect } from 'react'
import { useConfigStore } from '../store/configStore'
import type { ModelProvider } from '../types'

const MODEL_OPTIONS: Array<{ value: ModelProvider; label: string; defaultEndpoint: string; defaultModel: string }> = [
  {
    value: 'openai',
    label: 'OpenAI (GPT)',
    defaultEndpoint: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o'
  },
  {
    value: 'minimax',
    label: 'MiniMax',
    defaultEndpoint: 'https://api.minimax.chat/v1',
    defaultModel: 'MiniMax-Text-01'
  },
  {
    value: 'glm',
    label: '智谱 GLM',
    defaultEndpoint: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4'
  },
  {
    value: 'xiaomi',
    label: '小米',
    defaultEndpoint: 'https://api.xiaomi.com/v1',
    defaultModel: 'MiMo-8B'
  },
  {
    value: 'qwen',
    label: '千问 Qwen',
    defaultEndpoint: 'https://dashscope.aliyuncs.com/api/v1',
    defaultModel: 'qwen-turbo'
  }
]

function SettingsPanel() {
  const { config, updateConfig, setApiKey, setModel, setWorkDir } = useConfigStore()
  const [localApiKey, setLocalApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)

  useEffect(() => {
    setLocalApiKey(config.apiKey)
  }, [config.apiKey])

  const handleModelChange = async (provider: ModelProvider) => {
    const option = MODEL_OPTIONS.find(o => o.value === provider)
    if (option) {
      await setModel(provider, option.defaultEndpoint, option.defaultModel)
    }
  }

  const handleSelectWorkDir = async () => {
    const electronAPI = (window as any).electronAPI
    if (electronAPI) {
      const dir = await electronAPI.dialog.selectWorkDir()
      if (dir) {
        await setWorkDir(dir)
      }
    }
  }

  const handleApiKeySave = async () => {
    await setApiKey(localApiKey)
  }

  return (
    <div className="settings-container" style={{ flex: 1, overflow: 'auto' }}>
      <h2 style={{ marginBottom: '24px', fontSize: '20px' }}>Settings</h2>

      {/* API Configuration */}
      <div className="settings-section">
        <div className="settings-title">🔑 API Configuration</div>

        <div className="settings-field">
          <label className="settings-label">Model Provider</label>
          <select
            className="settings-select"
            value={config.model}
            onChange={(e) => handleModelChange(e.target.value as ModelProvider)}
          >
            {MODEL_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="settings-field">
          <label className="settings-label">API Endpoint</label>
          <input
            type="text"
            className="settings-input"
            value={config.modelEndpoint}
            onChange={(e) => updateConfig({ modelEndpoint: e.target.value })}
            placeholder="https://api.openai.com/v1"
          />
        </div>

        <div className="settings-field">
          <label className="settings-label">Model Name</label>
          <input
            type="text"
            className="settings-input"
            value={config.modelName}
            onChange={(e) => updateConfig({ modelName: e.target.value })}
            placeholder="gpt-4o"
          />
        </div>

        <div className="settings-field">
          <label className="settings-label">API Key</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type={showApiKey ? 'text' : 'password'}
              className="settings-input"
              value={localApiKey}
              onChange={(e) => setLocalApiKey(e.target.value)}
              placeholder="Enter your API key"
              style={{ flex: 1 }}
            />
            <button
              className="btn-secondary"
              onClick={() => setShowApiKey(!showApiKey)}
              style={{ padding: '8px 12px' }}
            >
              {showApiKey ? '🙈' : '👁'}
            </button>
            <button
              className="btn-primary"
              onClick={handleApiKeySave}
              style={{ padding: '8px 16px' }}
            >
              Save
            </button>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Your API key is stored locally and never sent to any third party
          </div>
        </div>
      </div>

      {/* Working Directory */}
      <div className="settings-section">
        <div className="settings-title">📁 Working Directory</div>

        <div className="settings-field">
          <label className="settings-label">Project Directory</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              className="settings-input"
              value={config.workDir}
              readOnly
              placeholder="Select a directory..."
              style={{ flex: 1 }}
            />
            <button
              className="btn-secondary"
              onClick={handleSelectWorkDir}
              style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}
            >
              Browse...
            </button>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            All file operations will be restricted to this directory
          </div>
        </div>
      </div>

      {/* Context Settings */}
      <div className="settings-section">
        <div className="settings-title">🧠 Context Settings</div>

        <div className="settings-field">
          <label className="settings-label">Context Window (tokens)</label>
          <input
            type="number"
            className="settings-input"
            value={config.contextWindow}
            onChange={(e) => updateConfig({ contextWindow: parseInt(e.target.value) || 128000 })}
            min={10000}
            max={1000000}
          />
        </div>
      </div>

      {/* Risk Confirmation */}
      <div className="settings-section">
        <div className="settings-title">⚠️ Risk Confirmation</div>

        <div className="settings-field">
          <div className="settings-row">
            <input
              type="checkbox"
              id="confirmMedium"
              checked={config.riskConfirmation.medium}
              onChange={(e) => updateConfig({
                riskConfirmation: { ...config.riskConfirmation, medium: e.target.checked }
              })}
            />
            <label htmlFor="confirmMedium">
              Confirm medium-risk operations (file write, append)
            </label>
          </div>
        </div>

        <div className="settings-field">
          <div className="settings-row">
            <input
              type="checkbox"
              id="confirmHigh"
              checked={config.riskConfirmation.high}
              onChange={(e) => updateConfig({
                riskConfirmation: { ...config.riskConfirmation, high: e.target.checked }
              })}
            />
            <label htmlFor="confirmHigh">
              Confirm high-risk operations (bash commands)
            </label>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="settings-section">
        <div className="settings-title">ℹ️ About</div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          <div><strong>Harness Desktop</strong> v1.0.0</div>
          <div style={{ marginTop: '4px' }}>
            Built on Harness Engineering architecture
          </div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
            Components: System Prompt Engine, Tool Schema, Tool Call Loop,
            Context Manager, Verification Hooks
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPanel
