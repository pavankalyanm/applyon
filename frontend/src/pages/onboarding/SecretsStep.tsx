import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { aiProviderPresets, type SecretsConfig } from './types'

type Props = {
  value: SecretsConfig
  onChange: (next: SecretsConfig) => void
}

export function SecretsStep({ value, onChange }: Props) {
  function update<K extends keyof SecretsConfig>(key: K, v: SecretsConfig[K]) {
    onChange({ ...value, [key]: v })
  }

  const currentProvider =
    aiProviderPresets[value.ai_provider as keyof typeof aiProviderPresets] ?? aiProviderPresets.openai

  function updateProvider(nextProvider: string) {
    const previousProvider =
      aiProviderPresets[value.ai_provider as keyof typeof aiProviderPresets] ?? aiProviderPresets.openai
    const nextPreset =
      aiProviderPresets[nextProvider as keyof typeof aiProviderPresets] ?? aiProviderPresets.openai

    onChange({
      ...value,
      ai_provider: nextProvider,
      llm_api_key: '',
      llm_api_url:
        !value.llm_api_url || value.llm_api_url === previousProvider.llmApiUrl
          ? nextPreset.llmApiUrl
          : value.llm_api_url,
      llm_model:
        !value.llm_model || value.llm_model === previousProvider.llmModel
          ? nextPreset.llmModel
          : value.llm_model,
      llm_spec:
        !value.llm_spec || value.llm_spec === previousProvider.llmSpec
          ? nextPreset.llmSpec
          : value.llm_spec,
    })
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
      {value.use_AI && (
        <>
          <FormControl fullWidth>
            <InputLabel id="ai-provider-label">AI provider</InputLabel>
            <Select
              labelId="ai-provider-label"
              label="AI provider"
              value={value.ai_provider}
              onChange={(e) => updateProvider(e.target.value)}
            >
              <MenuItem value="openai">OpenAI</MenuItem>
              <MenuItem value="groq">Groq</MenuItem>
              <MenuItem value="deepseek">DeepSeek</MenuItem>
              <MenuItem value="gemini">Gemini</MenuItem>
            </Select>
          </FormControl>

          {currentProvider.showApiUrl && (
            <TextField
              label={`${currentProvider.label} API URL`}
              helperText='Examples: "https://api.openai.com/v1/", "https://api.groq.com/openai/v1", "https://api.deepseek.com/v1"'
              value={value.llm_api_url}
              onChange={(e) => update('llm_api_url', e.target.value)}
              fullWidth
            />
          )}

          <TextField
            label={currentProvider.apiKeyLabel}
            type="password"
            helperText={currentProvider.apiKeyHelper}
            value={value.llm_api_key}
            onChange={(e) => update('llm_api_key', e.target.value)}
            fullWidth
          />

          <TextField
            label={`${currentProvider.label} model`}
            helperText='Examples: "gpt-4o-mini", "llama-3.3-70b-versatile", "deepseek-chat", or "gemini-1.5-flash"'
            value={value.llm_model}
            onChange={(e) => update('llm_model', e.target.value)}
            fullWidth
          />

          {currentProvider.showSpec && (
            <TextField
              label="LLM spec"
              helperText='Examples: "openai", "openai-like", "openai-like-github"'
              value={value.llm_spec}
              onChange={(e) => update('llm_spec', e.target.value)}
              fullWidth
            />
          )}

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
        </>
      )}
    </Stack>
  )
}
