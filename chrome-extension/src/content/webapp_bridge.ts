// Injected into the ApplyOn web app tab.
// Reads the JWT from localStorage and sends it to the background service worker.

(function () {
  function isCtxValid(): boolean {
    try { return !!chrome.runtime?.id } catch { return false }
  }

  function safeSend(msg: object) {
    if (!isCtxValid()) return
    try { chrome.runtime.sendMessage(msg) } catch { /* context invalidated */ }
  }

  const token = window.localStorage.getItem('access_token')
  const frontendOrigin = window.location.origin

  if (token) {
    safeSend({ type: 'SET_AUTH', token, frontendOrigin })
  }

  // Re-send on storage changes (e.g. user logs in/out in the same tab)
  window.addEventListener('storage', (e) => {
    if (e.key !== 'access_token') return
    if (e.newValue) {
      safeSend({ type: 'SET_AUTH', token: e.newValue, frontendOrigin })
    } else {
      safeSend({ type: 'CLEAR_AUTH' })
    }
  })
})()
