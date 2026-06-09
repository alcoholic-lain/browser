import { useState, useEffect, useRef, useCallback } from 'react'
import { useTabManager } from './TabManager'
import SessionsPanel from './panels/SessionsPanel'
import NodeGraphPanel from './panels/NodeGraphPanel'
import SettingsPanel from './panels/SettingsPanel'
import HistoryPanel from './panels/HistoryPanel'

const DEFAULT_PANEL_WIDTH = 340
const MIN_PANEL_WIDTH = 250
const MAX_PANEL_WIDTH = 800

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

  const [navNodes, setNavNodes] = useState([])
  const tabLastNode = useRef({})
  const panelRef = useRef(null)
  const inputRef = useRef(null)
  const addressBarRef = useRef(null)
  const dropdownContainerRef = useRef(null)

  // ── Address bar autocomplete ──────────────────────────────────────────────
  const [suggestions, setSuggestions] = useState([])
  const [historyCache, setHistoryCache] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  // load history into cache for autocomplete
  useEffect(() => {
    window.electron?.getHistory?.().then(res => {
      if (res?.ok) setHistoryCache(res.history)
    })
  }, [])

  // keep cache fresh when new entries are added
  useEffect(() => {
    window.electron?.onHistoryUpdate?.((entry) => {
      setHistoryCache(prev => {
        if (prev[0]?.url === entry.url) return prev
        return [entry, ...prev].slice(0, 1000)
      })
    })
  }, [])

  // close suggestions on outside click
  useEffect(() => {
    function handle(e) {
      const container = document.getElementById('suggestions-dropdown')
      if (container && !container.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowSuggestions(false)
        setSelectedIndex(-1)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // ── Render suggestions into native DOM container ──────────────────────
  useEffect(() => {
    const container = document.getElementById('suggestions-dropdown')
    if (!container) return
    dropdownContainerRef.current = container

    if (!showSuggestions || suggestions.length === 0) {
      container.classList.remove('visible')
      container.innerHTML = ''
      // Move BrowserView back down
      window.electron?.setTopOffset?.(0)
      return
    }

    // Move BrowserView up to make room for suggestions
    const suggestionHeight = Math.min(suggestions.length * 45 + 8, 220) // rough estimate
    window.electron?.setTopOffset?.(suggestionHeight)

    // Position the dropdown
    if (addressBarRef.current) {
      const r = addressBarRef.current.getBoundingClientRect()
      container.style.top = (r.bottom + 4) + 'px'
      container.style.left = r.left + 'px'
      container.style.width = r.width + 'px'
    }

    // Render suggestion items
    container.innerHTML = suggestions.map((s, i) => `
      <div class="suggestion-item ${i === selectedIndex ? 'selected' : ''}"
           data-index="${i}" data-url="${encodeURIComponent(s.url)}">
        ${s.favicon
          ? `<img src="${s.favicon}" alt="" style="width: 13px; height: 13px; border-radius: 2px; flex-shrink: 0;" />`
          : `<span style="font-size: 11px; opacity: 0.3; flex-shrink: 0;">○</span>`
        }
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 12px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${(s.title || s.url).replace(/</g, '&lt;').replace(/>/g, '&gt;')}
          </div>
          <div style="font-size: 11px; color: var(--text-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${s.url.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
          </div>
        </div>
      </div>
    `).join('')
    
    container.classList.add('visible')

    // Handle clicks with delegation
    const handleItemClick = (e) => {
      const item = e.target.closest('.suggestion-item')
      if (!item) return
      const url = decodeURIComponent(item.dataset.url)
      handleSuggestionClick(url)
    }

    // Handle hovers with delegation
    const handleItemHover = (e) => {
      const item = e.target.closest('.suggestion-item')
      if (!item) return
      setSelectedIndex(parseInt(item.dataset.index))
    }

    container.addEventListener('click', handleItemClick)
    container.addEventListener('mouseenter', handleItemHover, true)

    return () => {
      container.removeEventListener('click', handleItemClick)
      container.removeEventListener('mouseenter', handleItemHover, true)
    }
  }, [showSuggestions, suggestions, selectedIndex, handleSuggestionClick])

  // ── Blur address bar when the webpage is being interacted with ────────────
  useEffect(() => {
    function handleWindowBlur() {
      inputRef.current?.blur()
      setShowSuggestions(false)
      setSelectedIndex(-1)
    }
    window.addEventListener('blur', handleWindowBlur)
    return () => window.removeEventListener('blur', handleWindowBlur)
  }, [])

  // ── IPC listeners ─────────────────────────────────────────────────────────
  useEffect(() => {
    const el = window.electron
    if (!el) return
    el.onUrlChanged((u) => {
      setUrl(u)
      setInputVal(u)
      inputRef.current?.blur()
      setShowSuggestions(false)
      setSelectedIndex(-1)
    })
    el.onLoading((v) => {
      setLoading(v)
      if (v) {
        inputRef.current?.blur()
        setShowSuggestions(false)
        setSelectedIndex(-1)
      }
    })
  }, [])

  // ── Listen for open-panel from main (keyboard shortcuts) ─────────────────
  useEffect(() => {
    const el = window.electron
    if (!el) return
    const unsubscribe = el.onOpenPanel?.((name) => {
      setPanel(p => (p === name ? null : name))
      el.logAction?.('PANEL_OPENED_FROM_SHORTCUT', { panel: name })
    })
    return () => { unsubscribe?.() }
  }, [])

  const activeTabIdRef = useRef(activeTabId)
  useEffect(() => { activeTabIdRef.current = activeTabId }, [activeTabId])

  // ── Track navigation nodes + save history ────────────────────────────────
  useEffect(() => {
    const el = window.electron
    if (!el) return
    el.onUrlChanged((u) => {
      if (!u || u === 'about:blank') return

      const tabId = activeTabIdRef.current
      const parentId = tabLastNode.current[tabId] ?? null
      const id = nodeIdCounter++
      tabLastNode.current[tabId] = id
      setNavNodes(prev => [...prev, { id, url: u, title: u, tabId, parentId }])
    })
  }, [])

  // save to history whenever url changes, with title from active tab
  useEffect(() => {
    if (!url || url === 'about:blank') return
    const activeTab = tabs.find(t => t.id === activeTabId)
    const entry = {
      url,
      title: activeTab?.title || url,
      favicon: activeTab?.favicon || null,
    }
    window.electron?.addHistory(entry)
    // also refresh local cache for autocomplete
    setHistoryCache(prev => {
      if (prev[0]?.url === url) return prev
      return [{ ...entry, timestamp: Date.now() }, ...prev].slice(0, 1000)
    })
  }, [url])

  useEffect(() => {
    setNavNodes(prev =>
      prev.map(n => {
        const t = tabs.find(t => t.id === n.tabId)
        return t ? { ...n, title: t.title || n.url } : n
      })
    )
  }, [tabs])

  useEffect(() => {
    window.electron?.setPanelWidth(panel ? panelWidth : 0)
  }, [panel, panelWidth])

  function handleNavigate(e) {
    e?.preventDefault()
    window.electron?.navigate(inputVal)
    window.electron?.logAction('NAVIGATE', { url: inputVal })
    inputRef.current?.blur()
    setShowSuggestions(false)
  }

  function handleSuggestionClick(url) {
    setInputVal(url)
    setShowSuggestions(false)
    setSelectedIndex(-1)
    window.electron?.navigate(url)
    window.electron?.logAction('NAVIGATE_SUGGESTION', { url })
    inputRef.current?.blur()
  }

  function togglePanel(name) {
    setPanel(p => (p === name ? null : name))
  }

  function clearNavNodes() {
    setNavNodes([])
    tabLastNode.current = {}
  }

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return
    const handleMouseMove = (e) => {
      if (!panelRef.current) return
      const newWidth = window.innerWidth - e.clientX
      if (newWidth >= MIN_PANEL_WIDTH && newWidth <= MAX_PANEL_WIDTH) {
        setPanelWidth(newWidth)
      }
    }
    const handleMouseUp = () => setIsResizing(false)
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

        <form className="address-bar-form" onSubmit={handleNavigate} style={{ position: 'relative' }} ref={addressBarRef}>
          {loading && <div className="loading-bar" />}
          <div className="address-bar">
            <span className="security-icon">{url.startsWith('https') ? '🔒' : '⚠'}</span>
            <input
              ref={inputRef}
              className="address-input"
              value={inputVal}
              onChange={e => {
                const val = e.target.value
                setInputVal(val)
                setSelectedIndex(-1)
                window.electron?.logAction('ADDRESS_BAR_INPUT', { text: val })
                if (val.length > 1) {
                  const q = val.toLowerCase()
                  const matches = historyCache
                    .filter(h => h.url.toLowerCase().includes(q) || h.title?.toLowerCase().includes(q))
                    .slice(0, 6)
                  setSuggestions(matches)
                  setShowSuggestions(matches.length > 0)
                } else {
                  setShowSuggestions(false)
                }
              }}
              onFocus={e => {
                e.target.select()
                if (inputVal.length > 1 && suggestions.length > 0) setShowSuggestions(true)
              }}
              onKeyDown={e => {
                if (!showSuggestions) return
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setSelectedIndex(i => Math.min(i + 1, suggestions.length - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setSelectedIndex(i => Math.max(i - 1, -1))
                } else if (e.key === 'Enter' && selectedIndex >= 0) {
                  e.preventDefault()
                  handleSuggestionClick(suggestions[selectedIndex].url)
                } else if (e.key === 'Escape') {
                  setShowSuggestions(false)
                  setSelectedIndex(-1)
                }
              }}
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          {/* Autocomplete dropdown rendered as fixed overlay — see portal below */}
        </form>

        <div className="toolbar-actions">
          <button
            className={`nav-btn${panel === 'sessions' ? ' active' : ''}`}
            onClick={() => {
              togglePanel('sessions')
              window.electron?.logAction('TOGGLE_PANEL', { panel: 'sessions', open: panel !== 'sessions' })
            }}
            title="Sessions"
          >⊞</button>
          <button
            className={`nav-btn${panel === 'graph' ? ' active' : ''}`}
            onClick={() => {
              togglePanel('graph')
              window.electron?.logAction('TOGGLE_PANEL', { panel: 'graph', open: panel !== 'graph' })
            }}
            title={`Node graph (${navNodes.length})`}
          >◈</button>
          <button
            className={`nav-btn${panel === 'history' ? ' active' : ''}`}
            onClick={() => {
              togglePanel('history')
              window.electron?.logAction('TOGGLE_PANEL', { panel: 'history', open: panel !== 'history' })
            }}
            title="History (Ctrl+H)"
          >🕐</button>
          <button
            className={`nav-btn${panel === 'settings' ? ' active' : ''}`}
            onClick={() => {
              togglePanel('settings')
              window.electron?.logAction('TOGGLE_PANEL', { panel: 'settings', open: panel !== 'settings' })
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
          {panel === 'history' && (
            <HistoryPanel
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
