import type { Message } from '../../types'

export interface DreamMemoryConfig {
  /** Number of recent messages to summarise during dream phase (default: 50) */
  dreamWindow: number
  /** Max tokens before triggering compact (default: 128000) */
  maxTokens: number
  /** Ratio of maxTokens to trigger compaction (default: 0.8) */
  compactThreshold: number
  /** LLM callback used to generate summaries */
  llmSummarize: (text: string) => Promise<string>
}

export interface Session {
  id: string
  history: Message[]
  metadata: Record<string, unknown>
  createdAt: number
  updatedAt: number
  lastActiveAt: number
}

export class DreamMemoryService {
  private config: Required<DreamMemoryConfig>

  constructor(config: DreamMemoryConfig) {
    this.config = {
      dreamWindow: config.dreamWindow ?? 50,
      maxTokens: config.maxTokens ?? 128000,
      compactThreshold: config.compactThreshold ?? 0.8,
      llmSummarize: config.llmSummarize
    }
  }

  /**
   * Wake phase: record incoming message, check dream/compact triggers,
   * and schedule consolidation non-blocking via setTimeout(0).
   */
  async wake(session: Session, message: Message): Promise<void> {
    session.history.push(message)
    session.updatedAt = Date.now()
    session.lastActiveAt = Date.now()

    // Non-blocking triggers
    setTimeout(() => {
      if (this.shouldDream(session)) {
        this.dream(session).catch(err => {
          console.error('[DreamMemory] dream error:', err)
        })
      }
    }, 0)

    setTimeout(() => {
      if (this.shouldCompact(session)) {
        this.compact(session).catch(err => {
          console.error('[DreamMemory] compact error:', err)
        })
      }
    }, 0)
  }

  /**
   * Dream phase: summarise the last dreamWindow messages via LLM,
   * store the summary in metadata.dream_summaries, and prune history.
   */
  async dream(session: Session): Promise<void> {
    const window = session.history.slice(-this.config.dreamWindow)
    if (window.length === 0) return

    const rawText = window.map(m => `${m.role}: ${m.content}`).join('\n')
    const summaryText = await this.config.llmSummarize(rawText)

    const summaries: Array<{ text: string; messageCount: number; timestamp: number }> =
      (session.metadata.dream_summaries as Array<{ text: string; messageCount: number; timestamp: number }>) ?? []

    summaries.push({
      text: summaryText,
      messageCount: window.length,
      timestamp: Date.now()
    })

    session.metadata.dream_summaries = summaries

    // Prune the summarised window from history (keep the summary)
    const keepCount = session.history.length - window.length
    if (keepCount >= 0) {
      session.history = session.history.slice(0, keepCount)
    }

    session.updatedAt = Date.now()
  }

  /**
   * Compact phase: when token count exceeds maxTokens * compactThreshold,
   * compress the middle portion of history into a single summary.
   */
  async compact(session: Session): Promise<void> {
    const tokenCount = this.estimateTokens(session.history)
    const threshold = this.config.maxTokens * this.config.compactThreshold

    if (tokenCount <= threshold) return

    // Keep first 20% and last 20% as anchors; summarise the middle 60%
    const total = session.history.length
    const keepAnchor = Math.max(1, Math.floor(total * 0.2))
    const keepEnd = Math.max(1, Math.floor(total * 0.2))

    const head = session.history.slice(0, keepAnchor)
    const middle = session.history.slice(keepAnchor, total - keepEnd)
    const tail = session.history.slice(total - keepEnd)

    if (middle.length === 0) return

    const rawText = middle.map(m => `${m.role}: ${m.content}`).join('\n')
    const summaryText = await this.config.llmSummarize(rawText)

    const compactions: Array<{ text: string; messageCount: number; timestamp: number }> =
      (session.metadata.compactions as Array<{ text: string; messageCount: number; timestamp: number }>) ?? []

    compactions.push({
      text: summaryText,
      messageCount: middle.length,
      timestamp: Date.now()
    })

    session.metadata.compactions = compactions

    // Replace middle with a single placeholder message
    const placeholder: Message = {
      id: `compacted-${Date.now()}`,
      role: 'system',
      content: `[Compacted ${middle.length} messages into summary]`,
      timestamp: Date.now()
    }

    session.history = [...head, placeholder, ...tail]
    session.updatedAt = Date.now()
  }

  private shouldDream(session: Session): boolean {
    return session.history.length >= this.config.dreamWindow
  }

  private shouldCompact(session: Session): boolean {
    return this.estimateTokens(session.history) > this.config.maxTokens * this.config.compactThreshold
  }

  /**
   * Rough token estimate: ~4 characters per token (common heuristic for English).
   */
  private estimateTokens(messages: Message[]): number {
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0)
    return Math.ceil(totalChars / 4)
  }
}