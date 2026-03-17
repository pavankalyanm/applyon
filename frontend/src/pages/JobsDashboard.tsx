import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Typography,
} from '@mui/material'
import {
  ArrowBack,
  OpenInNew,
  Refresh,
  RocketLaunch,
  TableRows,
  ViewKanban,
} from '@mui/icons-material'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

type PipelineStatus = 'applied' | 'assessment' | 'interview' | 'rejected'
type BotStatus = 'applied' | 'failed'
type ViewMode = 'table' | 'board'

type JobApplication = {
  id: number
  run_id: number
  job_id?: string | null
  title?: string | null
  company?: string | null
  location?: string | null
  application_type?: string | null
  status: BotStatus
  pipeline_status: PipelineStatus
  reason_skipped?: string | null
  job_link?: string | null
  external_link?: string | null
  created_at: string
}

const pipelineStatuses: PipelineStatus[] = ['applied', 'assessment', 'interview', 'rejected']

const pipelineLabels: Record<PipelineStatus, string> = {
  applied: 'Applied',
  assessment: 'Assessment',
  interview: 'Interview',
  rejected: 'Rejected',
}

const pipelineColors: Record<PipelineStatus, 'primary' | 'warning' | 'success' | 'error'> = {
  applied: 'primary',
  assessment: 'warning',
  interview: 'success',
  rejected: 'error',
}

export function JobsDashboard() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<JobApplication[]>([])
  const [search, setSearch] = useState('')
  const [pipelineFilter, setPipelineFilter] = useState('all')
  const [botStatusFilter, setBotStatusFilter] = useState('all')
  const [view, setView] = useState<ViewMode>('table')
  const [loading, setLoading] = useState(false)

  async function loadJobs() {
    setLoading(true)
    try {
      const resp = await api.get('/jobs', {
        params: {
          search: search.trim() || undefined,
          pipeline_status: pipelineFilter === 'all' ? undefined : pipelineFilter,
          status: botStatusFilter === 'all' ? undefined : botStatusFilter,
          limit: 500,
        },
      })
      setJobs(resp.data.items)
    } finally {
      setLoading(false)
    }
  }

  async function updatePipelineStatus(jobId: number, pipelineStatus: PipelineStatus) {
    await api.patch(`/jobs/${jobId}`, { pipeline_status: pipelineStatus })
    setJobs((current) =>
      current.map((job) => (job.id === jobId ? { ...job, pipeline_status: pipelineStatus } : job)),
    )
  }

  useEffect(() => {
    loadJobs()
  }, [search, pipelineFilter, botStatusFilter])

  const counts = pipelineStatuses.reduce<Record<PipelineStatus, number>>(
    (acc, status) => {
      acc[status] = jobs.filter((job) => job.pipeline_status === status).length
      return acc
    },
    { applied: 0, assessment: 0, interview: 0, rejected: 0 },
  )

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
        <Toolbar sx={{ maxWidth: 1280, width: '100%', mx: 'auto' }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flexGrow: 1 }}>
            <RocketLaunch sx={{ color: '#16a34a', fontSize: 26 }} />
            <Typography sx={{ fontWeight: 800, color: '#14532d', fontSize: '1.05rem' }}>
              AutoApply
            </Typography>
          </Stack>
          <Button startIcon={<ArrowBack />} onClick={() => navigate('/dashboard')} sx={{ color: '#64748b' }}>
            Back to dashboard
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
        <Stack spacing={4} className="fade-in">
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="h4" sx={{ color: '#0f172a' }}>
                Jobs Dashboard
              </Typography>
              <Typography color="text.secondary">
                Track every job, maintain its current status, and jump back to the original listing.
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<Refresh sx={{ fontSize: 18 }} />}
              onClick={loadJobs}
              disabled={loading}
              sx={{ alignSelf: 'flex-start' }}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              fullWidth
              label="Search jobs"
              placeholder="Search by title, company, location, or job ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <FormControl sx={{ minWidth: 180 }}>
              <InputLabel id="pipeline-filter-label">Pipeline status</InputLabel>
              <Select
                labelId="pipeline-filter-label"
                value={pipelineFilter}
                label="Pipeline status"
                onChange={(event) => setPipelineFilter(event.target.value)}
              >
                <MenuItem value="all">All statuses</MenuItem>
                {pipelineStatuses.map((status) => (
                  <MenuItem key={status} value={status}>
                    {pipelineLabels[status]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 180 }}>
              <InputLabel id="bot-filter-label">Run result</InputLabel>
              <Select
                labelId="bot-filter-label"
                value={botStatusFilter}
                label="Run result"
                onChange={(event) => setBotStatusFilter(event.target.value)}
              >
                <MenuItem value="all">All results</MenuItem>
                <MenuItem value="applied">Applied</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
              </Select>
            </FormControl>
            <ToggleButtonGroup
              exclusive
              value={view}
              onChange={(_, next) => {
                if (next) setView(next)
              }}
              sx={{ alignSelf: 'stretch' }}
            >
              <ToggleButton value="table">
                <TableRows sx={{ mr: 1 }} />
                Table
              </ToggleButton>
              <ToggleButton value="board">
                <ViewKanban sx={{ mr: 1 }} />
                Board
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            {pipelineStatuses.map((status) => (
              <Paper
                key={status}
                sx={{
                  flex: 1,
                  p: 2.5,
                  borderRadius: 3,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                <Typography sx={{ color: '#64748b', fontSize: '0.9rem', mb: 1 }}>
                  {pipelineLabels[status]}
                </Typography>
                <Typography variant="h4" sx={{ color: '#0f172a', fontWeight: 800 }}>
                  {counts[status]}
                </Typography>
              </Paper>
            ))}
          </Stack>

          {view === 'table' ? (
            <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Job</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Run Result</TableCell>
                    <TableCell>Run</TableCell>
                    <TableCell>Applied At</TableCell>
                    <TableCell align="right">Links</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id} hover>
                      <TableCell sx={{ minWidth: 280 }}>
                        <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>
                          {job.title || 'Untitled job'}
                        </Typography>
                        <Typography sx={{ color: '#475569' }}>
                          {job.company || 'Unknown company'}
                        </Typography>
                        <Typography sx={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                          {job.location || 'Unknown location'}
                        </Typography>
                        {job.reason_skipped && (
                          <Typography sx={{ color: '#dc2626', fontSize: '0.8rem', mt: 0.5 }}>
                            {job.reason_skipped}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <FormControl size="small" sx={{ minWidth: 160 }}>
                          <Select
                            value={job.pipeline_status}
                            onChange={(event) => updatePipelineStatus(job.id, event.target.value as PipelineStatus)}
                          >
                            {pipelineStatuses.map((status) => (
                              <MenuItem key={status} value={status}>
                                {pipelineLabels[status]}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={job.status}
                          color={job.status === 'applied' ? 'success' : 'error'}
                          variant="outlined"
                          sx={{ textTransform: 'capitalize' }}
                        />
                      </TableCell>
                      <TableCell>#{job.run_id}</TableCell>
                      <TableCell>{new Date(job.created_at).toLocaleString()}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          {job.job_link && (
                            <Button
                              size="small"
                              variant="outlined"
                              href={job.job_link}
                              target="_blank"
                              rel="noreferrer"
                              startIcon={<OpenInNew />}
                            >
                              Job
                            </Button>
                          )}
                          {job.external_link && job.external_link !== 'Easy Applied' && (
                            <Button
                              size="small"
                              variant="outlined"
                              href={job.external_link}
                              target="_blank"
                              rel="noreferrer"
                              startIcon={<OpenInNew />}
                            >
                              External
                            </Button>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {jobs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography sx={{ py: 4, textAlign: 'center', color: '#64748b' }}>
                          No jobs matched the current filters.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: 'repeat(4, minmax(0, 1fr))' },
                gap: 2,
              }}
            >
              {pipelineStatuses.map((status) => {
                const columnJobs = jobs.filter((job) => job.pipeline_status === status)
                return (
                  <Paper
                    key={status}
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      border: '1px solid #e2e8f0',
                      bgcolor: '#fcfffd',
                      minHeight: 420,
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                      <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>
                        {pipelineLabels[status]}
                      </Typography>
                      <Chip label={columnJobs.length} color={pipelineColors[status]} size="small" />
                    </Stack>
                    <Stack spacing={1.5}>
                      {columnJobs.map((job) => (
                        <Paper
                          key={job.id}
                          sx={{
                            p: 2,
                            borderRadius: 2.5,
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
                          }}
                        >
                          <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>
                            {job.title || 'Untitled job'}
                          </Typography>
                          <Typography sx={{ color: '#475569', fontSize: '0.9rem' }}>
                            {job.company || 'Unknown company'}
                          </Typography>
                          <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem', mb: 1.5 }}>
                            {job.location || 'Unknown location'}
                          </Typography>
                          <FormControl size="small" fullWidth sx={{ mb: 1.5 }}>
                            <Select
                              value={job.pipeline_status}
                              onChange={(event) => updatePipelineStatus(job.id, event.target.value as PipelineStatus)}
                            >
                              {pipelineStatuses.map((value) => (
                                <MenuItem key={value} value={value}>
                                  {pipelineLabels[value]}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap' }}>
                            <Chip
                              label={job.status}
                              color={job.status === 'applied' ? 'success' : 'error'}
                              size="small"
                              variant="outlined"
                              sx={{ textTransform: 'capitalize' }}
                            />
                            <Chip label={`Run #${job.run_id}`} size="small" variant="outlined" />
                          </Stack>
                          <Stack direction="row" spacing={1}>
                            {job.job_link && (
                              <Button
                                fullWidth
                                size="small"
                                variant="outlined"
                                href={job.job_link}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Job link
                              </Button>
                            )}
                            {job.external_link && job.external_link !== 'Easy Applied' && (
                              <Button
                                fullWidth
                                size="small"
                                variant="outlined"
                                href={job.external_link}
                                target="_blank"
                                rel="noreferrer"
                              >
                                External
                              </Button>
                            )}
                          </Stack>
                        </Paper>
                      ))}
                      {columnJobs.length === 0 && (
                        <Typography sx={{ color: '#94a3b8', fontSize: '0.9rem', py: 2 }}>
                          No jobs in this column yet.
                        </Typography>
                      )}
                    </Stack>
                  </Paper>
                )
              })}
            </Box>
          )}
        </Stack>
      </Container>
    </Box>
  )
}
