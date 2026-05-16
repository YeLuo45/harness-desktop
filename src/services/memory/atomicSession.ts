import { promises as fs } from 'fs'
import { dirname } from 'path'

/**
 * Save session data atomically: write to temp file, fsync, rename.
 * On POSIX systems this guarantees no partial writes or corruption
 * if the process crashes between write and rename.
 */
export async function saveSessionAtomic(path: string, data: unknown): Promise<void> {
  const dir = dirname(path)
  const tmpPath = `${path}.tmp.${Date.now()}`
  const content = JSON.stringify(data, null, 2)

  // Ensure parent directory exists
  await fs.mkdir(dir, { recursive: true })

  // Write to temp file
  await fs.writeFile(tmpPath, content, 'utf-8')

  // fsync to flush OS buffers
  const fd = await fs.open(tmpPath, 'r+')
  await fd.sync()
  await fd.close()

  // Atomic rename (POSIX guarantees atomicity for rename within same filesystem)
  await fs.rename(tmpPath, path)
}

/**
 * Load session data with corruption recovery.
 * Returns null on missing file or JSON parse error.
 */
export async function loadSession(path: string): Promise<unknown | null> {
  try {
    const content = await fs.readFile(path, 'utf-8')
    return JSON.parse(content)
  } catch {
    // File missing or corrupted
    return null
  }
}