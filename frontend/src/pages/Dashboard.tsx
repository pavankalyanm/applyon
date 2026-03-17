import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Collapse,
  Container,
  Divider,
  IconButton,
  Paper,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material'
import {
  ExpandLess,
  ExpandMore,
  OpenInNew,
  PlayArrow,
  Stop,
  PowerSettingsNew,
  Refresh,
  RocketLaunch,
  Logout,
  AccessTime,
  CheckCircle,
  Error as ErrorIcon,
  HourglassEmpty,
  Settings,
} from '@mui/icons-material'
import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

type RunStatus = 'pending' | 'running' | 'stopping' | 'stopped' | 'success' | 'completed' | 'failed'

type Run = {
  id: number
  status: RunStatus
  started_at: string
  finished_at?: string | null
  error_message?: string | null
}

type RunDetail = Run & {
  log_excerpt?: string | null
}

const statusConfig: Record<string, { color: 'success' | 'warning' | 'error' | 'default'; icon: ReactElement; label: string }> = {
  running: { color: 'success', icon: <HourglassEmpty sx={{ fontSize: 16 }} />, label: 'running' },
  success: { color: 'success', icon: <CheckCircle sx={{ fontSize: 16 }} />, label: 'success' },
  completed: { color: 'success', icon: <CheckCircle sx={{ fontSize: 16 }} />, label: 'completed' },
  stopping: { color: 'warning', icon: <AccessTime sx={{ fontSize: 16 }} />, label: 'stopping' },
  stopped: { color: 'warning', icon: <Stop sx={{ fontSize: 16 }} />, label: 'stopped' },
  failed: { color: 'error', icon: <ErrorIcon sx={{ fontSize: 16 }} />, label: 'failed' },
  pending: { color: 'default', icon: <AccessTime sx={{ fontSize: 16 }} />, label: 'pending' },
}

export function Dashboard() {
  const navigate = useNavigate()
  const [runs, setRuns] = useState<Run[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedRuns, setExpandedRuns] = useState<Record<number, boolean>>({})
  const [runDetails, setRunDetails] = useState<Record<number, RunDetail>>({})

  async function refreshExpandedRunDetails(runIds?: number[]) {
    const ids = runIds ?? Object.entries(expandedRuns)
      .filter(([, expanded]) => expanded)
      .map(([id]) => Number(id))

    if (ids.length === 0) return

    const results = await Promise.all(ids.map((runId) => api.get(`/runs/${runId}`)))
    setRunDetails((current) => {
      const next = { ...current }
      results.forEach((resp) => {
        next[resp.data.id] = resp.data
      })
      return next
    })
  }

  async function refresh() {
    try {
      const resp = await api.get('/runs')
      setRuns(resp.data)
      await refreshExpandedRunDetails()
    } catch {
      // silent
    }
  }

  async function startRun() {
    setError(null)
    setLoading(true)
    try {
      await api.post('/runs')
      await refresh()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to start run')
    } finally {
      setLoading(false)
    }
  }

  async function stopRun(runId: number) {
    await api.post(`/runs/${runId}/stop`)
    await refresh()
  }

  async function killRun(runId: number) {
    await api.post(`/runs/${runId}/kill`)
    await refresh()
  }

  async function toggleRun(runId: number) {
    const nextExpanded = !expandedRuns[runId]
    setExpandedRuns((current) => ({ ...current, [runId]: nextExpanded }))

    if (nextExpanded && !runDetails[runId]) {
      await refreshExpandedRunDetails([runId])
    }
  }

  function logout() {
    localStorage.removeItem('access_token')
    navigate('/auth')
  }

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 2000)
    return () => clearInterval(interval)
  }, [])

  const latest = runs[0]
  const activeRun = runs.find((run) => run.status === 'running' || run.status === 'stopping')
  const runningCount = runs.filter((run) => run.status === 'running').length
  const completedCount = runs.filter((run) => run.status === 'success' || run.status === 'completed').length
  const totalCount = runs.length

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: '#f8faf9' }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <Toolbar sx={{ maxWidth: 1200, width: '100%', mx: 'auto' }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flexGrow: 1 }}>
            <RocketLaunch sx={{ color: '#16a34a', fontSize: 26 }} />
            <Typography sx={{ fontWeight: 800, color: '#14532d', fontSize: '1.05rem' }}>
              AutoApply
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              variant="outlined"
              startIcon={<OpenInNew />}
              onClick={() => navigate('/jobs')}
              sx={{ borderColor: '#d1d5db', color: '#374151' }}
            >
              Jobs
            </Button>
            <IconButton onClick={() => navigate('/settings/personals')} size="small" title="Settings">
              <Settings sx={{ fontSize: 20, color: '#64748b' }} />
            </IconButton>
            <IconButton onClick={logout} size="small" title="Logout">
              <Logout sx={{ fontSize: 20, color: '#64748b' }} />
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
        <Stack spacing={4} className="fade-in">
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2}>
            <Box>
              <Typography variant="h4" sx={{ color: '#0f172a' }}>
                Dashboard
              </Typography>
              <Typography color="text.secondary">
                Manage and monitor your automated job applications.
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<Refresh sx={{ fontSize: 18 }} />}
              onClick={refresh}
              sx={{
                bgcolor: '#f0fdf4',
                color: '#16a34a',
                border: '1px solid #bbf7d0',
                '&:hover': { bgcolor: '#dcfce7' },
                background: '#f0fdf4',
                alignSelf: 'flex-start',
              }}
            >
              Refresh
            </Button>
          </Stack>

          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
            {[
              { label: 'Total Runs', value: totalCount, color: '#16a34a', bgColor: '#f0fdf4' },
              { label: 'Running', value: runningCount, color: '#f59e0b', bgColor: '#fffbeb' },
              { label: 'Completed', value: completedCount, color: '#0ea5e9', bgColor: '#f0f9ff' },
            ].map((stat) => (
              <Box
                key={stat.label}
                sx={{
                  flex: 1,
                  p: 3,
                  borderRadius: 3,
                  bgcolor: '#fff',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar
                    sx={{
                      bgcolor: stat.bgColor,
                      color: stat.color,
                      width: 48,
                      height: 48,
                    }}
                  >
                    <Typography variant="h6" fontWeight={800}>{stat.value}</Typography>
                  </Avatar>
                  <Typography sx={{ color: '#64748b', fontWeight: 500 }}>{stat.label}</Typography>
                </Stack>
              </Box>
            ))}
          </Stack>

          <Paper
            sx={{
              p: 4,
              borderRadius: 3,
              background: 'linear-gradient(135deg, #14532d 0%, #15803d 80%)',
              border: 'none',
              color: '#fff',
            }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={3}
              alignItems={{ sm: 'center' }}
              justifyContent="space-between"
            >
              <Stack spacing={0.5}>
                <Typography variant="h6" fontWeight={700} color="#fff">
                  Bot Controls
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: latest?.status === 'running' ? '#4ade80' : '#94a3b8',
                      boxShadow: latest?.status === 'running' ? '0 0 8px #4ade80' : 'none',
                    }}
                  />
                  <Typography sx={{ color: '#bbf7d0', fontSize: '0.95rem' }}>
                    {latest ? `Latest: ${statusConfig[latest.status]?.label ?? latest.status}` : 'No runs yet'}
                  </Typography>
                </Stack>
              </Stack>
              <Stack direction="row" spacing={1.5}>
                <Button
                  variant="contained"
                  disabled={loading}
                  onClick={startRun}
                  startIcon={<PlayArrow />}
                  sx={{
                    bgcolor: '#fff',
                    color: '#15803d',
                    fontWeight: 700,
                    '&:hover': { bgcolor: '#f0fdf4' },
                    '&:disabled': { bgcolor: 'rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.5)' },
                    background: '#fff',
                  }}
                >
                  {loading ? 'Starting...' : 'Start Bot'}
                </Button>
                {activeRun && (
                  <>
                    <Button
                      variant="outlined"
                      onClick={() => stopRun(activeRun.id)}
                      startIcon={<Stop />}
                      disabled={activeRun.status === 'stopping'}
                      sx={{
                        borderColor: 'rgba(255,255,255,0.3)',
                        color: '#fff',
                        '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.1)' },
                        '&.Mui-disabled': { borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)' },
                      }}
                    >
                      Stop
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => killRun(activeRun.id)}
                      startIcon={<PowerSettingsNew />}
                      sx={{
                        borderColor: 'rgba(239,68,68,0.5)',
                        color: '#fca5a5',
                        '&:hover': { borderColor: '#ef4444', bgcolor: 'rgba(239,68,68,0.1)' },
                      }}
                    >
                      Force Stop
                    </Button>
                  </>
                )}
              </Stack>
            </Stack>
          </Paper>

          <Box>
            <Typography variant="h6" sx={{ mb: 2, color: '#0f172a' }}>
              Run History
            </Typography>

            {runs.length === 0 ? (
              <Paper
                sx={{
                  p: 6,
                  borderRadius: 3,
                  textAlign: 'center',
                }}
              >
                <Box
                  sx={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    bgcolor: '#f0fdf4',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2,
                  }}
                >
                  <RocketLaunch sx={{ fontSize: 32, color: '#16a34a' }} />
                </Box>
                <Typography variant="h6" sx={{ color: '#334155', mb: 0.5 }}>
                  No runs yet
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                  Hit "Start Bot" above to begin your first automated job application run.
                </Typography>
                <Button variant="contained" startIcon={<PlayArrow />} onClick={startRun} disabled={loading}>
                  Start Your First Run
                </Button>
              </Paper>
            ) : (
              <Stack spacing={1.5}>
                {runs.map((run) => {
                  const cfg = statusConfig[run.status] ?? statusConfig.pending
                  const expanded = expandedRuns[run.id] ?? false
                  const details = runDetails[run.id]
                  const currentStep = details?.log_excerpt
                    ?.split('\n')
                    .filter((line) => line.startsWith('[STEP]'))
                    .at(-1)
                  return (
                    <Paper
                      key={run.id}
                      sx={{
                        p: 3,
                        borderRadius: 2.5,
                        transition: 'all 0.2s',
                        '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.06)' },
                      }}
                    >
                      <Stack spacing={1.5}>
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          justifyContent="space-between"
                          alignItems={{ sm: 'center' }}
                          spacing={1.5}
                        >
                          <Stack direction="row" alignItems="center" spacing={2}>
                            <Box
                              sx={{
                                width: 40,
                                height: 40,
                                borderRadius: 2,
                                bgcolor: '#f0fdf4',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#16a34a',
                                fontWeight: 800,
                                fontSize: '0.85rem',
                              }}
                            >
                              #{run.id}
                            </Box>
                            <Stack spacing={0.25}>
                              <Typography fontWeight={600} sx={{ color: '#0f172a' }}>
                                Run #{run.id}
                              </Typography>
                              <Typography fontSize="0.8rem" color="text.secondary">
                                Started {new Date(run.started_at).toLocaleString()}
                              </Typography>
                              {run.finished_at && (
                                <Typography fontSize="0.8rem" color="text.secondary">
                                  Finished {new Date(run.finished_at).toLocaleString()}
                                </Typography>
                              )}
                            </Stack>
                          </Stack>

                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Chip
                              label={cfg.label}
                              color={cfg.color}
                              size="small"
                              icon={cfg.icon}
                              variant="outlined"
                              sx={{ fontWeight: 600, textTransform: 'capitalize' }}
                            />
                            {(run.status === 'running' || run.status === 'stopping') && (
                              <Stack direction="row" spacing={0.5}>
                                <IconButton
                                  size="small"
                                  onClick={() => stopRun(run.id)}
                                  title="Stop"
                                  disabled={run.status === 'stopping'}
                                >
                                  <Stop sx={{ fontSize: 18, color: '#f59e0b' }} />
                                </IconButton>
                                <IconButton size="small" onClick={() => killRun(run.id)} title="Force stop">
                                  <PowerSettingsNew sx={{ fontSize: 18, color: '#ef4444' }} />
                                </IconButton>
                              </Stack>
                            )}
                            <Button
                              size="small"
                              variant="text"
                              onClick={() => toggleRun(run.id)}
                              endIcon={expanded ? <ExpandLess /> : <ExpandMore />}
                            >
                              {expanded ? 'Hide logs' : 'Show logs'}
                            </Button>
                          </Stack>
                        </Stack>

                        {run.error_message && (
                          <Typography fontSize="0.85rem" sx={{ color: '#ef4444' }}>
                            {run.error_message}
                          </Typography>
                        )}

                        <Collapse in={expanded}>
                          <Divider sx={{ my: 1.5 }} />
                          {currentStep && (
                            <Typography variant="subtitle2" sx={{ mb: 1, color: '#15803d', fontWeight: 700 }}>
                              Current step: {currentStep.replace('[STEP] ', '')}
                            </Typography>
                          )}
                          <Typography variant="subtitle2" sx={{ mb: 1, color: '#334155' }}>
                            Bot logs
                          </Typography>
                          <Box
                            sx={{
                              p: 2,
                              borderRadius: 2,
                              bgcolor: '#0f172a',
                              color: '#e2e8f0',
                              fontFamily: 'monospace',
                              fontSize: '0.8rem',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              maxHeight: 320,
                              overflowY: 'auto',
                            }}
                          >
                            {details ? details.log_excerpt || 'No logs captured for this run yet.' : 'Loading logs...'}
                          </Box>
                        </Collapse>
                      </Stack>
                    </Paper>
                  )
                })}
              </Stack>
            )}
          </Box>
        </Stack>
      </Container>
    </Box>
  )
}
