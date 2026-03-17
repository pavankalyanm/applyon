import { Stack, TextField, Typography } from '@mui/material'
import type { ResumeConfig } from './types'

type Props = {
  value: ResumeConfig
  onChange: (next: ResumeConfig) => void
}

export function ResumeStep({ value, onChange }: Props) {
  function update<K extends keyof ResumeConfig>(key: K, v: ResumeConfig[K]) {
    onChange({ ...value, [key]: v })
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h6" sx={{ color: '#0f172a' }}>
        Resume Settings
      </Typography>
      <Typography color="text.secondary" fontSize="0.95rem">
        These fields map directly to <code>bot/config/resume.py</code>. Most logic is auto-generated, but you can
        control the default resume path here.
      </Typography>
      <TextField
        label="Default resume path"
        helperText="Relative path used when uploading your resume"
        value={value.default_resume_path ?? ''}
        onChange={(e) => update('default_resume_path', e.target.value)}
        fullWidth
      />
      <Typography color="text.secondary" fontSize="0.85rem">
        Advanced resume generator options are marked as experimental in the original script and are not exposed here
        yet. The bot will still behave exactly as configured in the backend.
      </Typography>
    </Stack>
  )
}

