/**
 * Result Aggregator
 * Combines and merges results from multiple sub-tasks into a unified result
 */

import { SubTaskResult, OrchestrationResult, AggregatorConfig } from './types';

/** Default aggregator configuration */
const DEFAULT_CONFIG: AggregatorConfig = {
  mergeStrategy: 'combine',
};

/**
 * Result Aggregator for combining sub-task results
 */
export class ResultAggregator {
  private config: AggregatorConfig;
  
  constructor(config: Partial<AggregatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Aggregates multiple sub-task results into a single orchestration result
   */
  aggregate(
    taskId: string,
    subTaskResults: SubTaskResult[],
    startTime: Date
  ): OrchestrationResult {
    const success = subTaskResults.every(r => r.success);
    const aggregatedData = this.mergeResults(subTaskResults);
    const totalExecutionTimeMs = Date.now() - startTime.getTime();
    
    return {
      taskId,
      success,
      subTaskResults,
      aggregatedData,
      totalExecutionTimeMs,
      completedAt: new Date(),
    };
  }
  
  /**
   * Merges results based on configured strategy
   */
  private mergeResults(results: SubTaskResult[]): unknown {
    switch (this.config.mergeStrategy) {
      case 'first_wins':
        return this.firstWinsMerge(results);
      
      case 'last_wins':
        return this.lastWinsMerge(results);
      
      case 'combine':
        return this.combineMerge(results);
      
      case 'custom':
        if (this.config.customMergeFn) {
          return this.config.customMergeFn(results);
        }
        return this.combineMerge(results);
      
      default:
        return this.combineMerge(results);
    }
  }
  
  /**
   * First wins merge strategy - returns the first successful result
   */
  private firstWinsMerge(results: SubTaskResult[]): unknown {
    const firstSuccess = results.find(r => r.success && r.data !== undefined);
    return firstSuccess?.data ?? null;
  }
  
  /**
   * Last wins merge strategy - returns the last successful result
   */
  private lastWinsMerge(results: SubTaskResult[]): unknown {
    const successfulResults = results.filter(r => r.success && r.data !== undefined);
    return successfulResults.length > 0 
      ? successfulResults[successfulResults.length - 1].data 
      : null;
  }
  
  /**
   * Combine merge strategy - merges all results into an array or object
   */
  private combineMerge(results: SubTaskResult[]): unknown {
    const successfulData = results
      .filter(r => r.success && r.data !== undefined)
      .map(r => r.data);
    
    if (successfulData.length === 0) {
      return null;
    }
    
    if (successfulData.length === 1) {
      return successfulData[0];
    }
    
    // Check if all results are objects that can be merged
    if (successfulData.every(d => typeof d === 'object' && d !== null && !Array.isArray(d))) {
      return this.deepMerge(successfulData as Record<string, unknown>[]);
    }
    
    return successfulData;
  }
  
  /**
   * Deep merges multiple objects
   */
  private deepMerge(objects: Record<string, unknown>[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    
    for (const obj of objects) {
      for (const [key, value] of Object.entries(obj)) {
        if (result[key] !== undefined && typeof result[key] === 'object' && typeof value === 'object') {
          result[key] = this.mergeNestedObjects(result[key] as Record<string, unknown>, value as Record<string, unknown>);
        } else {
          result[key] = value;
        }
      }
    }
    
    return result;
  }
  
  /**
   * Merges two nested objects
   */
  private mergeNestedObjects(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
    const result = { ...a };
    
    for (const [key, value] of Object.entries(b)) {
      if (result[key] !== undefined && typeof result[key] === 'object' && typeof value === 'object') {
        result[key] = this.mergeNestedObjects(
          result[key] as Record<string, unknown>,
          value as Record<string, unknown>
        );
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }
  
  /**
   * Filters results by status
   */
  filterResults(results: SubTaskResult[], status: 'success' | 'failure'): SubTaskResult[] {
    return results.filter(r => status === 'success' ? r.success : !r.success);
  }
  
  /**
   * Groups results by a specific key
   */
  groupResults<T>(results: SubTaskResult[], keyFn: (result: SubTaskResult) => T): Map<T, SubTaskResult[]> {
    const groups = new Map<T, SubTaskResult[]>();
    
    for (const result of results) {
      const key = keyFn(result);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(result);
    }
    
    return groups;
  }
  
  /**
   * Calculates summary statistics from results
   */
  calculateStats(results: SubTaskResult[]): {
    total: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    averageExecutionTimeMs: number;
    totalExecutionTimeMs: number;
  } {
    const successResults = results.filter(r => r.success);
    const totalTime = results.reduce((sum, r) => sum + r.executionTimeMs, 0);
    
    return {
      total: results.length,
      successCount: successResults.length,
      failureCount: results.length - successResults.length,
      successRate: results.length > 0 ? successResults.length / results.length : 0,
      averageExecutionTimeMs: results.length > 0 ? totalTime / results.length : 0,
      totalExecutionTimeMs: totalTime,
    };
  }
  
  /**
   * Generates a summary report from results
   */
  generateReport(result: OrchestrationResult): string {
    const stats = this.calculateStats(result.subTaskResults);
    
    const lines = [
      `=== Orchestration Result Report ===`,
      `Task ID: ${result.taskId}`,
      `Status: ${result.success ? 'SUCCESS' : 'FAILED'}`,
      `Total Sub-tasks: ${stats.total}`,
      `Successful: ${stats.successCount}`,
      `Failed: ${stats.failureCount}`,
      `Success Rate: ${(stats.successRate * 100).toFixed(1)}%`,
      `Total Execution Time: ${result.totalExecutionTimeMs}ms`,
      `Average Task Time: ${stats.averageExecutionTimeMs.toFixed(1)}ms`,
      `Completed At: ${result.completedAt.toISOString()}`,
    ];
    
    // Add failed task details
    const failures = this.filterResults(result.subTaskResults, 'failure');
    if (failures.length > 0) {
      lines.push('');
      lines.push('Failed Tasks:');
      for (const failure of failures) {
        lines.push(`  - ${failure.taskId}: ${failure.error || 'Unknown error'}`);
      }
    }
    
    return lines.join('\n');
  }
}

export default ResultAggregator;
