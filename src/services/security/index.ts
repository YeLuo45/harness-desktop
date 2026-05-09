// Security - barrel export

export * from './securityTypes'
export { PermissionService, permissionService } from './permissionService'
export { AuditLogger, auditLogger } from './auditLogger'
export { EncryptionService, encryptionService } from './encryptionService'

/*
Quick Start:

import { permissionService, auditLogger, encryptionService, Permission } from './security'

// Create user and assign role
const user = permissionService.createUser('john', 'john@example.com')
const role = permissionService.getAllRoles().find(r => r.type === 'developer')
if (role) permissionService.assignRole(user.id, role.id)

// Check permission
const canCreate = await permissionService.checkPermission(user.id, Permission.AGENT_CREATE)

// Audit log
auditLogger.logAgentCreated(user.id, user.username, 'agent-123')

// Encrypt data
const encrypted = encryptionService.encrypt('sensitive data')
const decrypted = encryptionService.decrypt(encrypted)
*/