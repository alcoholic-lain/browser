const { contextBridge, ipcRenderer } = require('electron')

console.log('[preload] Initializing preload.js')

// Set up open-panel listener immediately (not via callback)
let panelListeners = []
console.log('[preload] Setting up open-panel ipcRenderer.on listener')
ipcRenderer.on('open-panel', (event, name) => {
  console.log('[preload] *** open-panel IPC MESSAGE RECEIVED ***:', name)
  console.log('[preload] Calling', panelListeners.length, 'listeners')
  panelListeners.forEach((cb, idx) => {
    console.log('[preload] Calling listener', idx)
    cb(name)
  })
})
console.log('[preload] open-panel listener registered')

contextBridge.exposeInMainWorld('electron', {
  rendererReady: () => ipcRenderer.send('renderer-ready'),
  navigate:      (url) => ipcRenderer.send('navigate', url),
  goBack:        () => ipcRenderer.send('go-back'),
  goForward:     () => ipcRenderer.send('go-forward'),
  reload:        () => ipcRenderer.send('reload'),

  newTab:        (url, sessionId) => ipcRenderer.send('new-tab', { url, sessionId }),
  switchTab:     (id) => ipcRenderer.send('switch-tab', id),
  closeTab:      (id) => ipcRenderer.send('close-tab', id),
  setPanelWidth: (w) => ipcRenderer.send('set-panel-width', w),
  setTopOffset:  (h) => ipcRenderer.send('set-top-offset', h),

  minimize:      () => ipcRenderer.send('window-minimize'),
  maximize:      () => ipcRenderer.send('window-maximize'),
  close:         () => ipcRenderer.send('window-close'),

  onTitle:       (cb) => ipcRenderer.on('page-title',   (_, t)    => cb(t)),
  onFavicon:     (cb) => ipcRenderer.on('page-favicon',  (_, f)    => cb(f)),
  onLoading:     (cb) => ipcRenderer.on('loading',       (_, v)    => cb(v)),
  onUrlChanged:  (cb) => ipcRenderer.on('url-changed',   (_, url)  => cb(url)),
  onTabsUpdate:  (cb) => ipcRenderer.on('tabs-update',   (_, data) => cb(data)),
  onOpenPanel:   (cb) => {
    console.log('[preload] onOpenPanel registered callback')
    panelListeners.push(cb)
    return () => {
      panelListeners = panelListeners.filter(x => x !== cb)
    }
  },

  saveTree:      (nodes) => ipcRenderer.invoke('save-tree', nodes),

  getNetworkLog:  () => ipcRenderer.invoke('get-network-log'),
  openNetworkLog: () => ipcRenderer.invoke('open-network-log'),
  clearNetworkLog:() => ipcRenderer.send('clear-network-log'),

  getActionLog:   () => ipcRenderer.invoke('get-action-log'),
  openActionLog:  () => ipcRenderer.invoke('open-action-log'),
  clearActionLog: () => ipcRenderer.send('clear-action-log'),
  logAction:      (action, details) => ipcRenderer.send('log-action', action, details),

  // History
  getHistory:      ()        => ipcRenderer.invoke('get-history'),
  addHistory:      (entry)   => ipcRenderer.send('add-history', entry),
  clearHistory:    ()        => ipcRenderer.send('clear-history'),
  onHistoryUpdate: (cb)      => ipcRenderer.on('history-update', (_, entry) => cb(entry)),

  // Test IPC
  testIPC: (msg) => ipcRenderer.invoke('test-message', msg),
})

// Exposed separately so content-preload.js (running in BrowserViews with
// contextIsolation: true) can send website-level logs without needing
// direct access to ipcRenderer.
contextBridge.exposeInMainWorld('electronLog', (action, details) => {
  ipcRenderer.send('content-log-action', action, details)
})
