// ── Capture all keyboard input in BrowserView ──────────────────────────────
const { ipcRenderer } = require('electron')

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', setupInputCapture, false)
window.addEventListener('load', setupInputCapture, false)

function setupInputCapture() {
  // Capture all input/textarea changes
  document.addEventListener('input', (e) => {
    const element = e.target
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      const inputType = element.getAttribute('type') || 'text'
      const isPassword = inputType === 'password'
      const value = isPassword ? '[PASSWORD]' : (element.value || '').substring(0, 100)
      const placeholder = element.placeholder || ''
      const name = element.name || element.id || ''
      
      ipcRenderer.send('content-log-action', 'WEBSITE_INPUT', {
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
    
    for (let [key, value] of formData) {
      // Mask password fields
      if (key.toLowerCase().includes('password') || key.toLowerCase().includes('pass')) {
        fields[key] = '[PASSWORD]'
      } else {
        fields[key] = (value || '').toString().substring(0, 50)
      }
    }

    ipcRenderer.send('content-log-action', 'FORM_SUBMIT', {
      url: window.location.href,
      action: form.action,
      method: form.method,
      fields: JSON.stringify(fields)
    })
  }, true)

  // Capture clicks on important elements (login, submit, etc)
  document.addEventListener('click', (e) => {
    const target = e.target
    if (target.tagName === 'BUTTON' || target.tagName === 'A') {
      const text = (target.textContent || '').trim().substring(0, 50)
      const href = target.href || ''
      
      if (text.toLowerCase().includes('sign') || 
          text.toLowerCase().includes('login') || 
          text.toLowerCase().includes('submit') ||
          text.toLowerCase().includes('next') ||
          text.toLowerCase().includes('confirm') ||
          text.toLowerCase().includes('continue')) {
        
        ipcRenderer.send('content-log-action', 'BUTTON_CLICK', {
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
  
  window.history.pushState = function(...args) {
    const result = originalPushState.apply(window.history, args)
    ipcRenderer.send('content-log-action', 'PAGE_CHANGE', {
      url: window.location.href
    })
    return result
  }

  window.history.replaceState = function(...args) {
    const result = originalReplaceState.apply(window.history, args)
    ipcRenderer.send('content-log-action', 'PAGE_CHANGE', {
      url: window.location.href
    })
    return result
  }
}

// Also listen for manual URL navigation
window.addEventListener('beforeunload', () => {
  ipcRenderer.send('content-log-action', 'NAVIGATE_AWAY', {
    from: window.location.href
  })
})

