import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import type { PersonalsConfig } from './types'

type Props = {
  value: PersonalsConfig
  onChange: (next: PersonalsConfig) => void
}

export function PersonalsStep({ value, onChange }: Props) {
  function update<K extends keyof PersonalsConfig>(key: K, v: PersonalsConfig[K]) {
    onChange({ ...value, [key]: v })
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h6" sx={{ color: '#0f172a' }}>
        Personal Information
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="First name"
          value={value.first_name}
          onChange={(e) => update('first_name', e.target.value)}
          fullWidth
          autoFocus
          required
        />
        <TextField
          label="Middle name"
          value={value.middle_name}
          onChange={(e) => update('middle_name', e.target.value)}
          fullWidth
        />
        <TextField
          label="Last name"
          value={value.last_name}
          onChange={(e) => update('last_name', e.target.value)}
          fullWidth
          required
        />
      </Stack>
      <TextField
        label="Phone number"
        helperText="10 digit phone number used on applications"
        value={value.phone_number}
        onChange={(e) => update('phone_number', e.target.value)}
        fullWidth
      />
      <TextField
        label="Current city"
        helperText="If left empty, the bot uses job location"
        value={value.current_city}
        onChange={(e) => update('current_city', e.target.value)}
        fullWidth
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Street"
          value={value.street}
          onChange={(e) => update('street', e.target.value)}
          fullWidth
        />
        <TextField
          label="State"
          value={value.state}
          onChange={(e) => update('state', e.target.value)}
          fullWidth
        />
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Zip code"
          value={value.zipcode}
          onChange={(e) => update('zipcode', e.target.value)}
          fullWidth
        />
        <TextField
          label="Country"
          value={value.country}
          onChange={(e) => update('country', e.target.value)}
          fullWidth
        />
      </Stack>
      <FormControl fullWidth>
        <InputLabel id="ethnicity-label">Ethnicity</InputLabel>
        <Select
          labelId="ethnicity-label"
          label="Ethnicity"
          value={value.ethnicity}
          onChange={(e) => update('ethnicity', e.target.value as string)}
        >
          <MenuItem value="">Prefer not to answer</MenuItem>
          <MenuItem value="Hispanic/Latino">Hispanic/Latino</MenuItem>
          <MenuItem value="American Indian or Alaska Native">American Indian or Alaska Native</MenuItem>
          <MenuItem value="Asian">Asian</MenuItem>
          <MenuItem value="Black or African American">Black or African American</MenuItem>
          <MenuItem value="Native Hawaiian or Other Pacific Islander">
            Native Hawaiian or Other Pacific Islander
          </MenuItem>
          <MenuItem value="White">White</MenuItem>
          <MenuItem value="Other">Other</MenuItem>
          <MenuItem value="Decline">Decline</MenuItem>
        </Select>
      </FormControl>
      <FormControl fullWidth>
        <InputLabel id="gender-label">Gender</InputLabel>
        <Select
          labelId="gender-label"
          label="Gender"
          value={value.gender}
          onChange={(e) => update('gender', e.target.value as string)}
        >
          <MenuItem value="">Prefer not to answer</MenuItem>
          <MenuItem value="Male">Male</MenuItem>
          <MenuItem value="Female">Female</MenuItem>
          <MenuItem value="Other">Other</MenuItem>
          <MenuItem value="Decline">Decline</MenuItem>
        </Select>
      </FormControl>
      <FormControl fullWidth>
        <InputLabel id="disability-label">Disability status</InputLabel>
        <Select
          labelId="disability-label"
          label="Disability status"
          value={value.disability_status}
          onChange={(e) => update('disability_status', e.target.value as string)}
        >
          <MenuItem value="">Prefer not to answer</MenuItem>
          <MenuItem value="Yes">Yes</MenuItem>
          <MenuItem value="No">No</MenuItem>
          <MenuItem value="Decline">Decline</MenuItem>
        </Select>
      </FormControl>
      <FormControl fullWidth>
        <InputLabel id="veteran-label">Veteran status</InputLabel>
        <Select
          labelId="veteran-label"
          label="Veteran status"
          value={value.veteran_status}
          onChange={(e) => update('veteran_status', e.target.value as string)}
        >
          <MenuItem value="">Prefer not to answer</MenuItem>
          <MenuItem value="Yes">Yes</MenuItem>
          <MenuItem value="No">No</MenuItem>
          <MenuItem value="Decline">Decline</MenuItem>
        </Select>
      </FormControl>
      <Box />
    </Stack>
  )
}

