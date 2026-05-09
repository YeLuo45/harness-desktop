/**
 * Trajectory Record Types
 * Inspired by hermes-agent's trajectory system
 */

// 轨迹类型
export type TrajectoryType =
  | 'user_input'
  | 'assistant_response'
  | 'tool_call'
  | 'tool_result'
  | 'plan_step'
  | 'verification'
  | 'error'
  | 'session_start'
  | 'session_end'

// 轨迹记录
export interface TrajectoryRecord {
  id: string
  sessionId: string
  turn: number
  role: 'user' | 'assistant' | 'tool' | 'system'

  // 内容
  content: string
  summary: string

  // 元数据
  timestamp: number
  type: TrajectoryType
  tags: string[]
  associations: string[]

  // 扩展
  metadata?: Record<string, unknown>
}

// 轨迹查询条件
export interface TrajectoryQuery {
  sessionId?: string
  types?: TrajectoryType[]
  tags?: string[]
  timeRange?: {
    start: number
    end: number
  }
  keyword?: string
  limit?: number
  offset?: number
}

// 轨迹查询结果
export interface TrajectoryResult {
  records: TrajectoryRecord[]
  total: number
  hasMore: boolean
}

// 轨迹统计
export interface TrajectoryStats {
  totalRecords: number
  totalSessions: number
  recordsByType: Record<TrajectoryType, number>
  oldestRecord: number
  newestRecord: number
}

// 轨迹事件（创建时不需要 id 和 timestamp）
export type TrajectoryEvent = Omit<TrajectoryRecord, 'id' | 'timestamp'>

/**
 * Create a new TrajectoryRecord with auto-generated id and timestamp
 */
export function createTrajectoryRecord(event: TrajectoryEvent): TrajectoryRecord {
  return {
    ...event,
    id: `traj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    timestamp: Date.now()
  }
}

/**
 * Get trajectory type from role and context
 */
export function inferTrajectoryType(
  role: TrajectoryRecord['role'],
  content: string,
  tags: string[] = []
): TrajectoryType {
  if (role === 'system') return 'session_start'

  // Check for tool-related content
  if (content.includes('"name"') && content.includes('"arguments"')) {
    return 'tool_call'
  }

  if (content.includes('"result"') || content.includes('"success"')) {
    if (tags.includes('error')) return 'error'
    return 'tool_result'
  }

  // Check tags for special types
  if (tags.includes('verification')) return 'verification'
  if (tags.includes('plan_step')) return 'plan_step'

  // Default based on role
  switch (role) {
    case 'user':
      return 'user_input'
    case 'assistant':
      return 'assistant_response'
    case 'tool':
      return tags.includes('error') ? 'error' : 'tool_result'
    default:
      return 'user_input'
  }
}
