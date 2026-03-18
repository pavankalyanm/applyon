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
  TablePagination,
  TableRow,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material'
import { ArrowBack, OpenInNew, Refresh, RocketLaunch } from '@mui/icons-material'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

export function OutreachesDashboard() {
  const navigate = useNavigate()
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

  useEffect(() => {
    loadOutreaches()
  }, [search, status])

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
                Outreaches
              </Typography>
              <Typography color="text.secondary">
                Track recruiter outreach runs, message status, profile links, and any emails the bot found.
              </Typography>
            </Box>
            <Button variant="contained" startIcon={<Refresh />} onClick={loadOutreaches} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              fullWidth
              label="Search outreaches"
              placeholder="Search by role, recruiter, company, or email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <FormControl sx={{ minWidth: 220 }}>
              <InputLabel id="outreach-status-label">Status</InputLabel>
              <Select
                labelId="outreach-status-label"
                label="Status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <MenuItem value="all">All statuses</MenuItem>
                {statusOptions.map((value) => (
                  <MenuItem key={value} value={value}>
                    {value.replace('_', ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Recruiter</TableCell>
                  <TableCell>Role / Company</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Message</TableCell>
                  <TableCell>Run</TableCell>
                  <TableCell align="right">Links</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell sx={{ minWidth: 250 }}>
                      <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>
                        {item.recruiter_contact?.name || 'Unknown recruiter'}
                      </Typography>
                      <Typography sx={{ color: '#475569' }}>
                        {item.recruiter_contact?.headline || 'No headline captured'}
                      </Typography>
                      <Typography sx={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                        {item.recruiter_email || item.recruiter_contact?.email || 'Email not available'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: 220 }}>
                      <Typography sx={{ fontWeight: 600, color: '#0f172a' }}>
                        {item.role || 'Unknown role'}
                      </Typography>
                      <Typography sx={{ color: '#475569' }}>
                        {item.company_filter || item.recruiter_contact?.company || 'Any company'}
                      </Typography>
                      {item.search_context && (
                        <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                          {item.search_context}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack spacing={1}>
                        <Chip
                          label={item.status.replace('_', ' ')}
                          color={item.status === 'sent' ? 'success' : item.status === 'failed' ? 'error' : 'warning'}
                          size="small"
                          variant="outlined"
                          sx={{ textTransform: 'capitalize' }}
                        />
                        <Chip
                          label={item.used_ai ? 'AI refined' : 'Exact content'}
                          size="small"
                          variant="outlined"
                        />
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ minWidth: 320 }}>
                      <Typography sx={{ color: '#334155', fontSize: '0.85rem' }}>
                        {item.message_sent || item.message_input || 'No message stored'}
                      </Typography>
                      {item.reason && (
                        <Typography sx={{ color: '#dc2626', fontSize: '0.8rem', mt: 0.5 }}>
                          {item.reason}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography>#{item.run_id}</Typography>
                      <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                        {new Date(item.created_at).toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {item.recruiter_profile_url && (
                        <Button
                          size="small"
                          variant="outlined"
                          href={item.recruiter_profile_url}
                          target="_blank"
                          rel="noreferrer"
                          startIcon={<OpenInNew />}
                        >
                          Profile
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography sx={{ py: 4, textAlign: 'center', color: '#64748b' }}>
                        No outreach activity matched the current filters.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={items.length}
              page={page}
              onPageChange={(_, nextPage) => setPage(nextPage)}
              rowsPerPage={rowsPerPage}
              rowsPerPageOptions={[rowsPerPage]}
            />
          </TableContainer>
        </Stack>
      </Container>
    </Box>
  )
}
