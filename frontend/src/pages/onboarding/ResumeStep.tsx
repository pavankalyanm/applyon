import { Button, IconButton, List, ListItem, ListItemSecondaryAction, ListItemText, Stack, Typography } from '@mui/material'
import { Delete, Star, StarBorder } from '@mui/icons-material'
import { useEffect, useState } from 'react'
import type { ResumeConfig } from './types'
import { api } from '../../api'

type Props = {
  value: ResumeConfig
  onChange: (next: ResumeConfig) => void
}

export function ResumeStep({ value, onChange }: Props) {
  void value
  void onChange

  type ResumeItem = {
    id: string
    label: string
    path: string
    created_at?: string
  }

  const [items, setItems] = useState<ResumeItem[]>([])
  const [defaultId, setDefaultId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  async function loadResumes() {
    try {
      const resp = await api.get('/resumes')
      const data = resp.data || {}
      setItems((data.items as ResumeItem[]) || [])
      setDefaultId((data.default_resume_id as string) || null)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void loadResumes()
  }, [])

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    setUploading(true)
    try {
      await api.post('/resumes', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await loadResumes()
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function onDelete(id: string) {
    await api.delete(`/resumes/${id}`)
    await loadResumes()
  }

  async function onSetDefault(id: string) {
    await api.post(`/resumes/${id}/default`)
    await loadResumes()
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h6" sx={{ color: '#0f172a' }}>
        Resume Settings
      </Typography>
      <Typography color="text.secondary" fontSize="0.95rem">
        Upload resumes here and choose which one should be used by default. Resume files are stored separately from the
        rest of your settings so they do not get overwritten when you save config changes.
      </Typography>
      <Stack spacing={2}>
        <Typography variant="subtitle1" sx={{ color: '#0f172a' }}>
          Uploaded resumes
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <Button variant="outlined" component="label" disabled={uploading}>
            {uploading ? 'Uploading…' : 'Upload resume'}
            <input type="file" hidden onChange={onUpload} />
          </Button>
          <Typography fontSize="0.85rem" color="text.secondary">
            Upload PDF or DOCX files. These will be used by the bot when applying.
          </Typography>
        </Stack>
        {items.length === 0 ? (
          <Typography fontSize="0.9rem" color="text.secondary">
            No resumes uploaded yet.
          </Typography>
        ) : (
          <List dense>
            {items.map((item) => (
              <ListItem key={item.id} divider>
                <ListItemText
                  primary={item.label}
                  secondary={item.created_at ? new Date(item.created_at).toLocaleString() : undefined}
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    aria-label="set default"
                    onClick={() => onSetDefault(item.id)}
                    sx={{ mr: 1 }}
                  >
                    {defaultId === item.id ? <Star color="primary" /> : <StarBorder />}
                  </IconButton>
                  <IconButton edge="end" aria-label="delete" onClick={() => onDelete(item.id)}>
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </Stack>
      <Typography color="text.secondary" fontSize="0.85rem">
        The bot will use the selected default resume at run start. There is no manual resume path field to maintain.
      </Typography>
    </Stack>
  )
}
