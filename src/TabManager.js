import { useState, useEffect, useCallback } from 'react'

// Singleton state shared across the app via a simple event emitter
let _tabs = []
let _activeTabId = null
let _listeners = []

function notify() {
  _listeners.forEach(cb => cb({ tabs: _tabs, activeTabId: _activeTabId }))
}

export function useTabManager() {
  const [state, setState] = useState({ tabs: _tabs, activeTabId: _activeTabId })

  useEffect(() => {
    _listeners.push(setState)
    return () => { _listeners = _listeners.filter(l => l !== setState) }
  }, [])

  useEffect(() => {
    const el = window.electron
    if (!el) return
    el.onTabsUpdate(({ tabs, activeTabId }) => {
      _tabs = tabs
      _activeTabId = activeTabId
      notify()
    })
  }, [])

  const newTab = useCallback((url, sessionId) => {
    window.electron?.newTab(url, sessionId)
  }, [])

  const switchTab = useCallback((id) => {
    window.electron?.switchTab(id)
  }, [])

  const closeTab = useCallback((id) => {
    window.electron?.closeTab(id)
  }, [])

  return { ...state, newTab, switchTab, closeTab }
}
