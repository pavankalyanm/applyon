import type { RunStatus } from '../../lib/types'

const labels: Record<RunStatus | 'idle', string> = {
  idle: 'Idle',
  pending: 'Pending',
  running: 'Running',
  success: 'Completed',
  failed: 'Failed',
  stopped: 'Stopped',
}

interface Props {
  status: RunStatus | 'idle'
}

export default function StatusBadge({ status }: Props) {
  return (
    <div className="status-row">
      <span className="label">Bot Status</span>
      <div className="status-badge">
        <div className={`dot ${status}`} />
        <span>{labels[status]}</span>
      </div>
    </div>
  )
}
