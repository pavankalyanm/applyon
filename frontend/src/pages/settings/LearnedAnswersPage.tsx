import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { Delete, Edit, DeleteSweep } from '@mui/icons-material'
import { useEffect, useState } from 'react'
import { api } from '../../api'

interface LearnedAnswer {
  question: string
  question_type: string
  answer: string
  provider?: string
  options?: string[]
}

const TYPE_COLORS: Record<string, 'default' | 'primary' | 'success' | 'warning'> = {
  text: 'default',
  textarea: 'default',
  radio: 'success',
  single_select: 'primary',
  multiple_select: 'warning',
}

export function LearnedAnswersPage() {
  const [items, setItems] = useState<LearnedAnswer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const r = await api.get('/config/learned-answers')
      setItems(r.data.learned_answers ?? [])
    } catch {
      setError('Failed to load learned answers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function saveEdit() {
    if (editIndex === null) return
    setSaving(true)
    try {
      const r = await api.put(`/config/learned-answers/${editIndex}`, { answer: editValue })
      setItems(r.data.learned_answers)
      setEditIndex(null)
    } catch {
      setError('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function deleteOne(index: number) {
    try {
      const r = await api.delete(`/config/learned-answers/${index}`)
      setItems(r.data.learned_answers)
    } catch {
      setError('Failed to delete')
    }
  }

  async function clearAll() {
    try {
      const r = await api.delete('/config/learned-answers')
      setItems(r.data.learned_answers)
    } catch {
      setError('Failed to clear')
    } finally {
      setConfirmClear(false)
    }
  }

  function openEdit(index: number) {
    setEditIndex(index)
    setEditValue(items[index].answer)
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={28} /></Box>

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a' }}>Learned Answers</Typography>
          <Typography sx={{ color: '#64748b', fontSize: '0.875rem', mt: 0.4 }}>
            Answers the bot remembered from previous applications. Review and correct any wrong ones.
          </Typography>
        </Box>
        {items.length > 0 && (
          <Button
            size="small"
            color="error"
            startIcon={<DeleteSweep />}
            onClick={() => setConfirmClear(true)}
            sx={{ fontWeight: 700, textTransform: 'none' }}
          >
            Clear all
          </Button>
        )}
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {items.length === 0 ? (
        <Box
          sx={{
            py: 8,
            textAlign: 'center',
            border: '1px dashed #e2e8f0',
            borderRadius: 2,
            color: '#94a3b8',
          }}
        >
          <Typography sx={{ fontWeight: 600 }}>No learned answers yet</Typography>
          <Typography sx={{ fontSize: '0.875rem', mt: 0.5 }}>
            The bot will save answers here as it fills out external job applications.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {items.map((item, i) => (
            <Box
              key={i}
              sx={{
                p: 2.5,
                border: '1px solid #e2e8f0',
                borderRadius: 2,
                bgcolor: '#fafafa',
                '&:hover': { bgcolor: '#f8fafc', borderColor: '#cbd5e1' },
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.8 }}>
                    <Chip
                      label={item.question_type || 'text'}
                      size="small"
                      color={TYPE_COLORS[item.question_type] ?? 'default'}
                      sx={{ fontSize: '0.7rem', height: 20, fontWeight: 700 }}
                    />
                    {item.provider && (
                      <Chip
                        label={item.provider}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem', height: 20 }}
                      />
                    )}
                  </Stack>
                  <Typography sx={{ fontSize: '0.875rem', color: '#374151', fontWeight: 500, mb: 0.5 }}>
                    {item.question}
                  </Typography>
                  <Typography sx={{ fontSize: '0.875rem', color: '#16a34a', fontWeight: 700 }}>
                    → {item.answer}
                  </Typography>
                  {item.options && item.options.length > 0 && (
                    <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', mt: 0.5 }}>
                      Options: {item.options.join(' · ')}
                    </Typography>
                  )}
                </Box>
                <Stack direction="row" spacing={0.5} flexShrink={0}>
                  <Tooltip title="Edit answer">
                    <IconButton size="small" onClick={() => openEdit(i)} sx={{ color: '#64748b' }}>
                      <Edit sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" onClick={() => deleteOne(i)} sx={{ color: '#ef4444' }}>
                      <Delete sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      {/* Edit dialog */}
      <Dialog open={editIndex !== null} onClose={() => setEditIndex(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Edit Answer</DialogTitle>
        <DialogContent>
          {editIndex !== null && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Box>
                <Typography sx={{ fontSize: '0.8rem', color: '#64748b', mb: 0.5 }}>Question</Typography>
                <Typography sx={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 500 }}>
                  {items[editIndex]?.question}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.8rem', color: '#64748b', mb: 0.5 }}>Answer</Typography>
                {items[editIndex]?.options && items[editIndex].options!.length > 0 ? (
                  <Select
                    fullWidth
                    size="small"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                  >
                    {items[editIndex].options!.map((opt) => (
                      <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                    ))}
                  </Select>
                ) : (
                  <TextField
                    fullWidth
                    size="small"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    multiline={items[editIndex]?.question_type === 'textarea'}
                    rows={items[editIndex]?.question_type === 'textarea' ? 3 : 1}
                  />
                )}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditIndex(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={saveEdit}
            disabled={saving}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Clear all confirmation */}
      <Dialog open={confirmClear} onClose={() => setConfirmClear(false)}>
        <DialogTitle sx={{ fontWeight: 700 }}>Clear all learned answers?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#64748b' }}>
            This will delete all {items.length} learned answers. The bot will re-learn them over time.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmClear(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={clearAll} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Clear all
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
