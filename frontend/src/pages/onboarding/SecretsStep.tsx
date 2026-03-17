import { Checkbox, FormControlLabel, FormGroup, Stack, TextField, Typography } from '@mui/material'
import type { SecretsConfig } from './types'

type Props = {
  value: SecretsConfig
  onChange: (next: SecretsConfig) => void
}

export function SecretsStep({ value, onChange }: Props) {
  function update<K extends keyof SecretsConfig>(key: K, v: SecretsConfig[K]) {
    onChange({ ...value, [key]: v })
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h6" sx={{ color: '#0f172a' }}>
        Secrets & AI
      </Typography>
      <Typography color="text.secondary" fontSize="0.95rem">
        These fields correspond to sensitive values from <code>bot/config/secrets.py</code>. Do not share this page or
        screenshots of it.
      </Typography>
      <TextField
        label="LinkedIn username"
        type="email"
        value={value.username}
        onChange={(e) => update('username', e.target.value)}
        fullWidth
      />
      <TextField
        label="LinkedIn password"
        type="password"
        value={value.password}
        onChange={(e) => update('password', e.target.value)}
        fullWidth
      />
      <FormGroup>
        <FormControlLabel
          control={<Checkbox checked={value.use_AI} onChange={(e) => update('use_AI', e.target.checked)} />}
          label="Use AI to help answer questions"
        />
      </FormGroup>
      <TextField
        label="AI provider"
        helperText='Examples: "openai", "deepseek", "gemini"'
        value={value.ai_provider}
        onChange={(e) => update('ai_provider', e.target.value)}
        fullWidth
      />
      <TextField
        label="LLM API URL"
        helperText='Examples: "https://api.openai.com/v1/", "http://localhost:1234/v1/"'
        value={value.llm_api_url}
        onChange={(e) => update('llm_api_url', e.target.value)}
        fullWidth
      />
      <TextField
        label="LLM API key"
        type="password"
        helperText='Leave empty or "not-needed" if not required (e.g. Ollama).'
        value={value.llm_api_key}
        onChange={(e) => update('llm_api_key', e.target.value)}
        fullWidth
      />
      <TextField
        label="LLM model"
        helperText='Examples: "gpt-4o-mini", "gpt-3.5-turbo", "gemini-1.5-flash", or local model name'
        value={value.llm_model}
        onChange={(e) => update('llm_model', e.target.value)}
        fullWidth
      />
      <TextField
        label="LLM spec"
        helperText='Examples: "openai", "openai-like", "openai-like-github"'
        value={value.llm_spec}
        onChange={(e) => update('llm_spec', e.target.value)}
        fullWidth
      />
      <FormGroup>
        <FormControlLabel
          control={
            <Checkbox
              checked={value.stream_output}
              onChange={(e) => update('stream_output', e.target.checked)}
            />
          }
          label="Stream AI output (better UX, slightly slower)"
        />
      </FormGroup>
    </Stack>
  )
}

