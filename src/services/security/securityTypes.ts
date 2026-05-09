// Security Types

export enum Permission {
  AGENT_CREATE = 'agent:create',
  AGENT_DELETE = 'agent:delete',
  AGENT_EXECUTE = 'agent:execute',
  AGENT_READ = 'agent:read',
  WORKFLOW_CREATE = 'workflow:create',
  WORKFLOW_DELETE = 'workflow:delete',
  WORKFLOW_EXECUTE = 'workflow:execute',
  WORKFLOW_READ = 'workflow:read',
  DATA_READ = 'data:read',
  DATA_WRITE = 'data:write',
  DATA_DELETE = 'data:delete',
  MARKETPLACE_READ = 'marketplace:read',
  MARKETPLACE_PUBLISH = 'marketplace:publish',
  ADMIN = 'admin',
  AUDIT_READ = 'audit:read'
}

export enum RoleType {
  ADMIN = 'admin',
  DEVELOPER = 'developer',
  OPERATOR = 'operator',
  VIEWER = 'viewer',
  CUSTOM = 'custom'
}

export interface Role {
  id: string
  name: string
  type: RoleType
  permissions: Permission[]
  description?: string
  createdAt: number
  updatedAt: number
  isSystem: boolean
}

export interface User {
  id: string
  username: string
  email?: string
  roles: string[]
  isActive: boolean
  createdAt: number
  lastLogin?: number
}

export interface Delegation {
  id: string
  delegatorId: string
  delegateId: string
  permission: Permission
  grantedAt: number
  expiresAt: number
  revokedAt?: number
}

export interface AuditLog {
  id: string
  timestamp: number
  userId: string
  username?: string
  action: string
  resource: string
  resourceId?: string
  result: 'success' | 'failure'
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

export interface AuditFilter {
  startTime?: number
  endTime?: number
  userId?: string
  action?: string
  resource?: string
  result?: 'success' | 'failure'
  limit?: number
  offset?: number
}

export interface EncryptionKey {
  id: string
  version: number
  createdAt: number
  expiresAt: number
  isActive: boolean
}

// Built-in roles
export const BUILT_IN_ROLES: Omit<Role, 'id'>[] = [
  {
    name: 'Administrator',
    type: RoleType.ADMIN,
    permissions: Object.values(Permission),
    description: 'Full system access',
    createdAt: 0,
    updatedAt: 0,
    isSystem: true
  },
  {
    name: 'Developer',
    type: RoleType.DEVELOPER,
    permissions: [
      Permission.AGENT_CREATE,
      Permission.AGENT_READ,
      Permission.AGENT_EXECUTE,
      Permission.WORKFLOW_CREATE,
      Permission.WORKFLOW_READ,
      Permission.WORKFLOW_EXECUTE,
      Permission.DATA_READ,
      Permission.DATA_WRITE,
      Permission.MARKETPLACE_READ,
      Permission.MARKETPLACE_PUBLISH
    ],
    description: 'Can create and manage agents and workflows',
    createdAt: 0,
    updatedAt: 0,
    isSystem: true
  },
  {
    name: 'Operator',
    type: RoleType.OPERATOR,
    permissions: [
      Permission.AGENT_READ,
      Permission.AGENT_EXECUTE,
      Permission.WORKFLOW_READ,
      Permission.WORKFLOW_EXECUTE,
      Permission.DATA_READ
    ],
    description: 'Can execute agents and workflows',
    createdAt: 0,
    updatedAt: 0,
    isSystem: true
  },
  {
    name: 'Viewer',
    type: RoleType.VIEWER,
    permissions: [
      Permission.AGENT_READ,
      Permission.WORKFLOW_READ,
      Permission.DATA_READ,
      Permission.MARKETPLACE_READ
    ],
    description: 'Read-only access',
    createdAt: 0,
    updatedAt: 0,
    isSystem: true
  }
]
