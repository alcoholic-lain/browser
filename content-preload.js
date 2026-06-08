// content-preload.js
// Runs inside every BrowserView (website content).
// contextIsolation: true — cannot use require('electron') directly.
// Logging is done via window.postMessage to the preload bridge, or
// via the contextBridge-exposed window.electron.logAction if available.

// Safe IPC shim: works whether contextIsolation is true or false
function sendLog(action, details) {
  try {
    // contextIsolation: true path — use the exposed bridge
    if (window.electronLog) {
      window.electronLog(action, details)
      return
    }
    // fallback: contextIsolation: false (legacy)
    const { ipcRenderer } = require('electron')
    ipcRenderer.send('content-log-action', action, details)
  } catch (_) {
    // Silently ignore if neither is available
  }
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', setupInputCapture, false)
window.addEventListener('load', setupInputCapture, false)

let _setupDone = false
function setupInputCapture() {
  if (_setupDone) return
  _setupDone = true

  // Capture all input/textarea changes
  document.addEventListener('input', (e) => {
    const element = e.target
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      const inputType = element.getAttribute('type') || 'text'
      const isPassword = inputType === 'password'
      const value = isPassword ? '[PASSWORD]' : (element.value || '').substring(0, 100)
      const placeholder = element.placeholder || ''
      const name = element.name || element.id || ''

      sendLog('WEBSITE_INPUT', {
        tag: element.tagName,
        inputType,
        name,
        placeholder,
        value,
        isPassword,
        url: window.location.href
      })
    }
  }, true)

  // Capture form submissions
  document.addEventListener('submit', (e) => {
    const form = e.target
    const formData = new FormData(form)
    const fields = {}

    for (const [key, value] of formData) {
      if (key.toLowerCase().includes('password') || key.toLowerCase().includes('pass')) {
        fields[key] = '[PASSWORD]'
      } else {
        fields[key] = (value || '').toString().substring(0, 50)
      }
    }

    sendLog('FORM_SUBMIT', {
      url: window.location.href,
      action: form.action,
      method: form.method,
      fields: JSON.stringify(fields)
    })
  }, true)

  // Capture clicks on important elements (login, submit, etc.)
  document.addEventListener('click', (e) => {
    const target = e.target
    if (target.tagName === 'BUTTON' || target.tagName === 'A') {
      const text = (target.textContent || '').trim().substring(0, 50)
      const href = target.href || ''

      const isAuthClick =
        text.toLowerCase().includes('sign') ||
        text.toLowerCase().includes('login') ||
        text.toLowerCase().includes('submit') ||
        text.toLowerCase().includes('next') ||
        text.toLowerCase().includes('confirm') ||
        text.toLowerCase().includes('continue')

      if (isAuthClick) {
        sendLog('BUTTON_CLICK', {
          url: window.location.href,
          text,
          href
        })
      }
    }
  }, true)

  // Monitor page changes via history API
  const originalPushState = window.history.pushState
  const originalReplaceState = window.history.replaceState

  window.history.pushState = function (...args) {
    const result = originalPushState.apply(window.history, args)
    sendLog('PAGE_CHANGE', { url: window.location.href })
    return result
  }

  window.history.replaceState = function (...args) {
    const result = originalReplaceState.apply(window.history, args)
    sendLog('PAGE_CHANGE', { url: window.location.href })
    return result
  }
}

// Also listen for manual URL navigation
window.addEventListener('beforeunload', () => {
  sendLog('NAVIGATE_AWAY', { from: window.location.href })
})
