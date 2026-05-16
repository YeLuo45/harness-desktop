// src/components/designer/WorkflowToolbar.tsx
import { useState } from 'react';
import { Workflow } from '../../types/workflow';

interface WorkflowToolbarProps {
  workflowName: string;
  onNew: () => void;
  onSave: (name: string) => void;
  onExecute: () => void;
  onShowList: () => void;
  isExecuting: boolean;
}

export default function WorkflowToolbar({
  workflowName,
  onNew,
  onSave,
  onExecute,
  onShowList,
  isExecuting,
}: WorkflowToolbarProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(workflowName);

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim());
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 20px',
        background: '#1E1E1E',
        borderBottom: '1px solid #3A3A3A',
        gap: '12px',
      }}
    >
      {/* Logo / Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '22px' }}>🔧</span>
        <span style={{ color: '#E0E0E0', fontSize: '16px', fontWeight: 600 }}>
          Workflow Designer
        </span>
      </div>

      {/* Divider */}
      <div style={{ width: '1px', height: '24px', background: '#3A3A3A' }} />

      {/* Workflow Name */}
      {editing ? (
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          autoFocus
          style={{
            background: '#2A2A2A',
            border: '1px solid #4A90D9',
            borderRadius: '4px',
            padding: '6px 10px',
            color: '#E0E0E0',
            fontSize: '14px',
            width: '200px',
          }}
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          style={{
            color: '#B0B0B0',
            fontSize: '14px',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '4px',
          }}
          title="Click to rename"
        >
          {workflowName || 'Untitled Workflow'}
        </span>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {/* New Button */}
        <button
          onClick={onNew}
          disabled={isExecuting}
          style={{
            padding: '8px 14px',
            background: '#2A2A2A',
            border: '1px solid #3A3A3A',
            borderRadius: '6px',
            color: '#B0B0B0',
            fontSize: '13px',
            cursor: isExecuting ? 'not-allowed' : 'pointer',
            opacity: isExecuting ? 0.5 : 1,
          }}
        >
          + New
        </button>

        {/* List Button */}
        <button
          onClick={onShowList}
          disabled={isExecuting}
          style={{
            padding: '8px 14px',
            background: '#2A2A2A',
            border: '1px solid #3A3A3A',
            borderRadius: '6px',
            color: '#B0B0B0',
            fontSize: '13px',
            cursor: isExecuting ? 'not-allowed' : 'pointer',
            opacity: isExecuting ? 0.5 : 1,
          }}
        >
          📋 List
        </button>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={isExecuting}
          style={{
            padding: '8px 14px',
            background: '#2A2A2A',
            border: '1px solid #4A90D9',
            borderRadius: '6px',
            color: '#4A90D9',
            fontSize: '13px',
            cursor: isExecuting ? 'not-allowed' : 'pointer',
            opacity: isExecuting ? 0.5 : 1,
          }}
        >
          💾 Save
        </button>

        {/* Execute Button */}
        <button
          onClick={onExecute}
          disabled={isExecuting}
          style={{
            padding: '8px 18px',
            background: isExecuting ? '#555' : '#52c41a',
            border: 'none',
            borderRadius: '6px',
            color: '#FFF',
            fontSize: '13px',
            fontWeight: 600,
            cursor: isExecuting ? 'not-allowed' : 'pointer',
            opacity: isExecuting ? 0.7 : 1,
          }}
        >
          {isExecuting ? '⚡ Executing...' : '▶ Execute'}
        </button>
      </div>
    </div>
  );
}