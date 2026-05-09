// Performance Optimization - barrel export

export * from './performanceTypes'
export { PriorityQueue } from './priorityQueue'
export { ResultCache, resultCache } from './resultCache'
export { LoadBalancer, loadBalancer } from './loadBalancer'
export { TaskScheduler, taskScheduler } from './taskScheduler'

/*
Quick Start:

import { taskScheduler, Priority, TaskScheduler } from './performance'

// Register task handler
taskScheduler.registerHandler('my_task', async (task) => {
  return { processed: true, input: task.payload }
})

// Submit task
const id = await taskScheduler.submit('my_task', { data: 'test' }, {
  priority: Priority.HIGH,
  timeout: 5000,
  maxRetries: 3
})

// Get stats
const queueStats = taskScheduler.getQueueStats()
const schedulerStats = taskScheduler.getSchedulerStats()

// Control
taskScheduler.pause()
taskScheduler.resume()
taskScheduler.stop()
*/
