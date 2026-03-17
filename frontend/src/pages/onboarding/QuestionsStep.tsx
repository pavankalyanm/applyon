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
import type { QuestionsConfig } from './types'
import { parseNumber } from './types'

type Props = {
  value: QuestionsConfig
  onChange: (next: QuestionsConfig) => void
}

export function QuestionsStep({ value, onChange }: Props) {
  function update<K extends keyof QuestionsConfig>(key: K, v: QuestionsConfig[K]) {
    onChange({ ...value, [key]: v })
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h6" sx={{ color: '#0f172a' }}>
        Application Questions
      </Typography>
      <Typography color="text.secondary" fontSize="0.95rem">
        These fields map directly to <code>bot/config/questions.py</code>.
      </Typography>
      <TextField
        label="Default resume path"
        helperText="Relative path to your default resume PDF"
        value={value.default_resume_path}
        onChange={(e) => update('default_resume_path', e.target.value)}
        fullWidth
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Years of experience (generic answer)"
          value={value.years_of_experience}
          onChange={(e) => update('years_of_experience', e.target.value)}
          fullWidth
        />
        <FormControl fullWidth>
          <InputLabel id="visa-label">Need visa sponsorship?</InputLabel>
          <Select
            labelId="visa-label"
            label="Need visa sponsorship?"
            value={value.require_visa}
            onChange={(e) => update('require_visa', e.target.value as string)}
          >
            <MenuItem value="">Leave unanswered</MenuItem>
            <MenuItem value="Yes">Yes</MenuItem>
            <MenuItem value="No">No</MenuItem>
          </Select>
        </FormControl>
      </Stack>
      <TextField
        label="Portfolio website"
        value={value.website}
        onChange={(e) => update('website', e.target.value)}
        fullWidth
      />
      <TextField
        label="LinkedIn URL"
        value={value.linkedIn}
        onChange={(e) => update('linkedIn', e.target.value)}
        fullWidth
      />
      <FormControl fullWidth>
        <InputLabel id="citizenship-label">Citizenship status</InputLabel>
        <Select
          labelId="citizenship-label"
          label="Citizenship status"
          value={value.us_citizenship}
          onChange={(e) => update('us_citizenship', e.target.value as string)}
        >
          <MenuItem value="">Leave unanswered</MenuItem>
          <MenuItem value="U.S. Citizen/Permanent Resident">U.S. Citizen/Permanent Resident</MenuItem>
          <MenuItem value="Non-citizen allowed to work for any employer">
            Non-citizen allowed to work for any employer
          </MenuItem>
          <MenuItem value="Non-citizen allowed to work for current employer">
            Non-citizen allowed to work for current employer
          </MenuItem>
          <MenuItem value="Non-citizen seeking work authorization">Non-citizen seeking work authorization</MenuItem>
          <MenuItem value="Canadian Citizen/Permanent Resident">Canadian Citizen/Permanent Resident</MenuItem>
          <MenuItem value="Other">Other</MenuItem>
        </Select>
      </FormControl>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Desired salary (number)"
          type="number"
          value={value.desired_salary ?? ''}
          onChange={(e) => update('desired_salary', parseNumber(e.target.value))}
          fullWidth
        />
        <TextField
          label="Current CTC (number)"
          type="number"
          value={value.current_ctc ?? ''}
          onChange={(e) => update('current_ctc', parseNumber(e.target.value))}
          fullWidth
        />
      </Stack>
      <TextField
        label="Notice period (days)"
        type="number"
        value={value.notice_period ?? ''}
        onChange={(e) => update('notice_period', parseNumber(e.target.value))}
        fullWidth
      />
      <TextField
        label="LinkedIn headline"
        value={value.linkedin_headline}
        onChange={(e) => update('linkedin_headline', e.target.value)}
        fullWidth
        multiline
        minRows={2}
      />
      <TextField
        label="LinkedIn summary"
        value={value.linkedin_summary}
        onChange={(e) => update('linkedin_summary', e.target.value)}
        fullWidth
        multiline
        minRows={4}
      />
      <TextField
        label="Cover letter"
        value={value.cover_letter}
        onChange={(e) => update('cover_letter', e.target.value)}
        fullWidth
        multiline
        minRows={4}
      />
      <TextField
        label="User information (for AI)"
        helperText="Paste resume-style info that AI can use to answer custom questions"
        value={value.user_information_all}
        onChange={(e) => update('user_information_all', e.target.value)}
        fullWidth
        multiline
        minRows={4}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Most recent employer"
          value={value.recent_employer}
          onChange={(e) => update('recent_employer', e.target.value)}
          fullWidth
        />
        <TextField
          label="Experience confidence level (1-10)"
          value={value.confidence_level}
          onChange={(e) => update('confidence_level', e.target.value)}
          fullWidth
        />
      </Stack>
      <FormGroup>
        <FormControlLabel
          control={
            <Checkbox
              checked={value.pause_before_submit}
              onChange={(e) => update('pause_before_submit', e.target.checked)}
            />
          }
          label="Pause before submitting each application so I can review"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={value.pause_at_failed_question}
              onChange={(e) => update('pause_at_failed_question', e.target.checked)}
            />
          }
          label="Pause when the bot needs help answering a question"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={value.overwrite_previous_answers}
              onChange={(e) => update('overwrite_previous_answers', e.target.checked)}
            />
          }
          label="Overwrite previous answers if they exist"
        />
      </FormGroup>
    </Stack>
  )
}

