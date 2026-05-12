/**
 * Platform Service Type Definitions
 * Cross-platform abstraction layer types
 */

export enum Platform {
  Windows = 'windows',
  Linux = 'linux',
  MacOS = 'darwin',
  Unknown = 'unknown',
}

export enum Arch {
  X64 = 'x64',
  X86 = 'x86',
  Arm64 = 'arm64',
  Arm = 'arm',
  Unknown = 'unknown',
}

export interface PlatformInfo {
  platform: Platform;
  arch: Arch;
  isWindows: boolean;
  isLinux: boolean;
  isMacOS: boolean;
  is64Bit: boolean;
  homedir: string;
  hostname: string;
  platformString: string;
}

export interface IPathAdapter {
  /**
   * Convert a path to the native format for the current platform
   */
  toNativePath(path: string): string;

  /**
   * Convert a path to a POSIX-compatible format
   */
  toPosixPath(path: string): string;

  /**
   * Convert a Windows-style path to native format
   */
  toWindowsPath(path: string): string;

  /**
   * Check if a path is absolute
   */
  isAbsolute(path: string): boolean;

  /**
   * Join path segments
   */
  join(...paths: string[]): string;

  /**
   * Get the base name of a path
   */
  basename(path: string, ext?: string): string;

  /**
   * Get the directory name of a path
   */
  dirname(path: string): string;

  /**
   * Get the file extension
   */
  extname(path: string): string;

  /**
   * Normalize a path (resolve . and ..)
   */
  normalize(path: string): string;

  /**
   * Resolve to an absolute path
   */
  resolve(...paths: string[]): string;

  /**
   * Get the path to the user's home directory
   */
  home(): string;

  /**
   * Get the path to a temp directory
   */
  tmpdir(): string;
}

export interface IProcessAdapter {
  /**
   * Get environment variables
   */
  env(): NodeJS.ProcessEnv;

  /**
   * Get a specific environment variable
   */
  getEnv(key: string): string | undefined;

  /**
   * Set environment variables
   */
  setEnv(key: string, value: string): void;

  /**
   * Delete an environment variable
   */
  deleteEnv(key: string): void;

  /**
   * Get the current working directory
   */
  cwd(): string;

  /**
   * Change the current working directory
   */
  chdir(directory: string): void;

  /**
   * Get the platform info
   */
  platform(): NodeJS.Platform;

  /**
   * Get the number of CPU cores
   */
  cpuCount(): number;

  /**
   * Get the amount of free memory in bytes
   */
  freemem(): number;

  /**
   * Get the total amount of memory in bytes
   */
  totalmem(): number;

  /**
   * Get the process uptime in seconds
   */
  uptime(): number;

  /**
   * Get the process ID
   */
  pid(): number;

  /**
   * Get the parent process ID
   */
  ppid(): number;
}

export enum ShellType {
  Bash = 'bash',
  Zsh = 'zsh',
  PowerShell = 'powershell',
  Cmd = 'cmd',
  Sh = 'sh',
  Unknown = 'unknown',
}

export interface ShellInfo {
  type: ShellType;
  version?: string;
  path?: string;
  isWindows: boolean;
  supportsansi: boolean;
}

export interface DangerousCommand {
  windows: string;
  unix: string;
  description: string;
}

export interface IShellAdapter {
  /**
   * Get information about the current shell
   */
  getShell(): ShellInfo;

  /**
   * Detect the current shell type
   */
  detectShell(): ShellType;

  /**
   * Check if a command is dangerous and should be blocked
   */
  isDangerousCommand(command: string): DangerousCommand | null;

  /**
   * Translate a command to the current shell's syntax
   */
  translateCommand(command: string): string;

  /**
   * Check if the shell supports ANSI escape codes
   */
  supportsAnsi(): boolean;

  /**
   * Get the shell executable path
   */
  getShellPath(): string;

  /**
   * Get the default shell for the platform
   */
  getDefaultShell(): string;

  /**
   * Quote a string for shell usage
   */
  quote(str: string): string;

  /**
   * Escape a string for shell usage
   */
  escape(str: string): string;
}

export interface IPlatformImpl {
  path: IPathAdapter;
  process: IProcessAdapter;
  shell: IShellAdapter;
}
