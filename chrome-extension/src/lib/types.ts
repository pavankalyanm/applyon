export type RunStatus = 'pending' | 'running' | 'success' | 'failed' | 'stopped'
export type RunType = 'apply' | 'outreach'

export interface Run {
  id: number
  status: RunStatus
  type: RunType
  created_at: string
  finished_at: string | null
  error_message: string | null
}

export interface AuthState {
  token: string
  backendUrl: string
}

export interface LogLine {
  text: string
  ts: number
}

export interface SSEMessage {
  type: 'log' | 'run_update' | 'run_finished'
  run_id?: number
  line?: string
  status?: RunStatus
}

export type JobStatus =
  | 'scanning' | 'clicking' | 'applying'
  | 'filling' | 'submitting'
  | 'applied' | 'skipped' | 'error'

export interface JobEvent {
  jobNum?: number
  title?: string
  company?: string
  status: JobStatus
  detail?: string
  appliedCount?: number
  maxJobs?: number
}
