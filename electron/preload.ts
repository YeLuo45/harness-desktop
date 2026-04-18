import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Config
  config: {
    get: (key: string) => ipcRenderer.invoke('config:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('config:set', key, value),
    getAll: () => ipcRenderer.invoke('config:getAll')
  },

  // System Prompt
  systemPrompt: {
    getFixed: () => ipcRenderer.invoke('systemPrompt:getFixed'),
    buildDynamic: (context: Record<string, unknown>) => ipcRenderer.invoke('systemPrompt:buildDynamic', context)
  },

  // Tool Execution
  tool: {
    execute: (toolCall: { name: string; arguments: Record<string, unknown>; riskLevel?: string }) =>
      ipcRenderer.invoke('tool:execute', toolCall)
  },

  // Sandbox
  sandbox: {
    getStatus: () => ipcRenderer.invoke('sandbox:getStatus')
  },

  // Dialog
  dialog: {
    selectWorkDir: () => ipcRenderer.invoke('dialog:selectWorkDir')
  },

  // Shell
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url)
  },

  // Window controls
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized')
  },

  // File System helpers
  fs: {
    readDir: (dirPath: string) => ipcRenderer.invoke('fs:readDir', dirPath),
    readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),
    exists: (filePath: string) => ipcRenderer.invoke('fs:exists', filePath)
  },

  // Log viewer
  log: {
    getEntries: (options?: { level?: string; module?: string; limit?: number }) =>
      ipcRenderer.invoke('log:getEntries', options),
    export: () => ipcRenderer.invoke('log:export'),
    clear: () => ipcRenderer.invoke('log:clear'),
    getBuffer: () => ipcRenderer.invoke('log:getBuffer'),
  }
})
