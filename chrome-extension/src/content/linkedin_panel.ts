// Injected on LinkedIn pages.
// All backend calls go through the background service worker to avoid CORS issues.

(function () {
  if (document.getElementById('applyflowai-root')) return

  const host = document.createElement('div')
  host.id = 'applyflowai-root'
  host.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 999999;
    font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `
  document.body.appendChild(host)

  const shadow = host.attachShadow({ mode: 'closed' })

  const style = document.createElement('style')
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    .btn {
      display: flex; align-items: center; gap: 8px;
      background: #16a34a; color: #fff;
      border: none; border-radius: 20px;
      padding: 10px 18px; font-size: 14px; font-weight: 600;
      cursor: pointer; box-shadow: 0 4px 14px rgba(22,163,74,0.35);
      transition: background 0.2s, box-shadow 0.2s;
      font-family: Inter, sans-serif;
    }
    .btn:hover { background: #15803d; box-shadow: 0 4px 18px rgba(22,163,74,0.45); }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #d1fae5; flex-shrink: 0; }
    .dot.running { background: #86efac; animation: pulse 1.5s infinite; }
    .dot.pending { background: #fcd34d; }
    .dot.failed  { background: #fca5a5; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    .overlay {
      position: absolute; bottom: 52px; right: 0;
      background: #fff; border-radius: 12px; padding: 14px 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15); min-width: 230px;
      color: #1e293b; font-size: 13px; border: 1px solid #f0fdf4;
      font-family: Inter, sans-serif;
    }
    .overlay h4 { margin: 0 0 8px; font-size: 14px; color: #16a34a; font-weight: 700; }
    .overlay p  { margin: 4px 0; color: #64748b; }
    .overlay .status { font-weight: 600; color: #1e293b; }
    .hidden { display: none; }
    .hint { font-size: 11px; color: #94a3b8; margin-top: 10px; border-top: 1px solid #f1f5f9; padding-top: 8px; }
  `

  const dot = document.createElement('div')
  dot.className = 'dot'

  const label = document.createElement('span')
  label.textContent = 'ApplyFlow AI'

  const btn = document.createElement('button')
  btn.className = 'btn'
  btn.appendChild(dot)
  btn.appendChild(label)

  const overlay = document.createElement('div')
  overlay.className = 'overlay hidden'

  const statusText = document.createElement('p')
  statusText.className = 'status'
  statusText.textContent = 'Loading…'

  const hint = document.createElement('p')
  hint.className = 'hint'
  hint.textContent = 'Click the extension icon for full controls'

  const h4 = document.createElement('h4')
  h4.textContent = 'ApplyFlow AI Status'

  overlay.appendChild(h4)
  overlay.appendChild(statusText)
  overlay.appendChild(hint)

  shadow.appendChild(style)
  shadow.appendChild(overlay)
  shadow.appendChild(btn)

  let overlayVisible = false
  btn.addEventListener('click', () => {
    overlayVisible = !overlayVisible
    overlay.className = overlayVisible ? 'overlay' : 'overlay hidden'
    if (overlayVisible) refreshStatus()
  })

  /** Returns false if the extension was reloaded — all chrome.* calls will throw after that */
  function isCtxValid(): boolean {
    try { return !!chrome.runtime?.id } catch { return false }
  }

  function refreshStatus() {
    if (!isCtxValid()) return
    // Route through background to avoid CORS
    try {
      chrome.runtime.sendMessage({ type: 'BACKGROUND_FETCH', path: '/runs?limit=5' }, (res) => {
        if (chrome.runtime.lastError || !res?.ok) {
          statusText.textContent = 'Could not reach backend'
          statusText.style.color = '#ef4444'
          dot.className = 'dot failed'
          return
        }
        const runs: Array<{ status: string; type: string }> = res.data
        const active = runs.find((r) => r.status === 'running' || r.status === 'pending')
        if (active) {
          const typeLabel = active.type === 'outreach' ? 'Outreach' : 'Apply'
          statusText.textContent = `${typeLabel} run ${active.status}`
          statusText.style.color = '#16a34a'
          dot.className = `dot ${active.status}`
        } else {
          statusText.textContent = 'No active run'
          statusText.style.color = '#64748b'
          dot.className = 'dot'
        }
      })
    } catch {
      // Extension context invalidated — stop trying
      statusText.textContent = 'Extension reloaded — refresh page'
      statusText.style.color = '#94a3b8'
    }
  }

  const intervalId = setInterval(() => {
    if (!isCtxValid()) { clearInterval(intervalId); return }
    if (overlayVisible) refreshStatus()
  }, 15000)
})()
