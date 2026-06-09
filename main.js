const { app, BrowserWindow, ipcMain, dialog, session, globalShortcut } = require('electron')
const path = require('path')
const fs = require('fs')
const tabs = require('./tabs')

const IS_DEV = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow
const logPath        = path.join(app.getPath('userData'), 'recent.log')
const actionLogPath  = path.join(app.getPath('userData'), 'actions.log')
const historyPath    = path.join(app.getPath('userData'), 'history.json')
const MAX_LOG_SIZE   = 5 * 1024 * 1024 // 5MB

// ── Action logging ────────────────────────────────────────────────────────
function logAction(action, details = {}) {
  const timestamp = new Date().toISOString()
  const detailsStr = Object.keys(details).length > 0 
    ? ' | ' + Object.entries(details).map(([k, v]) => `${k}=${v}`).join(', ')
    : ''
  const logLine = `[${timestamp}] ${action}${detailsStr}\n`
  
  try {
    if (fs.existsSync(actionLogPath)) {
      const stats = fs.statSync(actionLogPath)
      if (stats.size > MAX_LOG_SIZE) {
        const backupPath = actionLogPath + `.${Date.now()}.bak`
        fs.renameSync(actionLogPath, backupPath)
      }
    }
    fs.appendFileSync(actionLogPath, logLine, 'utf-8')
  } catch (err) {
    console.error('Failed to write to action log:', err)
  }
}

// ── Network traffic logging ────────────────────────────────────────────────
function logNetworkTraffic(msg) {
  const timestamp = new Date().toISOString()
  const logLine = `[${timestamp}] ${msg}\n`
  
  try {
    if (fs.existsSync(logPath)) {
      const stats = fs.statSync(logPath)
      if (stats.size > MAX_LOG_SIZE) {
        const backupPath = logPath + `.${Date.now()}.bak`
        fs.renameSync(logPath, backupPath)
      }
    }
  } catch (err) {
    console.error('Log rotation error:', err)
  }
  
  try {
    fs.appendFileSync(logPath, logLine, 'utf-8')
  } catch (err) {
    console.error('Failed to write to log:', err)
  }
}

function setupNetworkLogging() {
  const defaultSession = session.defaultSession
  
  logNetworkTraffic('========== SESSION START ==========')
  logNetworkTraffic(`App started in ${IS_DEV ? 'DEV' : 'PRODUCTION'} mode`)
  
  defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const { method, url, resourceType } = details
    if (resourceType !== 'image' && resourceType !== 'stylesheet') {
      logNetworkTraffic(`→ [${method}] ${resourceType.padEnd(10)} ${url}`)
    }
    callback({ cancel: false })
  })

  defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const { statusCode, url, resourceType } = details
    if (resourceType !== 'image' && resourceType !== 'stylesheet') {
      logNetworkTraffic(`← [${statusCode}] ${url}`)
    }

    const headers = { ...details.responseHeaders }
    delete headers['cross-origin-opener-policy']
    delete headers['cross-origin-opener-policy-report-only']
    delete headers['cross-origin-embedder-policy']
    delete headers['cross-origin-embedder-policy-report-only']

    callback({ cancel: false, responseHeaders: headers })
  })

  defaultSession.webRequest.onErrorOccurred((details) => {
    const { url, error } = details
    logNetworkTraffic(`✗ [ERROR] ${error} - ${url}`)
  })
  
  app.on('session-created', (session) => {
    setupSessionLogging(session)
  })
}

function setupSessionLogging(sess) {
  sess.webRequest.onBeforeRequest((details, callback) => {
    const { method, url, resourceType } = details
    if (resourceType !== 'image' && resourceType !== 'stylesheet') {
      logNetworkTraffic(`→ [${method}] ${resourceType.padEnd(10)} ${url}`)
    }
    callback({ cancel: false })
  })

  sess.webRequest.onHeadersReceived((details, callback) => {
    const { statusCode, url, resourceType } = details
    if (resourceType !== 'image' && resourceType !== 'stylesheet') {
      logNetworkTraffic(`← [${statusCode}] ${url}`)
    }

    const headers = { ...details.responseHeaders }
    delete headers['cross-origin-opener-policy']
    delete headers['cross-origin-opener-policy-report-only']
    delete headers['cross-origin-embedder-policy']
    delete headers['cross-origin-embedder-policy-report-only']

    callback({ cancel: false, responseHeaders: headers })
  })

  sess.webRequest.onErrorOccurred((details) => {
    const { url, error } = details
    logNetworkTraffic(`✗ [ERROR] ${error} - ${url}`)
  })
}

// ── DevTools toggle helper ────────────────────────────────────────────────
function toggleActiveTabDevTools() {
  const view = tabs.getActiveView()
  if (!view || view.webContents.isDestroyed()) return
  if (view.webContents.isDevToolsOpened()) {
    view.webContents.closeDevTools()
  } else {
    view.webContents.openDevTools({ mode: 'detach' })
  }
}

function createWindow() {
  setupNetworkLogging()
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(__dirname, 'icons/silly-cat.png'),
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (IS_DEV) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'))
  }

  tabs.init(mainWindow)

  ipcMain.once('renderer-ready', () => {
    tabs.createTab('https://google.com')
  })

  mainWindow.on('resize', () => tabs.updateViewBounds())
}

// ── Tab IPC ───────────────────────────────────────────────────────────────
ipcMain.on('navigate', (_, url) => {
  let target = url.trim()
  if (!target.startsWith('http://') && !target.startsWith('https://')) {
    if (target.includes('.') && !target.includes(' ')) {
      target = 'https://' + target
    } else {
      target = `https://www.google.com/search?q=${encodeURIComponent(target)}`
    }
  }
  tabs.navigateActive(target)
})

ipcMain.on('new-tab',         (_, { url, sessionId } = {}) => tabs.createTab(url, sessionId))
ipcMain.on('switch-tab',      (_, id)  => tabs.switchTab(id))
ipcMain.on('go-back',         ()       => tabs.goBack())
ipcMain.on('go-forward',      ()       => tabs.goForward())
ipcMain.on('reload',          ()       => tabs.reload())
ipcMain.on('set-panel-width', (_, w)   => tabs.setPanelWidth(w))
ipcMain.on('set-top-offset', (_, h)   => tabs.setTopOffset(h))

// Test IPC
ipcMain.on('test-message', (event, msg) => {
  console.log('[IPC] test-message received:', msg)
  event.reply('test-reply', 'pong')
})

// close-tab — tabs.js records the closed URL internally
ipcMain.on('close-tab', (_, id) => {
  tabs.closeTab(id)
})

ipcMain.on('toggle-devtools', () => toggleActiveTabDevTools())

ipcMain.on('window-minimize', () => mainWindow.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize()
  else mainWindow.maximize()
})
ipcMain.on('window-close', () => mainWindow.close())

ipcMain.handle('save-tree', async (_, nodes) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Navigation Tree',
    defaultPath: `nav-tree-${Date.now()}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (canceled || !filePath) return { ok: false, canceled: true }
  return tabs.saveNavigationTree(nodes, filePath)
})

// ── Network log ───────────────────────────────────────────────────────────
ipcMain.handle('get-network-log', async () => {
  try {
    if (!fs.existsSync(logPath)) return { ok: true, log: '' }
    const log = fs.readFileSync(logPath, 'utf-8')
    return { ok: true, log, path: logPath }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.on('clear-network-log', () => {
  try {
    fs.writeFileSync(logPath, '', 'utf-8')
    logNetworkTraffic('=== Log cleared by user ===')
  } catch (err) {
    console.error('Failed to clear log:', err)
  }
})

ipcMain.handle('open-network-log', async () => {
  try {
    const { shell } = require('electron')
    await shell.showItemInFolder(logPath)
    return { ok: true, path: logPath }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

// ── Action log ────────────────────────────────────────────────────────────
ipcMain.handle('get-action-log', async () => {
  try {
    if (!fs.existsSync(actionLogPath)) return { ok: true, log: '' }
    const log = fs.readFileSync(actionLogPath, 'utf-8')
    return { ok: true, log, path: actionLogPath }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.on('clear-action-log', () => {
  try {
    fs.writeFileSync(actionLogPath, '', 'utf-8')
    logAction('LOG_CLEARED', { user: true })
  } catch (err) {
    console.error('Failed to clear action log:', err)
  }
})

ipcMain.handle('open-action-log', async () => {
  try {
    const { shell } = require('electron')
    await shell.showItemInFolder(actionLogPath)
    return { ok: true, path: actionLogPath }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.on('log-action', (_, action, details) => {
  logAction(action, details)
})

ipcMain.on('content-log-action', (_, action, details) => {
  logAction(`WEBSITE_${action}`, details)
})

// ── History ───────────────────────────────────────────────────────────────
ipcMain.on('add-history', (_, entry) => {
  try {
    let history = []
    if (fs.existsSync(historyPath)) {
      history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'))
    }
    if (history[0]?.url !== entry.url) {
      history.unshift({ ...entry, timestamp: Date.now() })
      history = history.slice(0, 1000)
    }
    fs.writeFileSync(historyPath, JSON.stringify(history), 'utf-8')
    // push update to renderer so the open panel and autocomplete stay fresh
    mainWindow.webContents.send('history-update', { ...entry, timestamp: Date.now() })
  } catch (err) {
    console.error('Failed to save history:', err)
  }
})

ipcMain.handle('get-history', async () => {
  try {
    if (!fs.existsSync(historyPath)) return { ok: true, history: [] }
    const history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'))
    return { ok: true, history }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.on('clear-history', () => {
  try {
    fs.writeFileSync(historyPath, '[]', 'utf-8')
    logAction('HISTORY_CLEARED')
  } catch (err) {
    console.error('Failed to clear history:', err)
  }
})

// ── App ready + shortcuts ─────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow()
  logAction('APP_START', { mode: IS_DEV ? 'dev' : 'production' })
  console.log(`📝 Network log: ${logPath}`)
  console.log(`📋 Action log:  ${actionLogPath}`)
  console.log(`🕐 History:     ${historyPath}`)

  // F12 — DevTools
  globalShortcut.register('F12', () => toggleActiveTabDevTools())

  // Ctrl+T — new tab
  globalShortcut.register('CommandOrControl+T', () => {
    tabs.createTab('https://google.com')
    logAction('SHORTCUT_NEW_TAB')
  })

  // Ctrl+W — close active tab
  globalShortcut.register('CommandOrControl+W', () => {
    tabs.closeActiveTab()
    logAction('SHORTCUT_CLOSE_TAB')
  })

  // Ctrl+Shift+T — reopen last closed tab
  globalShortcut.register('CommandOrControl+Shift+T', () => {
    const last = tabs.popClosedTab()
    if (last?.url) {
      tabs.createTab(last.url, last.sessionId)
      logAction('SHORTCUT_REOPEN_TAB', { url: last.url })
    }
  })

  // Ctrl+H — toggle history panel
  const registered = globalShortcut.register('CommandOrControl+H', () => {
    console.log('[main] Ctrl+H pressed! Sending open-panel message')
    console.log('[main] mainWindow exists:', !!mainWindow)
    console.log('[main] webContents exists:', !!mainWindow?.webContents)
    console.log('[main] webContents.isDestroyed():', mainWindow?.webContents?.isDestroyed?.())
    const result = mainWindow.webContents.send('open-panel', 'history')
    console.log('[main] send result:', result)
    logAction('SHORTCUT_HISTORY')
  })
  console.log('[main] Ctrl+H registration result:', registered)
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  app.quit()
  process.exit(0)
})
