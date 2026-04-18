import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { ToolExecutor } from './toolExecutor'
import { SandboxManager } from './sandboxManager'
import { SystemPromptEngine } from './systemPromptEngine'
import Store from 'electron-store'
import fs from 'fs'
import { log, registerLogIPC, createModuleLogger } from './main/logger'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const logger = createModuleLogger('Main');

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error.message, error.stack)
})

process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Rejection:', reason?.message || reason, reason?.stack)
})

const store = new Store({
  name: 'harness-desktop-config',
  defaults: {
    apiKey: '',
    model: 'openai',
    modelEndpoint: 'https://api.openai.com/v1',
    modelName: 'gpt-4o',
    workDir: app.getPath('home'),
    contextWindow: 128000,
    dangerousCommands: ['rm -rf', 'del /f /q', 'format', 'dd if='],
    allowedExtensions: ['.js', '.ts', '.jsx', '.tsx', '.json', '.md', '.txt', '.html', '.css', '.py', '.java', '.c', '.cpp', '.h', '.go', '.rs', '.yml', '.yaml', '.xml', '.sh', '.bat', '.ps1'],
    riskConfirmation: {
      medium: true,
      high: true
    }
  }
})

let mainWindow: BrowserWindow | null = null
let toolExecutor: ToolExecutor | null = null
let sandboxManager: SandboxManager | null = null
let systemPromptEngine: SystemPromptEngine | null = null

const isDev = !app.isPackaged

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false,
    backgroundColor: '#1a1a2e',
    title: 'Harness Desktop'
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    logger.info('Window ready to show')
  })

  mainWindow.webContents.on('did-finish-load', () => {
    logger.info('WebContents did-finish-load')
  })

  mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
    logger.warn('WebContents did-fail-load:', errorCode, errorDescription)
  })

  mainWindow.webContents.on('render-process-gone', (_, details) => {
    logger.warn('WebContents render-process-gone:', details.reason)
  })

  mainWindow.webContents.on('console-message', (_, level, message, line, sourceId) => {
    if (level >= 2) { // Error and critical
      logger.error(`Console error [${level}]: ${message} (${sourceId}:${line})`)
    }
  })

  // Initialize core services
  sandboxManager = new SandboxManager(
    store.get('workDir') as string,
    store.get('dangerousCommands') as string[],
    store.get('allowedExtensions') as string[]
  )
  
  toolExecutor = new ToolExecutor(sandboxManager)
  systemPromptEngine = new SystemPromptEngine()

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173')
    mainWindow.webContents.openDevTools()
  } else {
    // Use app.getAppPath() to correctly resolve path inside ASAR
    const indexPath = app.isPackaged
      ? `file://${path.join(app.getAppPath(), 'dist', 'index.html')}`
      : path.join(__dirname, '..', 'dist', 'index.html')
    logger.info('Loading production index from:', indexPath)
    mainWindow.loadURL(indexPath)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// IPC Handlers

// Config management
ipcMain.handle('config:get', (_, key: string) => {
  return store.get(key)
})

ipcMain.handle('config:set', (_, key: string, value: unknown) => {
  store.set(key, value)
  return true
})

ipcMain.handle('config:getAll', () => {
  return store.store
})

// System Prompt
ipcMain.handle('systemPrompt:getFixed', () => {
  return systemPromptEngine?.getFixedPrompt() || ''
})

ipcMain.handle('systemPrompt:buildDynamic', (_, context: Record<string, unknown>) => {
  return systemPromptEngine?.buildDynamicPrompt(context) || ''
})

// Tool Execution
ipcMain.handle('tool:execute', async (_, toolCall: {
  name: string
  arguments: Record<string, unknown>
  riskLevel?: 'low' | 'medium' | 'high'
}) => {
  logger.info('Tool call received:', toolCall.name, toolCall.arguments)
  try {
    if (!toolExecutor) throw new Error('ToolExecutor not initialized')
    const result = await toolExecutor.execute(toolCall.name, toolCall.arguments)
    return { success: true, result }
  } catch (error: any) {
    logger.error('Tool execution error:', error)
    return { success: false, error: error.message }
  }
})

// Sandbox status
ipcMain.handle('sandbox:getStatus', () => {
  return sandboxManager?.getStatus() || { initialized: false }
})

// Dialog for work directory selection
ipcMain.handle('dialog:selectWorkDir', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: 'Select Working Directory'
  })
  if (!result.canceled && result.filePaths.length > 0) {
    store.set('workDir', result.filePaths[0])
    return result.filePaths[0]
  }
  return null
})

// Shell open for external links
ipcMain.handle('shell:openExternal', async (_, url: string) => {
  await shell.openExternal(url)
})

// Window controls
ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize()
})

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})

ipcMain.handle('window:close', () => {
  mainWindow?.close()
})

ipcMain.handle('window:isMaximized', () => {
  return mainWindow?.isMaximized() || false
})

// File system helpers (for UI preview)
ipcMain.handle('fs:readDir', async (_, dirPath: string) => {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
    return entries.map(e => ({
      name: e.name,
      isDirectory: e.isDirectory(),
      path: path.join(dirPath, e.name)
    }))
  } catch (error: any) {
    return { error: error.message }
  }
})

ipcMain.handle('fs:readFile', async (_, filePath: string) => {
  try {
    const workDir = store.get('workDir') as string
    const resolvedPath = path.resolve(workDir, filePath)
    if (!resolvedPath.startsWith(workDir)) {
      throw new Error('Path outside work directory')
    }
    const content = await fs.promises.readFile(resolvedPath, 'utf-8')
    return { success: true, content }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
  try {
    const workDir = store.get('workDir') as string
    const resolvedPath = path.resolve(workDir, filePath)
    if (!resolvedPath.startsWith(workDir)) {
      throw new Error('Path outside work directory')
    }
    await fs.promises.writeFile(resolvedPath, content, 'utf-8')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('fs:exists', async (_, filePath: string) => {
  try {
    const workDir = store.get('workDir') as string
    const resolvedPath = path.resolve(workDir, filePath)
    if (!resolvedPath.startsWith(workDir)) {
      return false
    }
    await fs.promises.access(resolvedPath)
    return true
  } catch {
    return false
  }
})

// Register log IPC handlers
registerLogIPC(ipcMain);

// App lifecycle
app.whenReady().then(() => {
  logger.info('App ready, creating window...')
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('before-quit', () => {
  logger.info('App quitting...')
})
