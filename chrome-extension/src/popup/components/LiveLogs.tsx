import { useEffect, useRef, useState, useCallback } from 'react'
import type { SSEMessage } from '../../lib/types'

interface LogEntry {
  text: string
  cls: string
}

interface Props {
  active: boolean
}

function classifyLine(line: string): string {
  const l = line.toLowerCase()
  if (l.includes('error') || l.includes('failed')) return 'error'
  if (l.includes('success') || l.includes('applied') || l.includes('done')) return 'success'
  if (line.startsWith('EVENT:') || line.startsWith('[EVENT]')) return 'event'
  return ''
}

export default function LiveLogs({ active }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [connected, setConnected] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const portRef = useRef<chrome.runtime.Port | null>(null)
  const activeRef = useRef(active)
  activeRef.current = active

  const addLog = useCallback((line: string) => {
    setLogs((prev) => {
      const next = [...prev, { text: line, cls: classifyLine(line) }]
      return next.slice(-100) // keep last 100 lines
    })
  }, [])

  // Always connect the popup port so extension-bot logs arrive even before SSE starts
  useEffect(() => {
    let port: chrome.runtime.Port
    try {
      port = chrome.runtime.connect({ name: 'popup' })
    } catch {
      return // extension context already gone
    }
    portRef.current = port
    let alive = true

    port.onDisconnect.addListener(() => {
      alive = false
      portRef.current = null
      setConnected(false)
    })

    port.onMessage.addListener((msg: { type: string; payload?: SSEMessage; message?: string }) => {
      if (msg.type === 'SSE_CONNECTED') {
        setConnected(true)
        addLog('── Connected to log stream ──')
      } else if (msg.type === 'SSE_ERROR') {
        setConnected(false)
        addLog(`── Stream error: ${msg.message} ──`)
      } else if (msg.type === 'SSE_MESSAGE' && msg.payload) {
        const p = msg.payload
        if (p.line) addLog(p.line)
        if (p.status) addLog(`── Run status: ${p.status} ──`)
      } else if (msg.type === 'AUTH_MISSING') {
        addLog('── Not authenticated ──')
      }
    })

    function safePost(msg: object) {
      if (!alive) return
      try { port.postMessage(msg) } catch { alive = false; portRef.current = null }
    }

    // Store safePost so the active-change effect can use it
    ;(port as chrome.runtime.Port & { safePost?: (m: object) => void }).safePost = safePost

    return () => {
      safePost({ type: 'UNSUBSCRIBE_LOGS' })
      try { port.disconnect() } catch { /* already disconnected */ }
      portRef.current = null
      setConnected(false)
    }
  }, [addLog])

  // Subscribe/unsubscribe SSE based on active state
  useEffect(() => {
    const port = portRef.current as (chrome.runtime.Port & { safePost?: (m: object) => void }) | null
    if (!port) return
    if (active) {
      port.safePost?.({ type: 'SUBSCRIBE_LOGS' })
    } else {
      port.safePost?.({ type: 'UNSUBSCRIBE_LOGS' })
      setConnected(false)
    }
  }, [active])

  // Auto-scroll to bottom
  useEffect(() => {
    if (boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div className="logs-section">
      <div className="logs-header">
        <span>Live Logs</span>
        {active && (
          <span style={{ fontSize: 11, color: connected ? '#22c55e' : '#9ca3af' }}>
            {connected ? '● live' : '○ connecting…'}
          </span>
        )}
      </div>
      <div className="logs-box" ref={boxRef}>
        {logs.length === 0 ? (
          <span className="empty">Waiting for logs…</span>
        ) : (
          logs.map((l, i) => (
            <span key={i} className={`log-line ${l.cls}`}>
              {l.text}{'\n'}
            </span>
          ))
        )}
      </div>
    </div>
  )
}
