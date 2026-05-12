/**
 * Cross-Platform Process Adapter
 * Provides consistent process operations across Windows, Linux, and macOS
 */

import * as os from 'os';
import { IProcessAdapter } from './types';

function createProcessAdapter(): IProcessAdapter {
  const isWindows = process.platform === 'win32';
  const _env = { ...process.env };

  /**
   * Get environment variables
   */
  function env(): NodeJS.ProcessEnv {
    return { ..._env };
  }

  /**
   * Get a specific environment variable
   */
  function getEnv(key: string): string | undefined {
    return _env[key];
  }

  /**
   * Set environment variables
   */
  function setEnv(key: string, value: string): void {
    _env[key] = value;
    process.env[key] = value;
  }

  /**
   * Delete an environment variable
   */
  function deleteEnv(key: string): void {
    delete _env[key];
    delete process.env[key];
  }

  /**
   * Get the current working directory
   */
  function cwd(): string {
    return process.cwd();
  }

  /**
   * Change the current working directory
   */
  function chdir(directory: string): void {
    process.chdir(directory);
  }

  /**
   * Get the platform info
   */
  function platform(): NodeJS.Platform {
    return process.platform;
  }

  /**
   * Get the number of CPU cores
   */
  function cpuCount(): number {
    return os.cpus().length;
  }

  /**
   * Get the amount of free memory in bytes
   */
  function freemem(): number {
    return os.freemem();
  }

  /**
   * Get the total amount of memory in bytes
   */
  function totalmem(): number {
    return os.totalmem();
  }

  /**
   * Get the process uptime in seconds
   */
  function uptime(): number {
    return process.uptime();
  }

  /**
   * Get the process ID
   */
  function pid(): number {
    return process.pid;
  }

  /**
   * Get the parent process ID
   */
  function ppid(): number {
    return process.ppid;
  }

  return {
    env,
    getEnv,
    setEnv,
    deleteEnv,
    cwd,
    chdir,
    platform,
    cpuCount,
    freemem,
    totalmem,
    uptime,
    pid,
    ppid,
  };
}

export { createProcessAdapter };
export default createProcessAdapter;
