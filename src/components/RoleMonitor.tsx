/**
 * Role Monitor Component
 * 
 * Real-time monitoring panel for Role-Based Multi-Agent system.
 * Displays role states, message flow, and unattended mode controls.
 */

import React, { useState } from 'react'

const ROLE_COLORS: Record<string, string> = {
  planner: '#f97316',    // orange
  coder: '#06b6d4',      // cyan
  reviewer: '#22c55e',   // green
  executor: '#8b5cf6'    // purple
}

const ROLE_LABELS: Record<string, string> = {
  planner: 'Planner',
  coder: 'Coder',
  reviewer: 'Reviewer',
  executor: 'Executor'
}

type RoleStatus = 'idle' | 'running' | 'completed' | 'failed'

interface RoleState {
  status: RoleStatus
  lastUpdate?: number
}

export default function RoleMonitor() {
  const [roleStates] = useState<Record<string, RoleState>>({
    planner: { status: 'idle' },
    coder: { status: 'idle' },
    reviewer: { status: 'idle' },
    executor: { status: 'idle' }
  })
  const [unattendedActive, setUnattendedActive] = useState(false)

  const toggleUnattended = () => {
    setUnattendedActive(!unattendedActive)
  }

  return (
    <div className="role-monitor" style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Role Monitor</h3>
        <div style={styles.unattendedToggle}>
          <span style={styles.label}>无人值守</span>
          <button
            onClick={toggleUnattended}
            style={{
              ...styles.button,
              backgroundColor: unattendedActive ? '#22c55e' : '#6b7280'
            }}
          >
            {unattendedActive ? '停止' : '启动'}
          </button>
        </div>
      </div>

      <div style={styles.roleGrid}>
        {Object.keys(ROLE_COLORS).map(role => (
          <div
            key={role}
            style={{
              ...styles.roleCard,
              borderColor: ROLE_COLORS[role]
            }}
          >
            <div
              style={{
                ...styles.roleName,
                color: ROLE_COLORS[role]
              }}
            >
              {ROLE_LABELS[role] || role}
            </div>
            <div
              style={{
                ...styles.roleStatus,
                color: getStatusColor(roleStates[role]?.status)
              }}
            >
              {roleStates[role]?.status || 'idle'}
            </div>
          </div>
        ))}
      </div>

      <div style={styles.info}>
        <p style={styles.infoText}>
          角色系统已初始化 | 4个角色就绪
        </p>
        <p style={styles.infoText}>
          无人值守模式: {unattendedActive ? '已启用' : '已禁用'}
        </p>
      </div>
    </div>
  )
}

function getStatusColor(status?: RoleStatus): string {
  switch (status) {
    case 'idle': return '#6b7280'
    case 'running': return '#f97316'
    case 'completed': return '#22c55e'
    case 'failed': return '#ef4444'
    default: return '#9ca3af'
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '16px',
    backgroundColor: '#12121A',
    borderRadius: '8px',
    color: '#F0F0F5',
    fontSize: '13px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600
  },
  unattendedToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  label: {
    fontSize: '12px',
    color: '#A0A0B0'
  },
  button: {
    padding: '4px 12px',
    borderRadius: '4px',
    border: 'none',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer'
  },
  roleGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    marginBottom: '16px'
  },
  roleCard: {
    padding: '12px',
    backgroundColor: '#0A0A0F',
    borderRadius: '6px',
    border: '2px solid'
  },
  roleName: {
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '4px'
  },
  roleStatus: {
    fontSize: '12px',
    textTransform: 'uppercase'
  },
  info: {
    borderTop: '1px solid #2a2a3a',
    paddingTop: '12px'
  },
  infoText: {
    margin: '4px 0',
    fontSize: '12px',
    color: '#A0A0B0'
  }
}