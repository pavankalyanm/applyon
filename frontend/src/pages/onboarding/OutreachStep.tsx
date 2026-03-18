import { MenuItem, Stack, Switch, TextField, Typography } from '@mui/material'
import type { OutreachConfig } from './types'

type Props = {
  value: OutreachConfig
  onChange: React.Dispatch<React.SetStateAction<OutreachConfig>>
}

export function OutreachStep({ value, onChange }: Props) {
  function update<K extends keyof OutreachConfig>(key: K, next: OutreachConfig[K]) {
    onChange((current) => ({ ...current, [key]: next }))
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h5" sx={{ color: '#0f172a' }}>
          Outreach Defaults
        </Typography>
        <Typography color="text.secondary">
          Configure the defaults used when you start a recruiter outreach run.
        </Typography>
      </Stack>

      <TextField
        label="Default role"
        value={value.default_role}
        onChange={(event) => update('default_role', event.target.value)}
        placeholder="Data Engineer"
        fullWidth
      />

      <TextField
        label="Default company"
        value={value.default_company}
        onChange={(event) => update('default_company', event.target.value)}
        placeholder="Optional company filter"
        fullWidth
      />

      <TextField
        label="Recruiter search context"
        value={value.default_recruiter_search_context}
        onChange={(event) => update('default_recruiter_search_context', event.target.value)}
        placeholder="Technical recruiter, hiring manager, entry-level hiring"
        fullWidth
      />

      <TextField
        label="Default message content"
        value={value.default_message_content}
        onChange={(event) => update('default_message_content', event.target.value)}
        multiline
        minRows={5}
        placeholder="Hi, I’m reaching out about backend/data roles and would love to connect..."
        fullWidth
      />

      <TextField
        select
        label="Use AI by default"
        value={value.use_ai_for_outreach ? 'yes' : 'no'}
        onChange={(event) => update('use_ai_for_outreach', event.target.value === 'yes')}
      >
        <MenuItem value="no">No, send exact content</MenuItem>
        <MenuItem value="yes">Yes, refine with AI</MenuItem>
      </TextField>

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack spacing={0.25}>
          <Typography sx={{ color: '#0f172a', fontWeight: 600 }}>Attach default resume by default</Typography>
          <Typography color="text.secondary" fontSize="0.9rem">
            When enabled, outreach runs can attach the selected default resume in the LinkedIn message overlay.
          </Typography>
        </Stack>
        <Switch
          checked={value.attach_default_resume}
          onChange={(event) => update('attach_default_resume', event.target.checked)}
        />
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField
          label="Max outreaches per run"
          type="number"
          value={value.max_outreaches_per_run ?? ''}
          onChange={(event) => update('max_outreaches_per_run', event.target.value ? Number(event.target.value) : null)}
          fullWidth
        />
        <TextField
          label="Max outreaches per day"
          type="number"
          value={value.max_outreaches_per_day ?? ''}
          onChange={(event) => update('max_outreaches_per_day', event.target.value ? Number(event.target.value) : null)}
          fullWidth
        />
      </Stack>

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack spacing={0.25}>
          <Typography sx={{ color: '#0f172a', fontWeight: 600 }}>Require review before send</Typography>
          <Typography color="text.secondary" fontSize="0.9rem">
            Pause before the message is sent so you can approve or adjust it.
          </Typography>
        </Stack>
        <Switch
          checked={value.require_review_before_send}
          onChange={(event) => update('require_review_before_send', event.target.checked)}
        />
      </Stack>

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack spacing={0.25}>
          <Typography sx={{ color: '#0f172a', fontWeight: 600 }}>Collect recruiter email if visible</Typography>
          <Typography color="text.secondary" fontSize="0.9rem">
            Save email addresses only when LinkedIn clearly exposes them.
          </Typography>
        </Stack>
        <Switch
          checked={value.collect_recruiter_email_if_available}
          onChange={(event) => update('collect_recruiter_email_if_available', event.target.checked)}
        />
      </Stack>
    </Stack>
  )
}
