import {
  Box,
  Button,
  Container,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material'
import { ArrowBack, CheckCircle, RocketLaunch, Save } from '@mui/icons-material'
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
  { key: 'personals', label: 'Personals' },
  { key: 'search', label: 'Search' },
  { key: 'questions', label: 'Questions' },
  { key: 'settings', label: 'Settings' },
  { key: 'resume', label: 'Resume' },
  { key: 'outreach', label: 'Outreach' },
  { key: 'secrets', label: 'Secrets' },
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

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: '#f8faf9' }}>
      <Box
        sx={{
          borderBottom: '1px solid #e2e8f0',
          bgcolor: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Container maxWidth="lg">
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ py: 2 }}>
            <RocketLaunch sx={{ color: '#16a34a', fontSize: 24 }} />
            <Typography sx={{ fontWeight: 800, color: '#14532d', fontSize: '1rem' }}>
              AutoApply
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              size="small"
              startIcon={<ArrowBack />}
              onClick={() => navigate('/dashboard')}
              sx={{ color: '#64748b' }}
            >
              Back to dashboard
            </Button>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        <Stack spacing={4} className="fade-in">
          <Box>
            <Typography variant="h4" sx={{ mb: 1, color: '#0f172a' }}>
              Settings
            </Typography>
            <Typography color="text.secondary">
              Manage all configuration for your AutoApply bot. Values are loaded from your database config.
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '260px 1fr' },
              gap: 3,
              alignItems: 'flex-start',
            }}
          >
            <Box
              sx={{
                bgcolor: '#fff',
                borderRadius: 3,
                border: '1px solid #e2e8f0',
                p: 2,
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{ px: 1.5, py: 1, color: '#64748b', textTransform: 'uppercase', fontSize: 11 }}
              >
                Sections
              </Typography>
              <Divider />
              <List dense>
                {sections.map((section) => {
                  const selected = location.pathname.endsWith(`/${section.key}`)
                  return (
                    <ListItemButton
                      key={section.key}
                      selected={selected}
                      onClick={() => navigate(`/settings/${section.key}`)}
                      sx={{
                        borderRadius: 2,
                        my: 0.25,
                        '&.Mui-selected': {
                          bgcolor: '#ecfdf3',
                          '&:hover': { bgcolor: '#dcfce7' },
                        },
                      }}
                    >
                      <ListItemText
                        primary={section.label}
                        primaryTypographyProps={{ fontSize: 14, fontWeight: selected ? 600 : 500 }}
                      />
                    </ListItemButton>
                  )
                })}
              </List>
            </Box>

            <Stack
              spacing={3}
              sx={{
                bgcolor: '#fff',
                borderRadius: 3,
                border: '1px solid #e2e8f0',
                p: { xs: 3, md: 4 },
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

              <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
                <Button
                  variant="outlined"
                  startIcon={<Save />}
                  disabled={cfg.saving || !cfg.canSave || cfg.loading}
                  onClick={cfg.saveAll}
                >
                  {cfg.saving ? 'Saving…' : 'Save changes'}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<CheckCircle />}
                  disabled={cfg.saving || !cfg.canSave || cfg.loading}
                  onClick={async () => {
                    await cfg.saveAll()
                    navigate('/dashboard')
                  }}
                >
                  Save & close
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Stack>
      </Container>
    </Box>
  )
}
