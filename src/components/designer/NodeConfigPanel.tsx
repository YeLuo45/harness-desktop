// src/components/designer/NodeConfigPanel.tsx
import { useState, useEffect, useCallback } from 'react';
import { PhaseNodeData, PhaseType, PHASE_TYPE_META } from '../../types/workflow';

interface NodeConfigPanelProps {
  nodeId: string;
  data: PhaseNodeData;
  onUpdate: (nodeId: string, data: Partial<PhaseNodeData>) => void;
  onClose: () => void;
}

const PHASE_TYPES: PhaseType[] = ['planning', 'development', 'review', 'execution', 'deployment', 'custom'];

export default function NodeConfigPanel({ nodeId, data, onUpdate, onClose }: NodeConfigPanelProps) {
  const [formData, setFormData] = useState<PhaseNodeData>(data);

  useEffect(() => {
    setFormData(data);
  }, [data]);

  const handleChange = useCallback((field: keyof PhaseNodeData, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(() => {
    onUpdate(nodeId, formData);
    onClose();
  }, [nodeId, formData, onUpdate, onClose]);

  const meta = PHASE_TYPE_META[formData.phaseType] || PHASE_TYPE_META.custom;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '320px',
        height: '100vh',
        background: '#1A1A1A',
        borderLeft: '1px solid #3A3A3A',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        boxShadow: '-4px 0 16px rgba(0,0,0,0.3)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #3A3A3A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#252525',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>{meta.icon}</span>
          <span style={{ color: '#E0E0E0', fontSize: '16px', fontWeight: 600 }}>
            Configure Node
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '4px',
          }}
        >
          ✕
        </button>
      </div>

      {/* Form */}
      <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
        {/* Label */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', color: '#B0B0B0', fontSize: '12px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Label
          </label>
          <input
            type="text"
            value={formData.label}
            onChange={e => handleChange('label', e.target.value)}
            style={{
              width: '100%',
              background: '#2A2A2A',
              border: '1px solid #3A3A3A',
              borderRadius: '6px',
              padding: '10px 12px',
              color: '#E0E0E0',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Phase Type */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', color: '#B0B0B0', fontSize: '12px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Phase Type
          </label>
          <select
            value={formData.phaseType}
            onChange={e => handleChange('phaseType', e.target.value as PhaseType)}
            style={{
              width: '100%',
              background: '#2A2A2A',
              border: '1px solid #3A3A3A',
              borderRadius: '6px',
              padding: '10px 12px',
              color: '#E0E0E0',
              fontSize: '14px',
              boxSizing: 'border-box',
              cursor: 'pointer',
            }}
          >
            {PHASE_TYPES.map(type => (
              <option key={type} value={type}>
                {PHASE_TYPE_META[type].icon} {PHASE_TYPE_META[type].label}
              </option>
            ))}
          </select>
        </div>

        {/* Role ID */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', color: '#B0B0B0', fontSize: '12px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Role ID (Optional)
          </label>
          <input
            type="text"
            value={formData.roleId || ''}
            onChange={e => handleChange('roleId', e.target.value)}
            placeholder="e.g., planner, coder, reviewer"
            style={{
              width: '100%',
              background: '#2A2A2A',
              border: '1px solid #3A3A3A',
              borderRadius: '6px',
              padding: '10px 12px',
              color: '#E0E0E0',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Timeout */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', color: '#B0B0B0', fontSize: '12px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Timeout (ms)
          </label>
          <input
            type="number"
            value={formData.timeout || ''}
            onChange={e => handleChange('timeout', parseInt(e.target.value) || undefined)}
            placeholder="0 = no timeout"
            style={{
              width: '100%',
              background: '#2A2A2A',
              border: '1px solid #3A3A3A',
              borderRadius: '6px',
              padding: '10px 12px',
              color: '#E0E0E0',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Retry Count */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', color: '#B0B0B0', fontSize: '12px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Retry Count
          </label>
          <input
            type="number"
            min="0"
            max="10"
            value={formData.retryCount ?? ''}
            onChange={e => handleChange('retryCount', parseInt(e.target.value) || 0)}
            placeholder="0 = no retry"
            style={{
              width: '100%',
              background: '#2A2A2A',
              border: '1px solid #3A3A3A',
              borderRadius: '6px',
              padding: '10px 12px',
              color: '#E0E0E0',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '16px 20px',
          borderTop: '1px solid #3A3A3A',
          display: 'flex',
          gap: '12px',
          background: '#252525',
        }}
      >
        <button
          onClick={onClose}
          style={{
            flex: 1,
            padding: '10px 16px',
            background: '#3A3A3A',
            border: 'none',
            borderRadius: '6px',
            color: '#B0B0B0',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          style={{
            flex: 1,
            padding: '10px 16px',
            background: '#4A90D9',
            border: 'none',
            borderRadius: '6px',
            color: '#FFF',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}