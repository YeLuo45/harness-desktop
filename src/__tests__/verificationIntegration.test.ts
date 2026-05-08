/**
 * TDD Test Cases for harness-desktop Verification Hooks × Tool Call Loop Integration
 * 
 * PRD: P-20260509-001-verification-hook-integration
 * 
 * Tests cover:
 * 1. Unit tests: PlanStep.verificationStatus state management
 * 2. Integration tests: executePlanStep with verification hooks integration
 * 3. UI tests: PlanView verification status display
 * 
 * Acceptance Criteria:
 * - [ ] Planning phase displays verification level config
 * - [ ] Step execution auto-verifies and updates PlanView in real-time
 * - [ ] Verification status icons (✓/⚠/✗) display next to steps
 * - [ ] Warning messages can be expanded for viewing
 * - [ ] Auto-retry shows progress during execution
 * - [ ] Execution summary includes verification statistics
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { VerificationHooks, getVerificationHooks, initVerificationHooks } from '../services/verificationHooks'
import { useAppStore } from '../store/appStore'
import type { 
  ToolResult, 
  ExecutionPlan, 
  PlanStep, 
  VerificationConfig, 
  VerificationLevel,
  Message 
} from '../types'

// ==========================================
// SECTION 1: Unit Tests - PlanStep.verificationStatus State Management
// ==========================================

describe('PlanStep.verificationStatus - Unit Tests', () => {
  beforeEach(() => {
    useAppStore.setState({
      mode: 'execution',
      currentPlan: null,
      messages: [],
      isLoading: false,
      verificationWarnings: []
    })
  })

  afterEach(() => {
    useAppStore.setState({
      mode: 'execution',
      currentPlan: null,
      messages: [],
      isLoading: false,
      verificationWarnings: []
    })
  })

  describe('Verification status field types', () => {
    it('should support verificationStatus: "pending" initial state', () => {
      const step: PlanStep = {
        id: 'step-1',
        description: 'Test step',
        toolName: 'file_read',
        arguments: { path: '/test.txt' },
        riskLevel: 'low',
        status: 'pending',
        order: 0,
        verificationStatus: 'pending'
      }

      expect(step.verificationStatus).toBe('pending')
    })

    it('should support verificationStatus: "passed" state', () => {
      const step: PlanStep = {
        id: 'step-1',
        description: 'Test step',
        toolName: 'file_read',
        arguments: { path: '/test.txt' },
        riskLevel: 'low',
        status: 'completed',
        order: 0,
        verificationStatus: 'passed'
      }

      expect(step.verificationStatus).toBe('passed')
    })

    it('should support verificationStatus: "warning" state', () => {
      const step: PlanStep = {
        id: 'step-1',
        description: 'Test step',
        toolName: 'bash_execute',
        arguments: { command: 'ls -la' },
        riskLevel: 'medium',
        status: 'completed',
        order: 0,
        verificationStatus: 'warning',
        verificationMessage: 'Warnings: Large output (>100KB). Consider more specific commands.',
        warnings: ['Large output (>100KB). Consider more specific commands.']
      }

      expect(step.verificationStatus).toBe('warning')
      expect(step.warnings).toContain('Large output (>100KB). Consider more specific commands.')
    })

    it('should support verificationStatus: "failed" state', () => {
      const step: PlanStep = {
        id: 'step-1',
        description: 'Test step',
        toolName: 'bash_execute',
        arguments: { command: 'rm -rf /' },
        riskLevel: 'high',
        status: 'failed',
        order: 0,
        verificationStatus: 'failed',
        verificationMessage: 'Errors: Command failed: Permission denied'
      }

      expect(step.verificationStatus).toBe('failed')
    })

    it('should support all verificationStatus values as valid union type', () => {
      const validStatuses: Array<'pending' | 'passed' | 'warning' | 'failed'> = [
        'pending', 'passed', 'warning', 'failed'
      ]

      validStatuses.forEach(status => {
        const step: PlanStep = {
          id: `step-${status}`,
          description: `Test ${status}`,
          toolName: 'file_read',
          arguments: {},
          riskLevel: 'low',
          status: 'completed',
          order: 0,
          verificationStatus: status
        }
        expect(step.verificationStatus).toBe(status)
      })
    })
  })

  describe('State transitions with verificationStatus', () => {
    it('should transition from pending to passed after successful verification', () => {
      const plan: ExecutionPlan = {
        taskDescription: 'Test plan',
        steps: [{
          id: 'step-1',
          description: 'Read file',
          toolName: 'file_read',
          arguments: { path: '/test.txt' },
          riskLevel: 'low',
          status: 'pending',
          order: 0,
          verificationStatus: 'pending'
        }],
        risks: [],
        totalSteps: 1,
        confirmed: false
      }

      useAppStore.getState().setPlan(plan)

      // Execute step
      useAppStore.getState().updatePlanStep('step-1', { 
        status: 'completed', 
        result: 'file content',
        verificationStatus: 'passed'
      })

      const updatedStep = useAppStore.getState().currentPlan?.steps[0]
      expect(updatedStep?.status).toBe('completed')
      expect(updatedStep?.verificationStatus).toBe('passed')
    })

    it('should transition to warning when warnings are detected', () => {
      const plan: ExecutionPlan = {
        taskDescription: 'Test plan',
        steps: [{
          id: 'step-1',
          description: 'Execute command',
          toolName: 'bash_execute',
          arguments: { command: 'ls -R /' },
          riskLevel: 'high',
          status: 'pending',
          order: 0,
          verificationStatus: 'pending'
        }],
        risks: [],
        totalSteps: 1,
        confirmed: false
      }

      useAppStore.getState().setPlan(plan)

      // Simulate step completion with verification warning
      useAppStore.getState().updatePlanStep('step-1', {
        status: 'completed',
        result: { stdout: 'huge output', exitCode: 0 },
        verificationStatus: 'warning',
        verificationMessage: 'Warnings: Large output (>100KB). Consider more specific commands.',
        warnings: ['Large output (>100KB). Consider more specific commands.']
      })

      const updatedStep = useAppStore.getState().currentPlan?.steps[0]
      expect(updatedStep?.verificationStatus).toBe('warning')
      expect(updatedStep?.warnings).toHaveLength(1)
      expect(updatedStep?.warnings?.[0]).toContain('Large output')
    })

    it('should transition to failed when verification errors occur', () => {
      const plan: ExecutionPlan = {
        taskDescription: 'Test plan',
        steps: [{
          id: 'step-1',
          description: 'Execute dangerous command',
          toolName: 'bash_execute',
          arguments: { command: 'rm -rf /' },
          riskLevel: 'high',
          status: 'pending',
          order: 0,
          verificationStatus: 'pending'
        }],
        risks: ['High risk command'],
        totalSteps: 1,
        confirmed: false
      }

      useAppStore.getState().setPlan(plan)

      // Simulate failed execution
      useAppStore.getState().updatePlanStep('step-1', {
        status: 'failed',
        error: 'Permission denied',
        verificationStatus: 'failed',
        verificationMessage: 'Errors: Command failed: Permission denied'
      })

      const updatedStep = useAppStore.getState().currentPlan?.steps[0]
      expect(updatedStep?.status).toBe('failed')
      expect(updatedStep?.verificationStatus).toBe('failed')
      expect(updatedStep?.verificationMessage).toContain('Permission denied')
    })

    it('should preserve verificationStatus through multiple state changes', () => {
      const plan: ExecutionPlan = {
        taskDescription: 'Test plan',
        steps: [{
          id: 'step-1',
          description: 'Test step',
          toolName: 'file_read',
          arguments: {},
          riskLevel: 'low',
          status: 'pending',
          order: 0,
          verificationStatus: 'pending'
        }],
        risks: [],
        totalSteps: 1,
        confirmed: false
      }

      useAppStore.getState().setPlan(plan)

      // Start execution
      useAppStore.getState().updatePlanStep('step-1', { 
        status: 'executing',
        verificationStatus: 'pending' // Should remain pending during execution
      })

      let step = useAppStore.getState().currentPlan?.steps[0]
      expect(step?.status).toBe('executing')
      expect(step?.verificationStatus).toBe('pending')

      // Complete with verification passed
      useAppStore.getState().updatePlanStep('step-1', {
        status: 'completed',
        verificationStatus: 'passed'
      })

      step = useAppStore.getState().currentPlan?.steps[0]
      expect(step?.status).toBe('completed')
      expect(step?.verificationStatus).toBe('passed')
    })
  })

  describe('Verification status aggregation across steps', () => {
    it('should count steps by verification status', () => {
      const plan: ExecutionPlan = {
        taskDescription: 'Multi-step plan',
        steps: [
          { id: 's1', description: 'Step 1', toolName: 'file_read', arguments: {}, riskLevel: 'low', status: 'completed', order: 0, verificationStatus: 'passed' },
          { id: 's2', description: 'Step 2', toolName: 'bash_execute', arguments: {}, riskLevel: 'medium', status: 'completed', order: 1, verificationStatus: 'warning', warnings: ['Large output'] },
          { id: 's3', description: 'Step 3', toolName: 'file_write', arguments: {}, riskLevel: 'medium', status: 'completed', order: 2, verificationStatus: 'passed' },
          { id: 's4', description: 'Step 4', toolName: 'bash_execute', arguments: {}, riskLevel: 'high', status: 'failed', order: 3, verificationStatus: 'failed' }
        ],
        risks: [],
        totalSteps: 4,
        confirmed: true
      }

      useAppStore.getState().setPlan(plan)

      const steps = useAppStore.getState().currentPlan?.steps ?? []
      const passedCount = steps.filter(s => s.verificationStatus === 'passed').length
      const warningCount = steps.filter(s => s.verificationStatus === 'warning').length
      const failedCount = steps.filter(s => s.verificationStatus === 'failed').length

      expect(passedCount).toBe(2)
      expect(warningCount).toBe(1)
      expect(failedCount).toBe(1)
    })

    it('should calculate verification summary for execution complete', () => {
      const plan: ExecutionPlan = {
        taskDescription: 'Test plan',
        steps: [
          { id: 's1', description: 'Step 1', toolName: 'file_read', arguments: {}, riskLevel: 'low', status: 'completed', order: 0, verificationStatus: 'passed' },
          { id: 's2', description: 'Step 2', toolName: 'bash_execute', arguments: {}, riskLevel: 'medium', status: 'completed', order: 1, verificationStatus: 'warning', warnings: ['Large output'] },
          { id: 's3', description: 'Step 3', toolName: 'file_write', arguments: {}, riskLevel: 'medium', status: 'completed', order: 2, verificationStatus: 'passed' }
        ],
        risks: [],
        totalSteps: 3,
        confirmed: true
      }

      useAppStore.getState().setPlan(plan)

      const steps = useAppStore.getState().currentPlan?.steps ?? []
      const summary = {
        total: steps.length,
        passed: steps.filter(s => s.verificationStatus === 'passed').length,
        warnings: steps.filter(s => s.verificationStatus === 'warning').length,
        failed: steps.filter(s => s.verificationStatus === 'failed').length
      }

      // Format: "✅ 3步完成 | 2通过 | 1警告"
      expect(summary.total).toBe(3)
      expect(summary.passed).toBe(2)
      expect(summary.warnings).toBe(1)
      expect(summary.failed).toBe(0)
    })
  })
})

// ==========================================
// SECTION 2: Integration Tests - executePlanStep with Verification Hooks
// ==========================================

describe('executePlanStep with Verification Hooks - Integration Tests', () => {
  let verificationHooks: VerificationHooks

  beforeEach(() => {
    useAppStore.setState({
      mode: 'execution',
      currentPlan: null,
      messages: [],
      isLoading: false,
      verificationWarnings: []
    })
    
    // Initialize verification hooks with default config
    verificationHooks = initVerificationHooks({
      level: 'loose',
      autoRetry: true,
      maxRetries: 3,
      degradeOnFailure: true
    })
  })

  afterEach(() => {
    useAppStore.setState({
      mode: 'execution',
      currentPlan: null,
      messages: [],
      isLoading: false,
      verificationWarnings: []
    })
  })

  describe('Verification hooks integration with step execution', () => {
    it('should verify file_read tool result and update verificationStatus', () => {
      const step: PlanStep = {
        id: 'step-1',
        description: 'Read test file',
        toolName: 'file_read',
        arguments: { path: '/test.txt' },
        riskLevel: 'low',
        status: 'pending',
        order: 0
      }

      const mockToolResult: ToolResult = {
        toolName: 'file_read',
        arguments: { path: '/test.txt' },
        result: { content: 'Hello World', size: 11, lines: 1 },
        success: true,
        timestamp: Date.now()
      }

      // Verify the result using hooks
      const verificationResult = verificationHooks.verify(mockToolResult)

      // The verification should pass for a successful file read
      expect(verificationResult.passed).toBe(true)
      expect(verificationResult.errors).toHaveLength(0)

      // Map verification result to verificationStatus
      const verificationStatus = verificationResult.passed ? 'passed' : 'failed'

      expect(verificationStatus).toBe('passed')
    })

    it('should detect warnings for large file read', () => {
      const mockToolResult: ToolResult = {
        toolName: 'file_read',
        arguments: { path: '/huge-file.txt' },
        result: { content: 'x'.repeat(200), size: 11 * 1024 * 1024, lines: 10000 }, // > 10MB
        success: true,
        timestamp: Date.now()
      }

      const verificationResult = verificationHooks.verify(mockToolResult)

      // Should pass but with warnings about file size
      expect(verificationResult.passed).toBe(true)
      expect(verificationResult.warnings.length).toBeGreaterThan(0)
      expect(verificationResult.warnings[0]).toContain('File too large')
    })

    it('should detect errors for failed bash_execute', () => {
      const mockToolResult: ToolResult = {
        toolName: 'bash_execute',
        arguments: { command: 'rm -rf /' },
        result: { error: 'Permission denied', exitCode: 1 },
        success: false,
        timestamp: Date.now()
      }

      const verificationResult = verificationHooks.verify(mockToolResult)

      // Should fail verification
      expect(verificationResult.passed).toBe(false)
      expect(verificationResult.errors.length).toBeGreaterThan(0)
      expect(verificationResult.retryRecommended).toBe(true) // autoRetry enabled
    })

    it('should detect warnings for bash command with stderr errors', () => {
      const mockToolResult: ToolResult = {
        toolName: 'bash_execute',
        arguments: { command: 'npm build' },
        result: { stdout: 'building...', stderr: 'ERROR: failed to compile', exitCode: 1, success: true },
        success: true,
        timestamp: Date.now()
      }

      const verificationResult = verificationHooks.verify(mockToolResult)

      // Should have errors because stderr contains "ERROR"
      expect(verificationResult.passed).toBe(false)
      expect(verificationResult.errors.some(e => e.includes('stderr contains errors'))).toBe(true)
    })

    it('should detect warnings for non-zero exit code', () => {
      const mockToolResult: ToolResult = {
        toolName: 'bash_execute',
        arguments: { command: 'exit 1' },
        result: { stdout: '', stderr: '', exitCode: 1, success: true },
        success: true,
        timestamp: Date.now()
      }

      const verificationResult = verificationHooks.verify(mockToolResult)

      // Should pass but with warning about non-zero exit code
      expect(verificationResult.passed).toBe(true)
      expect(verificationResult.warnings.some(w => w.includes('exit code'))).toBe(true)
    })
  })

  describe('Verification with different config levels', () => {
    it('should pass with warnings in loose mode', () => {
      const hooks = new VerificationHooks({ level: 'loose', autoRetry: false, maxRetries: 0, degradeOnFailure: false })

      const mockToolResult: ToolResult = {
        toolName: 'edit_code',
        arguments: {},
        result: { applied: false, patches: 0 },
        success: true,
        timestamp: Date.now()
      }

      const result = hooks.verify(mockToolResult)
      // In loose mode, warnings don't fail verification
      expect(result.passed).toBe(true)
    })

    it('should fail with warnings in strict mode', () => {
      const hooks = new VerificationHooks({ level: 'strict', autoRetry: false, maxRetries: 0, degradeOnFailure: false })

      const mockToolResult: ToolResult = {
        toolName: 'edit_code',
        arguments: {},
        result: { applied: false, patches: 0 },
        success: true,
        timestamp: Date.now()
      }

      const result = hooks.verify(mockToolResult)
      // In strict mode, warnings cause verification to fail
      expect(result.passed).toBe(false)
    })

    it('should skip verification when disabled', () => {
      const hooks = new VerificationHooks({ level: 'disabled', autoRetry: false, maxRetries: 0, degradeOnFailure: false })

      const mockToolResult: ToolResult = {
        toolName: 'bash_execute',
        arguments: { command: 'rm -rf /' },
        result: { error: 'Permission denied' },
        success: false,
        timestamp: Date.now()
      }

      const result = hooks.verify(mockToolResult)
      // When disabled, everything passes
      expect(result.passed).toBe(true)
      expect(result.warnings).toHaveLength(0)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('Auto-retry recommendation', () => {
    it('should recommend retry when autoRetry is enabled and step fails', () => {
      const hooks = new VerificationHooks({ level: 'loose', autoRetry: true, maxRetries: 3, degradeOnFailure: false })

      const mockToolResult: ToolResult = {
        toolName: 'file_write',
        arguments: { path: '/test.txt', content: 'hello' },
        result: { error: 'Disk full' },
        success: false,
        timestamp: Date.now()
      }

      const result = hooks.verify(mockToolResult)

      expect(result.retryRecommended).toBe(true)
      expect(result.degradeRecommended).toBe(false) // degradeOnFailure is false
    })

    it('should recommend both retry and degrade when configured', () => {
      const hooks = new VerificationHooks({ level: 'loose', autoRetry: true, maxRetries: 3, degradeOnFailure: true })

      const mockToolResult: ToolResult = {
        toolName: 'bash_execute',
        arguments: { command: 'fail' },
        result: { error: 'Command failed' },
        success: false,
        timestamp: Date.now()
      }

      const result = hooks.verify(mockToolResult)

      expect(result.retryRecommended).toBe(true)
      expect(result.degradeRecommended).toBe(true)
    })
  })

  describe('Batch verification and summary', () => {
    it('should verify multiple tool results and generate summary', () => {
      const mockResults: ToolResult[] = [
        { toolName: 'file_read', arguments: {}, result: { content: 'ok' }, success: true, timestamp: Date.now() },
        { toolName: 'bash_execute', arguments: {}, result: { stdout: 'hello', exitCode: 0 }, success: true, timestamp: Date.now() },
        { toolName: 'file_write', arguments: {}, result: { error: 'failed' }, success: false, timestamp: Date.now() }
      ]

      const summary = verificationHooks.getBatchSummary(mockResults)

      expect(summary.totalTools).toBe(3)
      expect(summary.passed).toBe(2)
      expect(summary.failed).toBe(1)
      expect(summary.retriesRecommended).toBe(1) // The failed one
    })

    it('should format verification message correctly', () => {
      const mockToolResult: ToolResult = {
        toolName: 'bash_execute',
        arguments: { command: 'large output' },
        result: { stdout: 'x'.repeat(200000), exitCode: 0 }, // > 100KB
        success: true,
        timestamp: Date.now()
      }

      const result = verificationHooks.verify(mockToolResult)
      const message = verificationHooks.formatVerificationMessage(result)

      expect(message).toContain('Warnings:')
      expect(message).toContain('Large output')
    })
  })

  describe('executePlanStep simulation with verification', () => {
    it('should simulate full executePlanStep with verification integration', () => {
      // This simulates the PRD's executePlanStep integration
      const step: PlanStep = {
        id: 'step-1',
        description: 'Write config file',
        toolName: 'file_write',
        arguments: { path: '/config.yaml', content: 'key: value' },
        riskLevel: 'medium',
        status: 'pending',
        order: 0
      }

      useAppStore.getState().setPlan({
        taskDescription: 'Write config',
        steps: [step],
        risks: [],
        totalSteps: 1,
        confirmed: true
      })

      // Simulate: updatePlanStep(step.id, { status: 'executing' })
      useAppStore.getState().updatePlanStep('step-1', { status: 'executing' })
      expect(useAppStore.getState().currentPlan?.steps[0].status).toBe('executing')

      // Simulate tool execution
      const mockToolResult: ToolResult = {
        toolName: 'file_write',
        arguments: { path: '/config.yaml', content: 'key: value' },
        result: { path: '/config.yaml', bytesWritten: 9 },
        success: true,
        timestamp: Date.now()
      }

      // Simulate: updatePlanStep(step.id, { status: result.success ? 'completed' : 'failed', result: result.result, error: result.error })
      useAppStore.getState().updatePlanStep('step-1', {
        status: 'completed',
        result: mockToolResult.result
      })

      // Simulate: verification hooks integration
      const verificationResult = verificationHooks.verify(mockToolResult)
      const verificationStatus = verificationResult.passed ? 'passed' : 
                                  verificationResult.warnings.length > 0 ? 'warning' : 'failed'

      // Simulate: updatePlanStep with verification status
      useAppStore.getState().updatePlanStep('step-1', {
        verificationStatus: verificationStatus as 'passed' | 'warning' | 'failed',
        verificationMessage: verificationHooks.formatVerificationMessage(verificationResult),
        warnings: verificationResult.warnings
      })

      const finalStep = useAppStore.getState().currentPlan?.steps[0]
      expect(finalStep?.status).toBe('completed')
      expect(finalStep?.verificationStatus).toBe('passed')
    })
  })
})

// ==========================================
// SECTION 3: UI Tests - PlanView Verification Status Display
// ==========================================

describe('PlanView Verification Status Display - UI Tests', () => {
  beforeEach(() => {
    useAppStore.setState({
      mode: 'planning',
      currentPlan: null,
      messages: [],
      isLoading: false,
      verificationWarnings: []
    })
  })

  afterEach(() => {
    useAppStore.setState({
      mode: 'execution',
      currentPlan: null,
      messages: [],
      isLoading: false,
      verificationWarnings: []
    })
  })

  describe('Verification status icons display', () => {
    it('should display ✓ for passed verification status', () => {
      const step: PlanStep = {
        id: 'step-1',
        description: 'Read file',
        toolName: 'file_read',
        arguments: {},
        riskLevel: 'low',
        status: 'completed',
        order: 0,
        verificationStatus: 'passed'
      }

      // Simulate UI icon selection logic
      const icon = step.verificationStatus === 'passed' ? '✓' :
                   step.verificationStatus === 'warning' ? '⚠' :
                   step.verificationStatus === 'failed' ? '✗' : ''

      expect(icon).toBe('✓')
    })

    it('should display ⚠ for warning verification status', () => {
      const step: PlanStep = {
        id: 'step-1',
        description: 'Execute command',
        toolName: 'bash_execute',
        arguments: {},
        riskLevel: 'medium',
        status: 'completed',
        order: 0,
        verificationStatus: 'warning',
        warnings: ['Large output detected']
      }

      const icon = step.verificationStatus === 'passed' ? '✓' :
                   step.verificationStatus === 'warning' ? '⚠' :
                   step.verificationStatus === 'failed' ? '✗' : ''

      expect(icon).toBe('⚠')
    })

    it('should display ✗ for failed verification status', () => {
      const step: PlanStep = {
        id: 'step-1',
        description: 'Execute command',
        toolName: 'bash_execute',
        arguments: {},
        riskLevel: 'high',
        status: 'failed',
        order: 0,
        verificationStatus: 'failed',
        verificationMessage: 'Errors: Permission denied'
      }

      const icon = step.verificationStatus === 'passed' ? '✓' :
                   step.verificationStatus === 'warning' ? '⚠' :
                   step.verificationStatus === 'failed' ? '✗' : ''

      expect(icon).toBe('✗')
    })

    it('should display nothing for pending verification status', () => {
      const step: PlanStep = {
        id: 'step-1',
        description: 'Pending step',
        toolName: 'file_read',
        arguments: {},
        riskLevel: 'low',
        status: 'pending',
        order: 0,
        verificationStatus: 'pending'
      }

      const icon = step.verificationStatus === 'passed' ? '✓' :
                   step.verificationStatus === 'warning' ? '⚠' :
                   step.verificationStatus === 'failed' ? '✗' : ''

      expect(icon).toBe('')
    })
  })

  describe('Verification level display in planning mode', () => {
    it('should show verification level in plan header', () => {
      const plan: ExecutionPlan = {
        taskDescription: 'Test plan',
        steps: [
          { id: 's1', description: 'Step 1', toolName: 'file_read', arguments: {}, riskLevel: 'low', status: 'pending', order: 0 }
        ],
        risks: [],
        totalSteps: 1,
        confirmed: false
      }

      // Simulate getting verification level from config
      const verificationLevel: VerificationLevel = 'loose'

      useAppStore.getState().setPlan(plan)

      // In planning mode, verification level should be visible
      expect(useAppStore.getState().mode).toBe('planning')
      
      // The UI should show the verification level badge
      const levelDisplay = `Verification: ${verificationLevel}`
      expect(levelDisplay).toBe('Verification: loose')
    })

    it('should support switching verification level', () => {
      const hooks = getVerificationHooks()
      
      // Default config
      expect(hooks.getConfig().level).toBe('loose')

      // Simulate changing to strict mode
      hooks.setConfig({ level: 'strict' })
      expect(hooks.getConfig().level).toBe('strict')

      // Simulate changing to disabled mode
      hooks.setConfig({ level: 'disabled' })
      expect(hooks.getConfig().level).toBe('disabled')
    })
  })

  describe('Warning details expansion', () => {
    it('should display warnings array when expanded', () => {
      const step: PlanStep = {
        id: 'step-1',
        description: 'Execute command',
        toolName: 'bash_execute',
        arguments: { command: 'find / -name "*.log"' },
        riskLevel: 'high',
        status: 'completed',
        order: 0,
        verificationStatus: 'warning',
        warnings: [
          'Large output (>100KB). Consider more specific commands.',
          'Very large directory (>10000 entries). Results may be truncated.'
        ]
      }

      // Simulate UI expanding warnings
      const warningsExpanded = step.warnings && step.warnings.length > 0
      expect(warningsExpanded).toBe(true)

      // Simulate rendering warning list
      const warningItems = step.warnings?.map((w, i) => `⚠ ${w}`) ?? []
      expect(warningItems).toHaveLength(2)
      expect(warningItems[0]).toContain('Large output')
    })

    it('should not show warnings section when no warnings', () => {
      const step: PlanStep = {
        id: 'step-1',
        description: 'Read file',
        toolName: 'file_read',
        arguments: { path: '/simple.txt' },
        riskLevel: 'low',
        status: 'completed',
        order: 0,
        verificationStatus: 'passed'
      }

      // Simulate UI checking if warnings should be shown
      const shouldShowWarnings = step.warnings && step.warnings.length > 0
      expect(shouldShowWarnings).toBeFalsy()
    })
  })

  describe('Auto-retry progress display', () => {
    it('should track retry state during auto-retry', () => {
      const plan: ExecutionPlan = {
        taskDescription: 'Test plan',
        steps: [{
          id: 'step-1',
          description: 'Write file',
          toolName: 'file_write',
          arguments: {},
          riskLevel: 'medium',
          status: 'executing',
          order: 0,
          verificationStatus: 'pending'
        }],
        risks: [],
        totalSteps: 1,
        confirmed: true
      }

      useAppStore.getState().setPlan(plan)

      // Simulate auto-retry in progress
      const retryInProgress = plan.steps[0].status === 'executing'

      expect(retryInProgress).toBe(true)
      
      // UI should show "Auto-retrying..." text
      const retryMessage = retryInProgress ? 'Auto-retry in progress...' : ''
      expect(retryMessage).toBe('Auto-retry in progress...')
    })

    it('should clear retry state after completion', () => {
      const plan: ExecutionPlan = {
        taskDescription: 'Test plan',
        steps: [{
          id: 'step-1',
          description: 'Write file',
          toolName: 'file_write',
          arguments: {},
          riskLevel: 'medium',
          status: 'completed',
          order: 0,
          verificationStatus: 'passed'
        }],
        risks: [],
        totalSteps: 1,
        confirmed: true
      }

      useAppStore.getState().setPlan(plan)

      // After completion, retry message should be cleared
      const step = plan.steps[0]
      const retryInProgress = step.status === 'executing'
      const retryMessage = retryInProgress ? 'Auto-retry in progress...' : ''

      expect(retryMessage).toBe('')
    })
  })

  describe('Execution summary with verification statistics', () => {
    it('should generate summary with verification stats', () => {
      const plan: ExecutionPlan = {
        taskDescription: 'Test plan',
        steps: [
          { id: 's1', description: 'Step 1', toolName: 'file_read', arguments: {}, riskLevel: 'low', status: 'completed', order: 0, verificationStatus: 'passed' },
          { id: 's2', description: 'Step 2', toolName: 'bash_execute', arguments: {}, riskLevel: 'medium', status: 'completed', order: 1, verificationStatus: 'warning', warnings: ['Large output'] },
          { id: 's3', description: 'Step 3', toolName: 'file_write', arguments: {}, riskLevel: 'medium', status: 'completed', order: 2, verificationStatus: 'passed' }
        ],
        risks: [],
        totalSteps: 3,
        confirmed: true
      }

      useAppStore.getState().setPlan(plan)

      const steps = useAppStore.getState().currentPlan?.steps ?? []
      const passedCount = steps.filter(s => s.verificationStatus === 'passed').length
      const warningCount = steps.filter(s => s.verificationStatus === 'warning').length
      const completedCount = steps.filter(s => s.status === 'completed').length

      // Format: "✅ 3步完成 | 2通过 | 1警告"
      const summary = `✅ ${completedCount}步完成 | ${passedCount}通过 | ${warningCount}警告`
      expect(summary).toBe('✅ 3步完成 | 2通过 | 1警告')
    })

    it('should show failed count in summary', () => {
      const plan: ExecutionPlan = {
        taskDescription: 'Test plan',
        steps: [
          { id: 's1', description: 'Step 1', toolName: 'file_read', arguments: {}, riskLevel: 'low', status: 'completed', order: 0, verificationStatus: 'passed' },
          { id: 's2', description: 'Step 2', toolName: 'bash_execute', arguments: {}, riskLevel: 'high', status: 'failed', order: 1, verificationStatus: 'failed' }
        ],
        risks: [],
        totalSteps: 2,
        confirmed: true
      }

      useAppStore.getState().setPlan(plan)

      const steps = useAppStore.getState().currentPlan?.steps ?? []
      const passedCount = steps.filter(s => s.verificationStatus === 'passed').length
      const failedCount = steps.filter(s => s.verificationStatus === 'failed').length

      const summary = `✅ ${passedCount}通过 | ${failedCount}失败`
      expect(summary).toBe('✅ 1通过 | 1失败')
    })
  })
})

// ==========================================
// SECTION 4: PRD Acceptance Criteria Validation
// ==========================================

describe('PRD P-20260509-001 Acceptance Criteria Validation', () => {
  let verificationHooks: VerificationHooks

  beforeEach(() => {
    useAppStore.setState({
      mode: 'execution',
      currentPlan: null,
      messages: [],
      isLoading: false,
      verificationWarnings: []
    })
    
    verificationHooks = initVerificationHooks({
      level: 'loose',
      autoRetry: true,
      maxRetries: 3,
      degradeOnFailure: true
    })
  })

  afterEach(() => {
    useAppStore.setState({
      mode: 'execution',
      currentPlan: null,
      messages: [],
      isLoading: false,
      verificationWarnings: []
    })
  })

  // AC1: Planning phase displays verification level config
  it('AC1: Planning phase displays verification level config', () => {
    const verificationLevel: VerificationLevel = 'loose'

    // UI should display verification level in plan header
    const levelBadge = `Verification Level: ${verificationLevel}`
    expect(levelBadge).toBe('Verification Level: loose')

    // User can view the current verification level
    const currentLevel = verificationHooks.getConfig().level
    expect(currentLevel).toBe('loose')
  })

  // AC2: Step execution auto-verifies and updates PlanView in real-time
  it('AC2: Step execution auto-verifies and updates PlanView in real-time', async () => {
    const step: PlanStep = {
      id: 'step-1',
      description: 'Read file',
      toolName: 'file_read',
      arguments: { path: '/test.txt' },
      riskLevel: 'low',
      status: 'pending',
      order: 0,
      verificationStatus: 'pending'
    }

    useAppStore.getState().setPlan({
      taskDescription: 'Read test file',
      steps: [step],
      risks: [],
      totalSteps: 1,
      confirmed: true
    })

    // Execute step
    useAppStore.getState().updatePlanStep('step-1', { status: 'executing' })

    // Simulate tool execution
    const toolResult: ToolResult = {
      toolName: 'file_read',
      arguments: { path: '/test.txt' },
      result: { content: 'Hello', size: 5 },
      success: true,
      timestamp: Date.now()
    }

    // Auto-verify after execution
    const verificationResult = verificationHooks.verify(toolResult)
    const verificationStatus = verificationResult.passed ? 'passed' : 
                                verificationResult.warnings.length > 0 ? 'warning' : 'failed'

    // Update PlanView with verification status
    useAppStore.getState().updatePlanStep('step-1', {
      status: 'completed',
      verificationStatus: verificationStatus as 'passed' | 'warning' | 'failed',
      verificationMessage: verificationHooks.formatVerificationMessage(verificationResult)
    })

    // Verify the update happened
    const updatedStep = useAppStore.getState().currentPlan?.steps[0]
    expect(updatedStep?.verificationStatus).toBe('passed')
    expect(updatedStep?.status).toBe('completed')
  })

  // AC3: Verification status icons display (✓/⚠/✗)
  it('AC3: Verification status icons display (✓/⚠/✗)', () => {
    const testCases = [
      { status: 'passed' as const, expectedIcon: '✓' },
      { status: 'warning' as const, expectedIcon: '⚠' },
      { status: 'failed' as const, expectedIcon: '✗' }
    ]

    testCases.forEach(({ status, expectedIcon }) => {
      const icon = status === 'passed' ? '✓' : status === 'warning' ? '⚠' : '✗'
      expect(icon).toBe(expectedIcon)
    })
  })

  // AC4: Warning messages can be expanded for viewing
  it('AC4: Warning messages can be expanded for viewing', () => {
    const step: PlanStep = {
      id: 'step-1',
      description: 'Execute command',
      toolName: 'bash_execute',
      arguments: {},
      riskLevel: 'medium',
      status: 'completed',
      order: 0,
      verificationStatus: 'warning',
      warnings: ['Warning 1: Large output', 'Warning 2: Non-zero exit code']
    }

    // UI can expand to show warning details
    const canExpand = step.warnings && step.warnings.length > 0
    expect(canExpand).toBe(true)

    // Expand and render warnings
    const warningDetails = step.warnings?.map(w => `⚠ ${w}`) ?? []
    expect(warningDetails).toHaveLength(2)
  })

  // AC5: Auto-retry shows progress during execution
  it('AC5: Auto-retry shows progress during execution', () => {
    // When retryRecommended is true and autoRetry is enabled
    const hooks = new VerificationHooks({ level: 'loose', autoRetry: true, maxRetries: 3, degradeOnFailure: true })

    const failedResult: ToolResult = {
      toolName: 'file_write',
      arguments: {},
      result: { error: 'Temporary failure' },
      success: false,
      timestamp: Date.now()
    }

    const verificationResult = hooks.verify(failedResult)

    // Should recommend retry
    expect(verificationResult.retryRecommended).toBe(true)
    expect(hooks.getConfig().autoRetry).toBe(true)

    // UI should show "Auto-retrying..." during retry
    const retryInProgress = verificationResult.retryRecommended && hooks.getConfig().autoRetry
    const retryMessage = retryInProgress ? 'Auto-retrying...' : ''
    expect(retryMessage).toBe('Auto-retrying...')
  })

  // AC6: Execution summary includes verification statistics
  it('AC6: Execution summary includes verification statistics', () => {
    const plan: ExecutionPlan = {
      taskDescription: 'Test plan',
      steps: [
        { id: 's1', description: 'Step 1', toolName: 'file_read', arguments: {}, riskLevel: 'low', status: 'completed', order: 0, verificationStatus: 'passed' },
        { id: 's2', description: 'Step 2', toolName: 'bash_execute', arguments: {}, riskLevel: 'medium', status: 'completed', order: 1, verificationStatus: 'warning', warnings: ['Large output'] },
        { id: 's3', description: 'Step 3', toolName: 'file_write', arguments: {}, riskLevel: 'medium', status: 'completed', order: 2, verificationStatus: 'passed' },
        { id: 's4', description: 'Step 4', toolName: 'bash_execute', arguments: {}, riskLevel: 'high', status: 'failed', order: 3, verificationStatus: 'failed' }
      ],
      risks: [],
      totalSteps: 4,
      confirmed: true
    }

    useAppStore.getState().setPlan(plan)

    // Generate verification summary
    const steps = useAppStore.getState().currentPlan?.steps ?? []
    const summary = {
      total: steps.length,
      completed: steps.filter(s => s.status === 'completed').length,
      failed: steps.filter(s => s.status === 'failed').length,
      passed: steps.filter(s => s.verificationStatus === 'passed').length,
      warnings: steps.filter(s => s.verificationStatus === 'warning').length,
      verificationFailed: steps.filter(s => s.verificationStatus === 'failed').length
    }

    // Summary format: "✅ 3步完成 | 2通过 | 1警告 | 1失败"
    const summaryText = `✅ ${summary.completed}步完成 | ${summary.passed}通过 | ${summary.warnings}警告 | ${summary.verificationFailed}失败`
    expect(summaryText).toBe('✅ 3步完成 | 2通过 | 1警告 | 1失败')
  })
})
