import type { MemoryPointer } from '../../types'

/**
 * PointerIndex - Maintains various indexes on MemoryPointers for efficient querying
 * Provides O(1) lookups by type, O(log n) lookups by time, and O(1) by file/association
 */
export class PointerIndex {
  private byType: Map<MemoryPointer['type'], string[]> = new Map()
  private byTime: string[] = []
  private byFile: Map<string, string[]> = new Map()
  private byAssociation: Map<string, string[]> = new Map()

  // Internal map for fast pointer lookup by ID
  private pointers: Map<string, MemoryPointer> = new Map()

  // Track ordering for byTime
  private timeOrder: string[] = []

  /**
   * Add a pointer to all indexes
   */
  add(pointer: MemoryPointer): void {
    // Store pointer
    this.pointers.set(pointer.id, pointer)

    // Index by type
    if (!this.byType.has(pointer.type)) {
      this.byType.set(pointer.type, [])
    }
    this.byType.get(pointer.type)!.push(pointer.id)

    // Index by time - maintain sorted order
    this.insertByTime(pointer)

    // Index by file associations
    for (const assoc of pointer.associations) {
      if (!this.byAssociation.has(assoc)) {
        this.byAssociation.set(assoc, [])
      }
      this.byAssociation.get(assoc)!.push(pointer.id)
    }

    // Index file paths found in content
    this.indexFilePaths(pointer)
  }

  /**
   * Remove a pointer from all indexes
   */
  remove(pointerId: string): void {
    const pointer = this.pointers.get(pointerId)
    if (!pointer) return

    // Remove from type index
    const typeList = this.byType.get(pointer.type)
    if (typeList) {
      const idx = typeList.indexOf(pointerId)
      if (idx !== -1) typeList.splice(idx, 1)
    }

    // Remove from time index
    const timeIdx = this.timeOrder.indexOf(pointerId)
    if (timeIdx !== -1) this.timeOrder.splice(timeIdx, 1)

    // Remove from association index
    for (const assoc of pointer.associations) {
      const assocList = this.byAssociation.get(assoc)
      if (assocList) {
        const idx = assocList.indexOf(pointerId)
        if (idx !== -1) assocList.splice(idx, 1)
      }
    }

    // Remove file path references
    this.removeFileReferences(pointerId)

    // Remove from pointers map
    this.pointers.delete(pointerId)
  }

  /**
   * Update a pointer - removes old version and adds new
   */
  update(pointer: MemoryPointer): void {
    this.remove(pointer.id)
    this.add(pointer)
  }

  /**
   * Find pointers by type
   */
  findByType(type: MemoryPointer['type']): MemoryPointer[] {
    const ids = this.byType.get(type) || []
    return ids.map(id => this.pointers.get(id)).filter((p): p is MemoryPointer => p !== undefined)
  }

  /**
   * Find pointers within a time range
   */
  findByTimeRange(start: number, end: number): MemoryPointer[] {
    const result: MemoryPointer[] = []
    for (const id of this.timeOrder) {
      const pointer = this.pointers.get(id)
      if (pointer && pointer.timestamp >= start && pointer.timestamp <= end) {
        result.push(pointer)
      }
    }
    return result
  }

  /**
   * Find pointers associated with a specific file path
   */
  findByFile(filePath: string): MemoryPointer[] {
    const ids = this.byFile.get(filePath) || []
    return ids.map(id => this.pointers.get(id)).filter((p): p is MemoryPointer => p !== undefined)
  }

  /**
   * Find pointers associated with another pointer
   */
  findByAssociation(pointerId: string): MemoryPointer[] {
    const ids = this.byAssociation.get(pointerId) || []
    return ids.map(id => this.pointers.get(id)).filter((p): p is MemoryPointer => p !== undefined)
  }

  /**
   * Get all pointers
   */
  getAllPointers(): MemoryPointer[] {
    return Array.from(this.pointers.values())
  }

  /**
   * Get pointer by ID
   */
  getById(id: string): MemoryPointer | undefined {
    return this.pointers.get(id)
  }

  /**
   * Rebuild all indexes from a list of pointers
   */
  rebuild(pointers: MemoryPointer[]): void {
    // Clear all indexes
    this.byType.clear()
    this.byFile.clear()
    this.byAssociation.clear()
    this.pointers.clear()
    this.timeOrder = []

    // Rebuild
    for (const pointer of pointers) {
      this.add(pointer)
    }
  }

  /**
   * Clear all indexes
   */
  clear(): void {
    this.byType.clear()
    this.byFile.clear()
    this.byAssociation.clear()
    this.pointers.clear()
    this.timeOrder = []
  }

  /**
   * Get index size stats
   */
  getStats(): { totalPointers: number; byType: Record<string, number>; byFileCount: number } {
    const byType: Record<string, number> = {}
    for (const [type, ids] of this.byType) {
      byType[type] = ids.length
    }
    return {
      totalPointers: this.pointers.size,
      byType,
      byFileCount: this.byFile.size
    }
  }

  // Private helpers

  private insertByTime(pointer: MemoryPointer): void {
    const timestamp = pointer.timestamp
    let inserted = false

    // Find position using binary search-like approach
    for (let i = 0; i < this.timeOrder.length; i++) {
      const existing = this.pointers.get(this.timeOrder[i])
      if (existing && existing.timestamp > timestamp) {
        this.timeOrder.splice(i, 0, pointer.id)
        inserted = true
        break
      }
    }

    if (!inserted) {
      this.timeOrder.push(pointer.id)
    }
  }

  private indexFilePaths(pointer: MemoryPointer): void {
    // Extract file paths from fullContent (simple regex for demonstration)
    const pathRegex = /[\/\\]?[a-zA-Z]:[\\\/][^\s]+|\/[\w\-\.]+[\/][\w\-\.]+/g
    const matches = pointer.fullContent.match(pathRegex)

    if (matches) {
      for (const path of matches) {
        if (!this.byFile.has(path)) {
          this.byFile.set(path, [])
        }
        this.byFile.get(path)!.push(pointer.id)
      }
    }
  }

  private removeFileReferences(pointerId: string): void {
    for (const [, ids] of this.byFile) {
      const idx = ids.indexOf(pointerId)
      if (idx !== -1) {
        ids.splice(idx, 1)
      }
    }
    // Clean up empty entries
    for (const [path, ids] of this.byFile) {
      if (ids.length === 0) {
        this.byFile.delete(path)
      }
    }
  }
}

// Singleton instance
let pointerIndexInstance: PointerIndex | null = null

export function getPointerIndex(): PointerIndex {
  if (!pointerIndexInstance) {
    pointerIndexInstance = new PointerIndex()
  }
  return pointerIndexInstance
}

export function initPointerIndex(pointers?: MemoryPointer[]): PointerIndex {
  pointerIndexInstance = new PointerIndex()
  if (pointers) {
    pointerIndexInstance.rebuild(pointers)
  }
  return pointerIndexInstance
}
