// oauth-preload.js
// Injected into OAuth popup windows (Google Sign-In, etc.)
// Intercepts postMessage events from the auth provider and relays them
// to the main process, which forwards them into the active BrowserView.

const { ipcRenderer } = require('electron')

// ── Relay all postMessage events ──────────────────────────────────────────
window.addEventListener('message', (event) => {
  if (!event.data) return

  const data =
    typeof event.data === 'string'
      ? event.data
      : JSON.stringify(event.data)

  ipcRenderer.send('oauth-postmessage', {
    data,
    origin: event.origin,
    isFormPost: false,
  })
})

// ── Intercept form_post mode ───────────────────────────────────────────────
// Some OAuth flows (older GSI, non-Google providers) POST a form back
// instead of using postMessage. We intercept form submissions here.
document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('submit', (e) => {
    const form = e.target
    if (!form) return

    const formData = new FormData(form)
    const fields = {}
    for (const [key, value] of formData) {
      fields[key] = value.toString()
    }

    // Only relay if it looks like an OAuth response (has code or token)
    if (fields.code || fields.access_token || fields.id_token || fields.state) {
      e.preventDefault()
      ipcRenderer.send('oauth-postmessage', {
        data: JSON.stringify(fields),
        origin: window.location.origin,
        isFormPost: true,
      })
    }
  }, true)
})
