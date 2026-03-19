import {
  Box,
  Button,
  Chip,
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
  TablePagination,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { OpenInNew, Refresh, TableRows, ViewKanban } from '@mui/icons-material'
import { useEffect, useState } from 'react'
import { api } from '../api'

type PipelineStatus = 'applied' | 'assessment' | 'interview' | 'rejected'
type BotStatus = 'applied' | 'failed'
type ViewMode = 'table' | 'board'
type ApplicationProvider =
  | 'linkedin_easy_apply'
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'unsupported_external'
  | 'external'

type JobApplication = {
  id: number
  run_id: number
  job_id?: string | null
  title?: string | null
  company?: string | null
  location?: string | null
  application_type?: string | null
  application_provider?: ApplicationProvider | null
  application_stage?: string | null
  review_required?: boolean
  status: BotStatus
  pipeline_status: PipelineStatus
  reason_skipped?: string | null
  job_link?: string | null
  external_link?: string | null
  created_at: string
}

const pipelineStatuses: PipelineStatus[] = ['applied', 'assessment', 'interview', 'rejected']

const providerOptions = [
  { value: 'all', label: 'All providers' },
  { value: 'linkedin_easy_apply', label: 'LinkedIn Easy Apply' },
  { value: 'greenhouse', label: 'Greenhouse' },
  { value: 'lever', label: 'Lever' },
  { value: 'ashby', label: 'Ashby' },
  { value: 'unsupported_external', label: 'Unsupported external' },
  { value: 'external', label: 'Other external' },
]

const pipelineLabels: Record<PipelineStatus, string> = {
  applied: 'Applied', assessment: 'Assessment', interview: 'Interview', rejected: 'Rejected',
}

const pipelineAccentColors: Record<PipelineStatus, string> = {
  applied: '#0ea5e9', assessment: '#f59e0b', interview: '#16a34a', rejected: '#ef4444',
}

function providerLabel(provider?: string | null) {
  const map: Record<string, string> = {
    linkedin_easy_apply: 'LinkedIn Easy Apply',
    greenhouse: 'Greenhouse',
    lever: 'Lever',
    ashby: 'Ashby',
    unsupported_external: 'Unsupported external',
    external: 'External',
  }
  return map[provider ?? ''] ?? 'Unknown'
}

export function JobsDashboard() {
  const [jobs, setJobs] = useState<JobApplication[]>([])
  const [page, setPage] = useState(0)
  const rowsPerPage = 25
  const [search, setSearch] = useState('')
  const [pipelineFilter, setPipelineFilter] = useState('all')
  const [botStatusFilter, setBotStatusFilter] = useState('all')
  const [providerFilter, setProviderFilter] = useState('all')
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
          provider: providerFilter === 'all' ? undefined : providerFilter,
          limit: 500,
        },
      })
      setJobs(resp.data.items)
      setPage(0)
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

  useEffect(() => { loadJobs() }, [search, pipelineFilter, botStatusFilter, providerFilter])

  const counts = pipelineStatuses.reduce<Record<PipelineStatus, number>>(
    (acc, s) => { acc[s] = jobs.filter((j) => j.pipeline_status === s).length; return acc },
    { applied: 0, assessment: 0, interview: 0, rejected: 0 },
  )

  return (
    <Box sx={{ p: { xs: 3, md: 4 }, minHeight: '100%' }}>
      {/* ── Page header ── */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ color: '#0f172a', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Jobs
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, fontSize: '0.9rem' }}>
            Track every application, update pipeline status, and jump to the original listing.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh sx={{ fontSize: 16 }} />}
          onClick={loadJobs}
          disabled={loading}
          size="small"
          sx={{
            borderColor: '#d1d5db',
            color: '#374151',
            '&:hover': { borderColor: '#16a34a', color: '#16a34a', bgcolor: 'transparent' },
          }}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </Stack>

      {/* ── Pipeline stat cards ── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 2,
          mb: 3,
        }}
      >
        {pipelineStatuses.map((s) => (
          <Box
            key={s}
            sx={{
              p: 3,
              bgcolor: '#fff',
              border: '1px solid #e2e8f0',
              borderLeft: `4px solid ${pipelineAccentColors[s]}`,
              borderRadius: '5px',
              cursor: 'pointer',
              transition: 'background 0.12s',
              bgcolor: pipelineFilter === s ? '#f8fdf9' : '#fff',
              '&:hover': { bgcolor: '#f8fdf9' },
            }}
            onClick={() => setPipelineFilter((prev) => (prev === s ? 'all' : s))}
          >
            <Typography
              sx={{
                fontSize: '2rem',
                fontWeight: 800,
                color: pipelineAccentColors[s],
                lineHeight: 1,
                mb: 0.5,
              }}
            >
              {counts[s]}
            </Typography>
            <Typography sx={{ color: '#64748b', fontSize: '0.82rem', fontWeight: 500 }}>
              {pipelineLabels[s]}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* ── Filters row ── */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 3 }} alignItems="stretch">
        <TextField
          placeholder="Search by title, company, location, or job ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ flex: 1 }}
        />

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Pipeline status</InputLabel>
          <Select
            value={pipelineFilter}
            label="Pipeline status"
            onChange={(e) => setPipelineFilter(e.target.value)}
          >
            <MenuItem value="all">All statuses</MenuItem>
            {pipelineStatuses.map((s) => (
              <MenuItem key={s} value={s}>{pipelineLabels[s]}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Run result</InputLabel>
          <Select
            value={botStatusFilter}
            label="Run result"
            onChange={(e) => setBotStatusFilter(e.target.value)}
          >
            <MenuItem value="all">All results</MenuItem>
            <MenuItem value="applied">Applied</MenuItem>
            <MenuItem value="failed">Failed</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Provider</InputLabel>
          <Select
            value={providerFilter}
            label="Provider"
            onChange={(e) => setProviderFilter(e.target.value)}
          >
            {providerOptions.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <ToggleButtonGroup
          exclusive
          value={view}
          onChange={(_, next) => { if (next) setView(next) }}
          size="small"
          sx={{
            '& .MuiToggleButton-root': { px: 2, fontSize: '0.82rem' },
          }}
        >
          <ToggleButton value="table">
            <TableRows sx={{ fontSize: 16, mr: 0.75 }} /> Table
          </ToggleButton>
          <ToggleButton value="board">
            <ViewKanban sx={{ fontSize: 16, mr: 0.75 }} /> Board
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* ── Table view ── */}
      {view === 'table' ? (
        <TableContainer
          component={Paper}
          sx={{ border: '1px solid #e2e8f0', boxShadow: 'none' }}
        >
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                {['Job', 'Provider', 'Pipeline Status', 'Run Result', 'Run', 'Applied At', 'Links'].map((h) => (
                  <TableCell
                    key={h}
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.72rem',
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
              {jobs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((job) => (
                <TableRow key={job.id} hover sx={{ '&:hover': { bgcolor: '#f8fdf9' }, '&:last-child td': { borderBottom: 0 } }}>
                  {/* Job */}
                  <TableCell sx={{ minWidth: 260, py: 2 }}>
                    <Typography sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.875rem' }}>
                      {job.title || 'Untitled job'}
                    </Typography>
                    <Typography sx={{ color: '#475569', fontSize: '0.82rem' }}>
                      {job.company || 'Unknown company'}
                    </Typography>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.76rem' }}>
                      {job.location || 'Unknown location'}
                    </Typography>
                    {job.reason_skipped && (
                      <Typography sx={{ color: '#dc2626', fontSize: '0.72rem', mt: 0.25 }}>
                        {job.reason_skipped}
                      </Typography>
                    )}
                  </TableCell>

                  {/* Provider */}
                  <TableCell sx={{ minWidth: 180 }}>
                    <Stack spacing={0.75}>
                      <Chip
                        label={providerLabel(job.application_provider)}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.72rem', height: 22, borderColor: '#d1d5db' }}
                      />
                      <Chip
                        label={job.application_stage || 'submitted'}
                        size="small"
                        color={job.application_stage === 'review_pending' ? 'warning' : 'default'}
                        sx={{ fontSize: '0.72rem', height: 22, textTransform: 'capitalize' }}
                      />
                      {job.review_required && (
                        <Chip
                          label="Review required"
                          size="small"
                          color="warning"
                          variant="filled"
                          sx={{ fontSize: '0.72rem', height: 22 }}
                        />
                      )}
                    </Stack>
                  </TableCell>

                  {/* Pipeline status */}
                  <TableCell>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                      <Select
                        value={job.pipeline_status}
                        onChange={(e) => updatePipelineStatus(job.id, e.target.value as PipelineStatus)}
                        sx={{ fontSize: '0.82rem' }}
                      >
                        {pipelineStatuses.map((s) => (
                          <MenuItem key={s} value={s}>{pipelineLabels[s]}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </TableCell>

                  {/* Run result */}
                  <TableCell>
                    <Chip
                      label={job.status}
                      color={job.status === 'applied' ? 'success' : 'error'}
                      variant="outlined"
                      size="small"
                      sx={{ fontSize: '0.72rem', textTransform: 'capitalize', height: 22 }}
                    />
                  </TableCell>

                  {/* Run */}
                  <TableCell>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#475569' }}>
                      #{job.run_id}
                    </Typography>
                  </TableCell>

                  {/* Applied at */}
                  <TableCell>
                    <Typography sx={{ fontSize: '0.78rem', color: '#64748b' }}>
                      {new Date(job.created_at).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </Typography>
                  </TableCell>

                  {/* Links */}
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.75} justifyContent="flex-end">
                      {job.job_link && (
                        <Button
                          size="small"
                          variant="outlined"
                          href={job.job_link}
                          target="_blank"
                          rel="noreferrer"
                          startIcon={<OpenInNew sx={{ fontSize: 13 }} />}
                          sx={{ fontSize: '0.72rem', py: 0.4, px: 1, borderColor: '#d1d5db', color: '#374151' }}
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
                          startIcon={<OpenInNew sx={{ fontSize: 13 }} />}
                          sx={{ fontSize: '0.72rem', py: 0.4, px: 1, borderColor: '#d1d5db', color: '#374151' }}
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
                  <TableCell colSpan={7} sx={{ py: 6, textAlign: 'center', color: '#64748b' }}>
                    No jobs matched the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={jobs.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[rowsPerPage]}
          />
        </TableContainer>
      ) : (
        /* ── Board view ── */
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(4, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          {pipelineStatuses.map((status) => {
            const columnJobs = jobs.filter((j) => j.pipeline_status === status)
            return (
              <Box
                key={status}
                sx={{
                  border: '1px solid #e2e8f0',
                  borderTop: `3px solid ${pipelineAccentColors[status]}`,
                  bgcolor: '#fafafa',
                  minHeight: 420,
                }}
              >
                {/* Column header */}
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ px: 2, py: 1.5, borderBottom: '1px solid #e2e8f0', bgcolor: '#fff' }}
                >
                  <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {pipelineLabels[status]}
                  </Typography>
                  <Box
                    sx={{
                      minWidth: 22,
                      height: 22,
                      px: 0.75,
                      bgcolor: pipelineAccentColors[status],
                      color: '#fff',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {columnJobs.length}
                  </Box>
                </Stack>

                {/* Cards */}
                <Stack spacing={0} sx={{ p: 1.5, gap: 1 }}>
                  {columnJobs.map((job) => (
                    <Box
                      key={job.id}
                      sx={{
                        p: 2,
                        bgcolor: '#fff',
                        border: '1px solid #e8edf2',
                        borderLeft: `3px solid ${job.status === 'applied' ? '#16a34a' : '#ef4444'}`,
                        '&:hover': { borderColor: '#cbd5e1', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
                        transition: 'all 0.12s',
                      }}
                    >
                      <Typography sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem', mb: 0.25 }}>
                        {job.title || 'Untitled job'}
                      </Typography>
                      <Typography sx={{ color: '#475569', fontSize: '0.8rem' }}>
                        {job.company || 'Unknown'}
                      </Typography>
                      <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem', mb: 1.5 }}>
                        {job.location || 'Unknown location'}
                      </Typography>

                      <FormControl size="small" fullWidth sx={{ mb: 1.5 }}>
                        <Select
                          value={job.pipeline_status}
                          onChange={(e) => updatePipelineStatus(job.id, e.target.value as PipelineStatus)}
                          sx={{ fontSize: '0.78rem' }}
                        >
                          {pipelineStatuses.map((s) => (
                            <MenuItem key={s} value={s}>{pipelineLabels[s]}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      <Stack direction="row" spacing={0.75} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
                        <Chip
                          label={providerLabel(job.application_provider)}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.68rem', height: 20, borderColor: '#d1d5db' }}
                        />
                        <Chip
                          label={job.status}
                          color={job.status === 'applied' ? 'success' : 'error'}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.68rem', height: 20, textTransform: 'capitalize' }}
                        />
                        <Chip
                          label={`Run #${job.run_id}`}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.68rem', height: 20, borderColor: '#d1d5db', color: '#64748b' }}
                        />
                      </Stack>

                      <Stack direction="row" spacing={0.75}>
                        {job.job_link && (
                          <Button
                            fullWidth
                            size="small"
                            variant="outlined"
                            href={job.job_link}
                            target="_blank"
                            rel="noreferrer"
                            sx={{ fontSize: '0.72rem', py: 0.4, borderColor: '#d1d5db', color: '#374151' }}
                          >
                            Job
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
                            sx={{ fontSize: '0.72rem', py: 0.4, borderColor: '#d1d5db', color: '#374151' }}
                          >
                            External
                          </Button>
                        )}
                      </Stack>
                    </Box>
                  ))}

                  {columnJobs.length === 0 && (
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.82rem', py: 3, textAlign: 'center' }}>
                      No jobs here yet
                    </Typography>
                  )}
                </Stack>
              </Box>
            )
          })}
        </Box>
      )}
    </Box>
  )
}
