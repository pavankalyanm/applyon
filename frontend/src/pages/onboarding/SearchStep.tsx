import {
  Box,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import type { SearchConfig } from './types'
import { listToMultiline, multilineToList, parseNumber } from './types'

type Props = {
  value: SearchConfig
  onChange: (next: SearchConfig) => void
}

export function SearchStep({ value, onChange }: Props) {
  function update<K extends keyof SearchConfig>(key: K, v: SearchConfig[K]) {
    onChange({ ...value, [key]: v })
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h6" sx={{ color: '#0f172a' }}>
        Search Preferences
      </Typography>
      <TextField
        label="Search terms"
        helperText="One title per line, e.g. Software Engineer, Python Developer"
        minRows={4}
        multiline
        value={listToMultiline(value.search_terms)}
        onChange={(e) => update('search_terms', multilineToList(e.target.value))}
        fullWidth
      />
      <TextField
        label="Search location"
        helperText="e.g. United States, Remote, Chicago, Illinois, United States"
        value={value.search_location}
        onChange={(e) => update('search_location', e.target.value)}
        fullWidth
      />
      <TextField
        label="Apply count before switching search"
        type="number"
        value={value.switch_number ?? ''}
        onChange={(e) => update('switch_number', parseNumber(e.target.value))}
        fullWidth
      />
      <FormGroup>
        <FormControlLabel
          control={
            <Checkbox
              checked={value.randomize_search_order}
              onChange={(e) => update('randomize_search_order', e.target.checked)}
            />
          }
          label="Randomize search order"
        />
        <FormControlLabel
          control={
            <Checkbox checked={value.easy_apply_only} onChange={(e) => update('easy_apply_only', e.target.checked)} />
          }
          label="Easy Apply only"
        />
      </FormGroup>
      <FormControl fullWidth>
        <InputLabel id="sort-by-label">Sort by</InputLabel>
        <Select
          labelId="sort-by-label"
          label="Sort by"
          value={value.sort_by}
          onChange={(e) => update('sort_by', e.target.value as string)}
        >
          <MenuItem value="">Use LinkedIn default</MenuItem>
          <MenuItem value="Most recent">Most recent</MenuItem>
          <MenuItem value="Most relevant">Most relevant</MenuItem>
        </Select>
      </FormControl>
      <FormControl fullWidth>
        <InputLabel id="date-posted-label">Date posted</InputLabel>
        <Select
          labelId="date-posted-label"
          label="Date posted"
          value={value.date_posted}
          onChange={(e) => update('date_posted', e.target.value as string)}
        >
          <MenuItem value="">Any time</MenuItem>
          <MenuItem value="Past month">Past month</MenuItem>
          <MenuItem value="Past week">Past week</MenuItem>
          <MenuItem value="Past 24 hours">Past 24 hours</MenuItem>
        </Select>
      </FormControl>
      <TextField
        label="Salary filter"
        helperText='e.g. "$100,000+" or leave empty'
        value={value.salary}
        onChange={(e) => update('salary', e.target.value)}
        fullWidth
      />
      <FormControl fullWidth>
        <InputLabel id="experience-level-label">Experience level</InputLabel>
        <Select
          labelId="experience-level-label"
          multiple
          value={value.experience_level}
          onChange={(e) => update('experience_level', e.target.value as string[])}
          input={<OutlinedInput label="Experience level" />}
          renderValue={(selected) => (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {(selected as string[]).map((v) => (
                <Chip key={v} label={v} size="small" />
              ))}
            </Box>
          )}
        >
          {['Internship', 'Entry level', 'Associate', 'Mid-Senior level', 'Director', 'Executive'].map((level) => (
            <MenuItem key={level} value={level}>
              {level}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl fullWidth>
        <InputLabel id="job-type-label">Job type</InputLabel>
        <Select
          labelId="job-type-label"
          multiple
          value={value.job_type}
          onChange={(e) => update('job_type', e.target.value as string[])}
          input={<OutlinedInput label="Job type" />}
          renderValue={(selected) => (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {(selected as string[]).map((v) => (
                <Chip key={v} label={v} size="small" />
              ))}
            </Box>
          )}
        >
          {['Full-time', 'Part-time', 'Contract', 'Temporary', 'Volunteer', 'Internship', 'Other'].map((jt) => (
            <MenuItem key={jt} value={jt}>
              {jt}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl fullWidth>
        <InputLabel id="onsite-label">On-site / Remote</InputLabel>
        <Select
          labelId="onsite-label"
          multiple
          value={value.on_site}
          onChange={(e) => update('on_site', e.target.value as string[])}
          input={<OutlinedInput label="On-site / Remote" />}
          renderValue={(selected) => (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {(selected as string[]).map((v) => (
                <Chip key={v} label={v} size="small" />
              ))}
            </Box>
          )}
        >
          {['On-site', 'Remote', 'Hybrid'].map((v) => (
            <MenuItem key={v} value={v}>
              {v}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField
        label="Companies to prefer / include"
        helperText="One per line; leave empty for all"
        minRows={2}
        multiline
        value={listToMultiline(value.companies)}
        onChange={(e) => update('companies', multilineToList(e.target.value))}
        fullWidth
      />
      <TextField
        label="Locations filter"
        helperText="Dynamic multiple select; one per line"
        minRows={2}
        multiline
        value={listToMultiline(value.location)}
        onChange={(e) => update('location', multilineToList(e.target.value))}
        fullWidth
      />
      <TextField
        label="Industries"
        helperText="Dynamic multiple select; one per line"
        minRows={2}
        multiline
        value={listToMultiline(value.industry)}
        onChange={(e) => update('industry', multilineToList(e.target.value))}
        fullWidth
      />
      <TextField
        label="Job functions"
        helperText="Dynamic multiple select; one per line"
        minRows={2}
        multiline
        value={listToMultiline(value.job_function)}
        onChange={(e) => update('job_function', multilineToList(e.target.value))}
        fullWidth
      />
      <TextField
        label="Job titles filter"
        helperText="Dynamic multiple select; one per line"
        minRows={2}
        multiline
        value={listToMultiline(value.job_titles)}
        onChange={(e) => update('job_titles', multilineToList(e.target.value))}
        fullWidth
      />
      <TextField
        label="Benefits filter"
        helperText="Dynamic multiple select; one per line"
        minRows={2}
        multiline
        value={listToMultiline(value.benefits)}
        onChange={(e) => update('benefits', multilineToList(e.target.value))}
        fullWidth
      />
      <TextField
        label="Commitments filter"
        helperText="Dynamic multiple select; one per line"
        minRows={2}
        multiline
        value={listToMultiline(value.commitments)}
        onChange={(e) => update('commitments', multilineToList(e.target.value))}
        fullWidth
      />
      <FormGroup>
        <FormControlLabel
          control={
            <Checkbox
              checked={value.under_10_applicants}
              onChange={(e) => update('under_10_applicants', e.target.checked)}
            />
          }
          label="Prefer jobs with under 10 applicants"
        />
        <FormControlLabel
          control={
            <Checkbox checked={value.in_your_network} onChange={(e) => update('in_your_network', e.target.checked)} />
          }
          label="In your network"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={value.fair_chance_employer}
              onChange={(e) => update('fair_chance_employer', e.target.checked)}
            />
          }
          label="Fair chance employer"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={value.pause_after_filters}
              onChange={(e) => update('pause_after_filters', e.target.checked)}
            />
          }
          label="Pause after applying filters so you can review search"
        />
      </FormGroup>
      <TextField
        label="About company bad words"
        helperText='Companies containing these words in "About" will be skipped. One per line.'
        minRows={2}
        multiline
        value={listToMultiline(value.about_company_bad_words)}
        onChange={(e) => update('about_company_bad_words', multilineToList(e.target.value))}
        fullWidth
      />
      <TextField
        label="About company good words (exceptions)"
        helperText="If these are present, skip the bad-word filter. One per line."
        minRows={2}
        multiline
        value={listToMultiline(value.about_company_good_words)}
        onChange={(e) => update('about_company_good_words', multilineToList(e.target.value))}
        fullWidth
      />
      <TextField
        label="Job description bad words"
        helperText="Jobs containing these words will be skipped. One per line."
        minRows={2}
        multiline
        value={listToMultiline(value.bad_words)}
        onChange={(e) => update('bad_words', multilineToList(e.target.value))}
        fullWidth
      />
      <FormGroup>
        <FormControlLabel
          control={
            <Checkbox
              checked={value.security_clearance}
              onChange={(e) => update('security_clearance', e.target.checked)}
            />
          }
          label="I have an active security clearance"
        />
        <FormControlLabel
          control={
            <Checkbox checked={value.did_masters} onChange={(e) => update('did_masters', e.target.checked)} />
          }
          label="I have a Masters degree"
        />
      </FormGroup>
      <TextField
        label="Current experience (years)"
        helperText="Used to skip roles with higher required experience. -1 to disable."
        type="number"
        value={value.current_experience ?? ''}
        onChange={(e) => update('current_experience', parseNumber(e.target.value))}
        fullWidth
      />
    </Stack>
  )
}

