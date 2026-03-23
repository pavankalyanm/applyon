import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  IconButton,
  Paper,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import {
  ArrowForward,
  AutoAwesome,
  Bolt,
  Check,
  CheckCircleOutline,
  ContentCopy,
  DashboardCustomize,
  Lan,
  ManageSearch,
  RocketLaunch,
  Schedule,
  Terminal,
  TravelExplore,
  ViewKanban,
} from '@mui/icons-material'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const featureCards = [
  {
    icon: <AutoAwesome sx={{ fontSize: 28 }} />,
    title: 'AI that handles application friction',
    desc: 'Use structured profile data, resume details, and saved answers to move through repetitive forms with far less manual work.',
  },
  {
    icon: <TravelExplore sx={{ fontSize: 28 }} />,
    title: 'LinkedIn search automation with control',
    desc: 'Configure titles, locations, filters, preferences, and search behavior once, then let the bot work through the funnel.',
  },
  {
    icon: <DashboardCustomize sx={{ fontSize: 28 }} />,
    title: 'Real-time run visibility',
    desc: 'Watch the bot run live, inspect logs, understand exactly what step it is on, and stop or force-stop when needed.',
  },
  {
    icon: <ViewKanban sx={{ fontSize: 28 }} />,
    title: 'Jobs dashboard built for follow-through',
    desc: 'Track every job in table and board views, update statuses like Applied, Assessment, Interview, and Rejected, and jump back to original links.',
  },
]

const pillars = [
  'Set up your profile, resume, and preferences once.',
  'Launch the bot and let it search and apply at scale.',
  'Monitor runs, review logs, and manage the entire pipeline from one place.',
]

const stats = [
  { label: 'Setup once', value: '1 workflow' },
  { label: 'Job funnel views', value: '2 modes' },
  { label: 'Pipeline stages', value: '4 statuses' },
]

const commandPanels = [
  {
    eyebrow: 'Bot Run',
    title: 'Live automation status',
    body: 'See exactly where the bot is: login, filter application, job review, question answering, submit flow, and save events.',
    tone: 'linear-gradient(135deg, rgba(16,185,129,0.28), rgba(34,211,238,0.12))',
  },
  {
    eyebrow: 'Jobs Radar',
    title: 'Every application stays visible',
    body: 'Search by role or company, filter the funnel, open job links again, and move opportunities across pipeline stages.',
    tone: 'linear-gradient(135deg, rgba(20,83,45,0.88), rgba(15,23,42,0.92))',
  },
]

function CopyableCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        bgcolor: '#0f172a',
        borderRadius: '6px',
        px: 1.5,
        py: 1,
        gap: 1,
      }}
    >
      <Typography
        component="code"
        sx={{ fontFamily: 'monospace', fontSize: { xs: '0.72rem', sm: '0.82rem' }, color: '#86efac', flexGrow: 1, wordBreak: 'break-all', lineHeight: 1.5 }}
      >
        {command}
      </Typography>
      <Tooltip title={copied ? 'Copied!' : 'Copy'} placement="top">
        <IconButton size="small" onClick={copy} sx={{ color: copied ? '#86efac' : '#64748b', p: 0.5 }}>
          {copied ? <Check sx={{ fontSize: 15 }} /> : <ContentCopy sx={{ fontSize: 15 }} />}
        </IconButton>
      </Tooltip>
    </Box>
  )
}

const installStepsByOS = {
  mac: [
    {
      step: '1',
      title: 'Install the agent',
      desc: 'One command downloads and installs Jobcook on your machine. Python 3.10+ is installed automatically if needed.',
      command: 'curl -sSL https://applyflowai.com/install | sh',
    },
  ],
  windows: [
    {
      step: '1',
      title: 'Install the agent',
      desc: 'Download and run the installer. Python 3.12 and git are installed automatically via winget if needed.',
      command: 'curl -o "%TEMP%\\jobcook_install.bat" https://applyflowai.com/install.bat && "%TEMP%\\jobcook_install.bat"',
    },
  ],
}

const installStepsShared = [
  {
    step: '2',
    title: 'Connect to your account',
    desc: 'Log in with your account credentials. Your token is saved securely in ~/.jobcook/config.json.',
    command: 'jobcook login',
  },
  {
    step: '3',
    title: 'Run in the background',
    desc: 'Installs as a system service. Starts automatically on login — no terminal needed again.',
    command: 'jobcook install-service',
  },
]

export function LandingPage() {
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [scrollY, setScrollY] = useState(0)
  const [logIndex, setLogIndex] = useState(0)
  const [osTab, setOsTab] = useState<'mac' | 'windows'>('mac')
  const [sectionProgress, setSectionProgress] = useState({
    productStory: 0,
    howItWorks: 0,
    realtime: 0,
    cta: 0,
  })
  const productStoryRef = useRef<HTMLDivElement | null>(null)
  const howItWorksRef = useRef<HTMLDivElement | null>(null)
  const realtimeRef = useRef<HTMLDivElement | null>(null)
  const ctaRef = useRef<HTMLDivElement | null>(null)

  const liveLogs = useMemo(
    () => [
      '[STEP] Preparing LinkedIn session',
      '[STEP] Applying LinkedIn filters: sort=Most recent, date=Past week',
      '[STEP] Opening job search: Frontend Engineer',
      '[STEP] Reviewing job: Frontend Engineer | Orbit Labs | 4281655988',
      '[STEP] Analyzing job details: Frontend Engineer | Orbit Labs',
      '[STEP] Answering application questions: Frontend Engineer | Orbit Labs',
      '[STEP] Submitting application: Frontend Engineer | Orbit Labs',
      '[STEP] Saving applied job: Frontend Engineer | Orbit Labs | 4281655988',
    ],
    [],
  )

  useEffect(() => {
    const calculateProgress = (element: HTMLDivElement | null) => {
      if (!element) return 0
      const rect = element.getBoundingClientRect()
      const viewportHeight = window.innerHeight || 1
      const start = viewportHeight * 0.9
      const end = -rect.height * 0.35
      const raw = (start - rect.top) / (start - end)
      return Math.max(0, Math.min(1, raw))
    }

    const onScroll = () => {
      setScrollY(window.scrollY)
      setSectionProgress({
        productStory: calculateProgress(productStoryRef.current),
        howItWorks: calculateProgress(howItWorksRef.current),
        realtime: calculateProgress(realtimeRef.current),
        cta: calculateProgress(ctaRef.current),
      })
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLogIndex((current) => (current + 1) % liveLogs.length)
    }, 1200)
    return () => window.clearInterval(interval)
  }, [liveLogs])

  const visibleLogs = Array.from({ length: 5 }, (_, offset) => {
    const index = (logIndex + offset) % liveLogs.length
    return liveLogs[index]
  })

  const termLines = useMemo(() => [
    { type: 'cmd', text: 'curl -sSL https://applyflowai.com/install | sh' },
    { type: 'out', text: '✓ Python 3.12' },
    { type: 'out', text: '✓ Jobcook installed successfully!' },
    { type: 'cmd', text: 'jobcook login' },
    { type: 'prompt', text: 'Backend URL: https://applyflowai.com' },
    { type: 'prompt', text: 'Email: you@email.com  Password: ••••••••' },
    { type: 'out', text: '✓ Logged in · token saved to ~/.jobcook/config.json' },
    { type: 'cmd', text: 'jobcook install-service' },
    { type: 'out', text: '✓ Service installed · agent starts automatically on login' },
    { type: 'status', text: '● Agent connected → applyflowai.com' },
  ], [])

  const [termStep, setTermStep] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => {
      setTermStep((s) => (s + 1 >= termLines.length ? 0 : s + 1))
    }, 1400)
    return () => window.clearInterval(id)
  }, [termLines])
  const heroProgress = isMobile ? 0 : Math.min(scrollY / 900, 1.1)
  const heroTextShift = isMobile ? 0 : Math.min(scrollY * 0.18, 120)
  const heroPanelShift = isMobile ? 0 : Math.min(scrollY * 0.14, 110)
  const heroPanelRotateX = isMobile ? 0 : Math.min(scrollY * 0.02, 12)
  const heroPanelRotateY = isMobile ? 0 : Math.max(-10, -scrollY * 0.018)

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background:
          'radial-gradient(circle at top left, rgba(22,163,74,0.16), transparent 26%), radial-gradient(circle at 85% 12%, rgba(34,211,238,0.18), transparent 22%), linear-gradient(180deg, #f4fbf8 0%, #f9fcff 28%, #f6faf7 100%)',
      }}
    >
      {/* ── Mobile banner ── */}
      <Box
        sx={{
          display: { xs: 'flex', md: 'none' },
          alignItems: 'flex-start',
          gap: 1.5,
          px: 2,
          py: 1.5,
          bgcolor: '#0f172a',
          borderBottom: '1px solid rgba(34,197,94,0.18)',
        }}
      >
        <Box sx={{ fontSize: '1.1rem', mt: 0.1, flexShrink: 0 }}>💻</Box>
        <Box>
          <Typography sx={{ color: '#f0fdf4', fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.4 }}>
            Best experienced on desktop
          </Typography>
          <Typography sx={{ color: '#86efac', fontSize: '0.75rem', lineHeight: 1.5, mt: 0.2 }}>
            The agent runs on your laptop — but you can monitor and control it from your phone once it's set up.
          </Typography>
        </Box>
      </Box>

      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          background: 'rgba(248,252,251,0.72)',
          backdropFilter: 'blur(18px)',
          borderBottom: '1px solid rgba(148,163,184,0.18)',
          boxShadow: 'none',
        }}
      >
        <Toolbar sx={{ maxWidth: 1240, width: '100%', mx: 'auto', py: 0.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ flexGrow: 1 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '5px',
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                background: 'linear-gradient(135deg, #14532d 0%, #16a34a 55%, #22c55e 100%)',
                boxShadow: '0 12px 30px rgba(22,163,74,0.28)',
              }}
            >
              <RocketLaunch sx={{ fontSize: 21 }} />
            </Box>
            <Typography sx={{ color: '#0f172a', fontWeight: 900, fontSize: '1.1rem', letterSpacing: '-0.03em' }}>
              ApplyFlow AI
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              variant="text"
              onClick={() => navigate('/auth')}
              sx={{ color: '#475569', fontWeight: 700, display: { xs: 'none', sm: 'inline-flex' } }}
            >
              Login
            </Button>
            <Button
              variant="contained"
              onClick={() => navigate('/auth')}
              endIcon={<ArrowForward sx={{ fontSize: { xs: 14, sm: 16 } }} />}
              sx={{
                px: { xs: 1.8, sm: 2.5 },
                fontSize: { xs: '0.82rem', sm: '0.875rem' },
                borderRadius: '5px',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #14532d 0%, #16a34a 60%, #22c55e 100%)',
                boxShadow: '0 8px 24px rgba(22,163,74,0.24)',
              }}
            >
              Get Started
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          minHeight: { xs: 'auto', lg: '132vh' },
          pt: { xs: 6, md: 10 },
          pb: { xs: 8, md: 16 },
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            opacity: 0.9,
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: { xs: 80, md: 20 },
              left: { xs: '-10%', md: '3%' },
              width: { xs: 220, md: 340 },
              height: { xs: 220, md: 340 },
              display: { xs: 'none', md: 'block' },
              transform: `translate3d(0, ${scrollY * -0.18}px, 0) rotateZ(${heroProgress * -4}deg)`,
            }}
          >
            <Box
              sx={{
                width: '100%',
                height: '100%',
                borderRadius: '30%',
                border: '1px solid rgba(15,23,42,0.08)',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.52), rgba(255,255,255,0.08))',
                transform: `perspective(1200px) rotateX(${67 - heroProgress * 8}deg) rotateY(${-18 - heroProgress * 6}deg) rotateZ(-20deg)`,
                animation: 'floatCard 8s ease-in-out infinite',
              }}
            />
          </Box>
          <Box
            sx={{
              position: 'absolute',
              top: { xs: 120, md: 120 },
              right: { xs: '-8%', md: '9%' },
              width: { xs: 180, md: 280 },
              height: { xs: 180, md: 280 },
              display: { xs: 'none', md: 'block' },
              transform: `translate3d(0, ${scrollY * -0.26}px, 0) rotateZ(${heroProgress * 6}deg)`,
            }}
          >
            <Box
              sx={{
                width: '100%',
                height: '100%',
                borderRadius: '26%',
                background:
                  'radial-gradient(circle at 30% 30%, rgba(34,211,238,0.24), rgba(20,83,45,0.08) 55%, transparent 72%)',
                border: '1px solid rgba(34,211,238,0.14)',
                transform: `perspective(1000px) rotateX(${72 - heroProgress * 10}deg) rotateY(${24 + heroProgress * 10}deg) rotateZ(14deg)`,
                animation: 'floatCard 10s ease-in-out infinite reverse',
              }}
            />
          </Box>
          <Box
            sx={{
              position: 'absolute',
              inset: '8% 10%',
              backgroundImage:
                'linear-gradient(rgba(15,23,42,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.045) 1px, transparent 1px)',
              backgroundSize: '80px 80px',
              maskImage: 'radial-gradient(circle at center, rgba(0,0,0,0.95), transparent 80%)',
            }}
          />
        </Box>

        <Container
          maxWidth="xl"
          sx={{
            position: { xs: 'relative', lg: 'sticky' },
            top: { lg: 82 },
            zIndex: 1,
            px: { xs: 2, sm: 3, md: 4 },
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.08fr) minmax(460px, 0.92fr)' },
              gap: { xs: 5, lg: 6 },
              alignItems: 'center',
            }}
          >
            <Box
              sx={{
                maxWidth: 720,
                transform: `translate3d(0, ${heroTextShift}px, 0)`,
              }}
            >
              <Stack spacing={4} className="fade-in">
                <Chip
                  icon={<CheckCircleOutline sx={{ fontSize: '1rem !important' }} />}
                  label="AI that applies to jobs for you."
                  sx={{
                    alignSelf: 'flex-start',
                    px: 1,
                    height: 38,
                    borderRadius: '5px',
                    bgcolor: 'rgba(255,255,255,0.72)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(15,23,42,0.08)',
                    color: '#166534',
                    fontWeight: 700,
                  }}
                />

                <Typography
                  variant="h1"
                  sx={{
                    color: '#0f172a',
                    fontSize: { xs: '2.4rem', sm: '3.2rem', md: '4.9rem' },
                    lineHeight: { xs: 1.05, md: 0.95 },
                    letterSpacing: { xs: '-0.04em', md: '-0.06em' },
                    fontWeight: 900,
                    maxWidth: 760,
                  }}
                >
                  Set up once.
                  <br />
                  Apply at scale.
                  <br />
                  <Box
                    component="span"
                    sx={{
                      background: 'linear-gradient(135deg, #14532d 0%, #16a34a 45%, #06b6d4 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    Track everything.
                  </Box>
                </Typography>

                <Typography
                  sx={{
                    color: '#475569',
                    fontSize: { xs: '1rem', md: '1.18rem' },
                    lineHeight: 1.8,
                    maxWidth: 640,
                  }}
                >
                  ApplyFlow AI is an AI-powered job application platform that automates search and apply workflows,
                  shows real-time bot logs, and gives you a clean command center for every run, every job, and every outcome.
                </Typography>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <Button
                    variant="contained"
                    size="large"
                    endIcon={<ArrowForward />}
                    onClick={() => navigate('/auth')}
                    fullWidth={isMobile}
                    sx={{
                      px: { xs: 3, sm: 4 },
                      py: 1.5,
                      borderRadius: '5px',
                      fontWeight: 800,
                      background: 'linear-gradient(135deg, #14532d 0%, #16a34a 60%, #22c55e 100%)',
                      boxShadow: '0 16px 36px rgba(22,163,74,0.28)',
                    }}
                  >
                    Start Applying Free
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    fullWidth={isMobile}
                    onClick={() => document.getElementById('product-story')?.scrollIntoView({ behavior: 'smooth' })}
                    sx={{
                      px: { xs: 3, sm: 4 },
                      py: 1.5,
                      borderRadius: '5px',
                      borderColor: 'rgba(15,23,42,0.12)',
                      color: '#0f172a',
                      background: 'rgba(255,255,255,0.68)',
                      backdropFilter: 'blur(12px)',
                    }}
                  >
                    See How It Works
                  </Button>
                </Stack>

                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, pt: 0.5 }}>
                  {stats.map((stat) => (
                    <Paper
                      key={stat.label}
                      elevation={0}
                      sx={{
                        px: { xs: 1.5, sm: 2.2 },
                        py: { xs: 1.25, sm: 1.6 },
                        borderRadius: '5px',
                        bgcolor: 'rgba(255,255,255,0.74)',
                        backdropFilter: 'blur(14px)',
                        border: '1px solid rgba(148,163,184,0.18)',
                      }}
                    >
                      <Typography sx={{ color: '#0f172a', fontWeight: 900, fontSize: { xs: '1rem', sm: '1.25rem' } }}>{stat.value}</Typography>
                      <Typography sx={{ color: '#64748b', fontSize: { xs: '0.72rem', sm: '0.88rem' } }}>{stat.label}</Typography>
                    </Paper>
                  ))}
                </Box>
              </Stack>
            </Box>

            <Box
              sx={{
                display: { xs: 'none', lg: 'block' },
                position: 'relative',
                transform: `translate3d(0, ${-heroPanelShift}px, ${heroProgress * 24}px) rotateX(${heroPanelRotateX}deg) rotateY(${heroPanelRotateY}deg)`,
                transformStyle: 'preserve-3d',
                perspective: '1400px',
              }}
            >
              <Box className="slide-up" sx={{ position: 'relative' }}>
                <Box
                  sx={{
                    position: 'absolute',
                    inset: '14% 10% auto',
                    height: '72%',
                    borderRadius: '5px',
                    filter: 'blur(60px)',
                    background: 'linear-gradient(135deg, rgba(22,163,74,0.26), rgba(34,211,238,0.2))',
                    transform: `scale(${1.02 + heroProgress * 0.06})`,
                  }}
                />
                <Paper
                  elevation={0}
                  sx={{
                    position: 'relative',
                    p: { xs: 2.2, md: 2.8 },
                    borderRadius: '5px',
                    bgcolor: 'rgba(15,23,42,0.92)',
                    color: '#e2e8f0',
                    border: '1px solid rgba(148,163,184,0.14)',
                    boxShadow: '0 34px 80px rgba(15,23,42,0.28)',
                    overflow: 'hidden',
                  }}
                >
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'radial-gradient(circle at 18% 15%, rgba(34,197,94,0.2), transparent 28%), radial-gradient(circle at 82% 12%, rgba(34,211,238,0.14), transparent 22%)',
                    pointerEvents: 'none',
                  }}
                />
                <Stack spacing={2.2} sx={{ position: 'relative' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" alignItems="center" spacing={1.2}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: '5px',
                          display: 'grid',
                          placeItems: 'center',
                          background: 'linear-gradient(135deg, rgba(22,163,74,0.9), rgba(34,211,238,0.7))',
                        }}
                      >
                        <Lan sx={{ fontSize: 22 }} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontWeight: 800, color: '#f8fafc' }}>Automation Command Center</Typography>
                        <Typography sx={{ color: '#94a3b8', fontSize: '0.88rem' }}>
                          Real-time control over search, apply, and follow-up visibility
                        </Typography>
                      </Box>
                    </Stack>
                    <Chip
                      label="Live"
                      size="small"
                      sx={{
                        bgcolor: 'rgba(34,197,94,0.16)',
                        color: '#86efac',
                        fontWeight: 800,
                        border: '1px solid rgba(34,197,94,0.18)',
                      }}
                    />
                  </Stack>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: '1.18fr 0.82fr' },
                      gap: 2,
                    }}
                  >
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: '5px',
                        bgcolor: 'rgba(15,23,42,0.56)',
                        border: '1px solid rgba(148,163,184,0.12)',
                      }}
                    >
                      <Stack spacing={1.4}>
                        <Typography sx={{ color: '#e2e8f0', fontWeight: 700 }}>Run Monitor</Typography>
                        <Typography
                          sx={{
                            color: '#86efac',
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                            fontSize: '0.78rem',
                          }}
                        >
                          `bot/runAiBot.py --live`
                        </Typography>
                        <Stack
                          spacing={1}
                          sx={{
                            height: 208,
                            overflow: 'hidden',
                            position: 'relative',
                          }}
                        >
                          {visibleLogs.map((line, index) => (
                          <Box
                            key={`${line}-${index}`}
                            sx={{
                              px: 1.5,
                              py: 1,
                              borderRadius: '5px',
                              background: index === 0 ? 'rgba(22,163,74,0.18)' : 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(148,163,184,0.08)',
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                              fontSize: '0.8rem',
                              color: index === 0 ? '#bbf7d0' : '#cbd5e1',
                              transform: `translateY(${index * 2}px)`,
                              opacity: 1 - index * 0.14,
                              transition: 'all 0.45s ease',
                              boxShadow: index === 0 ? 'inset 0 0 0 1px rgba(34,197,94,0.12)' : 'none',
                            }}
                          >
                            <Box component="span" sx={{ color: '#64748b', mr: 1 }}>
                              00:{12 + index}
                            </Box>
                            {line}
                            {index === 0 && (
                              <Box
                                component="span"
                                sx={{
                                  display: 'inline-block',
                                  ml: 0.8,
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  bgcolor: '#4ade80',
                                  boxShadow: '0 0 14px #4ade80',
                                  animation: 'pulseGlow 1.4s ease-in-out infinite',
                                }}
                              />
                            )}
                          </Box>
                        ))}
                        </Stack>
                      </Stack>
                    </Paper>

                    <Stack spacing={2}>
                      {commandPanels.map((panel) => (
                        <Paper
                          key={panel.title}
                          elevation={0}
                          sx={{
                            p: 2,
                            borderRadius: '5px',
                            background: panel.tone,
                            border: '1px solid rgba(148,163,184,0.12)',
                            color: '#f8fafc',
                          }}
                        >
                          <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.16em', mb: 0.75 }}>
                            {panel.eyebrow}
                          </Typography>
                          <Typography sx={{ fontWeight: 800, mb: 0.8 }}>{panel.title}</Typography>
                          <Typography sx={{ color: 'rgba(226,232,240,0.82)', lineHeight: 1.6, fontSize: '0.9rem' }}>
                            {panel.body}
                          </Typography>
                        </Paper>
                      ))}
                    </Stack>
                  </Box>
                </Stack>
                </Paper>
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>

      <Box
        id="product-story"
        ref={productStoryRef}
        sx={{
          py: { xs: 6, md: 12 },
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
          <Box
            sx={{
              position: 'absolute',
              top: 60,
              right: '6%',
              width: { xs: 180, md: 320 },
              height: { xs: 180, md: 320 },
              borderRadius: '28%',
              background: 'radial-gradient(circle, rgba(34,211,238,0.14), transparent 68%)',
              transform: `translate3d(${(1 - sectionProgress.productStory) * 55}px, ${(1 - sectionProgress.productStory) * 90}px, 0) scale(${0.86 + sectionProgress.productStory * 0.18})`,
              transition: 'transform 0.12s linear',
              pointerEvents: 'none',
              filter: 'blur(8px)',
            }}
          />
          <Stack
            spacing={8}
            sx={{ position: 'relative', zIndex: 1 }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: '0.88fr 1.12fr' },
                gap: 4,
                alignItems: 'start',
              }}
            >
              <Stack spacing={2}>
                <Typography
                  sx={{
                    color: '#0f766e',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                  }}
                >
                  Product Story
                </Typography>
                <Typography
                  variant="h2"
                  sx={{
                    color: '#0f172a',
                    fontSize: { xs: '2rem', md: '3rem' },
                    lineHeight: 1,
                    letterSpacing: '-0.05em',
                    fontWeight: 900,
                    maxWidth: 520,
                  }}
                >
                  Built to remove repetitive work without removing control.
                </Typography>
              </Stack>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                  gap: 2,
                }}
              >
                {featureCards.map((card, index) => (
                  <Box
                    key={card.title}
                    className="slide-up"
                    sx={{
                      transform: isMobile ? 'none' : `translate3d(${(index % 2 === 0 ? -1 : 1) * (1 - sectionProgress.productStory) * 18}px, ${(1 - sectionProgress.productStory) * (44 + index * 8)}px, 0) scale(${0.95 + sectionProgress.productStory * 0.05})`,
                      transition: 'transform 0.16s linear',
                    }}
                  >
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      borderRadius: '5px',
                      height: '100%',
                      bgcolor: 'rgba(255,255,255,0.72)',
                      backdropFilter: 'blur(16px)',
                      border: '1px solid rgba(148,163,184,0.18)',
                      boxShadow: '0 14px 38px rgba(15,23,42,0.05)',
                      transition: 'transform 0.28s ease, box-shadow 0.28s ease',
                      '&:hover': {
                        transform: 'translateY(-5px)',
                        boxShadow: '0 22px 48px rgba(15,23,42,0.1)',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: '5px',
                        display: 'grid',
                        placeItems: 'center',
                        mb: 2.2,
                        color: '#0f766e',
                        background: 'linear-gradient(135deg, rgba(22,163,74,0.16), rgba(34,211,238,0.14))',
                      }}
                    >
                      {card.icon}
                    </Box>
                    <Typography sx={{ color: '#0f172a', fontWeight: 800, fontSize: '1.08rem', mb: 1 }}>
                      {card.title}
                    </Typography>
                    <Typography sx={{ color: '#64748b', lineHeight: 1.75 }}>{card.desc}</Typography>
                  </Paper>
                  </Box>
                ))}
              </Box>
            </Box>

            <Box ref={howItWorksRef} sx={{ position: 'relative' }}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 3, md: 4 },
                borderRadius: '5px',
                bgcolor: '#f8fffb',
                border: '1px solid rgba(22,163,74,0.12)',
                boxShadow: '0 20px 60px rgba(22,163,74,0.06)',
                transform: `translate3d(0, ${(1 - sectionProgress.howItWorks) * 70}px, 0) scale(${0.97 + sectionProgress.howItWorks * 0.03})`,
                transition: 'transform 0.12s linear',
              }}
            >
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', lg: '0.8fr 1.2fr' },
                  gap: 3,
                  alignItems: 'center',
                }}
              >
                <Stack spacing={2}>
                  <Typography
                    sx={{
                      color: '#166534',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                    }}
                  >
                    How It Works
                  </Typography>
                  <Typography
                    variant="h3"
                    sx={{
                      color: '#0f172a',
                      fontSize: { xs: '1.8rem', md: '2.7rem' },
                      lineHeight: 1.03,
                      letterSpacing: '-0.05em',
                      fontWeight: 900,
                    }}
                  >
                    From setup to interview pipeline in one clean loop.
                  </Typography>
                  <Typography sx={{ color: '#64748b', lineHeight: 1.8, maxWidth: 460 }}>
                    The experience is designed to feel like an intelligent system working in the background while you still retain visibility and choice.
                  </Typography>
                </Stack>

                <Stack spacing={2}>
                  {pillars.map((step, index) => (
                    <Paper
                      key={step}
                      elevation={0}
                      sx={{
                        p: 2.2,
                        borderRadius: '5px',
                        display: 'grid',
                        gridTemplateColumns: '56px 1fr',
                        gap: 2,
                        alignItems: 'center',
                        bgcolor: '#fff',
                        border: '1px solid rgba(148,163,184,0.16)',
                        transform: `translate3d(${(index % 2 === 0 ? -1 : 1) * (1 - sectionProgress.howItWorks) * 16}px, ${(1 - sectionProgress.howItWorks) * 30}px, 0)`,
                        transition: 'transform 0.14s linear',
                      }}
                    >
                      <Box
                        sx={{
                          width: 56,
                          height: 56,
                          borderRadius: '50%',
                          display: 'grid',
                          placeItems: 'center',
                          color: '#fff',
                          fontWeight: 900,
                          fontSize: '1.15rem',
                          background: 'linear-gradient(135deg, #14532d, #16a34a)',
                          boxShadow: '0 10px 24px rgba(22,163,74,0.2)',
                        }}
                      >
                        {index + 1}
                      </Box>
                      <Typography sx={{ color: '#0f172a', fontWeight: 700, fontSize: '1.03rem', lineHeight: 1.55 }}>
                        {step}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            </Paper>
            </Box>

            <Box
              ref={realtimeRef}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: '1.02fr 0.98fr' },
                gap: 3,
                position: 'relative',
              }}
            >
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 3, md: 4 },
                  borderRadius: '5px',
                  color: '#f8fafc',
                  background: 'linear-gradient(145deg, #0f172a 0%, #10253d 55%, #14532d 100%)',
                  border: '1px solid rgba(148,163,184,0.12)',
                  overflow: 'hidden',
                  position: 'relative',
                  transform: `translate3d(${(1 - sectionProgress.realtime) * -20}px, ${(1 - sectionProgress.realtime) * 64}px, 0) scale(${0.97 + sectionProgress.realtime * 0.03})`,
                  transition: 'transform 0.12s linear',
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'radial-gradient(circle at 20% 20%, rgba(34,197,94,0.2), transparent 28%), radial-gradient(circle at 85% 18%, rgba(34,211,238,0.14), transparent 24%)',
                    pointerEvents: 'none',
                  }}
                />
                <Stack spacing={2.5} sx={{ position: 'relative' }}>
                  <Typography sx={{ color: '#86efac', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                    Real-Time Control
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.05em' }}>
                    Watch the bot think, move, and work.
                  </Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,0.82)', lineHeight: 1.85, maxWidth: 560 }}>
                    ApplyFlow AI is not a black box. You can monitor runs in real time, expand logs, see current bot steps, and intervene the moment you need to.
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <Chip icon={<Terminal />} label="Live logs" sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#f8fafc' }} />
                    <Chip icon={<Schedule />} label="Run history" sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#f8fafc' }} />
                    <Chip icon={<Bolt />} label="Stop controls" sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#f8fafc' }} />
                  </Stack>
                </Stack>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: { xs: 3, md: 4 },
                  borderRadius: '5px',
                  bgcolor: 'rgba(255,255,255,0.82)',
                  backdropFilter: 'blur(14px)',
                  border: '1px solid rgba(148,163,184,0.16)',
                  transform: `translate3d(${(1 - sectionProgress.realtime) * 22}px, ${(1 - sectionProgress.realtime) * 76}px, 0) scale(${0.97 + sectionProgress.realtime * 0.03})`,
                  transition: 'transform 0.12s linear',
                }}
              >
                <Stack spacing={2.5}>
                  <Typography sx={{ color: '#0f766e', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                    Jobs Tracking
                  </Typography>
                  <Typography variant="h3" sx={{ color: '#0f172a', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.05em' }}>
                    Manage the entire funnel after the bot finishes.
                  </Typography>
                  <Typography sx={{ color: '#64748b', lineHeight: 1.85 }}>
                    Search jobs, filter views, switch between table and board layouts, maintain pipeline stages, and reopen original job links whenever you want context.
                  </Typography>
                  <Stack spacing={1.4}>
                    {[
                      { icon: <ManageSearch sx={{ fontSize: 20 }} />, text: 'Search by title, company, location, or job ID' },
                      { icon: <ViewKanban sx={{ fontSize: 20 }} />, text: 'Move jobs between Applied, Assessment, Interview, and Rejected' },
                      { icon: <DashboardCustomize sx={{ fontSize: 20 }} />, text: 'Use both board and table views depending on how you think' },
                    ].map((item) => (
                      <Stack key={item.text} direction="row" spacing={1.4} alignItems="center">
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: '5px',
                            display: 'grid',
                            placeItems: 'center',
                            color: '#0f766e',
                            background: 'linear-gradient(135deg, rgba(22,163,74,0.14), rgba(34,211,238,0.12))',
                          }}
                        >
                          {item.icon}
                        </Box>
                        <Typography sx={{ color: '#334155', fontWeight: 600 }}>{item.text}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Stack>
              </Paper>
            </Box>
          </Stack>
        </Container>
      </Box>

      {/* ── Jobcook Install Section ──────────────────────────────────────── */}
      <Box sx={{ py: { xs: 6, md: 12 }, position: 'relative', overflow: 'hidden' }}>
        <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
          <Stack spacing={6}>
            <Stack spacing={1.5} alignItems="center" textAlign="center">
              <Chip
                icon={<Terminal sx={{ fontSize: '1rem !important' }} />}
                label="Local Agent"
                sx={{
                  alignSelf: 'center',
                  px: 1,
                  height: 36,
                  borderRadius: '5px',
                  bgcolor: 'rgba(15,23,42,0.06)',
                  border: '1px solid rgba(15,23,42,0.1)',
                  color: '#0f172a',
                  fontWeight: 700,
                }}
              />
              <Typography
                variant="h2"
                sx={{
                  color: '#0f172a',
                  fontSize: { xs: '2rem', md: '3rem' },
                  lineHeight: 1.02,
                  letterSpacing: '-0.05em',
                  fontWeight: 900,
                  maxWidth: 640,
                }}
              >
                Get running in{' '}
                <Box
                  component="span"
                  sx={{
                    background: 'linear-gradient(135deg, #14532d 0%, #16a34a 45%, #06b6d4 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  3 commands.
                </Box>
              </Typography>
              <Typography sx={{ color: '#64748b', fontSize: '1.05rem', lineHeight: 1.8, maxWidth: 580 }}>
                Jobcook runs locally on your machine and connects to your web account. Start, stop, and monitor your bot
                entirely from the dashboard — no terminal needed after setup.
              </Typography>
            </Stack>

            {/* OS tab toggle */}
            <Stack direction="row" justifyContent="center">
              <Box
                sx={{
                  display: 'inline-flex',
                  bgcolor: 'rgba(15,23,42,0.05)',
                  borderRadius: '8px',
                  p: 0.5,
                  gap: 0.5,
                }}
              >
                {(['mac', 'windows'] as const).map((os) => (
                  <Button
                    key={os}
                    size="small"
                    onClick={() => setOsTab(os)}
                    sx={{
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      px: 2,
                      py: 0.6,
                      textTransform: 'none',
                      ...(osTab === os
                        ? { bgcolor: '#fff', color: '#0f172a', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }
                        : { bgcolor: 'transparent', color: '#64748b' }),
                    }}
                  >
                    {os === 'mac' ? '🍎 macOS / Linux' : '🪟 Windows'}
                  </Button>
                ))}
              </Box>
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                gap: 2.5,
              }}
            >
              {[...installStepsByOS[osTab], ...installStepsShared].map((item) => (
                <Paper
                  key={item.step}
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: '5px',
                    bgcolor: 'rgba(255,255,255,0.82)',
                    backdropFilter: 'blur(14px)',
                    border: '1px solid rgba(148,163,184,0.18)',
                    boxShadow: '0 8px 32px rgba(15,23,42,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#fff',
                        fontWeight: 900,
                        fontSize: '1rem',
                        background: 'linear-gradient(135deg, #14532d, #16a34a)',
                        boxShadow: '0 8px 20px rgba(22,163,74,0.22)',
                        flexShrink: 0,
                      }}
                    >
                      {item.step}
                    </Box>
                    <Typography sx={{ color: '#0f172a', fontWeight: 800, fontSize: '1.05rem' }}>
                      {item.title}
                    </Typography>
                  </Stack>
                  <Typography sx={{ color: '#64748b', lineHeight: 1.75, fontSize: '0.93rem' }}>
                    {item.desc}
                  </Typography>
                  <CopyableCommand command={item.command} />
                </Paper>
              ))}
            </Box>

            {/* ── Terminal animation ── */}
            <Paper
              elevation={0}
              sx={{
                borderRadius: '5px',
                overflow: 'hidden',
                border: '1px solid rgba(148,163,184,0.18)',
                boxShadow: '0 16px 48px rgba(15,23,42,0.12)',
              }}
            >
              {/* title bar */}
              <Box sx={{ px: 2, py: 1.2, bgcolor: '#1e293b', display: 'flex', alignItems: 'center', gap: 1 }}>
                {['#ef4444','#f59e0b','#22c55e'].map((c) => (
                  <Box key={c} sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: c }} />
                ))}
                <Typography sx={{ color: '#64748b', fontSize: '0.8rem', ml: 1, fontFamily: 'monospace' }}>
                  terminal
                </Typography>
              </Box>
              {/* body */}
              <Box
                sx={{
                  bgcolor: '#0f172a',
                  p: { xs: 1.5, md: 3 },
                  minHeight: 200,
                  fontFamily: 'monospace',
                  fontSize: { xs: '0.72rem', md: '0.875rem' },
                  lineHeight: 1.9,
                  overflowX: 'auto',
                  '& span': { whiteSpace: 'pre-wrap', wordBreak: 'break-all' },
                }}
              >
                {termLines.slice(0, termStep + 1).map((line, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                    {line.type === 'cmd' && (
                      <>
                        <Box component="span" sx={{ color: '#4ade80', userSelect: 'none' }}>$</Box>
                        <Box component="span" sx={{ color: '#e2e8f0' }}>{line.text}</Box>
                      </>
                    )}
                    {line.type === 'out' && (
                      <Box component="span" sx={{ color: '#86efac', pl: 2 }}>{line.text}</Box>
                    )}
                    {line.type === 'prompt' && (
                      <Box component="span" sx={{ color: '#94a3b8', pl: 2 }}>{line.text}</Box>
                    )}
                    {line.type === 'status' && (
                      <Box component="span" sx={{ color: '#4ade80', fontWeight: 700, pl: 2, animation: 'pulse 2s infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.6 } } }}>
                        {line.text}
                      </Box>
                    )}
                  </Box>
                ))}
                {/* blinking cursor */}
                <Box component="span" sx={{ display: 'inline-block', width: 8, height: '1em', bgcolor: '#4ade80', ml: termStep === termLines.length - 1 ? 2 : 0, animation: 'blink 1s step-end infinite', '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0 } } }} />
              </Box>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: { xs: 2.5, md: 3 },
                borderRadius: '5px',
                bgcolor: 'rgba(15,23,42,0.03)',
                border: '1px solid rgba(15,23,42,0.08)',
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { sm: 'center' },
                gap: 2,
              }}
            >
              <Terminal sx={{ color: '#64748b', fontSize: 22, flexShrink: 0 }} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography sx={{ color: '#0f172a', fontWeight: 700, mb: 0.3 }}>
                  Requires: Python 3.10+, Google Chrome
                </Typography>
                <Typography sx={{ color: '#64748b', fontSize: '0.9rem' }}>
                  No PyPI account needed. The script clones the app and installs it directly. After{' '}
                  <Box component="code" sx={{ fontFamily: 'monospace', bgcolor: 'rgba(0,0,0,0.06)', px: 0.6, borderRadius: '4px' }}>
                    jobcook install-service
                  </Box>
                  {' '}the agent starts automatically on login.
                </Typography>
              </Box>
              <Button
                variant="contained"
                size="small"
                endIcon={<ArrowForward />}
                onClick={() => navigate('/auth')}
                sx={{
                  flexShrink: 0,
                  borderRadius: '5px',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #14532d 0%, #16a34a 60%, #22c55e 100%)',
                  whiteSpace: 'nowrap',
                }}
              >
                Create Account First
              </Button>
            </Paper>
          </Stack>
        </Container>
      </Box>

      <Box ref={ctaRef} sx={{ py: { xs: 5, md: 10 }, position: 'relative', overflow: 'hidden' }}>
        <Container maxWidth="md">
          <Box
            sx={{
              position: 'absolute',
              inset: '18% auto auto 10%',
              width: { xs: 160, md: 260 },
              height: { xs: 160, md: 260 },
              borderRadius: '32%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%)',
              transform: `translate3d(${(1 - sectionProgress.cta) * -40}px, ${(1 - sectionProgress.cta) * 70}px, 0) scale(${0.84 + sectionProgress.cta * 0.18})`,
              transition: 'transform 0.12s linear',
              pointerEvents: 'none',
            }}
          />
          <Paper
            elevation={0}
            sx={{
              p: { xs: 4, md: 6 },
              borderRadius: '5px',
              textAlign: 'center',
              color: '#fff',
              background: 'linear-gradient(140deg, #14532d 0%, #0f172a 48%, #06b6d4 140%)',
              boxShadow: '0 28px 70px rgba(15,23,42,0.18)',
              position: 'relative',
              overflow: 'hidden',
              transform: `translate3d(0, ${(1 - sectionProgress.cta) * 78}px, 0) scale(${0.95 + sectionProgress.cta * 0.05})`,
              transition: 'transform 0.12s linear',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.12), transparent 22%), radial-gradient(circle at 85% 22%, rgba(255,255,255,0.1), transparent 18%)',
                pointerEvents: 'none',
              }}
            />
            <Stack spacing={2.4} alignItems="center" sx={{ position: 'relative' }}>
              <Typography
                variant="h2"
                sx={{
                  color: '#fff',
                  fontWeight: 900,
                  lineHeight: 1.02,
                  letterSpacing: '-0.05em',
                  fontSize: { xs: '2rem', md: '3.2rem' },
                }}
              >
                Turn repetitive applications into interview momentum.
              </Typography>
              <Typography sx={{ color: 'rgba(226,232,240,0.88)', maxWidth: 620, lineHeight: 1.8, fontSize: '1.04rem' }}>
                Create your profile, launch your automation flow, and manage the entire job pipeline from one beautiful control center.
              </Typography>
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowForward />}
                onClick={() => navigate('/auth')}
                fullWidth={isMobile}
                sx={{
                  px: { xs: 3, sm: 4.5 },
                  py: 1.6,
                  borderRadius: '5px',
                  fontWeight: 900,
                  bgcolor: '#fff',
                  color: '#14532d',
                  '&:hover': { bgcolor: '#f0fdf4' },
                }}
              >
                Create Your Workspace
              </Button>
            </Stack>
          </Paper>
        </Container>
      </Box>

      <Box
        component="footer"
        sx={{
          mt: 'auto',
          py: 4,
          borderTop: '1px solid rgba(148,163,184,0.14)',
          bgcolor: 'rgba(255,255,255,0.58)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <Container maxWidth="xl">
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={1.5}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <RocketLaunch sx={{ color: '#16a34a', fontSize: 18 }} />
              <Typography sx={{ color: '#0f172a', fontWeight: 800 }}>ApplyFlow AI</Typography>
            </Stack>
            <Typography sx={{ color: '#64748b', fontSize: '0.92rem', textAlign: { xs: 'center', sm: 'right' } }}>
              AI-powered LinkedIn job automation with real-time visibility and pipeline control.
            </Typography>
          </Stack>
        </Container>
      </Box>
    </Box>
  )
}
