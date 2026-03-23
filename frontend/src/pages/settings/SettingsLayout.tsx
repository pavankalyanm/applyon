import { Box, Button, Stack, Tab, Tabs, Typography } from '@mui/material'
import { CheckCircle, Save } from '@mui/icons-material'
import { useNavigate, useLocation, Outlet, useOutletContext } from 'react-router-dom'
import { useSettingsConfig } from './useSettingsConfig'
import type {
  OutreachConfig,
  PersonalsConfig,
  QuestionsConfig,
  ResumeConfig,
  SearchConfig,
  SecretsConfig,
  SettingsConfig,
} from '../onboarding/types'

const sections = [
  { key: 'personals',        label: 'Personals' },
  { key: 'search',           label: 'Search' },
  { key: 'questions',        label: 'Questions' },
  { key: 'settings',         label: 'Settings' },
  { key: 'resume',           label: 'Resume' },
  { key: 'outreach',         label: 'Outreach' },
  { key: 'secrets',          label: 'Secrets' },
  { key: 'learned-answers',  label: 'Learned Answers' },
] as const

export type SettingsOutletContext = {
  personals: PersonalsConfig
  setPersonals: React.Dispatch<React.SetStateAction<PersonalsConfig>>
  questions: QuestionsConfig
  setQuestions: React.Dispatch<React.SetStateAction<QuestionsConfig>>
  search: SearchConfig
  setSearch: React.Dispatch<React.SetStateAction<SearchConfig>>
  settings: SettingsConfig
  setSettings: React.Dispatch<React.SetStateAction<SettingsConfig>>
  resume: ResumeConfig
  setResume: React.Dispatch<React.SetStateAction<ResumeConfig>>
  outreach: OutreachConfig
  setOutreach: React.Dispatch<React.SetStateAction<OutreachConfig>>
  secrets: SecretsConfig
  setSecrets: React.Dispatch<React.SetStateAction<SecretsConfig>>
}

export function useSettingsOutlet() {
  return useOutletContext<SettingsOutletContext>()
}

export function SettingsLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const cfg = useSettingsConfig()

  const activeSection = sections.find((s) => location.pathname.endsWith(`/${s.key}`))?.key ?? 'personals'

  return (
    <Box sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ── Page header ── */}
      <Box
        sx={{
          px: { xs: 3, md: 4 },
          pt: 4,
          pb: 0,
          bgcolor: 'transparent',
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
          <Box>
            <Typography
              variant="h4"
              sx={{ color: '#0f172a', fontWeight: 800, letterSpacing: '-0.02em' }}
            >
              Settings
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5, fontSize: '0.9rem' }}>
              Manage all configuration for your ApplyFlow AI bot.
            </Typography>
          </Box>

          {/* Save buttons */}
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button
              variant="outlined"
              startIcon={<Save sx={{ fontSize: 16 }} />}
              disabled={cfg.saving || !cfg.canSave || cfg.loading}
              onClick={cfg.saveAll}
              size="small"
              sx={{
                borderColor: '#d1d5db',
                color: '#374151',
                '&:hover': { borderColor: '#16a34a', color: '#16a34a', bgcolor: 'transparent' },
              }}
            >
              {cfg.saving ? 'Saving…' : 'Save'}
            </Button>
            <Button
              variant="contained"
              startIcon={<CheckCircle sx={{ fontSize: 16 }} />}
              disabled={cfg.saving || !cfg.canSave || cfg.loading}
              onClick={async () => {
                await cfg.saveAll()
                navigate('/dashboard')
              }}
              size="small"
            >
              Save & close
            </Button>
          </Stack>
        </Stack>

        {/* ── Horizontal tab bar ── */}
        <Tabs
          value={activeSection}
          onChange={(_, val) => navigate(`/settings/${val}`)}
          variant="scrollable"
          scrollButtons="auto"
          TabIndicatorProps={{
            style: {
              backgroundColor: '#16a34a',
              height: 2,
            },
          }}
          sx={{
            borderBottom: '2px solid #e2e8f0',
            minHeight: 42,
            '& .MuiTab-root': {
              minHeight: 42,
              fontSize: '0.82rem',
              fontWeight: 500,
              textTransform: 'none',
              px: 2.5,
              py: 0,
              color: '#64748b',
              '&.Mui-selected': {
                color: '#16a34a',
                fontWeight: 700,
              },
            },
          }}
        >
          {sections.map((s) => (
            <Tab key={s.key} label={s.label} value={s.key} disableRipple />
          ))}
        </Tabs>
      </Box>

      {/* ── Section content ── */}
      <Box
        sx={{
          flex: 1,
          mx: { xs: 3, md: 4 },
          mt: 3,
          mb: 4,
          p: { xs: 3, md: 4 },
          bgcolor: '#fff',
          border: '1px solid #e2e8f0',
        }}
      >
        <Outlet
          context={{
            personals: cfg.personals,
            setPersonals: cfg.setPersonals,
            questions: cfg.questions,
            setQuestions: cfg.setQuestions,
            search: cfg.search,
            setSearch: cfg.setSearch,
            settings: cfg.settings,
            setSettings: cfg.setSettings,
            resume: cfg.resume,
            setResume: cfg.setResume,
            outreach: cfg.outreach,
            setOutreach: cfg.setOutreach,
            secrets: cfg.secrets,
            setSecrets: cfg.setSecrets,
          }}
        />
      </Box>
    </Box>
  )
}
