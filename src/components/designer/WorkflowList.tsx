// src/components/designer/WorkflowList.tsx
import { useState, useEffect } from 'react';
import { workflowStore } from '../../store/workflowStore';

interface WorkflowSummary {
  id: string;
  name: string;
  nodeCount: number;
  updatedAt: number;
}

interface WorkflowListProps {
  onSelect: (workflowId: string) => void;
  onClose: () => void;
}

export default function WorkflowList({ onSelect, onClose }: WorkflowListProps) {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);

  useEffect(() => {
    setWorkflows(workflowStore.listSummaries());
  }, []);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this workflow?')) {
      workflowStore.delete(id);
      setWorkflows(workflowStore.listSummaries());
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '600px',
          maxHeight: '80vh',
          background: '#1A1A1A',
          border: '1px solid #3A3A3A',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #3A3A3A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#252525',
          }}
        >
          <div>
            <h3 style={{ margin: 0, color: '#E0E0E0', fontSize: '18px' }}>
              Saved Workflows
            </h3>
            <p style={{ margin: '4px 0 0', color: '#888', fontSize: '13px' }}>
              {workflows.length} workflow{workflows.length !== 1 ? 's' : ''} saved
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              fontSize: '22px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* List */}
        <div style={{ padding: '16px', maxHeight: '400px', overflowY: 'auto' }}>
          {workflows.length === 0 ? (
            <div
              style={{
                padding: '40px',
                textAlign: 'center',
                color: '#666',
              }}
            >
              <p style={{ margin: '0 0 8px', fontSize: '16px' }}>📋</p>
              <p style={{ margin: 0 }}>No saved workflows yet</p>
              <p style={{ margin: '8px 0 0', fontSize: '13px' }}>
                Create a workflow and save it to see it here
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {workflows.map(w => (
                <div
                  key={w.id}
                  onClick={() => onSelect(w.id)}
                  style={{
                    padding: '16px 18px',
                    background: '#252525',
                    border: '1px solid #3A3A3A',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    transition: 'border-color 0.2s, background 0.2s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = '#4A90D9';
                    (e.currentTarget as HTMLDivElement).style.background = '#2A2A2A';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = '#3A3A3A';
                    (e.currentTarget as HTMLDivElement).style.background = '#252525';
                  }}
                >
                  <span style={{ fontSize: '28px' }}>📁</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#E0E0E0', fontSize: '15px', fontWeight: 500 }}>
                      {w.name}
                    </div>
                    <div style={{ color: '#888', fontSize: '12px', marginTop: '3px' }}>
                      {w.nodeCount} node{w.nodeCount !== 1 ? 's' : ''} • Updated {formatDate(w.updatedAt)}
                    </div>
                  </div>
                  <button
                    onClick={e => handleDelete(e, w.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#666',
                      fontSize: '16px',
                      cursor: 'pointer',
                      padding: '4px 8px',
                    }}
                    title="Delete workflow"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}