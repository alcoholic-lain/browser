import { useState } from 'react'

const THEMES = ['Dark', 'Darker', 'Midnight']
const SEARCH_ENGINES = [
  { id: 'google', label: 'Google', url: 'https://www.google.com/search?q=' },
  { id: 'ddg', label: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
  { id: 'brave', label: 'Brave Search', url: 'https://search.brave.com/search?q=' },
  { id: 'bing', label: 'Bing', url: 'https://www.bing.com/search?q=' },
]

export default function SettingsPanel({ onClose, onSettingsChange, settings }) {
  const [theme, setTheme] = useState(settings?.theme || 'Dark')
  const [searchEngine, setSearchEngine] = useState(settings?.searchEngine || 'google')
  const [homepage, setHomepage] = useState(settings?.homepage || 'https://google.com')
  const [logStatus, setLogStatus] = useState(null)
  const [actionLogStatus, setActionLogStatus] = useState(null)

  function save() {
    onSettingsChange?.({ theme, searchEngine, homepage })
    onClose()
  }

  async function handleOpenLog() {
    const result = await window.electron?.openNetworkLog()
    if (result?.ok) {
      setLogStatus('✓ Opened')
      setTimeout(() => setLogStatus(null), 2000)
    } else {
      setLogStatus('✗ Error')
      setTimeout(() => setLogStatus(null), 2000)
    }
  }

  async function handleClearLog() {
    if (confirm('Clear network log?')) {
      window.electron?.clearNetworkLog()
      setLogStatus('✓ Cleared')
      setTimeout(() => setLogStatus(null), 2000)
    }
  }

  async function handleOpenActionLog() {
    const result = await window.electron?.openActionLog()
    if (result?.ok) {
      setActionLogStatus('✓ Opened')
      setTimeout(() => setActionLogStatus(null), 2000)
    } else {
      setActionLogStatus('✗ Error')
      setTimeout(() => setActionLogStatus(null), 2000)
    }
  }

  async function handleClearActionLog() {
    if (confirm('Clear action log?')) {
      window.electron?.clearActionLog()
      setActionLogStatus('✓ Cleared')
      setTimeout(() => setActionLogStatus(null), 2000)
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Settings</span>
        <button className="panel-close" onClick={onClose}>×</button>
      </div>

      <div className="panel-body">
        <div className="panel-section-title">Appearance</div>
        <div className="setting-row">
          <span className="setting-label">Theme</span>
          <div className="setting-options">
            {THEMES.map(t => (
              <button
                key={t}
                className={`pill-btn${theme === t ? ' accent' : ''}`}
                onClick={() => setTheme(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="panel-section-title">Search</div>
        <div className="setting-row">
          <span className="setting-label">Default engine</span>
          <div className="setting-options">
            {SEARCH_ENGINES.map(e => (
              <button
                key={e.id}
                className={`pill-btn${searchEngine === e.id ? ' accent' : ''}`}
                onClick={() => setSearchEngine(e.id)}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>

        <div className="panel-section-title">General</div>
        <div className="setting-row column">
          <span className="setting-label">Homepage</span>
          <input
            className="panel-input"
            value={homepage}
            onChange={e => setHomepage(e.target.value)}
            placeholder="https://google.com"
          />
        </div>

        <div className="panel-section-title">Debugging</div>
        <div className="setting-row">
          <span className="setting-label">Network Log</span>
          <div className="setting-options">
            <button
              className={`pill-btn${logStatus === '✓ Opened' ? ' accent' : logStatus === '✓ Cleared' ? ' accent' : ''}`}
              onClick={handleOpenLog}
              title="Open log file in file explorer"
            >
              {logStatus ? logStatus : '📂 Open Log'}
            </button>
            <button
              className="pill-btn"
              onClick={handleClearLog}
              title="Clear network log"
            >
              🗑 Clear
            </button>
          </div>
        </div>

        <div className="setting-row">
          <span className="setting-label">Action Log</span>
          <div className="setting-options">
            <button
              className={`pill-btn${actionLogStatus === '✓ Opened' ? ' accent' : actionLogStatus === '✓ Cleared' ? ' accent' : ''}`}
              onClick={handleOpenActionLog}
              title="Open action log file in file explorer"
            >
              {actionLogStatus ? actionLogStatus : '📂 Actions'}
            </button>
            <button
              className="pill-btn"
              onClick={handleClearActionLog}
              title="Clear action log"
            >
              🗑 Clear
            </button>
          </div>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
          <button className="pill-btn accent wide" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}
