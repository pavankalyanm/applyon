import LoginForm from './LoginForm'
import type { AuthState } from '../../lib/types'

interface Props {
  defaultBackendUrl: string
  onLogin: (auth: AuthState) => void
}

export default function NotConnected({ defaultBackendUrl, onLogin }: Props) {
  return (
    <div className="not-connected">
      <div className="icon">🌿</div>
      <h2>Sign in to ApplyFlow AI</h2>
      <p>Log in below or open the ApplyFlow AI web app and your session will be detected automatically.</p>
      <div className="or-divider">or sign in directly</div>
      <LoginForm defaultBackendUrl={defaultBackendUrl} onLogin={onLogin} />
    </div>
  )
}
