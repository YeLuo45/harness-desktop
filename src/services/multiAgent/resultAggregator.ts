/**
 * P11: Multi-Agent Collaboration - Result Aggregator
 * 
 * Intelligent merging of multi-agent outputs.
 */

import type { AgentOutput } from './types'

export interface AggregationConfig {
  strategy: 'sequential' | 'hierarchical' | 'consensus' | 'vote'
  mergeToolCalls?: boolean
  resolveConflicts?: 'first' | 'last' | 'manual'
}

export interface AggregationResult {
  sessionId: string
  outputs: AgentOutput[]
  finalOutput: string
  summary: string
  metadata: {
    strategy: string
    totalAgents: number
    successfulOutputs: number
    failedOutputs: number
    toolCallsMerged?: number
    conflictsResolved?: number
  }
}

export interface ConflictResolution {
  type: 'content' | 'tool_call' | 'decision'
  originalOutputs: AgentOutput[]
  resolvedValue: unknown
  resolutionMethod: 'first' | 'last' | 'consensus' | 'vote'
}

export class ResultAggregator {
  private defaultConfig: AggregationConfig = {
    strategy: 'sequential',
    mergeToolCalls: true,
    resolveConflicts: 'first'
  }

  /**
   * Aggregate outputs from multiple agents
   */
  aggregate(outputs: AgentOutput[], config: AggregationConfig): AggregationResult {
    const finalConfig = { ...this.defaultConfig, ...config }
    
    let finalOutput: string
    let summary: string

    switch (finalConfig.strategy) {
      case 'hierarchical':
        finalOutput = this.mergeHierarchical(outputs)
        break
      case 'consensus':
        finalOutput = this.mergeConsensus(outputs)
        break
      case 'vote':
        finalOutput = this.mergeVoting(outputs)
        break
      case 'sequential':
      default:
        finalOutput = this.mergeSequential(outputs)
        break
    }

    summary = this.generateSummary(outputs)

    const successful = outputs.filter(o => o.success).length
    const failed = outputs.length - successful

    return {
      sessionId: '',
      outputs,
      finalOutput,
      summary,
      metadata: {
        strategy: finalConfig.strategy,
        totalAgents: outputs.length,
        successfulOutputs: successful,
        failedOutputs: failed,
        toolCallsMerged: finalConfig.mergeToolCalls ? this.countToolCalls(outputs) : undefined
      }
    }
  }

  /**
   * Merge text outputs sequentially (in order)
   */
  mergeTextOutputs(outputs: AgentOutput[]): string {
    return this.mergeSequential(outputs)
  }

  /**
   * Merge tool calls from all agents
   */
  mergeToolCalls(outputs: AgentOutput[]): Array<{ name: string; arguments: Record<string, unknown> }> {
    const merged: Array<{ name: string; arguments: Record<string, unknown> }> = []
    const seen = new Set<string>()

    for (const output of outputs) {
      if (output.toolCalls) {
        for (const toolCall of output.toolCalls) {
          const key = `${toolCall.name}:${JSON.stringify(toolCall.arguments)}`
          if (!seen.has(key)) {
            seen.add(key)
            merged.push(toolCall)
          }
        }
      }
    }

    return merged
  }

  /**
   * Generate a summary of the aggregated results
   */
  generateSummary(outputs: AgentOutput[]): string {
    return this.generateSummaryText(outputs)
  }

  /**
   * Merge outputs in sequential order
   */
  private mergeSequential(outputs: AgentOutput[]): string {
    return outputs.map(o => o.content).join('\n\n')
  }

  /**
   * Merge outputs hierarchically (by role/agent priority)
   */
  private mergeHierarchical(outputs: AgentOutput[]): string {
    // Sort by role priority
    const rolePriority: Record<string, number> = {
      orchestrator: 1,
      code_reviewer: 2,
      test_generator: 3,
      refactorer: 4
    }

    const sorted = [...outputs].sort((a, b) => {
      const priorityA = rolePriority[a.role] || 99
      const priorityB = rolePriority[b.role] || 99
      return priorityA - priorityB
    })

    // Build hierarchical output
    const sections: string[] = []
    
    for (const output of sorted) {
      const section = `## ${this.formatRole(output.role)}\n\n${output.content}`
      sections.push(section)
    }

    return sections.join('\n\n---\n\n')
  }

  /**
   * Merge outputs by finding consensus
   */
  private mergeConsensus(outputs: AgentOutput[]): string {
    if (outputs.length === 0) return ''
    if (outputs.length === 1) return outputs[0].content

    // Find common patterns in outputs
    const lines = outputs.map(o => o.content.split('\n'))
    const consensusLines: string[] = []

    // Check first line agreement
    const firstLines = lines.map(l => l[0]?.trim()).filter(Boolean)
    const firstLineCounts = this.countOccurrences(firstLines)
    const maxFirstLineCount = Math.max(...Array.from(firstLineCounts.values()), 0)
    if (maxFirstLineCount > outputs.length / 2) {
      consensusLines.push(this.getMostCommon(firstLines) || '')
    }

    // Add unique high-value content from each output
    const processedContent = new Set<string>()
    
    for (const output of outputs) {
      const paragraphs = output.content.split('\n\n')
      for (const para of paragraphs) {
        const normalized = para.trim().toLowerCase()
        if (normalized.length > 20 && !processedContent.has(normalized)) {
          // Check if this paragraph has agreement
          const matchingCount = outputs.filter(o => 
            o.content.toLowerCase().includes(normalized)
          ).length
          
          if (matchingCount > 1 || matchingCount === outputs.length) {
            consensusLines.push(para.trim())
            processedContent.add(normalized)
          }
        }
      }
    }

    return consensusLines.join('\n\n')
  }

  /**
   * Merge outputs by voting
   */
  private mergeVoting(outputs: AgentOutput[]): string {
    if (outputs.length === 0) return ''
    if (outputs.length === 1) return outputs[0].content

    // Extract distinct proposals
    const proposals = this.extractProposals(outputs)
    
    if (proposals.length === 0) {
      return outputs[0].content
    }

    // Vote on proposals
    const votes: Array<{ proposal: string; count: number }> = []
    
    for (const proposal of proposals) {
      const count = outputs.filter(o => 
        o.content.includes(proposal) || proposal.includes(o.content.substring(0, 50))
      ).length
      
      votes.push({ proposal, count })
    }

    // Sort by votes
    votes.sort((a, b) => b.count - a.count)

    // Build final output with vote counts
    const lines: string[] = ['# Voting Results\n']
    
    for (const { proposal, count } of votes.slice(0, 5)) {
      const percentage = Math.round((count / outputs.length) * 100)
      lines.push(`- [${count}/${outputs.length}] (${percentage}%) ${proposal}`)
    }

    // Add top proposal as final decision
    if (votes.length > 0) {
      lines.push('\n## Final Decision\n')
      lines.push(votes[0].proposal)
    }

    return lines.join('\n')
  }

  /**
   * Generate summary text
   */
  private generateSummaryText(outputs: AgentOutput[]): string {
    const successful = outputs.filter(o => o.success)
    const failed = outputs.filter(o => !o.success)

    const parts: string[] = []
    
    parts.push(`Processed ${outputs.length} agent outputs`)
    
    if (successful.length > 0) {
      parts.push(`${successful.length} successful`)
    }
    
    if (failed.length > 0) {
      parts.push(`${failed.length} failed`)
    }

    // Add role breakdown
    const roleCount = new Map<string, number>()
    for (const output of outputs) {
      roleCount.set(output.role, (roleCount.get(output.role) || 0) + 1)
    }

    const roleBreakdown = Array.from(roleCount.entries())
      .map(([role, count]) => `${role}: ${count}`)
      .join(', ')
    
    if (roleBreakdown) {
      parts.push(`[${roleBreakdown}]`)
    }

    return parts.join(' | ')
  }

  /**
   * Format role name for display
   */
  private formatRole(role: string): string {
    return role
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  /**
   * Count occurrences of each value
   */
  private countOccurrences(values: string[]): Map<string, number> {
    const counts = new Map<string, number>()
    for (const value of values) {
      counts.set(value, (counts.get(value) || 0) + 1)
    }
    return counts
  }

  /**
   * Get most common value
   */
  private getMostCommon(values: string[]): string | undefined {
    const counts = this.countOccurrences(values)
    let maxCount = 0
    let mostCommon: string | undefined
    
    for (const entry of Array.from(counts.entries())) {
      const [value, count] = entry
      if (count > maxCount) {
        maxCount = count
        mostCommon = value
      }
    }
    
    return mostCommon
  }

  /**
   * Extract distinct proposals from outputs
   */
  private extractProposals(outputs: AgentOutput[]): string[] {
    const proposals: string[] = []
    const seen = new Set<string>()

    for (const output of outputs) {
      // Extract sentences that look like decisions/proposals
      const sentences = output.content.split(/[.!?]+/)
      
      for (const sentence of sentences) {
        const trimmed = sentence.trim()
        if (trimmed.length > 10 && trimmed.length < 200) {
          // Normalize for comparison
          const normalized = trimmed.toLowerCase()
          if (!seen.has(normalized)) {
            seen.add(normalized)
            proposals.push(trimmed)
          }
        }
      }
    }

    return proposals
  }

  /**
   * Count total tool calls across all outputs
   */
  private countToolCalls(outputs: AgentOutput[]): number {
    let count = 0
    for (const output of outputs) {
      if (output.toolCalls) {
        count += output.toolCalls.length
      }
    }
    return count
  }

  /**
   * Detect conflicts between outputs
   */
  detectConflicts(outputs: AgentOutput[]): ConflictResolution[] {
    const conflicts: ConflictResolution[] = []

    // Compare outputs for content conflicts
    for (let i = 0; i < outputs.length; i++) {
      for (let j = i + 1; j < outputs.length; j++) {
        const outputA = outputs[i]
        const outputB = outputs[j]

        // Check for contradictory statements
        if (this.areContradictory(outputA.content, outputB.content)) {
          conflicts.push({
            type: 'content',
            originalOutputs: [outputA, outputB],
            resolvedValue: outputA.content, // Default resolution
            resolutionMethod: 'first'
          })
        }
      }
    }

    return conflicts
  }

  /**
   * Check if two content strings are contradictory
   */
  private areContradictory(contentA: string, contentB: string): boolean {
    const contradictions = [
      { positive: /\b(yes|agree|correct|good|should)\b/i, negative: /\b(no|disagree|incorrect|bad|should not)\b/i },
      { positive: /\b(include|add|use)\b/i, negative: /\b(exclude|remove|don't use)\b/i },
      { positive: /\b(success|passed|working)\b/i, negative: /\b(failure|failed|broken)\b/i }
    ]

    for (const { positive, negative } of contradictions) {
      const aHasPositive = positive.test(contentA)
      const aHasNegative = negative.test(contentA)
      const bHasPositive = positive.test(contentB)
      const bHasNegative = negative.test(contentB)

      if ((aHasPositive && bHasNegative) || (aHasNegative && bHasPositive)) {
        return true
      }
    }

    return false
  }

  /**
   * Merge with custom conflict resolution
   */
  mergeWithResolution(
    outputs: AgentOutput[],
    resolveConflicts: 'first' | 'last' | 'consensus'
  ): string {
    const conflicts = this.detectConflicts(outputs)
    
    if (conflicts.length === 0) {
      return this.mergeSequential(outputs)
    }

    // Apply resolution strategy
    switch (resolveConflicts) {
      case 'first':
        return this.mergeSequential(outputs)
      case 'last':
        return outputs.map(o => o.content).reverse().join('\n\n')
      case 'consensus':
        return this.mergeConsensus(outputs)
      default:
        return this.mergeSequential(outputs)
    }
  }
}

export const resultAggregator = new ResultAggregator()
