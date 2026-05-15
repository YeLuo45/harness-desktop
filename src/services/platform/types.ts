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
   * Path separator for the current platform
   */
  sep: string;

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

// Platform type for harness platform detection
export type PlatformType = 'electron' | 'web' | 'telegram' | 'feishu';

// WebSocket adapter interface
export interface WebSocketAdapter {
  send(data: string): void;
  close(): void;
  onOpen(callback: () => void): void;
  onClose(callback: () => void): void;
  onError(callback: (error: Error) => void): void;
}

// Platform capabilities
export interface PlatformCapabilities {
  fs: { read: boolean; write: boolean; watch: boolean; selectDir: boolean };
  network: { http: boolean; websocket: boolean };
  system: { notifications: boolean; clipboard: boolean; shell: boolean };
  ui: { window: boolean; dialog: boolean; tray: boolean; trayMenu: boolean };
  storage: { localStorage: boolean; indexedDB: boolean; fileSystem: boolean };
  communication: { telegram: boolean; feishu: boolean; webhooks: boolean };
}

// Platform adapter interface
export interface PlatformAdapter {
  readonly platform: PlatformType;
  initialize(): Promise<void>;
  getCapabilities(): PlatformCapabilities;
  fs: {
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    readDir(dirPath: string): Promise<Array<{ name: string; isDirectory: boolean; path: string }>>;
    selectDirectory(): Promise<string | null>;
  };
  network: {
    fetch(url: string, options?: RequestInit): Promise<Response>;
    websocket(url: string, onMessage: (data: string) => void): WebSocketAdapter;
  };
  system: {
    showNotification(title: string, body: string): Promise<void>;
    copyToClipboard(text: string): Promise<void>;
    openExternal(url: string): Promise<void>;
    getLocale(): string;
    getTimezone(): string;
  };
  window: {
    minimize(): Promise<void>;
    maximize(): Promise<void>;
    close(): Promise<void>;
    isMaximized(): Promise<boolean>;
  };
  storage: {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T): Promise<void>;
    remove(key: string): Promise<void>;
    clear(): Promise<void>;
  };
}

// Default capabilities by platform
export const DEFAULT_CAPABILITIES: Record<PlatformType, PlatformCapabilities> = {
  electron: {
    fs: { read: true, write: true, watch: true, selectDir: true },
    network: { http: true, websocket: true },
    system: { notifications: true, clipboard: true, shell: true },
    ui: { window: true, dialog: true, tray: true, trayMenu: true },
    storage: { localStorage: true, indexedDB: true, fileSystem: true },
    communication: { telegram: false, feishu: false, webhooks: true }
  },
  web: {
    fs: { read: false, write: false, watch: false, selectDir: false },
    network: { http: true, websocket: true },
    system: { notifications: false, clipboard: true, shell: false },
    ui: { window: false, dialog: true, tray: false, trayMenu: false },
    storage: { localStorage: true, indexedDB: true, fileSystem: false },
    communication: { telegram: false, feishu: false, webhooks: true }
  },
  telegram: {
    fs: { read: false, write: false, watch: false, selectDir: false },
    network: { http: true, websocket: true },
    system: { notifications: true, clipboard: true, shell: false },
    ui: { window: false, dialog: false, tray: false, trayMenu: false },
    storage: { localStorage: true, indexedDB: true, fileSystem: false },
    communication: { telegram: true, feishu: false, webhooks: true }
  },
  feishu: {
    fs: { read: false, write: false, watch: false, selectDir: false },
    network: { http: true, websocket: true },
    system: { notifications: true, clipboard: true, shell: false },
    ui: { window: false, dialog: false, tray: false, trayMenu: false },
    storage: { localStorage: true, indexedDB: true, fileSystem: false },
    communication: { telegram: false, feishu: true, webhooks: true }
  }
};
