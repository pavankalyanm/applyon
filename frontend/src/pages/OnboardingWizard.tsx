import { Box, Button, Container, LinearProgress, Stack, Step, StepLabel, Stepper, Typography } from '@mui/material'
import { ArrowBack, ArrowForward, CheckCircle, RocketLaunch } from '@mui/icons-material'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { ConfigResponse, OutreachConfig, PersonalsConfig, QuestionsConfig, ResumeConfig, SearchConfig, SettingsConfig, SecretsConfig } from './onboarding/types'
import {
  defaultPersonals,
  defaultQuestions,
  defaultOutreach,
  defaultResume,
  defaultSearch,
  defaultSettings,
  defaultSecrets,
} from './onboarding/types'
import { PersonalsStep } from './onboarding/PersonalsStep'
import { SearchStep } from './onboarding/SearchStep'
import { QuestionsStep } from './onboarding/QuestionsStep'
import { SettingsStep } from './onboarding/SettingsStep'
import { ResumeStep } from './onboarding/ResumeStep'
import { OutreachStep } from './onboarding/OutreachStep'
import { SecretsStep } from './onboarding/SecretsStep'

const steps = ['Personals', 'Search', 'Questions', 'Settings', 'Resume', 'Outreach', 'Secrets']

export function OnboardingWizard() {
  const navigate = useNavigate()
  const [activeStep, setActiveStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [personals, setPersonals] = useState<PersonalsConfig>(defaultPersonals)
  const [questions, setQuestions] = useState<QuestionsConfig>(defaultQuestions)
  const [search, setSearch] = useState<SearchConfig>(defaultSearch)
  const [settings, setSettings] = useState<SettingsConfig>(defaultSettings)
  const [resume, setResume] = useState<ResumeConfig>(defaultResume)
  const [outreach, setOutreach] = useState<OutreachConfig>(defaultOutreach)
  const [secrets, setSecrets] = useState<SecretsConfig>(defaultSecrets)

  useEffect(() => {
    async function loadConfig() {
      setLoading(true)
      try {
        const resp = await api.get<ConfigResponse>('/config')
        const data = resp.data
        if (data.personals) {
          setPersonals({ ...defaultPersonals, ...data.personals })
        }
        if (data.questions) {
          const { default_resume_path: _defaultResumePath, ...restQuestions } = data.questions as ConfigResponse['questions'] & { default_resume_path?: string }
          setQuestions({ ...defaultQuestions, ...restQuestions })
        }
        if (data.search) {
          setSearch({
            ...defaultSearch,
            ...data.search,
            search_terms: data.search.search_terms ?? defaultSearch.search_terms,
            experience_level: data.search.experience_level ?? defaultSearch.experience_level,
            job_type: data.search.job_type ?? defaultSearch.job_type,
            on_site: data.search.on_site ?? defaultSearch.on_site,
            companies: data.search.companies ?? defaultSearch.companies,
            location: data.search.location ?? defaultSearch.location,
            industry: data.search.industry ?? defaultSearch.industry,
            job_function: data.search.job_function ?? defaultSearch.job_function,
            job_titles: data.search.job_titles ?? defaultSearch.job_titles,
            benefits: data.search.benefits ?? defaultSearch.benefits,
            commitments: data.search.commitments ?? defaultSearch.commitments,
            about_company_bad_words:
              data.search.about_company_bad_words ?? defaultSearch.about_company_bad_words,
            about_company_good_words:
              data.search.about_company_good_words ?? defaultSearch.about_company_good_words,
            bad_words: data.search.bad_words ?? defaultSearch.bad_words,
          })
        }
        if (data.settings) {
          const { secrets: storedSecrets, ...restSettings } = data.settings
          setSettings({ ...defaultSettings, ...restSettings })
          if (storedSecrets) {
            setSecrets({ ...defaultSecrets, ...storedSecrets })
          }
        }
        if (data.resume) {
          setResume({ ...defaultResume, ...data.resume })
        }
        if (data.outreach) {
          setOutreach({ ...defaultOutreach, ...data.outreach })
        }
      } finally {
        setLoading(false)
      }
    }

    loadConfig()
  }, [])

  const progress = ((activeStep + 1) / steps.length) * 100

  const canNext = useMemo(() => {
    if (activeStep === 0) {
      return personals.first_name.trim() && personals.last_name.trim()
    }
    return true
  }, [activeStep, personals.first_name, personals.last_name])

  async function saveAll() {
    setSaving(true)
    try {
      const { default_resume_path: _defaultResumePath, ...questionPayload } = questions as QuestionsConfig & { default_resume_path?: string }
      await api.put('/config', {
        personals,
        questions: questionPayload,
        search,
        settings: { ...settings, secrets },
        outreach,
      })
    } finally {
      setSaving(false)
    }
  }

  async function finish() {
    await saveAll()
    navigate('/dashboard')
  }

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        background: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 40%)',
      }}
    >
      <Box sx={{ borderBottom: '1px solid #e2e8f0', bgcolor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)' }}>
        <Container maxWidth="md">
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ py: 2 }}>
            <RocketLaunch sx={{ color: '#16a34a', fontSize: 24 }} />
            <Typography sx={{ fontWeight: 800, color: '#14532d', fontSize: '1rem' }}>
              AutoApply
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Typography sx={{ color: '#64748b', fontSize: '0.85rem' }}>
              Step {activeStep + 1} of {steps.length}
            </Typography>
          </Stack>
        </Container>
        <LinearProgress
          variant={loading ? 'indeterminate' : 'determinate'}
          value={loading ? undefined : progress}
          sx={{
            height: 3,
            bgcolor: '#dcfce7',
            '& .MuiLinearProgress-bar': {
              background: 'linear-gradient(90deg, #16a34a, #22c55e)',
            },
          }}
        />
      </Box>

      <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
        <Stack spacing={5} className="fade-in">
          <Box>
            <Typography variant="h4" sx={{ mb: 1, color: '#0f172a' }}>
              Set up your profile
            </Typography>
            <Typography color="text.secondary">
              Complete each step so the bot knows how to apply on your behalf.
            </Typography>
          </Box>

          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Box
            sx={{
              bgcolor: '#fff',
              borderRadius: '5px',
              border: '1px solid #e2e8f0',
              p: { xs: 3, md: 5 },
              boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
            }}
          >
            {activeStep === 0 && <PersonalsStep value={personals} onChange={setPersonals} />}
            {activeStep === 1 && <SearchStep value={search} onChange={setSearch} />}
            {activeStep === 2 && <QuestionsStep value={questions} onChange={setQuestions} />}
            {activeStep === 3 && <SettingsStep value={settings} onChange={setSettings} />}
            {activeStep === 4 && <ResumeStep value={resume} onChange={setResume} />}
            {activeStep === 5 && <OutreachStep value={outreach} onChange={setOutreach} />}
            {activeStep === 6 && <SecretsStep value={secrets} onChange={setSecrets} />}
          </Box>

          <Stack direction="row" justifyContent="space-between">
            <Button
              disabled={activeStep === 0}
              onClick={() => setActiveStep((s) => s - 1)}
              startIcon={<ArrowBack />}
              sx={{ color: '#64748b' }}
            >
              Back
            </Button>
            <Stack direction="row" spacing={1.5}>
              <Button
                variant="outlined"
                disabled={saving}
                onClick={saveAll}
                sx={{ borderColor: '#bbf7d0', color: '#16a34a' }}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
              {activeStep < steps.length - 1 ? (
                <Button
                  variant="contained"
                  disabled={!canNext}
                  onClick={() => setActiveStep((s) => s + 1)}
                  endIcon={<ArrowForward />}
                >
                  Continue
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={finish}
                  endIcon={<CheckCircle />}
                  sx={{
                    px: 4,
                    background: 'linear-gradient(135deg, #14532d 0%, #16a34a 100%)',
                    '&:hover': { background: 'linear-gradient(135deg, #052e16 0%, #15803d 100%)' },
                  }}
                >
                  Finish Setup
                </Button>
              )}
            </Stack>
          </Stack>
        </Stack>
      </Container>
    </Box>
  )
}
