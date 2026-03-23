import { setAuth, getAuth, deriveBackendUrl } from '../lib/storage'
import type { AuthState } from '../lib/types'

// ─── State ────────────────────────────────────────────────────────────────────
let wsAgent: WebSocket | null = null
let currentRunId: number | null = null
let botTabId: number | null = null
let popupPort: chrome.runtime.Port | null = null
let sseAbortController: AbortController | null = null
let stopRequested = false
let keepaliveTimer: ReturnType<typeof setInterval> | null = null

// ─── Message types ────────────────────────────────────────────────────────────
interface Msg {
  type: string
  [key: string]: unknown
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('keepalive', { periodInMinutes: 1 })
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'keepalive') return
  const auth = await getAuth()
  if (auth && wsAgent?.readyState !== WebSocket.OPEN) {
    connectAgent(auth)
  } else if (wsAgent?.readyState === WebSocket.OPEN) {
    wsAgent.send(JSON.stringify({ type: 'agent_ready' }))
  }
})

// Auto-reconnect when extension starts
chrome.runtime.onStartup.addListener(async () => {
  const auth = await getAuth()
  if (auth) connectAgent(auth)
})

// ─── Popup long-lived port (SSE streaming + keepalive) ────────────────────────
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'popup') return
  popupPort = port

  port.onDisconnect.addListener(() => {
    popupPort = null
    stopSSE()
  })

  port.onMessage.addListener(async (msg: Msg) => {
    if (msg.type === 'SUBSCRIBE_LOGS') {
      const auth = await getAuth()
      if (!auth) { port.postMessage({ type: 'AUTH_MISSING' }); return }
      startSSE(auth.backendUrl, auth.token, port)
    } else if (msg.type === 'UNSUBSCRIBE_LOGS') {
      stopSSE()
    }
  })
})

// ─── One-time messages ────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg: Msg, _sender, sendResponse) => {
  // Web app logout detected
  if (msg.type === 'CLEAR_AUTH') {
    disconnectAgent()
    chrome.storage.local.remove('applyflowai_auth')
    sendResponse({ ok: true })
    return true
  }

  // Token harvested from web app tab
  if (msg.type === 'SET_AUTH') {
    const backendUrl = deriveBackendUrl(msg.frontendOrigin as string)
    setAuth({ token: msg.token as string, backendUrl }).then(() => {
      connectAgent({ token: msg.token as string, backendUrl })
      sendResponse({ ok: true })
    })
    return true
  }

  // CORS-free fetch for LinkedIn panel content script
  if (msg.type === 'BACKGROUND_FETCH') {
    getAuth().then(async (auth) => {
      if (!auth) { sendResponse({ ok: false, error: 'Not authenticated' }); return }
      try {
        const res = await fetch(`${auth.backendUrl}${msg.path}`, {
          headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
        })
        const data = await res.json()
        sendResponse({ ok: res.ok, data })
      } catch (e) {
        sendResponse({ ok: false, error: String(e) })
      }
    })
    return true
  }

  // Agent control from popup
  if (msg.type === 'CONNECT_AGENT') {
    // Clear rate-limit so a manual "Connect" click always works immediately
    chrome.storage.session.set({ lastConnectAttempt: 0 }).then(() => {
      getAuth().then((auth) => { if (auth) connectAgent(auth) })
    })
    sendResponse({ ok: true })
    return true
  }
  if (msg.type === 'DISCONNECT_AGENT') {
    disconnectAgent()
    sendResponse({ ok: true })
    return true
  }
  if (msg.type === 'GET_AGENT_STATUS') {
    sendResponse({ connected: wsAgent?.readyState === WebSocket.OPEN })
    return true
  }

  // Stop signal from popup
  if (msg.type === 'STOP_BOT') {
    stopRequested = true
    if (currentRunId) {
      getAuth().then(async (auth) => {
        if (auth && currentRunId) {
          await fetch(`${auth.backendUrl}/runs/${currentRunId}/stop`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${auth.token}` },
          }).catch(() => {})
        }
      })
    }
    sendResponse({ ok: true })
    return true
  }

  // Log line forwarded from linkedin_bot content script
  if (msg.type === 'BOT_LOG') {
    if (wsAgent?.readyState === WebSocket.OPEN && currentRunId != null) {
      wsAgent.send(JSON.stringify({ type: 'log', run_id: currentRunId, line: msg.line }))
    }
    // Also forward to popup if connected
    popupPort?.postMessage({ type: 'SSE_MESSAGE', payload: { type: 'log', line: msg.line } })
    sendResponse({ ok: true })
    return true
  }

  // Bot finished
  if (msg.type === 'BOT_FINISHED') {
    const exitCode = msg.success ? 0 : 1
    if (wsAgent?.readyState === WebSocket.OPEN && currentRunId != null) {
      wsAgent.send(JSON.stringify({ type: 'run_finished', run_id: currentRunId, exit_code: exitCode }))
    }
    currentRunId = null
    botTabId = null
    stopRequested = false
    sendResponse({ ok: true })
    return true
  }
})

// ─── WebSocket Agent ──────────────────────────────────────────────────────────
async function connectAgent(auth: AuthState) {
  if (wsAgent?.readyState === WebSocket.OPEN || wsAgent?.readyState === WebSocket.CONNECTING) return

  // Persist rate-limit across service worker restarts (in-memory resets on each restart)
  const stored = await chrome.storage.session.get('lastConnectAttempt')
  const last = (stored.lastConnectAttempt as number) ?? 0
  const now = Date.now()
  if (now - last < 30_000) return
  await chrome.storage.session.set({ lastConnectAttempt: now })

  const wsUrl = auth.backendUrl.replace(/^http/, 'ws') + `/agent/ws?token=${auth.token}`
  console.log('[ApplyFlow AI agent] Connecting to', wsUrl.replace(/token=.*/, 'token=***'))

  try {
    wsAgent = new WebSocket(wsUrl)
  } catch {
    return
  }

  wsAgent.onopen = () => {
    console.log('[ApplyFlow AI agent] Connected')
    wsAgent!.send(JSON.stringify({ type: 'agent_ready' }))
    broadcastAgentStatus(true)

    // Ping every 20 seconds to keep both the WebSocket and the service worker alive.
    // Chrome kills service workers after ~30 seconds of inactivity; the I/O from
    // the ping prevents that. The backend's routes_agent.py ignores `agent_ready`.
    if (keepaliveTimer) clearInterval(keepaliveTimer)
    keepaliveTimer = setInterval(() => {
      if (wsAgent?.readyState === WebSocket.OPEN) {
        wsAgent.send(JSON.stringify({ type: 'agent_ready' }))
      } else {
        clearInterval(keepaliveTimer!)
        keepaliveTimer = null
      }
    }, 20_000)
  }

  wsAgent.onclose = () => {
    console.log('[ApplyFlow AI agent] Disconnected')
    if (keepaliveTimer) { clearInterval(keepaliveTimer); keepaliveTimer = null }
    wsAgent = null
    broadcastAgentStatus(false)
  }

  wsAgent.onerror = (e) => {
    console.warn('[ApplyFlow AI agent] WebSocket error — backend may not be running', e)
    if (keepaliveTimer) { clearInterval(keepaliveTimer); keepaliveTimer = null }
    wsAgent = null
    broadcastAgentStatus(false)
  }

  wsAgent.onmessage = async (event) => {
    let msg: Msg
    try { msg = JSON.parse(event.data) } catch { return }

    if (msg.type === 'ping') {
      wsAgent?.send(JSON.stringify({ type: 'pong' }))

    } else if (msg.type === 'start_run') {
      currentRunId = msg.run_id as number
      stopRequested = false
      agentLog('[Extension Agent] Run received — opening LinkedIn tab...')
      popupPort?.postMessage({ type: 'BOT_STARTING' })
      await launchBotTab(msg.config as Record<string, unknown>)

    } else if (msg.type === 'stop_run') {
      stopRequested = true
      if (botTabId) {
        // Tell the content script to stop; if tab is gone, finalize immediately
        chrome.tabs.sendMessage(botTabId, { type: 'STOP_BOT' }).catch(() => {
          chrome.tabs.remove(botTabId!).catch(() => {})
          if (currentRunId != null) {
            wsAgent?.send(JSON.stringify({ type: 'run_finished', run_id: currentRunId, exit_code: 1 }))
          }
          currentRunId = null
          botTabId = null
        })
      } else if (currentRunId != null) {
        // Extension received start_run but never successfully launched a tab.
        // Mark it finished so the run doesn't stay stuck as "running" forever.
        agentLog('[Extension Agent] Stop requested — no active tab, marking run finished')
        wsAgent?.send(JSON.stringify({ type: 'run_finished', run_id: currentRunId, exit_code: 1 }))
        currentRunId = null
      }
      // If currentRunId is null the run is server-controlled — backend handles it

    } else if (msg.type === 'kill_run') {
      stopRequested = true
      if (botTabId) chrome.tabs.remove(botTabId).catch(() => {})
      if (currentRunId != null) {
        wsAgent?.send(JSON.stringify({ type: 'run_finished', run_id: currentRunId, exit_code: 1 }))
      }
      currentRunId = null
      botTabId = null
    }
  }
}

function disconnectAgent() {
  wsAgent?.close()
  wsAgent = null
  broadcastAgentStatus(false)
}

function broadcastAgentStatus(connected: boolean) {
  chrome.runtime.sendMessage({ type: 'AGENT_STATUS_UPDATE', connected }).catch(() => {})
  popupPort?.postMessage({ type: 'AGENT_STATUS_UPDATE', connected })
}

/** Send a log line both to the backend WS stream and to the popup live logs */
function agentLog(line: string) {
  const ts = new Date().toISOString().slice(11, 19)
  const msg = `[${ts}] ${line}`
  if (wsAgent?.readyState === WebSocket.OPEN && currentRunId != null) {
    wsAgent.send(JSON.stringify({ type: 'log', run_id: currentRunId, line: msg }))
  }
  popupPort?.postMessage({ type: 'SSE_MESSAGE', payload: { type: 'log', line: msg } })
}

// ─── Launch LinkedIn bot tab ──────────────────────────────────────────────────
async function launchBotTab(config: Record<string, unknown>) {
  const auth = await getAuth()
  if (!auth || !currentRunId) return

  const runId = currentRunId

  const searchConfig = (config.search ?? {}) as Record<string, unknown>
  const keywords = (searchConfig.keywords as string) || ''
  const location = (searchConfig.location as string) || ''

  if (!keywords) {
    agentLog('[Extension Agent] ERROR: No job keywords in config. Configure Search settings first.')
    wsAgent?.send(JSON.stringify({ type: 'run_finished', run_id: runId, exit_code: 1 }))
    currentRunId = null
    return
  }

  const searchUrl =
    'https://www.linkedin.com/jobs/search/?' +
    `keywords=${encodeURIComponent(keywords)}` +
    (location ? `&location=${encodeURIComponent(location)}` : '') +
    '&f_AL=true' // Easy Apply filter

  agentLog(`[Extension Agent] Searching: "${keywords}" in "${location || 'any location'}"`)
  agentLog(`[Extension Agent] Opening LinkedIn tab — do NOT close it while bot is running`)

  // Store context BEFORE creating the tab so the content script can read it immediately
  await chrome.storage.session.set({
    applyflowai_bot_context: {
      runId,
      config,
      token: auth.token,
      backendUrl: auth.backendUrl,
    },
  })

  try {
    // The linkedin_bot content script auto-injects on linkedin.com/jobs/* via manifest
    const tab = await chrome.tabs.create({ url: searchUrl, active: true })
    botTabId = tab.id ?? null
    agentLog(`[Extension Agent] LinkedIn tab opened (tab ${botTabId}) — automation starting...`)
  } catch (err) {
    agentLog(`[Extension Agent] ERROR: Failed to open LinkedIn tab: ${err}`)
    wsAgent?.send(JSON.stringify({ type: 'run_finished', run_id: runId, exit_code: 1 }))
    currentRunId = null
    botTabId = null
  }
}

// ─── SSE (live log relay to popup) ───────────────────────────────────────────
function stopSSE() {
  sseAbortController?.abort()
  sseAbortController = null
}

async function startSSE(backendUrl: string, token: string, port: chrome.runtime.Port) {
  stopSSE()
  sseAbortController = new AbortController()
  const signal = sseAbortController.signal

  try {
    const res = await fetch(`${backendUrl}/runs/stream?token=${token}`, {
      signal,
      headers: { Accept: 'text/event-stream' },
    })
    if (!res.ok || !res.body) {
      port.postMessage({ type: 'SSE_ERROR', message: `HTTP ${res.status}` })
      return
    }
    port.postMessage({ type: 'SSE_CONNECTED' })

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done || signal.aborted) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (!data || data === '[DONE]') continue
        try {
          popupPort?.postMessage({ type: 'SSE_MESSAGE', payload: JSON.parse(data) })
        } catch {
          popupPort?.postMessage({ type: 'SSE_MESSAGE', payload: { type: 'log', line: data } })
        }
      }
    }
  } catch (err) {
    if (!sseAbortController?.signal.aborted) {
      port.postMessage({ type: 'SSE_ERROR', message: String(err) })
    }
  }
}
