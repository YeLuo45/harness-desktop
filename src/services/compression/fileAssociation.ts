/**
 * FileAssociationTracker - Tracks file operations and their associated pointers
 * Provides history and relationship queries for file-based context
 */

export interface FileOperation {
  type: 'read' | 'write' | 'delete'
  timestamp: number
  pointerId: string
}

export interface FileAssociation {
  filePath: string
  operations: FileOperation[]
  lastModified: number
  relatedPointers: string[]
}

export class FileAssociationTracker {
  private associations: Map<string, FileAssociation> = new Map()

  /**
   * Track a file operation
   */
  trackOperation(filePath: string, type: FileOperation['type'], pointerId: string): void {
    const operation: FileOperation = {
      type,
      timestamp: Date.now(),
      pointerId
    }

    if (!this.associations.has(filePath)) {
      this.associations.set(filePath, {
        filePath,
        operations: [],
        lastModified: operation.timestamp,
        relatedPointers: []
      })
    }

    const association = this.associations.get(filePath)!
    association.operations.push(operation)
    association.lastModified = operation.timestamp

    // Track related pointer if not already recorded
    if (!association.relatedPointers.includes(pointerId)) {
      association.relatedPointers.push(pointerId)
    }
  }

  /**
   * Get file operation history
   */
  getFileHistory(filePath: string): FileOperation[] {
    const association = this.associations.get(filePath)
    return association?.operations || []
  }

  /**
   * Get pointers associated with a file
   */
  getRelatedPointers(filePath: string): string[] {
    const association = this.associations.get(filePath)
    return association?.relatedPointers || []
  }

  /**
   * Get full file association data
   */
  getFileAssociation(filePath: string): FileAssociation | undefined {
    return this.associations.get(filePath)
  }

  /**
   * Get all tracked file paths
   */
  getAllTrackedFiles(): string[] {
    return Array.from(this.associations.keys())
  }

  /**
   * Get recently modified files
   */
  getRecentlyModifiedFiles(limit = 10): FileAssociation[] {
    return Array.from(this.associations.values())
      .sort((a, b) => b.lastModified - a.lastModified)
      .slice(0, limit)
  }

  /**
   * Get operation history by type
   */
  getOperationsByType(filePath: string, type: FileOperation['type']): FileOperation[] {
    const association = this.associations.get(filePath)
    if (!association) return []
    return association.operations.filter(op => op.type === type)
  }

  /**
   * Clear all tracking data
   */
  clear(): void
  /**
   * Clear tracking data for a specific file
   */
  clear(filePath: string): void
  clear(filePath?: string): void {
    if (filePath) {
      this.associations.delete(filePath)
    } else {
      this.associations.clear()
    }
  }

  /**
   * Get statistics about tracked files
   */
  getStats(): {
    totalFiles: number
    totalOperations: number
    readCount: number
    writeCount: number
    deleteCount: number
  } {
    let totalOperations = 0
    let readCount = 0
    let writeCount = 0
    let deleteCount = 0

    for (const association of this.associations.values()) {
      totalOperations += association.operations.length
      for (const op of association.operations) {
        switch (op.type) {
          case 'read': readCount++; break
          case 'write': writeCount++; break
          case 'delete': deleteCount++; break
        }
      }
    }

    return {
      totalFiles: this.associations.size,
      totalOperations,
      readCount,
      writeCount,
      deleteCount
    }
  }

  /**
   * Rebuild tracker from list of file associations
   */
  rebuild(associations: FileAssociation[]): void {
    this.associations.clear()
    for (const assoc of associations) {
      this.associations.set(assoc.filePath, { ...assoc })
    }
  }
}

// Singleton instance
let fileTrackerInstance: FileAssociationTracker | null = null

export function getFileAssociationTracker(): FileAssociationTracker {
  if (!fileTrackerInstance) {
    fileTrackerInstance = new FileAssociationTracker()
  }
  return fileTrackerInstance
}

export function initFileAssociationTracker(associations?: FileAssociation[]): FileAssociationTracker {
  fileTrackerInstance = new FileAssociationTracker()
  if (associations) {
    fileTrackerInstance.rebuild(associations)
  }
  return fileTrackerInstance
}
