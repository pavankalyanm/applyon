import { useEffect, useRef, useState } from 'react'
import type { JobStatus } from '../../lib/types'

interface JobEntry {
  jobNum: number
  title: string
  company: string
  status: JobStatus
  detail?: string
}

interface JobMsg {
  type: string
  jobNum?: number
  title?: string
  company?: string
  status?: JobStatus
  detail?: string
  appliedCount?: number
  maxJobs?: number
}

const TERMINAL: JobStatus[] = ['applied', 'skipped', 'error']

function statusLabel(s: JobStatus): string {
  switch (s) {
    case 'clicking':   return 'Opening'
    case 'applying':   return 'Easy Apply'
    case 'filling':    return 'Filling'
    case 'submitting': return 'Submitting'
    case 'applied':    return 'Applied'
    case 'skipped':    return 'Skipped'
    case 'error':      return 'Failed'
    default:           return '...'
  }
}

function currentActionText(job: JobEntry): string {
  const name = job.title ? `${job.title}${job.company ? ` @ ${job.company}` : ''}` : 'job'
  switch (job.status) {
    case 'clicking':   return `Opening ${name}`
    case 'applying':   return `Easy Apply — ${name}`
    case 'filling':    return `Filling form${job.detail ? ` · ${job.detail}` : ''} — ${name}`
    case 'submitting': return `Submitting — ${name}`
    default:           return name
  }
}

export default function JobTracker() {
  const [jobs, setJobs] = useState<JobEntry[]>([])
  const [appliedCount, setAppliedCount] = useState(0)
  const [maxJobs, setMaxJobs] = useState(0)
  const [scanMsg, setScanMsg] = useState<string | null>(null)
  const [botActive, setBotActive] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let port: chrome.runtime.Port
    try { port = chrome.runtime.connect({ name: 'popup' }) } catch { return }

    port.onMessage.addListener((msg: JobMsg & { payload?: { status?: string } }) => {
      if (msg.type === 'BOT_STARTING') {
        setJobs([])
        setAppliedCount(0)
        setScanMsg(null)
        setBotActive(true)
        return
      }

      if (msg.type === 'BOT_FINISHED' || (msg.type === 'SSE_MESSAGE' && (msg.payload?.status === 'success' || msg.payload?.status === 'failed' || msg.payload?.status === 'stopped'))) {
        setBotActive(false)
        return
      }

      if (msg.type !== 'JOB_EVENT') return

      if (typeof msg.appliedCount === 'number') setAppliedCount(msg.appliedCount)
      if (msg.maxJobs && msg.maxJobs > 0) setMaxJobs(msg.maxJobs)

      if (msg.status === 'scanning') {
        setScanMsg(msg.detail ?? 'Scanning for jobs...')
        return
      }

      if (!msg.jobNum || !msg.status) return
      setScanMsg(null)

      const entry: JobEntry = {
        jobNum: msg.jobNum,
        title: msg.title ?? '',
        company: msg.company ?? '',
        status: msg.status,
        detail: msg.detail,
      }

      setJobs(prev => {
        const idx = prev.findIndex(j => j.jobNum === entry.jobNum)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...prev[idx], ...entry }
          return next
        }
        return [...prev, entry]
      })
    })

    return () => { try { port.disconnect() } catch { /* gone */ } }
  }, [])

  // Scroll job list to show newest entry
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [jobs.length])

  const pct = maxJobs > 0 ? Math.min(100, Math.round((appliedCount / maxJobs) * 100)) : 0
  const activeJob = [...jobs].reverse().find(j => !TERMINAL.includes(j.status))

  if (!botActive && jobs.length === 0) {
    return (
      <div className="jt-empty-state">
        Start a run — job progress will appear here in real time.
      </div>
    )
  }

  return (
    <div className="jt">
      {/* Header: applied count + progress */}
      <div className="jt-header">
        <span className="jt-title">Job Progress</span>
        <span className="jt-count">
          <strong>{appliedCount}</strong>{maxJobs > 0 ? `/${maxJobs}` : ''} applied
        </span>
      </div>

      {maxJobs > 0 && (
        <div className="jt-bar-track">
          <div className="jt-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      )}

      {/* Current action */}
      {(activeJob || scanMsg) && (
        <div className="jt-action">
          <div className="dot running" style={{ flexShrink: 0 }} />
          <span className="jt-action-text">
            {activeJob ? currentActionText(activeJob) : scanMsg}
          </span>
        </div>
      )}

      {/* Job list */}
      <div className="jt-list" ref={listRef}>
        {jobs.length === 0 && botActive && (
          <div className="jt-list-empty">Searching LinkedIn jobs...</div>
        )}
        {[...jobs].reverse().map(job => (
          <div key={job.jobNum} className={`jt-job jt-job-${job.status}`}>
            <div className="jt-job-row">
              <span className="jt-job-num">#{job.jobNum}</span>
              <span className="jt-job-name">
                {job.title || '—'}{job.company ? ` @ ${job.company}` : ''}
              </span>
              <span className={`jt-job-badge jt-badge-${job.status}`}>
                {!TERMINAL.includes(job.status) && <span className="jt-spinner" />}
                {statusLabel(job.status)}
              </span>
            </div>
            {!TERMINAL.includes(job.status) && job.detail && (
              <div className="jt-job-detail">{job.detail}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
