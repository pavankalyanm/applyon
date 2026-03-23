import { Checkbox, FormControlLabel, FormGroup, Stack, TextField, Typography } from '@mui/material'
import type { SettingsConfig } from './types'
import { parseNumber } from './types'

type Props = {
  value: SettingsConfig
  onChange: (next: SettingsConfig) => void
  aiEnabled?: boolean
}

export function SettingsStep({ value, onChange, aiEnabled = true }: Props) {
  function update<K extends keyof SettingsConfig>(key: K, v: SettingsConfig[K]) {
    onChange({ ...value, [key]: v })
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h6" sx={{ color: '#0f172a' }}>
        Bot & Global Settings
      </Typography>
      <FormGroup>
        <FormControlLabel
          control={
            <Checkbox checked={value.close_tabs} onChange={(e) => update('close_tabs', e.target.checked)} />
          }
          label="Close external application tabs after apply"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={value.follow_companies}
              onChange={(e) => update('follow_companies', e.target.checked)}
            />
          }
          label="Follow companies after Easy Apply"
        />
        <FormControlLabel
          control={
            <Checkbox checked={value.run_non_stop} onChange={(e) => update('run_non_stop', e.target.checked)} />
          }
          label="Run continuously until you stop the bot"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={value.alternate_sortby}
              onChange={(e) => update('alternate_sortby', e.target.checked)}
            />
          }
          label="Alternate sort order between runs"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={value.cycle_date_posted}
              onChange={(e) => update('cycle_date_posted', e.target.checked)}
            />
          }
          label="Cycle date posted filter"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={value.stop_date_cycle_at_24hr}
              onChange={(e) => update('stop_date_cycle_at_24hr', e.target.checked)}
            />
          }
          label="Stop date cycle at 24 hours"
        />
      </FormGroup>
      <TextField
        label="Generated resume folder path"
        value={value.generated_resume_path}
        onChange={(e) => update('generated_resume_path', e.target.value)}
        fullWidth
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Applied applications history file"
          value={value.file_name}
          onChange={(e) => update('file_name', e.target.value)}
          fullWidth
        />
        <TextField
          label="Failed applications history file"
          value={value.failed_file_name}
          onChange={(e) => update('failed_file_name', e.target.value)}
          fullWidth
        />
      </Stack>
      <TextField
        label="Logs folder path"
        value={value.logs_folder_path}
        onChange={(e) => update('logs_folder_path', e.target.value)}
        fullWidth
      />
      <TextField
        label="Max click gap (seconds)"
        type="number"
        value={value.click_gap ?? ''}
        onChange={(e) => update('click_gap', parseNumber(e.target.value))}
        fullWidth
      />
      <FormGroup>
        <FormControlLabel
          control={
            <Checkbox
              checked={value.run_in_background}
              onChange={(e) => update('run_in_background', e.target.checked)}
            />
          }
          label="Run Chrome in background (headless)"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={value.disable_extensions}
              onChange={(e) => update('disable_extensions', e.target.checked)}
            />
          }
          label="Disable browser extensions"
        />
        <FormControlLabel
          control={<Checkbox checked={value.safe_mode} onChange={(e) => update('safe_mode', e.target.checked)} />}
          label="Safe mode (open Chrome in guest profile)"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={value.smooth_scroll}
              onChange={(e) => update('smooth_scroll', e.target.checked)}
            />
          }
          label="Smooth scrolling (may reduce performance)"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={value.keep_screen_awake}
              onChange={(e) => update('keep_screen_awake', e.target.checked)}
            />
          }
          label="Keep screen awake while bot is running"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={value.stealth_mode}
              onChange={(e) => update('stealth_mode', e.target.checked)}
            />
          }
          label="Stealth mode (bypass anti-bot protections - experimental)"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={value.showAiErrorAlerts}
              onChange={(e) => update('showAiErrorAlerts', e.target.checked)}
            />
          }
          label="Show alerts when AI API errors occur"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={value.show_bot_cursor}
              onChange={(e) => update('show_bot_cursor', e.target.checked)}
            />
          }
          label="Show a visual bot cursor for clicks, scrolling, and typing"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={value.use_context_ai}
              disabled={!aiEnabled}
              onChange={(e) => update('use_context_ai', e.target.checked)}
            />
          }
          label="Context AI Engine — use AI to fill any external application form, including unsupported portals. Learns and caches each new page layout."
        />
      </FormGroup>
      {!aiEnabled ? (
        <Typography color="warning.main" fontSize="0.9rem">
          Enable AI and configure a provider in the Secrets step before turning on Context AI.
        </Typography>
      ) : null}
    </Stack>
  )
}
