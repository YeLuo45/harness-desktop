import { useMemo } from 'react'
import type { SubAgent, SubTask } from '../types'

export interface CollaborationViewProps {
  agents: Array<{
    id: string
    name: string
    status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
    taskCount: number
    completedTaskCount: number
  }>
  activeTasks: Array<{
    id: string
    description: string
    agentName: string
    status: 'idle' | 'running' | 'completed' | 'failed'
  }>
  onAgentSelect?: (agentId: string) => void
  onTaskSelect?: (taskId: string) => void
}

function CollaborationView({ agents, activeTasks, onAgentSelect, onTaskSelect }: CollaborationViewProps) {
  const getStatusIcon = (status: CollaborationViewProps['agents'][0]['status']): string => {
    switch (status) {
      case 'idle': return '○'
      case 'running': return '◐'
      case 'completed': return '●'
      case 'failed': return '✗'
      case 'cancelled': return '◌'
      default: return '○'
    }
  }

  const renderAgentCard = (agent: CollaborationViewProps['agents'][0]) => {
    return {
      id: agent.id,
      name: agent.name,
      status: agent.status,
      progress: `${agent.completedTaskCount}/${agent.taskCount}`
    }
  }

  const renderTaskItem = (task: CollaborationViewProps['activeTasks'][0]) => {
    const statusSymbol = task.status === 'completed' ? '✓' : task.status === 'running' ? '▶' : '○'
    return `${statusSymbol} [${task.agentName}] ${task.description}`
  }

  const totalTasks = useMemo(() => agents.reduce((sum, a) => sum + a.taskCount, 0), [agents])
  const completedTasks = useMemo(() => agents.reduce((sum, a) => sum + a.completedTaskCount, 0), [agents])
  const overallProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

  const runningAgents = agents.filter(a => a.status === 'running').length
  const completedAgents = agents.filter(a => a.status === 'completed').length

  const summary = runningAgents > 0 || completedAgents > 0
    ? `${runningAgents} agents running, ${completedAgents} agents completed`
    : 'No active collaboration'

  return (
    <div className="collaboration-container" style={{ margin: '0 20px 16px' }}>
      <div className="collaboration-header">
        🔄 Multi-Agent Collaboration
      </div>

      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
        Overall Progress: {overallProgress.toFixed(1)}% ({completedTasks}/{totalTasks} tasks)
        <span style={{ marginLeft: '12px' }}>|</span>
        <span style={{ marginLeft: '12px' }}>{summary}</span>
      </div>

      {/* Agent Cards */}
      <div className="agent-cards" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {agents.map(agent => {
          const card = renderAgentCard(agent)
          return (
            <div
              key={agent.id}
              className={`agent-card agent-${agent.status}`}
              style={{
                padding: '12px',
                borderRadius: '8px',
                background: 'var(--bg-tertiary)',
                border: `1px solid ${agent.status === 'running' ? 'var(--accent)' : 'transparent'}`,
                minWidth: '150px',
                cursor: onAgentSelect ? 'pointer' : 'default'
              }}
              onClick={() => onAgentSelect?.(agent.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '16px' }}>{getStatusIcon(agent.status)}</span>
                <span style={{ fontWeight: '600' }}>{agent.name}</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Progress: {card.progress}
              </div>
              <div style={{
                marginTop: '8px',
                height: '4px',
                borderRadius: '2px',
                background: 'var(--bg-primary)',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: agent.taskCount > 0 ? `${(agent.completedTaskCount / agent.taskCount) * 100}%` : '0%',
                  background: agent.status === 'failed' ? 'var(--error)' : 'var(--success)',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Active Tasks */}
      {activeTasks.length > 0 && (
        <div className="active-tasks" style={{ marginTop: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>
            Active Tasks
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {activeTasks.map(task => (
              <div
                key={task.id}
                className={`task-item task-${task.status}`}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'var(--bg-secondary)',
                  fontSize: '13px',
                  cursor: onTaskSelect ? 'pointer' : 'default',
                  borderLeft: `3px solid ${task.status === 'completed' ? 'var(--success)' : task.status === 'running' ? 'var(--accent)' : 'var(--text-muted)'}`
                }}
                onClick={() => onTaskSelect?.(task.id)}
              >
                {renderTaskItem(task)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {agents.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '32px',
          color: 'var(--text-muted)'
        }}>
          No active agents. Start a collaboration to see status here.
        </div>
      )}
    </div>
  )
}

export default CollaborationView

// Helper function to convert SubAgent to CollaborationView format
export function agentsToCollaborationView(agents: SubAgent[]): CollaborationViewProps['agents'] {
  return agents.map(agent => ({
    id: agent.id,
    name: agent.name,
    status: agent.status,
    taskCount: agent.tasks.length,
    completedTaskCount: agent.tasks.filter(t => t.status === 'completed').length
  }))
}

// Helper function to get active tasks
export function getActiveTasks(agents: SubAgent[]): CollaborationViewProps['activeTasks'] {
  const activeTasks: CollaborationViewProps['activeTasks'] = []

  for (const agent of agents) {
    for (const task of agent.tasks) {
      if (task.status === 'running' || task.status === 'idle') {
        activeTasks.push({
          id: task.id,
          description: task.description,
          agentName: agent.name,
          status: task.status
        })
      }
    }
  }

  return activeTasks
}
