import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  IconButton,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import {
  Close,
  PlayArrow,
  PowerSettingsNew,
  Refresh,
  RocketLaunch,
  Stop,
  Terminal,
  AccessTime,
  CheckCircle,
  Error as ErrorIcon,
  HourglassEmpty,
} from '@mui/icons-material'
import type { ReactElement } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api, apiBaseUrl } from '../api'

type RunStatus = 'pending' | 'running' | 'stopping' | 'stopped' | 'success' | 'completed' | 'failed'

type Run = {
  id: number
  status: RunStatus
  run_type?: string
  started_at: string
  finished_at?: string | null
  error_message?: string | null
}

type RunDetail = Run & {
  log_excerpt?: string | null
}

const statusConfig: Record<string, { color: 'success' | 'warning' | 'error' | 'default'; icon: ReactElement; label: string }> = {
  running:   { color: 'success', icon: <HourglassEmpty sx={{ fontSize: 14 }} />, label: 'running' },
  success:   { color: 'success', icon: <CheckCircle sx={{ fontSize: 14 }} />,    label: 'success' },
  completed: { color: 'success', icon: <CheckCircle sx={{ fontSize: 14 }} />,    label: 'completed' },
  stopping:  { color: 'warning', icon: <AccessTime sx={{ fontSize: 14 }} />,     label: 'stopping' },
  stopped:   { color: 'warning', icon: <Stop sx={{ fontSize: 14 }} />,           label: 'stopped' },
  failed:    { color: 'error',   icon: <ErrorIcon sx={{ fontSize: 14 }} />,      label: 'failed' },
  pending:   { color: 'default', icon: <AccessTime sx={{ fontSize: 14 }} />,     label: 'pending' },
}

function asUtc(ts: string): string {
  return ts.endsWith('Z') || ts.includes('+') ? ts : ts + 'Z'
}

function getDuration(run: Run): string {
  const start = new Date(asUtc(run.started_at)).getTime()
  const end = run.finished_at ? new Date(asUtc(run.finished_at)).getTime() : Date.now()
  const s = Math.floor((end - start) / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

function TerminalLogDialog({
  open,
  onClose,
  run,
  details,
}: {
  open: boolean
  onClose: () => void
  run: Run | null
  details: RunDetail | null
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [open, details?.log_excerpt])

  const lines = details?.log_excerpt?.split('\n') ?? []

  function lineColor(line: string): string {
    if (line.startsWith('[STEP]')) return '#4ade80'
    if (/error|exception|failed|traceback/i.test(line)) return '#f87171'
    if (/warning|warn/i.test(line)) return '#fbbf24'
    if (/success|completed|done/i.test(line)) return '#86efac'
    return '#a3c4b0'
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#0a0f0a',
          border: '1px solid #1c3a1c',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        },
      }}
    >
      {/* Terminal title bar */}
      <Box
        sx={{
          bgcolor: '#111a11',
          px: 2,
          py: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderBottom: '1px solid #1c3a1c',
        }}
      >
        {/* macOS-style dots */}
        <Box sx={{ display: 'flex', gap: 0.75, mr: 1.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#ff5f57' }} />
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#febc2e' }} />
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#28c840' }} />
        </Box>
        <Terminal sx={{ fontSize: 14, color: '#3a6a4a', mr: 0.5 }} />
        <Typography
          sx={{
            flex: 1,
            textAlign: 'center',
            fontFamily: 'monospace',
            fontSize: '0.78rem',
            color: '#4a8a5a',
            letterSpacing: '0.03em',
          }}
        >
          {run ? `run #${run.id} — ${run.run_type ?? 'apply'} — ${statusConfig[run.status]?.label ?? run.status}` : '—'}
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: '#3a6a4a', p: 0.5, '&:hover': { color: '#86efac' } }}>
          <Close sx={{ fontSize: 15 }} />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 0 }}>
        {/* Live indicator */}
        {run?.status === 'running' && (
          <Box
            sx={{
              px: 2.5,
              py: 0.75,
              bgcolor: 'rgba(34,197,94,0.08)',
              borderBottom: '1px solid rgba(34,197,94,0.12)',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Box
              sx={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                bgcolor: '#4ade80',
                boxShadow: '0 0 6px #4ade80',
                animation: 'pulse 1.5s infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.4 },
                },
              }}
            />
            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#4ade80' }}>
              LIVE — streaming logs
            </Typography>
          </Box>
        )}

        {/* Log content */}
        <Box
          ref={scrollRef}
          sx={{
            p: 2.5,
            fontFamily: '"Fira Code", "Cascadia Code", "Consolas", monospace',
            fontSize: '0.76rem',
            lineHeight: 1.75,
            maxHeight: '62vh',
            overflowY: 'auto',
            '&::-webkit-scrollbar': { width: 5 },
            '&::-webkit-scrollbar-track': { bgcolor: '#0a0f0a' },
            '&::-webkit-scrollbar-thumb': { bgcolor: '#1e3a1e' },
          }}
        >
          {lines.length === 0 ? (
            <Typography sx={{ color: '#3a6a4a', fontFamily: 'inherit', fontSize: 'inherit' }}>
              {details ? 'No logs captured for this run yet.' : 'Loading logs…'}
            </Typography>
          ) : (
            lines.map((line, i) => (
              <Box
                key={i}
                component="div"
                sx={{
                  color: lineColor(line),
                  minHeight: '1.2em',
                  wordBreak: 'break-all',
                }}
              >
                {line || '\u00A0'}
              </Box>
            ))
          )}
        </Box>

        {/* Bottom prompt line */}
        <Box
          sx={{
            px: 2.5,
            py: 1,
            bgcolor: '#0d150d',
            borderTop: '1px solid #1c3a1c',
            fontFamily: 'monospace',
            fontSize: '0.72rem',
            color: '#2d5a2d',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          <Box component="span" sx={{ color: '#4ade80' }}>
            $
          </Box>{' '}
          applyflowai-bot
          {run?.status === 'running' && (
            <Box
              component="span"
              sx={{
                ml: 0.5,
                display: 'inline-block',
                width: 7,
                height: 13,
                bgcolor: '#4ade80',
                verticalAlign: 'middle',
                animation: 'blink 1s step-start infinite',
                '@keyframes blink': { '50%': { opacity: 0 } },
              }}
            />
          )}
        </Box>
      </DialogContent>
    </Dialog>
  )
}

export function Dashboard() {
  const [runs, setRuns] = useState<Run[]>([])
  const [tick, setTick] = useState(0)
  const [runsPage, setRunsPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [runDetails, setRunDetails] = useState<Record<number, RunDetail>>({})
  const [resumes, setResumes] = useState<{ id: string; label: string }[]>([])
  const [selectedResumeId, setSelectedResumeId] = useState<string | ''>('')
  const [outreachDialogOpen, setOutreachDialogOpen] = useState(false)
  const [outreachDraft, setOutreachDraft] = useState({
    role: '',
    company: '',
    recruiter_search_context: '',
    message_content: '',
    use_ai_for_outreach: false,
    attach_default_resume: false,
  })
  const [logDialogRunId, setLogDialogRunId] = useState<number | null>(null)
  const runsPerPage = 25
  const eventSourceRef = useRef<EventSource | null>(null)

  async function loadResumes() {
    const resumesResp = await api.get('/resumes')
    const data = resumesResp.data || {}
    const items = (data.items as { id: string; label: string }[]) || []
    setResumes(items)
    if (!selectedResumeId && data.default_resume_id) {
      setSelectedResumeId(data.default_resume_id as string)
    }
  }

  async function loadOutreachDefaults() {
    const configResp = await api.get('/config')
    const outreach = configResp.data?.outreach || {}
    const search = configResp.data?.search || {}
    setOutreachDraft((current) => ({
      role: current.role || outreach.default_role || search.search_terms?.[0] || '',
      company: current.company || outreach.default_company || '',
      recruiter_search_context: current.recruiter_search_context || outreach.default_recruiter_search_context || '',
      message_content: current.message_content || outreach.default_message_content || '',
      attach_default_resume:
        current.role || current.message_content || current.company || current.recruiter_search_context
          ? current.attach_default_resume
          : Boolean(outreach.attach_default_resume),
      use_ai_for_outreach:
        current.message_content || current.role
          ? current.use_ai_for_outreach
          : Boolean(outreach.use_ai_for_outreach),
    }))
  }

  function applyRunUpdate(updatedRun: RunDetail) {
    setRuns((current) => {
      const next = [...current]
      const index = next.findIndex((item) => item.id === updatedRun.id)
      const baseRun = {
        id: updatedRun.id,
        status: updatedRun.status,
        run_type: updatedRun.run_type,
        started_at: updatedRun.started_at,
        finished_at: updatedRun.finished_at,
        error_message: updatedRun.error_message,
      }
      if (index >= 0) {
        next[index] = { ...next[index], ...baseRun }
      } else {
        next.unshift(baseRun)
      }
      next.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
      return next
    })
    setRunDetails((current) => ({ ...current, [updatedRun.id]: updatedRun }))
  }

  async function refreshRuns() {
    try {
      const resp = await api.get('/runs')
      setRuns(resp.data)
      setRunsPage(1)
    } catch {
      // silent
    }
  }

  async function refreshAll() {
    try {
      await Promise.all([refreshRuns(), loadResumes(), loadOutreachDefaults()])
    } catch {
      // silent
    }
  }

  async function startRun() {
    setError(null)
    setLoading(true)
    try {
      if (selectedResumeId) await api.post(`/resumes/${selectedResumeId}/default`)
      await api.post('/runs')
      await Promise.all([refreshRuns(), loadResumes()])
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to start run')
    } finally {
      setLoading(false)
    }
  }

  async function stopRun(runId: number) {
    await api.post(`/runs/${runId}/stop`)
    await refreshRuns()
  }

  async function killRun(runId: number) {
    await api.post(`/runs/${runId}/kill`)
    await refreshRuns()
  }

  async function openLogs(runId: number) {
    setLogDialogRunId(runId)
    if (!runDetails[runId]) {
      const resp = await api.get(`/runs/${runId}`)
      setRunDetails((current) => ({ ...current, [runId]: resp.data }))
    }
  }

  async function startOutreachRun() {
    setError(null)
    setLoading(true)
    try {
      await api.post('/runs/outreach', { run_type: 'outreach', run_input: outreachDraft })
      setOutreachDialogOpen(false)
      await refreshRuns()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to start outreach run')
    } finally {
      setLoading(false)
    }
  }

  const streamUrl = useMemo(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return null
    return `${apiBaseUrl}/runs/stream?token=${encodeURIComponent(token)}`
  }, [])

  useEffect(() => { void refreshAll() }, [])

  // Tick every second to keep active run timers live
  useEffect(() => {
    const hasActive = runs.some(r => r.status === 'running' || r.status === 'stopping')
    if (!hasActive) return
    const id = window.setInterval(() => setTick(t => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [runs])

  useEffect(() => {
    if (!streamUrl) return
    const source = new EventSource(streamUrl)
    eventSourceRef.current = source

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload.type === 'runs_snapshot' && Array.isArray(payload.runs)) {
          const snapshotRuns = payload.runs as RunDetail[]
          setRuns(snapshotRuns.map((run) => ({
            id: run.id, status: run.status, run_type: run.run_type,
            started_at: run.started_at, finished_at: run.finished_at, error_message: run.error_message,
          })))
          setRunDetails((current) => {
            const next = { ...current }
            snapshotRuns.forEach((run) => { next[run.id] = run })
            return next
          })
          return
        }
        if (payload.run) applyRunUpdate(payload.run as RunDetail)
      } catch { /* ignore */ }
    }

    return () => { source.close(); eventSourceRef.current = null }
  }, [streamUrl])

  const latest = runs[0]
  const activeRun = runs.find((r) => r.status === 'running' || r.status === 'stopping')
  const runningCount  = runs.filter((r) => r.status === 'running').length
  const completedCount = runs.filter((r) => r.status === 'success' || r.status === 'completed').length
  const failedCount   = runs.filter((r) => r.status === 'failed').length
  const totalCount    = runs.length
  const totalPages    = Math.max(1, Math.ceil(totalCount / runsPerPage))
  const currentPage   = Math.min(runsPage, totalPages)
  const paginatedRuns = runs.slice((currentPage - 1) * runsPerPage, currentPage * runsPerPage)

  const logDialogRun     = logDialogRunId != null ? (runs.find((r) => r.id === logDialogRunId) ?? null) : null
  const logDialogDetails = logDialogRunId != null ? (runDetails[logDialogRunId] ?? null) : null

  const statCards = [
    { label: 'Total Runs',  value: totalCount,    color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Running',     value: runningCount,  color: '#f59e0b', bg: '#fffbeb' },
    { label: 'Completed',   value: completedCount, color: '#0ea5e9', bg: '#f0f9ff' },
    { label: 'Failed',      value: failedCount,   color: '#ef4444', bg: '#fef2f2' },
  ]

  return (
    <Box sx={{ p: { xs: 3, md: 4 }, minHeight: '100%' }}>
      {/* ── Page header ── */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ color: '#0f172a', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Dashboard
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, fontSize: '0.9rem' }}>
            Monitor and control your automated job application runs.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh sx={{ fontSize: 16 }} />}
          onClick={refreshAll}
          size="small"
          sx={{
            borderColor: '#d1d5db',
            color: '#374151',
            '&:hover': { borderColor: '#16a34a', color: '#16a34a', bgcolor: 'transparent' },
          }}
        >
          Refresh
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* ── Stat cards ── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 2,
          mb: 3,
        }}
      >
        {statCards.map((stat) => (
          <Box
            key={stat.label}
            sx={{
              p: 3,
              bgcolor: '#fff',
              border: '1px solid #e2e8f0',
              borderLeft: `4px solid ${stat.color}`,
              borderRadius: '5px',
            }}
          >
            <Typography
              sx={{
                fontSize: '2rem',
                fontWeight: 800,
                color: stat.color,
                lineHeight: 1,
                mb: 0.5,
              }}
            >
              {stat.value}
            </Typography>
            <Typography sx={{ color: '#64748b', fontSize: '0.82rem', fontWeight: 500 }}>
              {stat.label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* ── Bot controls panel ── */}
      <Box
        sx={{
          p: 3,
          mb: 3,
          background: 'linear-gradient(135deg, #0f2d1a 0%, #14532d 60%, #15803d 100%)',
          border: '1px solid #166534',
          borderRadius: '5px',
          color: '#fff',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2.5}
          alignItems={{ md: 'center' }}
          justifyContent="space-between"
        >
          <Box>
            <Typography variant="h6" fontWeight={700} color="#fff" sx={{ mb: 0.5 }}>
              Bot Controls
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  bgcolor: latest?.status === 'running' ? '#4ade80' : '#475569',
                  boxShadow: latest?.status === 'running' ? '0 0 8px #4ade80' : 'none',
                }}
              />
              <Typography sx={{ color: '#86efac', fontSize: '0.85rem' }}>
                {latest
                  ? `Latest: #${latest.id} — ${statusConfig[latest.status]?.label ?? latest.status}`
                  : 'No runs yet'}
              </Typography>
            </Stack>
          </Box>

          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            <Select
              size="small"
              displayEmpty
              value={selectedResumeId}
              onChange={(e) => setSelectedResumeId(e.target.value as string)}
              sx={{
                minWidth: 200,
                bgcolor: 'rgba(255,255,255,0.06)',
                color: '#d1fae5',
                fontSize: '0.85rem',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.35)' },
                '& .MuiSvgIcon-root': { color: '#86efac' },
              }}
            >
              <MenuItem value=""><em>Default resume (from settings)</em></MenuItem>
              {resumes.map((r) => (
                <MenuItem key={r.id} value={r.id}>{r.label}</MenuItem>
              ))}
            </Select>

            <Button
              variant="contained"
              disabled={loading}
              onClick={startRun}
              startIcon={<PlayArrow sx={{ fontSize: 16 }} />}
              sx={{
                bgcolor: '#fff',
                color: '#15803d',
                fontWeight: 700,
                '&:hover': { bgcolor: '#f0fdf4' },
                '&:disabled': { bgcolor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.4)' },
                background: '#fff',
              }}
            >
              {loading ? 'Starting…' : 'Start Bot'}
            </Button>

            <Button
              variant="outlined"
              onClick={() => setOutreachDialogOpen(true)}
              sx={{
                borderColor: 'rgba(255,255,255,0.2)',
                color: '#d1fae5',
                '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.06)' },
              }}
            >
              Start Outreach
            </Button>

            {activeRun && (
              <>
                <Button
                  variant="outlined"
                  onClick={() => stopRun(activeRun.id)}
                  startIcon={<Stop sx={{ fontSize: 16 }} />}
                  sx={{
                    borderColor: 'rgba(255,200,0,0.4)',
                    color: '#fde68a',
                    '&:hover': { borderColor: '#fde68a', bgcolor: 'rgba(253,230,138,0.08)' },
                  }}
                >
                  Stop
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => killRun(activeRun.id)}
                  startIcon={<PowerSettingsNew sx={{ fontSize: 16 }} />}
                  sx={{
                    borderColor: 'rgba(239,68,68,0.4)',
                    color: '#fca5a5',
                    '&:hover': { borderColor: '#ef4444', bgcolor: 'rgba(239,68,68,0.08)' },
                  }}
                >
                  Force Stop
                </Button>
              </>
            )}
          </Stack>
        </Stack>
      </Box>

      {/* ── Run History ── */}
      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ color: '#0f172a', fontWeight: 700 }}>
            Run History
          </Typography>
          <Typography sx={{ color: '#94a3b8', fontSize: '0.82rem' }}>
            {totalCount} total
          </Typography>
        </Stack>

        {runs.length === 0 ? (
          <Box
            sx={{
              p: 6,
              bgcolor: '#fff',
              border: '1px solid #e2e8f0',
              textAlign: 'center',
            }}
          >
            <RocketLaunch sx={{ fontSize: 36, color: '#cbd5e1', mb: 1.5 }} />
            <Typography variant="h6" sx={{ color: '#334155', mb: 0.5 }}>
              No runs yet
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3, fontSize: '0.9rem' }}>
              Hit "Start Bot" to begin your first automated job application run.
            </Typography>
            <Button
              variant="contained"
              startIcon={<PlayArrow />}
              onClick={startRun}
              disabled={loading}
            >
              Start Your First Run
            </Button>
          </Box>
        ) : (
          <>
            <TableContainer
              component={Paper}
              sx={{ border: '1px solid #e2e8f0', boxShadow: 'none' }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc' }}>
                    {['Run', 'Type', 'Status', 'Started', 'Duration', 'Actions'].map((h) => (
                      <TableCell
                        key={h}
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          color: '#64748b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          borderBottom: '2px solid #e2e8f0',
                          py: 1.5,
                        }}
                      >
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedRuns.map((run) => {
                    const cfg = statusConfig[run.status] ?? statusConfig.pending
                    const isActive = run.status === 'running' || run.status === 'stopping'
                    return (
                      <TableRow
                        key={run.id}
                        hover
                        sx={{
                          '&:hover': { bgcolor: '#f8fdf9' },
                          '&:last-child td': { borderBottom: 0 },
                        }}
                      >
                        {/* Run # */}
                        <TableCell sx={{ py: 1.75 }}>
                          <Typography
                            sx={{
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              color: '#0f172a',
                              fontSize: '0.85rem',
                            }}
                          >
                            #{run.id}
                          </Typography>
                        </TableCell>

                        {/* Type */}
                        <TableCell>
                          <Chip
                            label={run.run_type ?? 'apply'}
                            size="small"
                            variant="outlined"
                            sx={{
                              fontSize: '0.72rem',
                              textTransform: 'capitalize',
                              borderColor: '#d1d5db',
                              color: '#475569',
                              height: 22,
                            }}
                          />
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            {isActive && (
                              <Box
                                sx={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  bgcolor: '#4ade80',
                                  boxShadow: '0 0 6px #4ade80',
                                  flexShrink: 0,
                                }}
                              />
                            )}
                            <Chip
                              label={cfg.label}
                              color={cfg.color}
                              size="small"
                              variant="outlined"
                              sx={{
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                textTransform: 'capitalize',
                                height: 22,
                              }}
                            />
                          </Box>
                        </TableCell>

                        {/* Started */}
                        <TableCell>
                          <Typography sx={{ fontSize: '0.8rem', color: '#475569' }}>
                            {new Date(asUtc(run.started_at)).toLocaleString(undefined, {
                              month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </Typography>
                        </TableCell>

                        {/* Duration */}
                        <TableCell>
                          <Typography sx={{ fontSize: '0.8rem', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                            {getDuration(run)}
                          </Typography>
                        </TableCell>

                        {/* Actions */}
                        <TableCell>
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<Terminal sx={{ fontSize: 13 }} />}
                              onClick={() => openLogs(run.id)}
                              sx={{
                                fontSize: '0.72rem',
                                py: 0.4,
                                px: 1,
                                minWidth: 0,
                                borderColor: '#d1d5db',
                                color: '#374151',
                                '&:hover': { borderColor: '#16a34a', color: '#16a34a', bgcolor: 'transparent' },
                              }}
                            >
                              Logs
                            </Button>
                            {isActive && (
                              <>
                                <IconButton
                                  size="small"
                                  onClick={() => stopRun(run.id)}
                                  title="Stop gracefully"
                                  sx={{ color: '#f59e0b', p: 0.5 }}
                                >
                                  <Stop sx={{ fontSize: 16 }} />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => killRun(run.id)}
                                  title="Force stop"
                                  sx={{ color: '#ef4444', p: 0.5 }}
                                >
                                  <PowerSettingsNew sx={{ fontSize: 16 }} />
                                </IconButton>
                              </>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <Pagination
                  count={totalPages}
                  page={currentPage}
                  onChange={(_, page) => setRunsPage(page)}
                  color="primary"
                  shape="rounded"
                  size="small"
                />
              </Box>
            )}
          </>
        )}
      </Box>

      {/* ── Terminal log dialog ── */}
      <TerminalLogDialog
        open={logDialogRunId !== null}
        onClose={() => setLogDialogRunId(null)}
        run={logDialogRun}
        details={logDialogDetails}
      />

      {/* ── Start outreach dialog ── */}
      <Dialog
        open={outreachDialogOpen}
        onClose={() => setOutreachDialogOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: '5px' } }}
      >
        <Box
          sx={{
            px: 3,
            py: 2.5,
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="h6" fontWeight={700}>
            Start Outreach
          </Typography>
          <IconButton size="small" onClick={() => setOutreachDialogOpen(false)} sx={{ color: '#94a3b8' }}>
            <Close sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        <Box sx={{ p: 3 }}>
          <Stack spacing={2.5}>
            <TextField
              label="Role"
              value={outreachDraft.role}
              onChange={(e) => setOutreachDraft((c) => ({ ...c, role: e.target.value }))}
              required
              fullWidth
              size="small"
            />
            <TextField
              label="Company"
              value={outreachDraft.company}
              onChange={(e) => setOutreachDraft((c) => ({ ...c, company: e.target.value }))}
              helperText="Optional. Focus the bot on recruiters from this company."
              fullWidth
              size="small"
            />
            <TextField
              label="Recruiter search context"
              value={outreachDraft.recruiter_search_context}
              onChange={(e) => setOutreachDraft((c) => ({ ...c, recruiter_search_context: e.target.value }))}
              helperText="e.g. technical recruiter, hiring manager, entry-level hiring"
              fullWidth
              size="small"
            />
            <TextField
              label={outreachDraft.use_ai_for_outreach ? 'Message context for AI' : 'Exact message content'}
              value={outreachDraft.message_content}
              onChange={(e) => setOutreachDraft((c) => ({ ...c, message_content: e.target.value }))}
              multiline
              minRows={5}
              helperText={
                outreachDraft.use_ai_for_outreach
                  ? 'AI will refine this into the message that gets sent.'
                  : 'This exact content will be sent without AI rewriting.'
              }
              fullWidth
            />

            <Box
              sx={{
                border: '1px solid #e2e8f0',
                p: 2,
              }}
            >
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#0f172a' }}>
                      Attach default resume
                    </Typography>
                  </Box>
                  <Switch
                    checked={outreachDraft.attach_default_resume}
                    onChange={(e) => setOutreachDraft((c) => ({ ...c, attach_default_resume: e.target.checked }))}
                    size="small"
                  />
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#0f172a' }}>
                      Use AI to refine and send
                    </Typography>
                  </Box>
                  <Switch
                    checked={outreachDraft.use_ai_for_outreach}
                    onChange={(e) => setOutreachDraft((c) => ({ ...c, use_ai_for_outreach: e.target.checked }))}
                    size="small"
                  />
                </Stack>
              </Stack>
            </Box>
          </Stack>
        </Box>

        <Box
          sx={{
            px: 3,
            py: 2,
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1.5,
          }}
        >
          <Button
            onClick={() => setOutreachDialogOpen(false)}
            sx={{ color: '#64748b' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={startOutreachRun}
            disabled={loading || !outreachDraft.role.trim() || !outreachDraft.message_content.trim()}
          >
            {loading ? 'Starting…' : 'Start Outreach'}
          </Button>
        </Box>
      </Dialog>
    </Box>
  )
}
