const { BrowserView, BrowserWindow, session } = require('electron')
const fs = require('fs')
const path = require('path')
const os = require('os')

// ── Build a realistic UA + client hints based on the actual OS ────────────
function buildPlatformProfile() {
  const platform = os.platform()  // 'win32' | 'darwin' | 'linux'
  const arch     = os.arch()      // 'x64' | 'arm64' | 'ia32' | ...

  // Use the actual Chromium version bundled with this Electron build
  const chromeVersion = process.versions.chrome || '125.0.0.0'
  const [chromeMajor]  = chromeVersion.split('.')

  const hints = `"Chromium";v="${chromeMajor}", "Google Chrome";v="${chromeMajor}", "Not-A.Brand";v="99"`

  if (platform === 'win32') {
    // Windows always reports x64 in the UA regardless of actual arch
    return {
      ua:       `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
      platform: '"Windows"',
      mobile:   '?0',
      hints,
    }
  }

  if (platform === 'darwin') {
    const isArm = arch === 'arm64'
    // macOS UA uses underscored version; 10_15_7 is the highest Google accepts for desktop
    return {
      ua:       `Mozilla/5.0 (Macintosh; ${isArm ? 'ARM' : 'Intel'} Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
      platform: '"macOS"',
      mobile:   '?0',
      hints,
    }
  }

  // Linux (including SteamDeck / aarch64 boards)
  const linuxArch = arch === 'arm64' ? 'aarch64' : 'x86_64'
  return {
    ua:       `Mozilla/5.0 (X11; Linux ${linuxArch}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
    platform: '"Linux"',
    mobile:   '?0',
    hints,
  }
}

const PLATFORM = buildPlatformProfile()
const CHROME_UA = PLATFORM.ua

let mainWindow = null
let tabs = []
let activeTabId = null
let nextId = 1
let panelWidth = 0
let topOffset = 0
const TOOLBAR_HEIGHT = 80

// Closed-tab stack — populated by closeTab() so both IPC and shortcut paths use it
let closedTabStack = []

// Track which partitions have already had their session configured
// so we don't register duplicate webRequest handlers
const configuredPartitions = new Set()

function init(win) {
  mainWindow = win
}

// ── Configure a session partition once: UA + client hints + COOP/COEP stripping ──
function configureSession(ses, partition) {
  if (configuredPartitions.has(partition)) return
  configuredPartitions.add(partition)

  ses.setUserAgent(CHROME_UA)

  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders }
    headers['sec-ch-ua']          = PLATFORM.hints
    headers['sec-ch-ua-mobile']   = PLATFORM.mobile
    headers['sec-ch-ua-platform'] = PLATFORM.platform
    callback({ requestHeaders: headers })
  })

  ses.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders }
    delete headers['cross-origin-opener-policy']
    delete headers['cross-origin-opener-policy-report-only']
    delete headers['cross-origin-embedder-policy']
    delete headers['cross-origin-embedder-policy-report-only']
    callback({ cancel: false, responseHeaders: headers })
  })
}

// ── Helper: is this URL part of an auth/OAuth provider? ───────────────────
function isAuthProviderUrl(url) {
  return /accounts\.google\.com|login\.microsoftonline\.com|appleid\.apple\.com|github\.com\/login|\/gsi\/|\/o\/oauth2|\/signin\/oauth|auth\.|oauth\.|sso\./i.test(url)
}

function createTab(url = 'https://google.com', sessionId = 'default') {
  const id = nextId++
  const partition =
    sessionId === 'default' ? 'persist:default' : `persist:session-${sessionId}`
  const ses = session.fromPartition(partition)

  configureSession(ses, partition)

  const view = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      session: ses,
      preload: path.join(__dirname, 'content-preload.js'),
    },
  })

  view.webContents.setUserAgent(CHROME_UA)

  const tab = { id, view, title: 'New Tab', favicon: null, url, loading: false, sessionId }
  tabs.push(tab)

  view.webContents.on('page-title-updated', (_, title) => {
    tab.title = title
    sendTabsUpdate()
  })
  view.webContents.on('page-favicon-updated', (_, favicons) => {
    tab.favicon = favicons[0] || null
    sendTabsUpdate()
  })
  view.webContents.on('did-start-loading', () => {
    tab.loading = true
    sendTabsUpdate()
    if (id === activeTabId) mainWindow.webContents.send('loading', true)
  })
  view.webContents.on('did-stop-loading', () => {
    tab.loading = false
    tab.url = view.webContents.getURL()
    sendTabsUpdate()
    if (id === activeTabId) {
      mainWindow.webContents.send('loading', false)
      mainWindow.webContents.send('url-changed', tab.url)
    }
  })
  view.webContents.on('did-navigate', (_, url) => {
    tab.url = url
    if (id === activeTabId) mainWindow.webContents.send('url-changed', url)
  })
  view.webContents.on('did-navigate-in-page', (_, url) => {
    tab.url = url
    if (id === activeTabId) mainWindow.webContents.send('url-changed', url)
  })

  // ── Window-open handler ────────────────────────────────────────────────
  view.webContents.setWindowOpenHandler(({ url, features }) => {
    console.log('[window.open intercepted]', { url, features: features?.slice?.(0, 80) })

    const isOAuthUrl = isAuthProviderUrl(url)
    const hasSize    = typeof features === 'string' && features.includes('width')
    const isPopup    = isOAuthUrl || hasSize

    if (isPopup) {
      const w = typeof features === 'string'
        ? parseInt(features.match(/width=(\d+)/)?.[1]  || '520') : 520
      const h = typeof features === 'string'
        ? parseInt(features.match(/height=(\d+)/)?.[1] || '640') : 640

      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: w,
          height: h,
          parent: mainWindow,
          modal: false,
          autoHideMenuBar: true,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            session: ses,
          },
        },
      }
    }

    // Non-popup link → open as a new tab instead
    createTab(url, sessionId)
    return { action: 'deny' }
  })

  // ── Configure the OAuth popup after Electron has created it ───────────
  view.webContents.on('did-create-window', (popup, { url }) => {
    console.log('[did-create-window]', url)

    // ← THE FIX: set real UA on the popup so Google serves the desktop flow
    popup.webContents.setUserAgent(CHROME_UA)

    let authCompleted = false

    popup.webContents.on('did-navigate', (_, navUrl) => {
      if (/\/gsi\/transform/i.test(navUrl)) {
        console.log('[popup] GSI transform loaded — auth in progress')
        authCompleted = true
      }
    })

    popup.webContents.on('will-navigate', (event, navUrl) => {
      console.log('[popup will-navigate]', navUrl)

      if (isAuthProviderUrl(navUrl)) return

      console.log('[popup] redirect intercepted:', navUrl)
      event.preventDefault()
      const active = tabs.find(t => t.id === activeTabId)
      if (active && !active.view.webContents.isDestroyed()) {
        setImmediate(() => {
          active.view.webContents.loadURL(navUrl)
          popup.destroy()
        })
      } else {
        popup.destroy()
      }
    })

    popup.webContents.setWindowOpenHandler(({ url: innerUrl }) => {
      console.log('[popup inner window.open]', innerUrl)
      if (isAuthProviderUrl(innerUrl)) return { action: 'allow' }

      const active = tabs.find(t => t.id === activeTabId)
      if (active && !active.view.webContents.isDestroyed()) {
        active.view.webContents.loadURL(innerUrl)
      }
      popup.destroy()
      return { action: 'deny' }
    })

    popup.on('closed', () => {
      console.log('[popup closed] authCompleted=', authCompleted)
    })
  })

  view.webContents.loadURL(url)
  switchTab(id)
  return id
}

function switchTab(id) {
  const tab = tabs.find(t => t.id === id)
  if (!tab) return
  if (activeTabId !== null) {
    const current = tabs.find(t => t.id === activeTabId)
    if (current && !current.view.webContents.isDestroyed()) {
      mainWindow.removeBrowserView(current.view)
    }
  }
  activeTabId = id
  mainWindow.addBrowserView(tab.view)
  updateViewBounds()
  mainWindow.webContents.send('url-changed', tab.url)
  mainWindow.webContents.send('page-title', tab.title)
  mainWindow.webContents.send('page-favicon', tab.favicon)
  mainWindow.webContents.send('loading', tab.loading ?? false)
  sendTabsUpdate()
}

function closeTab(id) {
  const idx = tabs.findIndex(t => t.id === id)
  if (idx === -1) return
  const tab = tabs[idx]

  if (!tab.view.webContents.isDestroyed()) {
    // save before destroy so Ctrl+Shift+T can reopen
    closedTabStack.push({ url: tab.view.webContents.getURL(), sessionId: tab.sessionId })
    if (closedTabStack.length > 20) closedTabStack.shift()

    mainWindow.removeBrowserView(tab.view)
    tab.view.webContents.destroy()
  }

  tabs.splice(idx, 1)

  if (tabs.length === 0) {
    createTab()
    return
  }
  if (activeTabId === id) {
    const next = tabs[Math.min(idx, tabs.length - 1)]
    switchTab(next.id)
  } else {
    sendTabsUpdate()
  }
}

function navigateActive(url) {
  const tab = tabs.find(t => t.id === activeTabId)
  if (!tab || tab.view.webContents.isDestroyed()) return
  tab.view.webContents.loadURL(url)
}

function goBack() {
  const tab = tabs.find(t => t.id === activeTabId)
  if (tab && !tab.view.webContents.isDestroyed() && tab.view.webContents.canGoBack())
    tab.view.webContents.goBack()
}

function goForward() {
  const tab = tabs.find(t => t.id === activeTabId)
  if (tab && !tab.view.webContents.isDestroyed() && tab.view.webContents.canGoForward())
    tab.view.webContents.goForward()
}

function reload() {
  const tab = tabs.find(t => t.id === activeTabId)
  if (tab && !tab.view.webContents.isDestroyed()) tab.view.webContents.reload()
}

function setPanelWidth(w) {
  panelWidth = w
  updateViewBounds()
}

function setTopOffset(h) {
  topOffset = h
  updateViewBounds()
}

function updateViewBounds() {
  const tab = tabs.find(t => t.id === activeTabId)
  if (!tab || !mainWindow || tab.view.webContents.isDestroyed()) return
  const [width, height] = mainWindow.getContentSize()
  tab.view.setBounds({
    x: 0,
    y: TOOLBAR_HEIGHT + topOffset,
    width: Math.max(width - panelWidth, 100),
    height: height - TOOLBAR_HEIGHT - topOffset,
  })
}

function getActiveView() {
  const tab = tabs.find(t => t.id === activeTabId)
  return tab?.view ?? null
}

function getViewById(id) {
  const tab = tabs.find(t => t.id === id)
  return tab?.view ?? null
}

function closeActiveTab() {
  if (activeTabId !== null) closeTab(activeTabId)
}

function saveNavigationTree(nodes, filePath) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(nodes, null, 2), 'utf-8')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

function sendTabsUpdate() {
  if (!mainWindow) return
  mainWindow.webContents.send('tabs-update', {
    tabs: tabs.map(t => ({
      id: t.id,
      title: t.title,
      favicon: t.favicon,
      loading: t.loading,
      url: t.url,
      sessionId: t.sessionId,
    })),
    activeTabId,
  })
}

function popClosedTab() {
  return closedTabStack.pop() ?? null
}

module.exports = {
  init,
  createTab,
  switchTab,
  closeTab,
  navigateActive,
  goBack,
  goForward,
  reload,
  updateViewBounds,
  setPanelWidth,
  setTopOffset,
  sendTabsUpdate,
  saveNavigationTree,
  getActiveView,
  getViewById,
  closeActiveTab,
  popClosedTab,
}
