/**
 * P9: Task Scheduling - Cron Parser
 * 
 * Simple cron expression parser supporting 5-field format:
 * minute hour dayOfMonth month dayOfWeek
 * 
 * Examples:
 *   "0 9 * * *" => daily at 9:00 AM
 *   "0,15,30,45 * * * *" => every 15 minutes
 *   "0 0 1 * *" => monthly at midnight on 1st
 */

import type { CronFields } from './types'

// Parse a single cron field, handling *, /, and ranges
function parseField(field: string, min: number, max: number): number[] {
  const values: number[] = []
  
  // Handle step values with */n
  if (field === '*') {
    for (let i = min; i <= max; i++) values.push(i)
    return values
  }
  
  if (field.includes('/')) {
    const [base, stepStr] = field.split('/')
    const step = parseInt(stepStr, 10)
    if (isNaN(step) || step <= 0) return []
    
    const baseValues = base === '*' 
      ? Array.from({ length: max - min + 1 }, (_, i) => min + i)
      : parseRangeOrList(base, min, max)
    
    for (let i = 0; i < baseValues.length; i += step) {
      values.push(baseValues[i])
    }
    return values
  }
  
  return parseRangeOrList(field, min, max)
}

function parseRangeOrList(field: string, min: number, max: number): number[] {
  const values: number[] = []
  
  if (field.includes(',')) {
    // Comma-separated list
    for (const part of field.split(',')) {
      const parsed = parseSingleValue(part.trim(), min, max)
      if (parsed !== null) values.push(parsed)
    }
  } else if (field.includes('-')) {
    // Range
    const [startStr, endStr] = field.split('-')
    const start = parseInt(startStr, 10)
    const end = parseInt(endStr, 10)
    if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
      return []
    }
    for (let i = start; i <= end; i++) values.push(i)
  } else {
    // Single value
    const parsed = parseSingleValue(field, min, max)
    if (parsed !== null) values.push(parsed)
  }
  
  return values
}

function parseSingleValue(value: string, min: number, max: number): number | null {
  const num = parseInt(value, 10)
  if (isNaN(num) || num < min || num > max) return null
  return num
}

// Normalize dayOfWeek: 7 becomes 0 (both = Sunday)
function normalizeDayOfWeek(day: number): number {
  return day === 7 ? 0 : day
}

/**
 * Parse a cron expression into its component fields
 * Supports 5-field format: minute hour dayOfMonth month dayOfWeek
 */
export function parseCron(expression: string): CronFields | null {
  const trimmed = expression.trim()
  const parts = trimmed.split(/\s+/)
  
  // Support both 5-field (minute hour dayOfMonth month dayOfWeek)
  // and 6-field (second minute hour dayOfMonth month dayOfWeek)
  if (parts.length !== 5 && parts.length !== 6) {
    return null
  }
  
  let minuteIdx = 0
  let secondPart: string | undefined
  
  if (parts.length === 6) {
    // 6-field format: second is first field
    secondPart = parts[0]
    minuteIdx = 1
  }
  
  const minute = parseField(parts[minuteIdx], 0, 59)
  const hour = parseField(parts[minuteIdx + 1], 0, 23)
  const dayOfMonth = parseField(parts[minuteIdx + 2], 1, 31)
  const month = parseField(parts[minuteIdx + 3], 1, 12)
  let dayOfWeek = parseField(parts[minuteIdx + 4], 0, 6)
  
  // Normalize dayOfWeek: 7 -> 0
  dayOfWeek = dayOfWeek.map(normalizeDayOfWeek)
  
  if (minute.length === 0 || hour.length === 0 || 
      dayOfMonth.length === 0 || month.length === 0 || dayOfWeek.length === 0) {
    return null
  }
  
  return {
    second: secondPart,
    minute: parts[minuteIdx],
    hour: parts[minuteIdx + 1],
    dayOfMonth: parts[minuteIdx + 2],
    month: parts[minuteIdx + 3],
    dayOfWeek: parts[minuteIdx + 4]
  }
}

/**
 * Validate a cron expression
 */
export function isValidCron(expression: string): boolean {
  return parseCron(expression) !== null
}

/**
 * Get the next run time (timestamp) for a cron expression
 */
export function getNextRunTime(expression: string, from: number = Date.now()): number | null {
  const fields = parseCron(expression)
  if (!fields) return null
  
  const parts = expression.trim().split(/\s+/)
  let minuteIdx = 0
  if (parts.length === 6) minuteIdx = 1
  
  const minuteField = parseField(parts[minuteIdx], 0, 59)
  const hourField = parseField(parts[minuteIdx + 1], 0, 23)
  const dayOfMonthField = parseField(parts[minuteIdx + 2], 1, 31)
  const monthField = parseField(parts[minuteIdx + 3], 1, 12)
  let dayOfWeekField = parseField(parts[minuteIdx + 4], 0, 6).map(normalizeDayOfWeek)
  
  const fromDate = new Date(from)
  const current = new Date(fromDate)
  
  // Start from the next minute
  current.setSeconds(0, 0)
  current.setMinutes(current.getMinutes() + 1)
  
  // Max iterations to prevent infinite loops (search up to 1 year ahead)
  const maxIterations = 366 * 24 * 60
  
  for (let i = 0; i < maxIterations; i++) {
    const month = current.getMonth() + 1 // getMonth is 0-indexed
    const dayOfMonth = current.getDate()
    const dayOfWeek = normalizeDayOfWeek(current.getDay())
    const hour = current.getHours()
    const minute = current.getMinutes()
    
    // Check each field
    const monthMatch = monthField.includes(month)
    const dayOfMonthMatch = dayOfMonthField.includes(dayOfMonth)
    const dayOfWeekMatch = dayOfWeekField.includes(dayOfWeek)
    const hourMatch = hourField.includes(hour)
    const minuteMatch = minuteField.includes(minute)
    
    // For day matching: cron typically uses OR between dayOfMonth and dayOfWeek
    // unless both are specified with special characters
    const dayMatch = (dayOfMonthMatch || dayOfWeekMatch) && !(parts[minuteIdx + 2] === '*' && parts[minuteIdx + 4] === '*')
      ? (dayOfMonthMatch && dayOfWeekMatch)
        ? true // both specified and both match (rare case)
        : (parts[minuteIdx + 2] === '*' ? dayOfWeekMatch : dayOfMonthMatch)
      : (dayOfMonthMatch || dayOfWeekMatch)
    
    if (monthMatch && dayMatch && hourMatch && minuteMatch) {
      return current.getTime()
    }
    
    // Advance to next minute
    current.setMinutes(current.getMinutes() + 1)
  }
  
  return null // Should not reach here for valid cron expressions
}
