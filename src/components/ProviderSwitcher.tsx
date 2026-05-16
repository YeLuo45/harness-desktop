/**
 * Provider Switcher Component
 * 
 * Simple UI for switching between LLM providers.
 */

import { useProviderStore, type ProviderName } from '../store/providerStore'

const providers: ProviderName[] = ['openai', 'anthropic', 'azure', 'google', 'custom']

export function ProviderSwitcher() {
  const currentProvider = useProviderStore((state) => state.currentProvider)
  const setCurrentProvider = useProviderStore((state) => state.setCurrentProvider)

  return (
    <div className="provider-switcher" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '14px', color: '#888' }}>Provider:</span>
      <select
        value={currentProvider}
        onChange={(e) => setCurrentProvider(e.target.value as ProviderName)}
        style={{
          padding: '4px 8px',
          borderRadius: '4px',
          border: '1px solid #444',
          backgroundColor: '#2a2a2a',
          color: '#fff',
          fontSize: '14px',
          cursor: 'pointer'
        }}
      >
        {providers.map((p) => (
          <option key={p} value={p}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </option>
        ))}
      </select>
    </div>
  )
}