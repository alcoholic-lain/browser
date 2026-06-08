import { useState } from 'react'

const PRESET_COLORS = ['#5b6af0', '#e05555', '#55b055', '#e0a855', '#a855e0', '#55a8e0']

export default function SessionsPanel({ tabs, activeTabId, onClose }) {
  const [sessions, setSessions] = useState([
    { id: 'default', name: 'Default', color: '#5b6af0' },
  ])
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#e05555')

  const activeTab = tabs.find(t => t.id === activeTabId)
  const activeSession = activeTab?.sessionId || 'default'

  function addSession() {
    const name = newName.trim()
    if (!name) return
    const id = name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()
    setSessions(s => [...s, { id, name, color: newColor }])
    setNewName('')
  }

  function removeSession(id) {
    if (id === 'default') return
    setSessions(s => s.filter(s => s.id !== id))
  }

  function openInSession(sessionId) {
    window.electron?.newTab('https://google.com', sessionId)
    onClose()
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Sessions</span>
        <button className="panel-close" onClick={onClose}>×</button>
      </div>

      <div className="panel-body">
        <p className="panel-hint">
          Each session has isolated cookies, storage, and login state.
          {activeTab && (
            <span> Active tab is in <strong>{activeSession}</strong>.</span>
          )}
        </p>

        <div className="session-list">
          {sessions.map(s => (
            <div key={s.id} className={`session-row${s.id === activeSession ? ' active' : ''}`}>
              <span className="session-dot" style={{ background: s.color }} />
              <span className="session-name">{s.name}</span>
              <div className="session-actions">
                <button className="pill-btn" onClick={() => openInSession(s.id)}>
                  New Tab
                </button>
                {s.id !== 'default' && (
                  <button className="pill-btn danger" onClick={() => removeSession(s.id)}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="panel-section-title">New Session</div>
        <div className="new-session-form">
          <input
            className="panel-input"
            placeholder="Session name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSession()}
          />
          <div className="color-picker">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                className={`color-swatch${c === newColor ? ' selected' : ''}`}
                style={{ background: c }}
                onClick={() => setNewColor(c)}
              />
            ))}
          </div>
          <button className="pill-btn accent" onClick={addSession}>Create</button>
        </div>
      </div>
    </div>
  )
}
