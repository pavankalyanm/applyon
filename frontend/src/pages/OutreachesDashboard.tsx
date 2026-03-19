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
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { OpenInNew, Refresh } from '@mui/icons-material'
import { useEffect, useState } from 'react'
import { api } from '../api'

type OutreachStatus = 'drafted' | 'review_pending' | 'sent' | 'skipped' | 'failed'

type OutreachEvent = {
  id: number
  run_id: number
  role?: string | null
  company_filter?: string | null
  search_context?: string | null
  message_input?: string | null
  message_sent?: string | null
  used_ai: boolean
  action_type: string
  status: OutreachStatus
  reason?: string | null
  recruiter_profile_url?: string | null
  recruiter_email?: string | null
  sent_at?: string | null
  created_at: string
  recruiter_contact?: {
    id: number
    name?: string | null
    headline?: string | null
    company?: string | null
    location?: string | null
    email?: string | null
    linkedin_profile_url: string
  } | null
}

const statusOptions: OutreachStatus[] = ['drafted', 'review_pending', 'sent', 'skipped', 'failed']

const statusColors: Record<OutreachStatus, string> = {
  sent: '#16a34a',
  drafted: '#0ea5e9',
  review_pending: '#f59e0b',
  skipped: '#94a3b8',
  failed: '#ef4444',
}

const statusStats: OutreachStatus[] = ['sent', 'review_pending', 'drafted', 'skipped', 'failed']

export function OutreachesDashboard() {
  const [items, setItems] = useState<OutreachEvent[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const rowsPerPage = 25

  async function loadOutreaches() {
    setLoading(true)
    try {
      const resp = await api.get('/outreaches', {
        params: {
          search: search.trim() || undefined,
          status: status === 'all' ? undefined : status,
          limit: 500,
        },
      })
      setItems(resp.data.items || [])
      setPage(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadOutreaches() }, [search, status])

  const counts = statusStats.reduce<Record<string, number>>(
    (acc, s) => { acc[s] = items.filter((i) => i.status === s).length; return acc },
    {},
  )

  function statusChipColor(s: OutreachStatus): 'success' | 'error' | 'warning' | 'default' | 'info' {
    if (s === 'sent') return 'success'
    if (s === 'failed') return 'error'
    if (s === 'review_pending') return 'warning'
    if (s === 'drafted') return 'info'
    return 'default'
  }

  return (
    <Box sx={{ p: { xs: 3, md: 4 }, minHeight: '100%' }}>
      {/* ── Page header ── */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ color: '#0f172a', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Outreaches
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, fontSize: '0.9rem' }}>
            Track recruiter outreach runs, message status, profile links, and emails found.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh sx={{ fontSize: 16 }} />}
          onClick={loadOutreaches}
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

      {/* ── Status stat cards ── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' },
          gap: 2,
          mb: 3,
        }}
      >
        {statusStats.map((s) => (
          <Box
            key={s}
            sx={{
              p: 2.5,
              bgcolor: status === s ? '#f8fdf9' : '#fff',
              border: '1px solid #e2e8f0',
              borderLeft: `4px solid ${statusColors[s]}`,
              borderRadius: '5px',
              cursor: 'pointer',
              '&:hover': { bgcolor: '#f8fdf9' },
              transition: 'background 0.12s',
            }}
            onClick={() => setStatus((prev) => (prev === s ? 'all' : s))}
          >
            <Typography
              sx={{
                fontSize: '1.8rem',
                fontWeight: 800,
                color: statusColors[s],
                lineHeight: 1,
                mb: 0.5,
              }}
            >
              {counts[s] ?? 0}
            </Typography>
            <Typography sx={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 500, textTransform: 'capitalize' }}>
              {s.replace('_', ' ')}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* ── Filters ── */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
        <TextField
          placeholder="Search by role, recruiter, company, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ flex: 1 }}
        />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Status</InputLabel>
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            sx={{}}
          >
            <MenuItem value="all">All statuses</MenuItem>
            {statusOptions.map((s) => (
              <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>
                {s.replace('_', ' ')}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {/* ── Table ── */}
      <TableContainer
        component={Paper}
        sx={{ border: '1px solid #e2e8f0', boxShadow: 'none' }}
      >
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8fafc' }}>
              {['Recruiter', 'Role / Company', 'Status', 'Message', 'Run', 'Links'].map((h) => (
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
            {items.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((item) => (
              <TableRow
                key={item.id}
                hover
                sx={{ '&:hover': { bgcolor: '#f8fdf9' }, '&:last-child td': { borderBottom: 0 } }}
              >
                {/* Recruiter */}
                <TableCell sx={{ minWidth: 230, py: 2 }}>
                  <Typography sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.875rem' }}>
                    {item.recruiter_contact?.name || 'Unknown recruiter'}
                  </Typography>
                  <Typography sx={{ color: '#475569', fontSize: '0.8rem' }}>
                    {item.recruiter_contact?.headline || 'No headline'}
                  </Typography>
                  <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    {item.recruiter_email || item.recruiter_contact?.email || '—'}
                  </Typography>
                </TableCell>

                {/* Role / Company */}
                <TableCell sx={{ minWidth: 200 }}>
                  <Typography sx={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem' }}>
                    {item.role || 'Unknown role'}
                  </Typography>
                  <Typography sx={{ color: '#475569', fontSize: '0.8rem' }}>
                    {item.company_filter || item.recruiter_contact?.company || 'Any company'}
                  </Typography>
                  {item.search_context && (
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem', mt: 0.25 }}>
                      {item.search_context}
                    </Typography>
                  )}
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Stack spacing={0.75}>
                    <Chip
                      label={item.status.replace('_', ' ')}
                      color={statusChipColor(item.status)}
                      size="small"
                      variant="outlined"
                      sx={{
                        fontSize: '0.72rem',
                        height: 22,
                        textTransform: 'capitalize',
                        fontWeight: 600,
                      }}
                    />
                    <Chip
                      label={item.used_ai ? 'AI refined' : 'Exact content'}
                      size="small"
                      variant="outlined"
                      sx={{
                        fontSize: '0.68rem',
                        height: 20,
                        borderColor: '#d1d5db',
                        color: '#64748b',
                      }}
                    />
                  </Stack>
                </TableCell>

                {/* Message */}
                <TableCell sx={{ minWidth: 300, maxWidth: 360 }}>
                  <Typography
                    sx={{
                      color: '#334155',
                      fontSize: '0.8rem',
                      lineHeight: 1.5,
                      display: '-webkit-box',
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {item.message_sent || item.message_input || 'No message stored'}
                  </Typography>
                  {item.reason && (
                    <Typography sx={{ color: '#dc2626', fontSize: '0.72rem', mt: 0.5 }}>
                      {item.reason}
                    </Typography>
                  )}
                </TableCell>

                {/* Run */}
                <TableCell>
                  <Typography sx={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#475569' }}>
                    #{item.run_id}
                  </Typography>
                  <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem' }}>
                    {new Date(item.created_at).toLocaleString(undefined, {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </Typography>
                </TableCell>

                {/* Links */}
                <TableCell>
                  {item.recruiter_profile_url && (
                    <Button
                      size="small"
                      variant="outlined"
                      href={item.recruiter_profile_url}
                      target="_blank"
                      rel="noreferrer"
                      startIcon={<OpenInNew sx={{ fontSize: 13 }} />}
                      sx={{
                        fontSize: '0.72rem',
                        py: 0.4,
                        px: 1,
                        borderColor: '#d1d5db',
                        color: '#374151',
                      }}
                    >
                      Profile
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}

            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} sx={{ py: 6, textAlign: 'center', color: '#64748b' }}>
                  No outreach activity matched the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={items.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[rowsPerPage]}
        />
      </TableContainer>
    </Box>
  )
}
