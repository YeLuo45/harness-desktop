/**
 * Cross-Platform Shell Adapter
 * Provides shell abstraction for Windows (cmd.exe/powershell), Linux (bash/sh), and macOS
 */

import { IShellAdapter, ShellInfo, ShellType, DangerousCommand } from './types';

function createShellAdapter(): IShellAdapter {
  const isWindows = process.platform === 'win32';

  /**
   * Detect the current shell type
   */
  function detectShell(): ShellType {
    if (isWindows) {
      // Check if PowerShell is available
      try {
        const psPath = process.env.SYSTEMROOT + '\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
        const fs = require('fs');
        if (fs.existsSync(psPath)) {
          return ShellType.PowerShell;
        }
      } catch {}
      return ShellType.Cmd;
    }
    
    // Unix-like systems
    const shell = process.env.SHELL || '';
    if (shell.includes('zsh')) return ShellType.Zsh;
    if (shell.includes('bash')) return ShellType.Bash;
    return ShellType.Sh;
  }

  /**
   * Get information about the current shell
   */
  function getShell(): ShellInfo {
    const shellType = detectShell();
    return {
      type: shellType,
      isWindows,
      supportsansi: isWindows ? true : checkAnsiSupport(),
    };
  }

  /**
   * Check if the shell supports ANSI escape codes
   */
  function supportsAnsi(): boolean {
    if (isWindows) return true;
    return checkAnsiSupport();
  }

  function checkAnsiSupport(): boolean {
    const term = process.env.TERM || '';
    return term.includes('xterm') || term.includes('screen') || term.includes('ANSI');
  }

  /**
   * Get the shell executable path
   */
  function getShellPath(): string {
    if (isWindows) {
      return detectShell() === ShellType.PowerShell
        ? process.env.SYSTEMROOT + '\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
        : process.env.COMSPEC || 'cmd.exe';
    }
    return process.env.SHELL || '/bin/sh';
  }

  /**
   * Get the default shell for the platform
   */
  function getDefaultShell(): string {
    return isWindows ? 'cmd.exe' : '/bin/sh';
  }

  /**
   * Check if a command is dangerous and should be blocked
   */
  function isDangerousCommand(command: string): DangerousCommand | null {
    const lowerCommand = command.toLowerCase().trim();
    const parts = lowerCommand.split(/\s+/);
    const base = parts[0].split('/').pop() || '';

    const dangerousCommands: Record<string, { windows: string; unix: string; description: string }> = {
      'rm': { windows: 'del', unix: 'rm -rf', description: 'Delete files recursively' },
      'rmdir': { windows: 'rmdir /s /q', unix: 'rmdir -p', description: 'Remove directory' },
      'del': { windows: 'del /f /q', unix: 'rm', description: 'Delete files' },
      'format': { windows: 'format', unix: 'mkfs', description: 'Format disk' },
      'shutdown': { windows: 'shutdown /s /t 0', unix: 'shutdown -h now', description: 'Shutdown system' },
      'reboot': { windows: 'shutdown /r /t 0', unix: 'reboot', description: 'Reboot system' },
      'dd': { windows: 'dd', unix: 'dd', description: 'Direct disk access' },
      'chmod': { windows: 'icacls', unix: 'chmod', description: 'Change permissions' },
      'chown': { windows: 'takeown', unix: 'chown', description: 'Change owner' },
      'curl': { windows: 'curl', unix: 'curl', description: 'Download/upload data' },
      'wget': { windows: 'invoke-webrequest', unix: 'wget', description: 'Download files' },
      'bash': { windows: 'cmd', unix: 'bash', description: 'Execute bash shell' },
      'sh': { windows: 'cmd', unix: 'sh', description: 'Execute shell' },
      'powershell': { windows: 'powershell', unix: 'pwsh', description: 'Execute PowerShell' },
      'sudo': { windows: 'runas', unix: 'sudo', description: 'Run as administrator' },
      'su': { windows: 'runas', unix: 'su', description: 'Switch user' },
      'ssh': { windows: 'ssh', unix: 'ssh', description: 'Secure shell' },
      'scp': { windows: 'copy', unix: 'scp', description: 'Secure copy' },
      'mount': { windows: 'mount', unix: 'mount', description: 'Mount filesystem' },
      'umount': { windows: 'mountvol /p', unix: 'umount', description: 'Unmount filesystem' },
      'docker': { windows: 'docker', unix: 'docker', description: 'Container runtime' },
      'kubectl': { windows: 'kubectl', unix: 'kubectl', description: 'Kubernetes CLI' },
    };

    if (dangerousCommands[base]) {
      return dangerousCommands[base];
    }

    // Check for dangerous patterns
    if (/rm\s+-rf/.test(lowerCommand) || /del\s+\/f\s+\/q/.test(lowerCommand)) {
      return { windows: 'del /s /q', unix: 'rm -rf', description: 'Force delete files' };
    }
    if (/chmod\s+777/.test(lowerCommand)) {
      return { windows: 'icacls', unix: 'chmod 777', description: 'Grant full permissions' };
    }
    if (/curl\s+.*\|/.test(lowerCommand) || /wget\s+.*\|/.test(lowerCommand)) {
      return { windows: 'irm | iex', unix: 'curl | sh', description: 'Download and execute' };
    }

    return null;
  }

  /**
   * Translate a command to the current shell's syntax
   */
  function translateCommand(command: string): string {
    if (isWindows) {
      // Unix to Windows command translation
      return command
        .replace(/rm\s+-rf/gi, 'rmdir /s /q')
        .replace(/rm\s+-r/gi, 'rmdir /s /q')
        .replace(/rm\s+-f/gi, 'del /f /q')
        .replace(/rm\s+/gi, 'del /f ')
        .replace(/ls/gi, 'dir')
        .replace(/cat\s+/gi, 'type ')
        .replace(/cp\s+/gi, 'copy ')
        .replace(/mv\s+/gi, 'move ')
        .replace(/mkdir\s+-p\s+/gi, 'mkdir ')
        .replace(/grep\s+/gi, 'findstr ')
        .replace(/echo\s+/gi, 'echo ')
        .replace(/\|\s*grep/gi, '| findstr')
        .replace(/\|\s*wc/gi, '| find /c /v ""');
    }
    // Windows to Unix command translation (for cross-platform scripts)
    return command
      .replace(/del\s+\/f\s+\/q/gi, 'rm -f')
      .replace(/del\s+/gi, 'rm ')
      .replace(/rmdir\s+\/s\s+\/q/gi, 'rm -rf')
      .replace(/dir\s+/gi, 'ls ')
      .replace(/type\s+/gi, 'cat ')
      .replace(/copy\s+/gi, 'cp ')
      .replace(/move\s+/gi, 'mv ')
      .replace(/findstr\s+/gi, 'grep ')
      .replace(/move\s+(\S+)\s+(\S+)/gi, 'mv $1 $2');
  }

  /**
   * Quote a string for shell usage
   */
  function quote(str: string): string {
    if (isWindows) {
      // Windows: use double quotes, escape internal quotes
      return `"${str.replace(/"/g, '\\"')}"`;
    }
    // Unix: use single quotes (protects everything except single quotes themselves)
    if (str.includes("'")) {
      return `"${str.replace(/"/g, '\\"')}"`;
    }
    return `'${str}'`;
  }

  /**
   * Escape a string for shell usage
   */
  function escape(str: string): string {
    if (isWindows) {
      return str.replace(/[<>|&^"]/g, '^$&');
    }
    return str.replace(/[\\$'"]/g, '\\$&');
  }

  return {
    getShell,
    detectShell,
    isDangerousCommand,
    translateCommand,
    supportsAnsi,
    getShellPath,
    getDefaultShell,
    quote,
    escape,
  };
}

export { createShellAdapter };
export default createShellAdapter;
