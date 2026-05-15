/**
 * P11: Multi-Agent Collaboration - Task Decomposer
 * 
 * Automatically decomposes complex tasks into executable subtasks.
 */

import { v4 as uuidv4 } from 'uuid'
import type { SubTask } from '../../types'

export interface SubTaskItem {
  id: string
  description: string
  dependencies: string[]
  estimatedDuration?: number
  priority?: 'low' | 'medium' | 'high'
  parallelGroup?: number  // Tasks in same group can run in parallel
}

export interface DecomposedTask {
  id: string
  description: string
  subtasks: SubTaskItem[]
  estimatedDuration?: number
  parallelGroups?: string[][]  // Groups of task IDs that can run in parallel
  complexity: number  // 0-10
  strategy: 'sequential' | 'parallel' | 'hierarchical'
}

// Keywords that indicate a task can be decomposed
const DECOMPOSABLE_PATTERNS = [
  /\b(and|also|plus)\b/i,
  /\b(analyze|review|generate|create|build)\b.*\b(multiple|many|several)\b/i,
  /\b(first|then|next|after|before)\b/i,
  /\b(step|phase|stage)\s+\d+\b/i,
  /\b(task|subtask)\b/i
]

// Keywords indicating high complexity
const COMPLEXITY_KEYWORDS = [
  { pattern: /\b(architecture|system design|framework)\b/i, weight: 3 },
  { pattern: /\b(algorithm|optimize|performance)\b/i, weight: 2 },
  { pattern: /\b(integrate|connect|interface)\b/i, weight: 2 },
  { pattern: /\b(security|authentication|authorization)\b/i, weight: 3 },
  { pattern: /\b(microservice|distributed|concurrent)\b/i, weight: 3 },
  { pattern: /\b(refactor|restructure|redesign)\b/i, weight: 2 },
  { pattern: /\b(test|validation|verification)\b/i, weight: 1 },
  { pattern: /\b(documentation|comment|spec)\b/i, weight: 1 },
  { pattern: /\b(API|REST|GraphQL|endpoint)\b/i, weight: 2 },
  { pattern: /\b(database|schema|migration)\b/i, weight: 2 }
]

export class TaskDecomposer {
  /**
   * Decompose a complex task into subtasks
   */
  decompose(task: string, context?: Record<string, unknown>): DecomposedTask {
    const complexity = this.estimateComplexity(task)
    const canDecompose = this.canDecompose(task)
    
    const decomposed: DecomposedTask = {
      id: uuidv4(),
      description: task,
      subtasks: [],
      complexity,
      strategy: 'parallel'
    }

    if (!canDecompose) {
      // Simple task - single subtask
      decomposed.subtasks.push({
        id: uuidv4(),
        description: task,
        dependencies: []
      })
      return decomposed
    }

    // Analyze task structure to determine decomposition strategy
    const subtasks = this.analyzeAndDecompose(task, context)
    decomposed.subtasks = subtasks

    // If no subtasks were generated, create default ones
    if (decomposed.subtasks.length === 0) {
      decomposed.subtasks.push({
        id: uuidv4(),
        description: task,
        dependencies: []
      })
    }

    // Calculate parallel groups
    decomposed.parallelGroups = this.computeParallelGroups(decomposed.subtasks)
    
    // Estimate total duration
    decomposed.estimatedDuration = this.estimateDuration(decomposed.subtasks)

    // Determine strategy based on dependencies
    const hasSequentialDeps = subtasks.some(t => t.dependencies.length > 0)
    if (hasSequentialDeps) {
      decomposed.strategy = 'hierarchical'
    } else if (decomposed.parallelGroups && decomposed.parallelGroups.length > 1) {
      decomposed.strategy = 'parallel'
    }

    return decomposed
  }

  /**
   * Check if a task needs decomposition
   */
  canDecompose(task: string): boolean {
    // Check for decomposable patterns
    for (const pattern of DECOMPOSABLE_PATTERNS) {
      if (pattern.test(task)) {
        return true
      }
    }

    // Check complexity
    if (this.estimateComplexity(task) >= 6) {
      return true
    }

    // Check length - longer tasks are often composite
    const wordCount = task.split(/\s+/).length
    if (wordCount > 30) {
      return true
    }

    return false
  }

  /**
   * Estimate task complexity on a scale of 0-10
   */
  estimateComplexity(task: string): number {
    let score = 0

    // Check for complexity keywords
    for (const { pattern, weight } of COMPLEXITY_KEYWORDS) {
      if (pattern.test(task)) {
        score += weight
      }
    }

    // Word count factor
    const wordCount = task.split(/\s+/).length
    if (wordCount > 20) score += 1
    if (wordCount > 40) score += 1
    if (wordCount > 60) score += 1

    // Sentence count factor
    const sentenceCount = task.split(/[.!?]+/).filter(s => s.trim()).length
    if (sentenceCount > 2) score += 1
    if (sentenceCount > 4) score += 1

    // Clamp to 0-10
    return Math.min(10, Math.max(0, score))
  }

  /**
   * Analyze task and generate subtasks
   */
  private analyzeAndDecompose(
    task: string,
    context?: Record<string, unknown>
  ): SubTaskItem[] {
    const subtasks: SubTaskItem[] = []
    
    // Try to detect task phases
    const phases = this.detectPhases(task)
    
    if (phases.length > 1) {
      // Hierarchical decomposition by phase
      let prevId: string | undefined
      for (let i = 0; i < phases.length; i++) {
        const phase = phases[i]
        const id = uuidv4()
        const subtask: SubTaskItem = {
          id,
          description: phase.description,
          dependencies: prevId ? [prevId] : [],
          priority: phase.priority,
          parallelGroup: phase.parallelGroup
        }
        subtasks.push(subtask)
        prevId = id
      }
    } else {
      // Try to detect parallelizable components
      const components = this.detectComponents(task)
      
      if (components.length > 1) {
        // Parallel decomposition
        for (let i = 0; i < components.length; i++) {
          const component = components[i]
          subtasks.push({
            id: uuidv4(),
            description: component,
            dependencies: [],
            parallelGroup: i
          })
        }
      } else {
        // Default: single task with subtasks for common operations
        const commonSubtasks = this.generateCommonSubtasks(task)
        subtasks.push(...commonSubtasks)
      }
    }

    return subtasks
  }

  /**
   * Detect phases in a task description
   */
  private detectPhases(task: string): Array<{
    description: string
    priority: 'low' | 'medium' | 'high'
    parallelGroup?: number
  }> {
    const phases: Array<{
      description: string
      priority: 'low' | 'medium' | 'high'
      parallelGroup?: number
    }> = []

    // Pattern for numbered phases: "1. ... 2. ... 3. ..."
    const numberedPattern = /(?:\d+\.\s*)([^.!?]+[.!?]?)/gi
    let match
    while ((match = numberedPattern.exec(task)) !== null) {
      const description = match[1].trim()
      if (description.length > 5) {
        phases.push({
          description,
          priority: 'medium'
        })
      }
    }

    // Pattern for sequential keywords: "First, ... Then, ... Finally, ..."
    const sequentialKeywords = /\b(first|initially|start)\b[,.\s]+([^.]+)/gi
    while ((match = sequentialKeywords.exec(task)) !== null) {
      phases.push({
        description: match[2].trim(),
        priority: 'high'
      })
    }

    const thenKeywords = /\b(then|next|after that|afterward)\b[,.\s]+([^.]+)/gi
    while ((match = thenKeywords.exec(task)) !== null) {
      phases.push({
        description: match[2].trim(),
        priority: 'medium'
      })
    }

    const finallyKeywords = /\b(finally|last|ultimately|in the end)\b[,.\s]+([^.]+)/gi
    while ((match = finallyKeywords.exec(task)) !== null) {
      phases.push({
        description: match[2].trim(),
        priority: 'low'
      })
    }

    // Pattern for "and also" type parallel tasks
    const andPattern = /\b(and|also|plus)\b\s+([^,]+)/gi
    const parallelTasks: string[] = []
    while ((match = andPattern.exec(task)) !== null) {
      parallelTasks.push(match[2].trim())
    }

    if (parallelTasks.length > 1 && phases.length === 0) {
      // All parallel tasks
      for (let i = 0; i < parallelTasks.length; i++) {
        phases.push({
          description: parallelTasks[i],
          priority: 'medium',
          parallelGroup: i
        })
      }
    }

    return phases
  }

  /**
   * Detect components that could be processed in parallel
   */
  private detectComponents(task: string): string[] {
    const components: string[] = []

    // Pattern for "X, Y, and Z" type enumerations
    const enumerationPattern = /\b([A-Z][a-z]+(?:\s+[a-z]+)*)\s*,(?:\s*[A-Z][a-z]+(?:\s+[a-z]+)*\s*)*(?:and|or)\s+([A-Z][a-z]+(?:\s+[a-z]+)*)/g
    let match
    while ((match = enumerationPattern.exec(task)) !== null) {
      // Extract all components
      const fullMatch = match[0]
      const parts = fullMatch.split(/,\s*(?:and|or)\s*/)
      components.push(...parts.map(p => p.trim()))
    }

    // Pattern for bullet-like items
    const bulletPattern = /(?:^|\n)\s*[-•*]\s*([^\n]+)/g
    while ((match = bulletPattern.exec(task)) !== null) {
      components.push(match[1].trim())
    }

    return components
  }

  /**
   * Generate common subtasks for a task
   */
  private generateCommonSubtasks(task: string): SubTaskItem[] {
    const lowerTask = task.toLowerCase()
    const subtasks: SubTaskItem[] = []

    // For code-related tasks
    if (lowerTask.includes('code') || lowerTask.includes('implement') || lowerTask.includes('build')) {
      if (lowerTask.includes('test')) {
        subtasks.push(
          { id: uuidv4(), description: 'Write implementation code', dependencies: [], priority: 'high' },
          { id: uuidv4(), description: 'Generate test cases', dependencies: [], priority: 'high', parallelGroup: 0 },
          { id: uuidv4(), description: 'Review implementation', dependencies: [], priority: 'medium', parallelGroup: 0 },
          { id: uuidv4(), description: 'Run tests and verify', dependencies: [] }
        )
      } else {
        subtasks.push(
          { id: uuidv4(), description: 'Analyze requirements', dependencies: [] },
          { id: uuidv4(), description: 'Write implementation', dependencies: [] },
          { id: uuidv4(), description: 'Review code', dependencies: [] },
          { id: uuidv4(), description: 'Document changes', dependencies: [] }
        )
      }
    }
    // For review tasks
    else if (lowerTask.includes('review') || lowerTask.includes('analyze')) {
      subtasks.push(
        { id: uuidv4(), description: 'Gather relevant context', dependencies: [] },
        { id: uuidv4(), description: 'Perform analysis', dependencies: [] },
        { id: uuidv4(), description: 'Document findings', dependencies: [] }
      )
    }
    // For test generation
    else if (lowerTask.includes('test') && lowerTask.includes('generate')) {
      subtasks.push(
        { id: uuidv4(), description: 'Identify test scenarios', dependencies: [] },
        { id: uuidv4(), description: 'Write unit tests', dependencies: [], priority: 'high', parallelGroup: 0 },
        { id: uuidv4(), description: 'Write integration tests', dependencies: [], priority: 'high', parallelGroup: 0 },
        { id: uuidv4(), description: 'Verify test coverage', dependencies: [] }
      )
    }
    // For refactoring
    else if (lowerTask.includes('refactor')) {
      subtasks.push(
        { id: uuidv4(), description: 'Identify refactoring targets', dependencies: [] },
        { id: uuidv4(), description: 'Plan refactoring steps', dependencies: [] },
        { id: uuidv4(), description: 'Execute refactoring', dependencies: [] },
        { id: uuidv4(), description: 'Verify functionality', dependencies: [] }
      )
    }
    // Default decomposition
    else {
      subtasks.push({
        id: uuidv4(),
        description: task,
        dependencies: []
      })
    }

    return subtasks
  }

  /**
   * Compute parallel execution groups
   */
  private computeParallelGroups(subtasks: SubTaskItem[]): string[][] {
    const groups: string[][] = []
    const assigned = new Set<string>()

    // First pass: group by parallelGroup index
    const groupMap = new Map<number, string[]>()
    for (const task of subtasks) {
      if (task.parallelGroup !== undefined) {
        const group = groupMap.get(task.parallelGroup) || []
        group.push(task.id)
        groupMap.set(task.parallelGroup, group)
      }
    }

    for (const group of Array.from(groupMap.values())) {
      groups.push(group)
      group.forEach(id => assigned.add(id))
    }

    // Second pass: group independent tasks
    const independentTasks = subtasks
      .filter(t => !assigned.has(t.id) && t.dependencies.length === 0)
      .map(t => t.id)
    
    if (independentTasks.length > 0) {
      groups.push(independentTasks)
      independentTasks.forEach(id => assigned.add(id))
    }

    // Third pass: remaining tasks in dependency order
    const remaining = subtasks
      .filter(t => !assigned.has(t.id))
      .sort((a, b) => a.dependencies.length - b.dependencies.length)

    if (remaining.length > 0) {
      // Build execution order based on dependencies
      const executed = new Set<string>()
      while (executed.size < remaining.length) {
        const ready = remaining.filter(t => 
          !executed.has(t.id) && 
          t.dependencies.every(dep => executed.has(dep))
        )
        
        if (ready.length === 0) break
        
        const group = ready.map(t => t.id)
        groups.push(group)
        group.forEach(id => executed.add(id))
      }
    }

    return groups
  }

  /**
   * Estimate total duration in milliseconds
   */
  private estimateDuration(subtasks: SubTaskItem[]): number {
    const baseDurations = {
      low: 30000,      // 30 seconds
      medium: 60000,   // 1 minute
      high: 120000     // 2 minutes
    }

    let totalDuration = 0
    for (const task of subtasks) {
      const priority = task.priority || 'medium'
      const taskDuration = task.estimatedDuration || baseDurations[priority]
      totalDuration += taskDuration
    }

    // Add overhead for dependencies
    const hasDependencies = subtasks.some(t => t.dependencies.length > 0)
    if (hasDependencies) {
      totalDuration = Math.round(totalDuration * 1.2)
    }

    return totalDuration
  }
}

export const taskDecomposer = new TaskDecomposer()
