import { useState } from 'react'
import { setAuth, setSavedBackendUrl } from '../../lib/storage'
import type { AuthState } from '../../lib/types'

interface Props {
  defaultBackendUrl: string
  onLogin: (auth: AuthState) => void
}

export default function LoginForm({ defaultBackendUrl, onLogin }: Props) {
  const [backendUrl, setBackendUrl] = useState(defaultBackendUrl)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const url = backendUrl.replace(/\/$/, '')
    try {
      const res = await fetch(`${url}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.detail ?? `Login failed (${res.status})`)
      }
      const data = await res.json()
      const token: string = data.access_token ?? data.token
      if (!token) throw new Error('No token in response')
      const auth: AuthState = { token, backendUrl: url }
      await setAuth(auth)
      await setSavedBackendUrl(url)
      onLogin(auth)
    } catch (err) {
      setError(String(err).replace(/^Error: /, ''))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      {error && <div className="error-msg">{error}</div>}

      <label>Email</label>
      <input
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoFocus
      />

      <label>Password</label>
      <input
        type="password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <button className="btn btn-primary" type="submit" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign In'}
      </button>

      <div
        className="settings-toggle"
        onClick={() => setShowSettings((s) => !s)}
      >
        <span>⚙ Advanced settings</span>
        <span>{showSettings ? '▲' : '▼'}</span>
      </div>

      {showSettings && (
        <div className="settings-panel">
          <label>Backend URL</label>
          <input
            type="url"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            placeholder="http://localhost:8000"
          />
        </div>
      )}
    </form>
  )
}
