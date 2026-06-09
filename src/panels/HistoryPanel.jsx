import { useState, useEffect } from 'react'

function groupByDate(entries) {
  const groups = {}
  for (const entry of entries) {
    const d = new Date(entry.timestamp)
    const key = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    if (!groups[key]) groups[key] = []
    groups[key].push(entry)
  }
  return groups
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export default function HistoryPanel({ onClose, onNavigate }) {
  const [history, setHistory] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.electron?.getHistory().then(res => {
      if (res?.ok) setHistory(res.history)
      setLoading(false)
    })
  }, [])

  // listen for real-time updates while panel is open
  useEffect(() => {
    const el = window.electron
    if (!el) return
    el.onHistoryUpdate?.((entry) => {
      setHistory(prev => {
        if (prev[0]?.url === entry.url) return prev
        return [entry, ...prev].slice(0, 1000)
      })
    })
  }, [])

  const filtered = search.trim()
    ? history.filter(e =>
        e.url.toLowerCase().includes(search.toLowerCase()) ||
        e.title?.toLowerCase().includes(search.toLowerCase())
      )
    : history

  const groups = groupByDate(filtered)

  function handleClear() {
    if (!confirm('Clear all history?')) return
    window.electron?.clearHistory()
    setHistory([])
  }

  function handleNavigate(url) {
    window.electron?.navigate(url)
    window.electron?.logAction('HISTORY_NAVIGATE', { url })
    onNavigate?.()
    onClose()
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <span>History</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="pill-btn danger" onClick={handleClear}>Clear all</button>
          <button className="panel-close" onClick={onClose}>×</button>
        </div>
      </div>

      <div style={{ padding: '10px 14px 0', flexShrink: 0 }}>
        <input
          className="panel-input"
          placeholder="Search history…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      <div className="panel-body" style={{ gap: 0, paddingTop: 10 }}>
        {loading && (
          <div className="panel-hint" style={{ textAlign: 'center', paddingTop: 20 }}>Loading…</div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="panel-hint" style={{ textAlign: 'center', paddingTop: 20 }}>
            {search ? 'No results.' : 'No history yet.'}
          </div>
        )}

        {Object.entries(groups).map(([date, entries]) => (
          <div key={date} style={{ marginBottom: 12 }}>
            <div className="panel-section-title" style={{ marginBottom: 4 }}>{date}</div>
            <div className="session-list">
              {entries.map((entry, i) => (
                <div
                  key={i}
                  className="history-row"
                  onClick={() => handleNavigate(entry.url)}
                  title={entry.url}
                >
                  {entry.favicon
                    ? <img src={entry.favicon} alt="" style={{ width: 13, height: 13, flexShrink: 0, borderRadius: 2 }} />
                    : <span style={{ fontSize: 11, opacity: 0.3, flexShrink: 0 }}>○</span>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.title || entry.url}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.url}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-faint)', flexShrink: 0 }}>
                    {formatTime(entry.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
