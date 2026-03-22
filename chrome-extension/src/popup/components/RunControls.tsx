import { useState, useEffect } from 'react'
import { ApiClient } from '../../lib/api'
import type { Run, RunStatus } from '../../lib/types'

interface Props {
  client: ApiClient
  activeRun: Run | null
  agentConnected: boolean
  onRunChange: (run: Run | null) => void
}

export default function RunControls({ client, activeRun, agentConnected, onRunChange }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)

  const isActive =
    activeRun?.status === 'running' || activeRun?.status === 'pending'

  // Listen for BOT_STARTING message from background to show tab-opening hint
  useEffect(() => {
    const listener = (msg: { type: string }) => {
      if (msg.type === 'BOT_STARTING') {
        setHint('Bot is opening a LinkedIn tab — keep this popup open and watch the logs below.')
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  // Clear hint when run finishes
  useEffect(() => {
    if (!isActive) setHint(null)
  }, [isActive])

  async function startRun(type: 'apply' | 'outreach') {
    setLoading(true)
    setError(null)
    setHint(null)
    try {
      const run = await client.startRun(type)
      onRunChange(run)
      if (agentConnected) {
        setHint('Dispatched to extension agent — a LinkedIn tab will open automatically.')
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function stopRun() {
    if (!activeRun) return
    setLoading(true)
    setError(null)
    try {
      await client.stopRun(activeRun.id)
      onRunChange({ ...activeRun, status: 'stopped' as RunStatus })
      setHint(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="run-controls">
      {error && <div className="error-msg">{error}</div>}
      {hint && <div className="info-msg">{hint}</div>}

      {isActive ? (
        <button className="btn btn-danger" onClick={stopRun} disabled={loading}>
          {loading ? 'Stopping…' : 'Stop Run'}
        </button>
      ) : (
        <>
          <button
            className="btn btn-primary"
            onClick={() => startRun('apply')}
            disabled={loading}
          >
            {loading ? 'Starting…' : 'Start Apply Run'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => startRun('outreach')}
            disabled={loading}
          >
            Start Outreach Run
          </button>
          {agentConnected && (
            <p style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 2 }}>
              Bot will open a new LinkedIn tab automatically — do not open LinkedIn manually.
            </p>
          )}
        </>
      )}
    </div>
  )
}
