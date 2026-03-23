import { useEffect, useState, useCallback } from 'react'
import { getAuth, clearAuth, getSavedBackendUrl } from '../lib/storage'
import { ApiClient } from '../lib/api'
import type { AuthState, Run, RunStatus } from '../lib/types'
import NotConnected from './components/NotConnected'
import StatusBadge from './components/StatusBadge'
import RunControls from './components/RunControls'
import JobTracker from './components/JobTracker'

const DEFAULT_BACKEND = 'http://localhost:8000'

export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(null)
  const [defaultBackendUrl, setDefaultBackendUrl] = useState(DEFAULT_BACKEND)
  const [loading, setLoading] = useState(true)
  const [activeRun, setActiveRun] = useState<Run | null>(null)
  const [agentConnected, setAgentConnected] = useState(false)

  // Load auth + saved backend URL on mount
  useEffect(() => {
    Promise.all([getAuth(), getSavedBackendUrl()]).then(([a, savedUrl]) => {
      setAuth(a)
      if (savedUrl) setDefaultBackendUrl(savedUrl)
      setLoading(false)
    })

    // Re-check auth on storage changes (web app login detected automatically)
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes['applyflowai_auth']) {
        setAuth(changes['applyflowai_auth'].newValue ?? null)
      }
    }
    chrome.storage.local.onChanged.addListener(listener)
    return () => chrome.storage.local.onChanged.removeListener(listener)
  }, [])

  // Fetch active run + agent status whenever auth changes
  useEffect(() => {
    if (!auth) { setActiveRun(null); return }
    const client = new ApiClient(auth.backendUrl, auth.token)
    client.getActiveRun().then(setActiveRun).catch(() => setActiveRun(null))
    // Ask background for agent connection status
    chrome.runtime.sendMessage({ type: 'GET_AGENT_STATUS' }, (res) => {
      if (!chrome.runtime.lastError) setAgentConnected(res?.connected ?? false)
    })
  }, [auth])

  // Listen for agent status updates from background
  useEffect(() => {
    const listener = (msg: { type: string; connected?: boolean }) => {
      if (msg.type === 'AGENT_STATUS_UPDATE') {
        setAgentConnected(msg.connected ?? false)
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  const handleLogin = useCallback((a: AuthState) => {
    setAuth(a)
    // Tell background to connect agent
    chrome.runtime.sendMessage({ type: 'CONNECT_AGENT' })
  }, [])

  const handleLogout = useCallback(async () => {
    await clearAuth()
    chrome.runtime.sendMessage({ type: 'DISCONNECT_AGENT' })
    setAuth(null)
    setActiveRun(null)
    setAgentConnected(false)
  }, [])

  const toggleAgent = useCallback(() => {
    if (agentConnected) {
      chrome.runtime.sendMessage({ type: 'DISCONNECT_AGENT' })
    } else {
      chrome.runtime.sendMessage({ type: 'CONNECT_AGENT' })
    }
  }, [agentConnected])

  const runStatus: RunStatus | 'idle' =
    activeRun?.status === 'running' ? 'running'
    : activeRun?.status === 'pending' ? 'pending'
    : activeRun?.status === 'failed' ? 'failed'
    : activeRun?.status === 'stopped' ? 'stopped'
    : 'idle'

  const client = auth ? new ApiClient(auth.backendUrl, auth.token) : null

  return (
    <>
      <div className="header">
        <div className="logo">A</div>
        <h1>ApplyFlow AI</h1>
        {auth && (
          <span
            className="badge"
            style={{ cursor: 'pointer' }}
            title="Sign out"
            onClick={handleLogout}
          >
            Sign out
          </span>
        )}
      </div>

      <div className="content">
        {loading ? (
          <p style={{ color: '#64748b', fontSize: 13, padding: '8px 0' }}>Loading…</p>
        ) : !auth ? (
          <NotConnected defaultBackendUrl={defaultBackendUrl} onLogin={handleLogin} />
        ) : (
          <>
            <StatusBadge status={runStatus} />

            {/* Agent connection row */}
            <div className="agent-row">
              <div className="label">Bot Agent</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="agent-status">
                  <div className={`dot ${agentConnected ? 'agent' : ''}`} />
                  <span>{agentConnected ? 'Connected' : 'Disconnected'}</span>
                </div>
                <button
                  className={`btn btn-agent btn-sm ${agentConnected ? 'connected' : ''}`}
                  onClick={toggleAgent}
                  style={{ padding: '4px 10px', fontSize: 11, width: 'auto', borderRadius: 6 }}
                >
                  {agentConnected ? 'Disconnect' : 'Connect'}
                </button>
              </div>
            </div>

            {client && (
              <RunControls
                client={client}
                activeRun={activeRun}
                agentConnected={agentConnected}
                onRunChange={setActiveRun}
              />
            )}

            <div className="divider" />
            <JobTracker />
          </>
        )}
      </div>
    </>
  )
}
