// src/components/designer/NodePalette.tsx
import { useState, useCallback } from 'react';
import { PhaseType, PHASE_TYPE_META } from '../../types/workflow';

interface NodePaletteProps {
  onDragStart: (phaseType: PhaseType) => void;
}

const PHASE_TYPES: PhaseType[] = ['planning', 'development', 'review', 'execution', 'deployment', 'custom'];

export default function NodePalette({ onDragStart }: NodePaletteProps) {
  const [collapsed, setCollapsed] = useState(false);

  const handleDragStart = useCallback((e: React.DragEvent, phaseType: PhaseType) => {
    e.dataTransfer.setData('application/reactflow', phaseType);
    e.dataTransfer.effectAllowed = 'move';
    onDragStart(phaseType);
  }, [onDragStart]);

  if (collapsed) {
    return (
      <div
        style={{
          position: 'absolute',
          left: '10px',
          top: '60px',
          width: '48px',
          height: '48px',
          background: '#252525',
          border: '1px solid #3A3A3A',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 10,
        }}
        onClick={() => setCollapsed(false)}
        title="Expand Node Palette"
      >
        <span style={{ fontSize: '20px', color: '#B0B0B0' }}>☰</span>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: '10px',
        top: '60px',
        width: '200px',
        background: '#252525',
        border: '1px solid #3A3A3A',
        borderRadius: '8px',
        overflow: 'hidden',
        zIndex: 10,
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid #3A3A3A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#1E1E1E',
        }}
      >
        <span style={{ color: '#E0E0E0', fontSize: '13px', fontWeight: 600 }}>
          Phase Types
        </span>
        <button
          onClick={() => setCollapsed(true)}
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            fontSize: '14px',
            cursor: 'pointer',
            padding: '2px',
          }}
          title="Collapse"
        >
          ✕
        </button>
      </div>

      {/* Phase Type Cards */}
      <div style={{ padding: '8px' }}>
        {PHASE_TYPES.map(type => {
          const meta = PHASE_TYPE_META[type];
          return (
            <div
              key={type}
              draggable
              onDragStart={e => handleDragStart(e, type)}
              style={{
                padding: '10px 12px',
                marginBottom: '6px',
                background: '#2A2A2A',
                border: '1px solid #3A3A3A',
                borderRadius: '6px',
                cursor: 'grab',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'border-color 0.2s, background 0.2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = meta.color;
                (e.currentTarget as HTMLDivElement).style.background = '#333';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = '#3A3A3A';
                (e.currentTarget as HTMLDivElement).style.background = '#2A2A2A';
              }}
            >
              <span style={{ fontSize: '18px' }}>{meta.icon}</span>
              <div>
                <div style={{ 
                  color: '#E0E0E0', 
                  fontSize: '13px', 
                  fontWeight: 500 
                }}>
                  {meta.label}
                </div>
                <div style={{ 
                  color: '#888', 
                  fontSize: '11px',
                  marginTop: '1px'
                }}>
                  Drag to add
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hint */}
      <div
        style={{
          padding: '10px 14px',
          borderTop: '1px solid #3A3A3A',
          background: '#1E1E1E',
        }}
      >
        <span style={{ color: '#666', fontSize: '11px' }}>
          💡 Drag nodes to canvas
        </span>
      </div>
    </div>
  );
}