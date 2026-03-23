import { Box, Button, Container, IconButton, LinearProgress, Paper, Stack, Step, StepLabel, Stepper, Tooltip, Typography } from '@mui/material'
import { ArrowBack, ArrowForward, Check, CheckCircle, ContentCopy, RocketLaunch } from '@mui/icons-material'
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

const steps = ['Personals', 'Search', 'Questions', 'Settings', 'Resume', 'Outreach', 'Secrets', 'Install & Connect']

function CopyCmd({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#0f172a', borderRadius: '8px', px: 2, py: 1.25, gap: 1, border: '1px solid rgba(148,163,184,0.12)' }}>
      <Typography component="code" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: { xs: '0.72rem', sm: '0.82rem' }, color: '#86efac', flexGrow: 1, wordBreak: 'break-all', lineHeight: 1.6 }}>
        {command}
      </Typography>
      <Tooltip title={copied ? 'Copied!' : 'Copy'} placement="top">
        <IconButton size="small" onClick={() => { navigator.clipboard.writeText(command); setCopied(true); setTimeout(() => setCopied(false), 2000) }} sx={{ color: copied ? '#86efac' : '#64748b', p: 0.5, flexShrink: 0 }}>
          {copied ? <Check sx={{ fontSize: 15 }} /> : <ContentCopy sx={{ fontSize: 15 }} />}
        </IconButton>
      </Tooltip>
    </Box>
  )
}

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
  const [osTab, setOsTab] = useState<'mac' | 'windows'>('mac')

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
      const sanitizedSettings = {
        ...settings,
        use_context_ai: Boolean(secrets.use_AI) && Boolean(settings.use_context_ai),
      }
      await api.put('/config', {
        personals,
        questions: questionPayload,
        search,
        settings: { ...sanitizedSettings, secrets },
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
              ApplyFlow AI
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
            {activeStep === 3 && (
              <SettingsStep
                value={settings}
                onChange={setSettings}
                aiEnabled={Boolean(secrets.use_AI)}
              />
            )}
            {activeStep === 4 && <ResumeStep value={resume} onChange={setResume} />}
            {activeStep === 5 && <OutreachStep value={outreach} onChange={setOutreach} />}
            {activeStep === 6 && <SecretsStep value={secrets} onChange={setSecrets} />}
            {activeStep === 7 && (
              <Stack spacing={3}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>Install & Connect</Typography>
                  <Typography sx={{ color: '#475569', lineHeight: 1.8 }}>
                    Run three commands to install Jobcook on your machine, connect it to your account, and
                    register it as a background service. Pick your operating system below.
                  </Typography>
                </Box>

                {/* OS toggle */}
                <Box sx={{ display: 'inline-flex', bgcolor: 'rgba(15,23,42,0.05)', borderRadius: '8px', p: 0.5, gap: 0.5 }}>
                  {(['mac', 'windows'] as const).map((os) => (
                    <Button key={os} size="small" onClick={() => setOsTab(os)}
                      sx={{ borderRadius: '6px', fontWeight: 700, fontSize: '0.82rem', px: 2, py: 0.6, textTransform: 'none',
                        ...(osTab === os
                          ? { bgcolor: '#fff', color: '#0f172a', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }
                          : { bgcolor: 'transparent', color: '#64748b' }),
                      }}
                    >
                      {os === 'mac' ? 'macOS / Linux' : 'Windows'}
                    </Button>
                  ))}
                </Box>

                {/* Command cards */}
                <Stack spacing={2}>
                  {(() => {
                    const cards = osTab === 'mac'
                      ? [
                          { step: '1', title: 'Install the agent', desc: 'One command downloads and installs Jobcook. Python 3.10+ is installed automatically if needed.', command: 'curl -sSL https://applyflowai.com/install | sh' },
                          { step: '2', title: 'Connect to your account', desc: 'Log in with your credentials. Your token is saved securely.', command: 'jobcook login' },
                          { step: '3', title: 'Run in the background', desc: 'Installs as a system service — starts automatically on login.', command: 'jobcook install-service' },
                        ]
                      : [
                          { step: '1', title: 'Install the agent', desc: 'Download and run the installer. Python 3.12 and git are installed automatically via winget.', command: 'curl -o "%TEMP%\\jobcook_install.bat" https://applyflowai.com/install.bat && "%TEMP%\\jobcook_install.bat"' },
                          { step: '2', title: 'Connect to your account', desc: 'Log in with your credentials. Your token is saved securely.', command: 'jobcook login' },
                          { step: '3', title: 'Run in the background', desc: 'Registers as a Windows service — starts automatically on login.', command: 'jobcook install-service' },
                        ]
                    return cards.map((item) => (
                      <Paper key={item.step} elevation={0} sx={{ p: 2.5, borderRadius: '10px', border: '1px solid #e2e8f0', bgcolor: '#fafafa', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <Box sx={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 900, fontSize: '0.9rem', background: 'linear-gradient(135deg, #14532d, #15803d)', boxShadow: '0 4px 12px rgba(21,128,61,0.22)' }}>
                            {item.step}
                          </Box>
                          <Box>
                            <Typography sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>{item.title}</Typography>
                            <Typography sx={{ color: '#64748b', fontSize: '0.8rem', mt: 0.2 }}>{item.desc}</Typography>
                          </Box>
                        </Stack>
                        <CopyCmd command={item.command} />
                      </Paper>
                    ))
                  })()}
                </Stack>

                {/* Callout */}
                <Stack direction="row" spacing={1.5} sx={{ p: 2, borderRadius: '8px', bgcolor: 'rgba(21,128,61,0.05)', border: '1px solid rgba(21,128,61,0.18)' }}>
                  <CheckCircle sx={{ color: '#15803d', fontSize: 18, mt: 0.1, flexShrink: 0 }} />
                  <Typography sx={{ color: '#14532d', fontSize: '0.875rem', lineHeight: 1.6 }}>
                    Once the service is running you can close the terminal. The agent appears as "Online" in your dashboard.
                  </Typography>
                </Stack>
              </Stack>
            )}
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
                  Go to Dashboard
                </Button>
              )}
            </Stack>
          </Stack>
        </Stack>
      </Container>
    </Box>
  )
}
