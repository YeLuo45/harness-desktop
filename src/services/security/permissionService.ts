import { Permission, Role, User, Delegation, BUILT_IN_ROLES } from './securityTypes'

const STORAGE_KEY_ROLES = 'security_roles'
const STORAGE_KEY_USERS = 'security_users'
const STORAGE_KEY_DELEGATIONS = 'security_delegations'

const generateId = (): string => Math.random().toString(36).substring(2, 15)

export class PermissionService {
  private roles: Map<string, Role> = new Map()
  private users: Map<string, User> = new Map()
  private delegations: Map<string, Delegation> = new Map()

  constructor() {
    this.loadFromStorage()
    this.initBuiltInRoles()
  }

  private loadFromStorage(): void {
    try {
      const rolesData = localStorage.getItem(STORAGE_KEY_ROLES)
      if (rolesData) {
        const roles = JSON.parse(rolesData)
        roles.forEach((r: Role) => this.roles.set(r.id, r))
      }

      const usersData = localStorage.getItem(STORAGE_KEY_USERS)
      if (usersData) {
        const users = JSON.parse(usersData)
        users.forEach((u: User) => this.users.set(u.id, u))
      }

      const delegationsData = localStorage.getItem(STORAGE_KEY_DELEGATIONS)
      if (delegationsData) {
        const delegations = JSON.parse(delegationsData)
        delegations.forEach((d: Delegation) => this.delegations.set(d.id, d))
      }
    } catch (e) {
      console.warn('Failed to load security data from storage:', e)
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY_ROLES, JSON.stringify(Array.from(this.roles.values())))
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(Array.from(this.users.values())))
      localStorage.setItem(STORAGE_KEY_DELEGATIONS, JSON.stringify(Array.from(this.delegations.values())))
    } catch (e) {
      console.warn('Failed to save security data to storage:', e)
    }
  }

  private initBuiltInRoles(): void {
    if (this.roles.size === 0) {
      BUILT_IN_ROLES.forEach(role => {
        const id = generateId()
        this.roles.set(id, { ...role, id })
      })
      this.saveToStorage()
    }
  }

  // Role management
  createRole(name: string, type: string, permissions: Permission[], description?: string): Role {
    const role: Role = {
      id: generateId(),
      name,
      type: type as any,
      permissions,
      description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isSystem: false
    }
    this.roles.set(role.id, role)
    this.saveToStorage()
    return role
  }

  getRole(id: string): Role | undefined {
    return this.roles.get(id)
  }

  getAllRoles(): Role[] {
    return Array.from(this.roles.values())
  }

  updateRole(id: string, updates: Partial<Role>): Role | undefined {
    const role = this.roles.get(id)
    if (!role || role.isSystem) return undefined

    const updated = { ...role, ...updates, id, updatedAt: Date.now() }
    this.roles.set(id, updated)
    this.saveToStorage()
    return updated
  }

  deleteRole(id: string): boolean {
    const role = this.roles.get(id)
    if (!role || role.isSystem) return false
    return this.roles.delete(id)
  }

  // User management
  createUser(username: string, email?: string): User {
    const user: User = {
      id: generateId(),
      username,
      email,
      roles: [],
      isActive: true,
      createdAt: Date.now()
    }
    this.users.set(user.id, user)
    this.saveToStorage()
    return user
  }

  getUser(id: string): User | undefined {
    return this.users.get(id)
  }

  getAllUsers(): User[] {
    return Array.from(this.users.values())
  }

  assignRole(userId: string, roleId: string): boolean {
    const user = this.users.get(userId)
    const role = this.roles.get(roleId)
    if (!user || !role) return false

    if (!user.roles.includes(roleId)) {
      user.roles.push(roleId)
      this.users.set(userId, user)
      this.saveToStorage()
    }
    return true
  }

  removeRole(userId: string, roleId: string): boolean {
    const user = this.users.get(userId)
    if (!user) return false

    const idx = user.roles.indexOf(roleId)
    if (idx >= 0) {
      user.roles.splice(idx, 1)
      this.users.set(userId, user)
      this.saveToStorage()
      return true
    }
    return false
  }

  // Permission checking
  async checkPermission(userId: string, permission: Permission): Promise<boolean> {
    const user = this.users.get(userId)
    if (!user || !user.isActive) return false

    // Check user's direct roles
    for (const roleId of user.roles) {
      const role = this.roles.get(roleId)
      if (role && role.permissions.includes(permission)) {
        return true
      }
      // Check if role has admin permission
      if (role && role.permissions.includes(Permission.ADMIN)) {
        return true
      }
    }

    // Check delegations
    const delegations = this.getActiveDelegations(userId)
    for (const delegation of delegations) {
      if (delegation.permission === permission) {
        return true
      }
    }

    return false
  }

  // Delegation
  delegatePermission(
    delegatorId: string,
    delegateId: string,
    permission: Permission,
    expiresIn: number
  ): Delegation {
    const delegation: Delegation = {
      id: generateId(),
      delegatorId,
      delegateId,
      permission,
      grantedAt: Date.now(),
      expiresAt: Date.now() + expiresIn
    }
    this.delegations.set(delegation.id, delegation)
    this.saveToStorage()
    return delegation
  }

  revokeDelegation(delegationId: string): boolean {
    const delegation = this.delegations.get(delegationId)
    if (!delegation) return false

    delegation.revokedAt = Date.now()
    this.delegations.set(delegationId, delegation)
    this.saveToStorage()
    return true
  }

  getActiveDelegations(userId: string): Delegation[] {
    const now = Date.now()
    return Array.from(this.delegations.values()).filter(
      d => d.delegateId === userId &&
           d.expiresAt > now &&
           !d.revokedAt
    )
  }

  // Batch permission check
  async checkPermissions(userId: string, permissions: Permission[]): Promise<Map<Permission, boolean>> {
    const results = new Map<Permission, boolean>()
    for (const p of permissions) {
      results.set(p, await this.checkPermission(userId, p))
    }
    return results
  }
}

export const permissionService = new PermissionService()
