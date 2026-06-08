import { useState, useEffect, useRef, useCallback } from 'react'
import { useTabManager } from './TabManager'
import SessionsPanel from './panels/SessionsPanel'
import NodeGraphPanel from './panels/NodeGraphPanel'
import SettingsPanel from './panels/SettingsPanel'

const DEFAULT_PANEL_WIDTH = 340
const MIN_PANEL_WIDTH = 250
const MAX_PANEL_WIDTH = 800

// Navigation node counter — lives outside React so it never resets on re-render
let nodeIdCounter = 1

export default function App() {
  const { tabs, activeTabId, newTab, switchTab, closeTab } = useTabManager()
  const [inputVal, setInputVal] = useState('https://google.com')
  const [url, setUrl] = useState('https://google.com')
  const [loading, setLoading] = useState(false)
  const [panel, setPanel] = useState(null)
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const [settings, setSettings] = useState({
    theme: 'Dark',
    searchEngine: 'google',
    homepage: 'https://google.com',
  })

  // ── Navigation tree state (lifted out of NodeGraphPanel) ─────────────────
  // Stored here so it accumulates regardless of whether the panel is open.
  const [navNodes, setNavNodes] = useState([])
  const tabLastNode = useRef({})          // tabId → last nodeId
  const panelRef = useRef(null)

  const inputRef = useRef(null)

  // ── IPC listeners ─────────────────────────────────────────────────────────
  useEffect(() => {
    const el = window.electron
    if (!el) return
    el.onUrlChanged((u) => {
      setUrl(u)
      setInputVal(u)
    })
    el.onLoading((v) => setLoading(v))
  }, [])

  // ── Record every navigation, even when the panel is closed ───────────────
  // We store activeTabId in a ref so the listener always sees the latest value
  // without needing to be re-registered every time the active tab changes.
  const activeTabIdRef = useRef(activeTabId)
  useEffect(() => { activeTabIdRef.current = activeTabId }, [activeTabId])

  useEffect(() => {
    const el = window.electron
    if (!el) return
    el.onUrlChanged((url) => {
      if (!url || url === 'about:blank') return
      const tabId = activeTabIdRef.current
      const parentId = tabLastNode.current[tabId] ?? null
      const id = nodeIdCounter++
      tabLastNode.current[tabId] = id
      setNavNodes(prev => [...prev, { id, url, title: url, tabId, parentId }])
    })
  }, []) // intentionally empty — register once, use ref for activeTabId

  // Sync titles into nav nodes whenever tab metadata updates
  useEffect(() => {
    setNavNodes(prev =>
      prev.map(n => {
        const t = tabs.find(t => t.id === n.tabId)
        return t ? { ...n, title: t.title || n.url } : n
      })
    )
  }, [tabs])

  // ── Panel width → BrowserView ─────────────────────────────────────────────
  useEffect(() => {
    window.electron?.setPanelWidth(panel ? panelWidth : 0)
  }, [panel, panelWidth])

  function handleNavigate(e) {
    e.preventDefault()
    window.electron?.navigate(inputVal)
    window.electron?.logAction('NAVIGATE', { url: inputVal })
    inputRef.current?.blur()
  }

  function togglePanel(name) {
    setPanel(p => (p === name ? null : name))
  }

  function clearNavNodes() {
    setNavNodes([])
    tabLastNode.current = {}
  }

  // ── Panel resize handlers ──────────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e) => {
      if (!panelRef.current) return
      const rect = panelRef.current.getBoundingClientRect()
      const newWidth = window.innerWidth - e.clientX
      if (newWidth >= MIN_PANEL_WIDTH && newWidth <= MAX_PANEL_WIDTH) {
        setPanelWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'auto'
      document.body.style.userSelect = 'auto'
    }
  }, [isResizing])

  return (
    <div className="shell">
      {/* ── Titlebar ── */}
      <div className="titlebar">
        <div className="tab-strip">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`tab${tab.id === activeTabId ? ' active' : ''}`}
              onClick={() => {
                switchTab(tab.id)
                window.electron?.logAction('SWITCH_TAB', { tabId: tab.id, title: tab.title })
              }}
            >
              {tab.favicon
                ? <img className="tab-favicon" src={tab.favicon} alt="" />
                : <span style={{ fontSize: 12, opacity: 0.4 }}>○</span>
              }
              <span className="tab-title">
                {tab.loading ? 'Loading…' : (tab.title || 'New Tab')}
              </span>
              <button
                className="tab-close"
                onClick={e => { 
                  e.stopPropagation()
                  window.electron?.logAction('CLOSE_TAB', { tabId: tab.id, title: tab.title })
                  closeTab(tab.id)
                }}
              >×</button>
            </div>
          ))}
          <button className="new-tab-btn" onClick={() => {
            window.electron?.logAction('NEW_TAB', {})
            newTab()
          }} title="New tab">+</button>
        </div>
        <div className="titlebar-spacer" />
        <div className="window-controls">
          <button onClick={() => window.electron?.minimize()} className="wc wc-min"   title="Minimize" />
          <button onClick={() => window.electron?.maximize()} className="wc wc-max"   title="Maximize" />
          <button onClick={() => window.electron?.close()}    className="wc wc-close" title="Close" />
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="toolbar">
        <div className="nav-buttons">
          <button className="nav-btn" onClick={() => {
            window.electron?.goBack()
            window.electron?.logAction('BACK', {})
          }} title="Back">←</button>
          <button className="nav-btn" onClick={() => {
            window.electron?.goForward()
            window.electron?.logAction('FORWARD', {})
          }} title="Forward">→</button>
          <button className="nav-btn" onClick={() => {
            window.electron?.reload()
            window.electron?.logAction('RELOAD', {})
          }} title="Reload">
            {loading ? '✕' : '↻'}
          </button>
        </div>

        <form className="address-bar-form" onSubmit={handleNavigate}>
          {loading && <div className="loading-bar" />}
          <div className="address-bar">
            <span className="security-icon">{url.startsWith('https') ? '🔒' : '⚠'}</span>
            <input
              ref={inputRef}
              className="address-input"
              value={inputVal}
              onChange={e => {
                setInputVal(e.target.value)
                window.electron?.logAction('ADDRESS_BAR_INPUT', { text: e.target.value })
              }}
              onFocus={e => e.target.select()}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
        </form>

        <div className="toolbar-actions">
          <button
            className={`nav-btn${panel === 'sessions' ? ' active' : ''}`}
            onClick={() => {
              const newPanel = panel === 'sessions' ? null : 'sessions'
              togglePanel('sessions')
              window.electron?.logAction('TOGGLE_PANEL', { panel: 'sessions', open: newPanel === 'sessions' })
            }}
            title="Sessions"
          >⊞</button>
          <button
            className={`nav-btn${panel === 'graph' ? ' active' : ''}`}
            onClick={() => {
              const newPanel = panel === 'graph' ? null : 'graph'
              togglePanel('graph')
              window.electron?.logAction('TOGGLE_PANEL', { panel: 'graph', open: newPanel === 'graph' })
            }}
            title={`Node graph (${navNodes.length})`}
          >◈</button>
          <button
            className={`nav-btn${panel === 'settings' ? ' active' : ''}`}
            onClick={() => {
              const newPanel = panel === 'settings' ? null : 'settings'
              togglePanel('settings')
              window.electron?.logAction('TOGGLE_PANEL', { panel: 'settings', open: newPanel === 'settings' })
            }}
            title="Settings"
          >⚙</button>
        </div>
      </div>

      {/* ── Panel sidebar ── */}
      {panel && (
        <div
          ref={panelRef}
          className={`panel-sidebar${isResizing ? ' resizing' : ''}`}
          style={{ width: panelWidth }}
        >
          <div className="panel-resize-handle" onMouseDown={handleMouseDown} />
          {panel === 'sessions' && (
            <SessionsPanel
              tabs={tabs}
              activeTabId={activeTabId}
              onClose={() => setPanel(null)}
            />
          )}
          {panel === 'graph' && (
            <NodeGraphPanel
              tabs={tabs}
              activeTabId={activeTabId}
              nodes={navNodes}
              onClear={clearNavNodes}
              onClose={() => setPanel(null)}
            />
          )}
          {panel === 'settings' && (
            <SettingsPanel
              settings={settings}
              onSettingsChange={setSettings}
              onClose={() => setPanel(null)}
            />
          )}
        </div>
      )}
    </div>
  )
}
