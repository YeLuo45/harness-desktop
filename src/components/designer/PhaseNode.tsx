// src/components/designer/PhaseNode.tsx
import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { PhaseNodeData, PHASE_TYPE_META } from '../../types/workflow';

interface PhaseNodeProps extends NodeProps {
  data: PhaseNodeData;
}

const PhaseNode = memo(({ data, selected }: PhaseNodeProps) => {
  const meta = PHASE_TYPE_META[data.phaseType] || PHASE_TYPE_META.custom;
  
  return (
    <div
      style={{
        background: '#1E1E1E',
        border: selected ? '2px solid #4A90D9' : '1px solid #3A3A3A',
        borderRadius: '8px',
        padding: '12px 16px',
        minWidth: '140px',
        boxShadow: selected ? '0 0 12px rgba(74, 144, 217, 0.4)' : '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '18px' }}>{meta.icon}</span>
        <div>
          <div style={{ 
            fontSize: '12px', 
            color: meta.color, 
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {meta.label}
          </div>
          <div style={{ 
            fontSize: '14px', 
            color: '#E0E0E0',
            fontWeight: 500,
            marginTop: '2px'
          }}>
            {data.label}
          </div>
        </div>
      </div>
      
      {(data.timeout || data.retryCount) && (
        <div style={{ 
          marginTop: '8px', 
          fontSize: '11px', 
          color: '#888',
          display: 'flex',
          gap: '8px'
        }}>
          {data.timeout && <span>⏱ {data.timeout}ms</span>}
          {data.retryCount !== undefined && data.retryCount > 0 && (
            <span>🔁 {data.retryCount}x</span>
          )}
        </div>
      )}
      
      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
    </div>
  );
});

PhaseNode.displayName = 'PhaseNode';

export default PhaseNode;