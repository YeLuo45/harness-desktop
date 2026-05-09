// Resource Isolation - barrel export

export * from './resourceTypes'
export { ResourceQuotaManager, resourceQuotaManager } from './resourceQuota'
export { ExecutionContextManager, executionContextManager } from './executionContext'
export { Sandbox, sandbox } from './sandbox'
export { ResourceMonitor, resourceMonitor } from './resourceMonitor'

/*
Quick Start:

import { resourceQuotaManager, executionContextManager, sandbox, resourceMonitor, ResourceType } from './isolation'

// Set resource quota
resourceQuotaManager.setQuota('agent-123', {
  memoryMB: 256,
  cpuTimeMs: 30000,
  maxExecTimeMs: 60000,
  maxFileSizeMB: 50,
  maxNetworkCalls: 100
})

// Create execution context
const context = executionContextManager.createContext('agent-123')

// Execute in sandbox
const result = await sandbox.executeInSandbox('agent-123', 'console.log("hello")')

// Monitor resources
const stats = resourceMonitor.getStats()
const alerts = resourceMonitor.getAlerts({ severity: 'warning' })
*/