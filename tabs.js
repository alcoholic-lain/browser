const { BrowserView, BrowserWindow, session } = require('electron')
const fs = require('fs')
const path = require('path')

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

let mainWindow = null
let tabs = []
let activeTabId = null
let nextId = 1
let panelWidth = 0
const TOOLBAR_HEIGHT = 80

function init(win) {
  mainWindow = win
}

function createTab(url = 'https://google.com', sessionId = 'default') {
  const id = nextId++
  const partition =
    sessionId === 'default' ? 'persist:default' : `persist:session-${sessionId}`
  const ses = session.fromPartition(partition)

  const view = new BrowserView({
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: false,
      session: ses,
      preload: path.join(__dirname, 'content-preload.js')
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
  view.webContents.on('did-finish-load', () => {
    tab.loading = false
    sendTabsUpdate()
    if (id === activeTabId) mainWindow.webContents.send('loading', false)
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
  // OAuth / SSO flows call window.open() with a popup size. We detect those
  // and open a real BrowserWindow so the redirect back actually works.
  // For every other case we open a new tab in the main window.
  view.webContents.setWindowOpenHandler(({ url, features }) => {
    const isOAuthPopup =
      features.includes('width') ||               // explicit sizing → popup
      /accounts\.google\.com|login\.microsoftonline\.com|appleid\.apple\.com|github\.com\/login|auth\.|oauth\.|sso\./i.test(url)

    if (isOAuthPopup) {
      // Parse width/height from features string (e.g. "width=500,height=600")
      const w = parseInt(features.match(/width=(\d+)/)?.[1] || '520')
      const h = parseInt(features.match(/height=(\d+)/)?.[1] || '640')

      const popup = new BrowserWindow({
        width: w, height: h,
        parent: mainWindow,
        modal: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          session: ses,               // same session → cookies shared
        },
      })
      popup.loadURL(url)
      popup.on('closed', () => {
        // After OAuth popup closes, refresh the active tab so it picks up
        // the new login cookies.
        const active = tabs.find(t => t.id === activeTabId)
        if (active && !active.view.webContents.isDestroyed()) {
          active.view.webContents.reload()
        }
      })
      return { action: 'deny' }   // we handled it ourselves
    }

    // Normal link-opens-tab
    createTab(url, sessionId)
    return { action: 'deny' }
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

  // Guard: only touch webContents if it hasn't been destroyed already
  if (!tab.view.webContents.isDestroyed()) {
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

function updateViewBounds() {
  const tab = tabs.find(t => t.id === activeTabId)
  if (!tab || !mainWindow || tab.view.webContents.isDestroyed()) return
  const [width, height] = mainWindow.getContentSize()
  tab.view.setBounds({
    x: 0,
    y: TOOLBAR_HEIGHT,
    width: Math.max(width - panelWidth, 100),
    height: height - TOOLBAR_HEIGHT,
  })
}

// ── JSON export ────────────────────────────────────────────────────────────
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
  sendTabsUpdate,
  saveNavigationTree,
}
