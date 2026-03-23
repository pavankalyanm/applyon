import {
  Box,
  Button,
  Chip,
  Container,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import {
  AccountCircle,
  ArrowForward,
  AutoAwesome,
  Check,
  CheckCircle,
  ContentCopy,
  Dashboard,
  Login,
  PlayArrow,
  RocketLaunch,
  Settings,
  Tune,
  Visibility,
} from '@mui/icons-material'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface Step {
  id: number
  phase: string
  title: string
  subtitle: string
  icon: React.ReactNode
  color: string
  colorLight: string
  content: React.ReactNode
}

function CopyCommand({ command }: { command: string }) {
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
        borderRadius: '8px',
        px: 2,
        py: 1.25,
        gap: 1,
        border: '1px solid rgba(148,163,184,0.12)',
      }}
    >
      <Typography
        component="code"
        sx={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: { xs: '0.75rem', sm: '0.875rem' },
          color: '#86efac',
          flexGrow: 1,
          wordBreak: 'break-all',
          lineHeight: 1.6,
        }}
      >
        {command}
      </Typography>
      <Tooltip title={copied ? 'Copied!' : 'Copy'} placement="top">
        <IconButton size="small" onClick={copy} sx={{ color: copied ? '#86efac' : '#64748b', p: 0.5, flexShrink: 0 }}>
          {copied ? <Check sx={{ fontSize: 15 }} /> : <ContentCopy sx={{ fontSize: 15 }} />}
        </IconButton>
      </Tooltip>
    </Box>
  )
}

function StepBadge({ label, color }: { label: string; color: string }) {
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        bgcolor: `${color}18`,
        color,
        fontWeight: 700,
        fontSize: '0.7rem',
        border: `1px solid ${color}30`,
        height: 22,
      }}
    />
  )
}


export function SetupGuidePage() {
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [activeStep, setActiveStep] = useState(0)
  const [osTab, setOsTab] = useState<'mac' | 'windows'>('mac')
  const stepRefs = useRef<(HTMLDivElement | null)[]>([])
  const [visible, setVisible] = useState<boolean[]>([])
  const belowRef = useRef<HTMLDivElement | null>(null)
  const [belowVisible, setBelowVisible] = useState(false)

  const termLinesMac = useMemo(() => [
    { type: 'cmd',    text: 'curl -sSL https://applyflowai.com/install | sh' },
    { type: 'out',    text: '✓ Python 3.12' },
    { type: 'out',    text: '✓ Jobcook installed successfully!' },
    { type: 'cmd',    text: 'jobcook login' },
    { type: 'prompt', text: 'Backend URL: https://applyflowai.com/api' },
    { type: 'prompt', text: 'Email: you@email.com  Password: ••••••••' },
    { type: 'out',    text: '✓ Logged in · token saved to ~/.jobcook/config.json' },
    { type: 'cmd',    text: 'jobcook install-service' },
    { type: 'out',    text: '✓ Service installed · agent starts automatically on login' },
    { type: 'status', text: '● Agent connected → applyflowai.com' },
  ], [])
  const termLinesWin = useMemo(() => [
    { type: 'cmd',    text: 'curl -o "%TEMP%\\jobcook_install.bat" https://applyflowai.com/install.bat && "%TEMP%\\jobcook_install.bat"' },
    { type: 'out',    text: 'Downloading installer...' },
    { type: 'out',    text: 'Python 3.12 installed via winget' },
    { type: 'out',    text: 'Jobcook installed successfully!' },
    { type: 'cmd',    text: 'jobcook login' },
    { type: 'prompt', text: 'Backend URL: https://applyflowai.com/api' },
    { type: 'prompt', text: 'Email: you@email.com  Password: ••••••••' },
    { type: 'out',    text: 'Logged in · token saved to %USERPROFILE%\\.jobcook\\config.json' },
    { type: 'cmd',    text: 'jobcook install-service' },
    { type: 'out',    text: 'Service registered · auto-start on login enabled' },
    { type: 'status', text: '● Agent connected → applyflowai.com' },
  ], [])
  const termLines = osTab === 'mac' ? termLinesMac : termLinesWin
  const [termStep, setTermStep] = useState(0)

  const steps: Step[] = [
    {
      id: 1,
      phase: 'Account',
      title: 'Create your account',
      subtitle: 'Sign up for free and get access to the full platform.',
      icon: <AccountCircle sx={{ fontSize: 26 }} />,
      color: '#22c55e',
      colorLight: 'rgba(34,197,94,0.12)',
      content: (
        <Stack spacing={3}>
          <Typography sx={{ color: '#475569', lineHeight: 1.8 }}>
            Head to the app and create your account. Your account gives you access to the dashboard,
            settings, run history, jobs pipeline, and outreach tools.
          </Typography>
          <Paper
            elevation={0}
            sx={{ p: 3, borderRadius: '10px', bgcolor: 'rgba(22,163,74,0.04)', border: '1px solid rgba(22,163,74,0.14)' }}
          >
            <Stack spacing={1.5}>
              {[
                'Click "Get Started" or "Sign Up" on the home page',
                'Enter your email and create a password',
                "You'll be redirected to the onboarding wizard to complete your profile",
              ].map((item, i) => (
                <Stack key={i} direction="row" spacing={1.5} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 22, height: 22, borderRadius: '50%', bgcolor: '#22c55e', color: '#fff',
                      display: 'grid', placeItems: 'center', fontSize: '0.72rem', fontWeight: 800,
                      flexShrink: 0, mt: 0.15,
                    }}
                  >
                    {i + 1}
                  </Box>
                  <Typography sx={{ color: '#334155', fontSize: '0.9rem', lineHeight: 1.6 }}>{item}</Typography>
                </Stack>
              ))}
            </Stack>
          </Paper>
          <Button
            variant="contained"
            endIcon={<ArrowForward />}
            onClick={() => navigate('/auth')}
            sx={{
              alignSelf: 'flex-start', borderRadius: '8px', fontWeight: 700,
              background: 'linear-gradient(135deg, #14532d 0%, #16a34a 60%, #22c55e 100%)',
              boxShadow: '0 8px 24px rgba(22,163,74,0.24)',
            }}
          >
            Create Account
          </Button>
        </Stack>
      ),
    },
    {
      id: 2,
      phase: 'Profile',
      title: 'Complete your profile',
      subtitle: 'Fill in your info so the bot can answer application questions accurately.',
      icon: <Settings sx={{ fontSize: 26 }} />,
      color: '#16a34a',
      colorLight: 'rgba(22,163,74,0.12)',
      content: (
        <Stack spacing={3}>
          <Typography sx={{ color: '#475569', lineHeight: 1.8 }}>
            The onboarding wizard walks you through every section. The bot uses this data to fill
            forms, answer questions, and represent you accurately on applications.
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            {[
              { label: 'Personals', desc: 'Name, location, contact info, links' },
              { label: 'Resume', desc: 'Upload your PDF resume' },
              { label: 'Search Settings', desc: 'Titles, locations, filters, preferences' },
              { label: 'Questions', desc: 'Pre-fill common application questions' },
              { label: 'Secrets', desc: 'LinkedIn credentials (stored securely)' },
              { label: 'Outreach', desc: 'Recruiter message templates' },
            ].map((s) => (
              <Paper
                key={s.label}
                elevation={0}
                sx={{ p: 2, borderRadius: '8px', bgcolor: 'rgba(22,163,74,0.04)', border: '1px solid rgba(22,163,74,0.12)' }}
              >
                <Typography sx={{ color: '#0f172a', fontWeight: 700, fontSize: '0.9rem' }}>{s.label}</Typography>
                <Typography sx={{ color: '#64748b', fontSize: '0.8rem', mt: 0.3 }}>{s.desc}</Typography>
              </Paper>
            ))}
          </Box>
          <Typography sx={{ color: '#64748b', fontSize: '0.85rem', fontStyle: 'italic' }}>
            Tip: You can always update settings later from the Settings page in the dashboard.
          </Typography>
        </Stack>
      ),
    },
    {
      id: 3,
      phase: 'Install & Connect',
      title: 'Install the agent and connect it',
      subtitle: 'Three quick commands — install, login, and run as a service.',
      icon: <RocketLaunch sx={{ fontSize: 26 }} />,
      color: '#15803d',
      colorLight: 'rgba(21,128,61,0.12)',
      content: (
        <Stack spacing={3}>
          <Typography sx={{ color: '#475569', lineHeight: 1.8 }}>
            Run three commands to install Jobcook on your machine, connect it to your account, and
            register it as a background service. Pick your operating system below to see the right commands.
          </Typography>

          {/* OS toggle */}
          <Box sx={{ display: 'inline-flex', bgcolor: 'rgba(15,23,42,0.05)', borderRadius: '8px', p: 0.5, gap: 0.5 }}>
            {(['mac', 'windows'] as const).map((os) => (
              <Button key={os} size="small" onClick={() => setOsTab(os)}
                sx={{
                  borderRadius: '6px', fontWeight: 700, fontSize: '0.82rem', px: 2, py: 0.6, textTransform: 'none',
                  ...(osTab === os
                    ? { bgcolor: '#fff', color: '#0f172a', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }
                    : { bgcolor: 'transparent', color: '#64748b' }),
                }}
              >
                {os === 'mac' ? 'macOS / Linux' : 'Windows'}
              </Button>
            ))}
          </Box>

          {/* Command cards: card 1 full width, cards 2+3 side by side */}
          {(() => {
            const card1 = osTab === 'mac'
              ? { step: '1', title: 'Install the agent', desc: 'One command downloads and installs Jobcook on your machine. Python 3.10+ is installed automatically if needed.', command: 'curl -sSL https://applyflowai.com/install | sh' }
              : { step: '1', title: 'Install the agent', desc: 'Download and run the installer. Python 3.12 and git are installed automatically via winget if needed.', command: 'curl -o "%TEMP%\\jobcook_install.bat" https://applyflowai.com/install.bat && "%TEMP%\\jobcook_install.bat"' }
            const cards23 = [
              { step: '2', title: 'Connect to your account', desc: 'Log in with your account credentials. Your token is saved securely in ~/.jobcook/config.json.', command: 'jobcook login' },
              { step: '3', title: 'Run in the background', desc: 'Installs as a system service. Starts automatically on login — no terminal needed again.', command: 'jobcook install-service' },
            ]
            const cardSx = {
              p: 3, borderRadius: '5px', display: 'flex', flexDirection: 'column' as const, gap: 2,
              bgcolor: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(14px)',
              border: '1px solid rgba(148,163,184,0.18)', boxShadow: '0 8px 32px rgba(15,23,42,0.05)',
            }
            const numSx = {
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 900, fontSize: '1rem',
              background: 'linear-gradient(135deg, #14532d, #15803d)', boxShadow: '0 8px 20px rgba(21,128,61,0.22)',
            }
            return (
              <Stack spacing={2.5}>
                <Paper elevation={0} sx={cardSx}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box sx={numSx}>{card1.step}</Box>
                    <Typography sx={{ color: '#0f172a', fontWeight: 800, fontSize: '1.05rem' }}>{card1.title}</Typography>
                  </Stack>
                  <Typography sx={{ color: '#64748b', lineHeight: 1.75, fontSize: '0.93rem' }}>{card1.desc}</Typography>
                  <CopyCommand command={card1.command} />
                </Paper>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>
                  {cards23.map((item) => (
                    <Paper key={item.step} elevation={0} sx={cardSx}>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Box sx={numSx}>{item.step}</Box>
                        <Typography sx={{ color: '#0f172a', fontWeight: 800, fontSize: '1.05rem' }}>{item.title}</Typography>
                      </Stack>
                      <Typography sx={{ color: '#64748b', lineHeight: 1.75, fontSize: '0.93rem' }}>{item.desc}</Typography>
                      <CopyCommand command={item.command} />
                    </Paper>
                  ))}
                </Box>
              </Stack>
            )
          })()}

          {/* Animated terminal */}
          <Paper elevation={0} sx={{ borderRadius: '5px', overflow: 'hidden', border: '1px solid rgba(148,163,184,0.18)', boxShadow: '0 16px 48px rgba(15,23,42,0.12)' }}>
            {osTab === 'mac' ? (
              /* macOS — traffic-light title bar */
              <Box sx={{ px: 2, py: 1.2, bgcolor: '#1e293b', display: 'flex', alignItems: 'center', gap: 1 }}>
                {['#ef4444', '#f59e0b', '#22c55e'].map((c) => (
                  <Box key={c} sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: c }} />
                ))}
                <Typography sx={{ color: '#64748b', fontSize: '0.8rem', ml: 1, fontFamily: 'monospace' }}>terminal</Typography>
              </Box>
            ) : (
              /* Windows — cmd.exe title bar */
              <Box sx={{ px: 2, py: 1, bgcolor: '#000080', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography sx={{ color: '#fff', fontSize: '0.78rem', fontFamily: 'monospace', fontWeight: 700 }}>
                  Command Prompt
                </Typography>
                <Stack direction="row" spacing={0.5}>
                  {['_', '□', '✕'].map((c) => (
                    <Box key={c} sx={{ px: 0.75, py: 0.1, bgcolor: '#1a1a8a', color: '#fff', fontSize: '0.7rem', fontFamily: 'monospace', cursor: 'default', userSelect: 'none' }}>{c}</Box>
                  ))}
                </Stack>
              </Box>
            )}
            <Box sx={{
              bgcolor: osTab === 'mac' ? '#0f172a' : '#0c0c0c',
              p: { xs: 1.5, md: 3 }, minHeight: 200,
              fontFamily: osTab === 'mac' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : '"Courier New", Courier, monospace',
              fontSize: { xs: '0.72rem', md: '0.875rem' }, lineHeight: 1.9, overflowX: 'auto',
              '& span': { whiteSpace: 'pre-wrap', wordBreak: 'break-all' },
            }}>
              {termLines.slice(0, termStep + 1).map((line, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                  {line.type === 'cmd' && osTab === 'mac' && (<><Box component="span" sx={{ color: '#4ade80', userSelect: 'none' }}>$</Box><Box component="span" sx={{ color: '#e2e8f0' }}>{line.text}</Box></>)}
                  {line.type === 'cmd' && osTab === 'windows' && (<><Box component="span" sx={{ color: '#c0c0c0', userSelect: 'none' }}>C:\&gt;</Box><Box component="span" sx={{ color: '#c0c0c0' }}>{line.text}</Box></>)}
                  {line.type === 'out' && <Box component="span" sx={{ color: osTab === 'mac' ? '#86efac' : '#c0c0c0', pl: 2 }}>{line.text}</Box>}
                  {line.type === 'prompt' && <Box component="span" sx={{ color: '#94a3b8', pl: 2 }}>{line.text}</Box>}
                  {line.type === 'status' && <Box component="span" sx={{ color: osTab === 'mac' ? '#4ade80' : '#00ff00', fontWeight: 700, pl: 2, animation: 'pulse 2s infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.6 } } }}>{line.text}</Box>}
                </Box>
              ))}
              <Box component="span" sx={{ display: 'inline-block', width: 8, height: '1em', bgcolor: osTab === 'mac' ? '#4ade80' : '#c0c0c0', ml: termStep === termLines.length - 1 ? 2 : 0, animation: 'blink 1s step-end infinite', '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0 } } }} />
            </Box>
          </Paper>

          {/* Online callout */}
          <Stack direction="row" spacing={1} sx={{ p: 2, borderRadius: '8px', bgcolor: 'rgba(21,128,61,0.05)', border: '1px solid rgba(21,128,61,0.18)' }}>
            <CheckCircle sx={{ color: '#15803d', fontSize: 18, mt: 0.1, flexShrink: 0 }} />
            <Typography sx={{ color: '#14532d', fontSize: '0.875rem', lineHeight: 1.6 }}>
              Once the service is running you can control the agent from the dashboard.
            </Typography>
          </Stack>
        </Stack>
      ),
    },
    {
      id: 4,
      phase: 'Run',
      title: 'Start your first bot run',
      subtitle: 'Launch the bot from the dashboard and watch it apply to jobs.',
      icon: <PlayArrow sx={{ fontSize: 26 }} />,
      color: '#166534',
      colorLight: 'rgba(22,101,52,0.12)',
      content: (
        <Stack spacing={3}>
          <Typography sx={{ color: '#475569', lineHeight: 1.8 }}>
            With the agent connected and your profile configured, head to the Dashboard and start the
            bot. It opens LinkedIn, applies your search filters, and begins reviewing and applying to
            jobs automatically.
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            {[
              { step: '1', label: 'Go to Dashboard', desc: 'Navigate to the Dashboard in the app' },
              { step: '2', label: 'Click "Start Bot"', desc: 'Press the green Start Bot button in the controls panel' },
              { step: '3', label: 'Watch logs appear', desc: 'Live logs stream as the bot works through each job' },
              { step: '4', label: 'Let it run', desc: 'The bot applies autonomously — you just monitor' },
            ].map((s) => (
              <Paper
                key={s.step}
                elevation={0}
                sx={{
                  p: 2.5, borderRadius: '8px',
                  bgcolor: 'rgba(22,101,52,0.04)', border: '1px solid rgba(22,101,52,0.14)',
                  display: 'flex', gap: 2, alignItems: 'flex-start',
                }}
              >
                <Box
                  sx={{
                    width: 32, height: 32, borderRadius: '50%', bgcolor: '#166534', color: '#fff',
                    display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: '0.85rem', flexShrink: 0,
                  }}
                >
                  {s.step}
                </Box>
                <Box>
                  <Typography sx={{ color: '#0f172a', fontWeight: 700, fontSize: '0.875rem' }}>{s.label}</Typography>
                  <Typography sx={{ color: '#64748b', fontSize: '0.8rem', mt: 0.3 }}>{s.desc}</Typography>
                </Box>
              </Paper>
            ))}
          </Box>

          {/* Live log preview */}
          <Paper
            elevation={0}
            sx={{ p: 2.5, borderRadius: '8px', bgcolor: '#0f172a', border: '1px solid rgba(148,163,184,0.1)' }}
          >
            <Typography
              component="code"
              sx={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#64748b', display: 'block', mb: 1 }}
            >
              Run #1 · Live
            </Typography>
            <Stack spacing={0.6}>
              {[
                '[STEP] Preparing LinkedIn session',
                '[STEP] Applying filters: Frontend Engineer · Remote · Past week',
                '[STEP] Reviewing job: Frontend Engineer | Orbit Labs',
                '[STEP] Answering application questions...',
                '[STEP] Submitting application ✓',
              ].map((line, i) => (
                <Typography
                  key={i}
                  component="code"
                  sx={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: '0.78rem',
                    color: i === 4 ? '#4ade80' : i === 0 ? '#94a3b8' : '#cbd5e1',
                  }}
                >
                  {line}
                </Typography>
              ))}
            </Stack>
          </Paper>

          <Button
            variant="contained"
            startIcon={<Dashboard />}
            onClick={() => navigate('/dashboard')}
            sx={{
              alignSelf: 'flex-start', borderRadius: '8px', fontWeight: 700,
              background: 'linear-gradient(135deg, #14532d 0%, #16a34a 60%, #22c55e 100%)',
              boxShadow: '0 8px 24px rgba(22,163,74,0.24)',
            }}
          >
            Go to Dashboard
          </Button>
        </Stack>
      ),
    },
  ]

  const belowFeatures = [
    {
      icon: <Tune sx={{ fontSize: 26 }} />,
      color: '#9333ea',
      colorLight: 'rgba(147,51,234,0.1)',
      title: 'Configure your job search',
      desc: 'Set job titles, locations, experience levels, date filters, and a company blacklist. These settings drive every bot run.',
      cta: { label: 'Open Search Settings', path: '/settings/search' },
      items: [
        { label: 'Job Titles', desc: '"Frontend Engineer", "React Developer", etc.' },
        { label: 'Locations', desc: 'City, country, or "Remote" — add multiple' },
        { label: 'Experience Level', desc: 'Entry / Mid / Senior — LinkedIn filter' },
        { label: 'Easy Apply Only', desc: 'Skip external forms, LinkedIn-only applications' },
        { label: 'Date Posted', desc: 'Past 24h, week, or month — fresher = better' },
        { label: 'Blacklist', desc: 'Companies to always skip' },
      ],
    },
    {
      icon: <Visibility sx={{ fontSize: 26 }} />,
      color: '#0891b2',
      colorLight: 'rgba(8,145,178,0.1)',
      title: 'Monitor, manage & iterate',
      desc: 'Every application lands in your Jobs dashboard. Track statuses, revisit listings, and manage your pipeline from one place.',
      cta: { label: 'Open Jobs Dashboard', path: '/jobs' },
      items: [
        { label: 'Run History', desc: 'Start time, job counts, duration, outcome' },
        { label: 'Jobs Pipeline', desc: 'Table + board — Applied → Interview → Rejected' },
        { label: 'Stop Controls', desc: 'Stop or force-stop the bot at any point' },
        { label: 'Outreach', desc: 'Send recruiter messages using saved templates' },
      ],
    },
  ]

  useEffect(() => {
    const observers: IntersectionObserver[] = []
    stepRefs.current.forEach((el, i) => {
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setVisible((prev) => { const n = [...prev]; n[i] = true; return n })
            setActiveStep(i)
          }
        },
        { threshold: 0.3 },
      )
      obs.observe(el)
      observers.push(obs)
    })
    if (belowRef.current) {
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setBelowVisible(true) },
        { threshold: 0.1 },
      )
      obs.observe(belowRef.current)
      observers.push(obs)
    }
    return () => observers.forEach((o) => o.disconnect())
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      setTermStep((s) => (s + 1 >= termLines.length ? 0 : s + 1))
    }, 1400)
    return () => window.clearInterval(id)
  }, [termLines])

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        background:
          'radial-gradient(circle at top left, rgba(22,163,74,0.1), transparent 30%), radial-gradient(circle at 90% 10%, rgba(34,211,238,0.12), transparent 25%), linear-gradient(180deg, #f4fbf8 0%, #f9fcff 50%, #f6faf7 100%)',
      }}
    >
      {/* ── Header ── */}
      <Box
        sx={{
          position: 'sticky', top: 0, zIndex: 100,
          bgcolor: 'rgba(248,252,251,0.82)', backdropFilter: 'blur(18px)',
          borderBottom: '1px solid rgba(148,163,184,0.16)',
        }}
      >
        <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box
                sx={{
                  width: 34, height: 34, borderRadius: '6px', display: 'grid', placeItems: 'center',
                  background: 'linear-gradient(135deg, #14532d 0%, #16a34a 55%, #22c55e 100%)',
                  boxShadow: '0 8px 20px rgba(22,163,74,0.24)', cursor: 'pointer',
                }}
                onClick={() => navigate('/')}
              >
                <RocketLaunch sx={{ color: '#fff', fontSize: 18 }} />
              </Box>
              <Box>
                <Typography sx={{ color: '#0f172a', fontWeight: 900, fontSize: '0.95rem', letterSpacing: '-0.02em', lineHeight: 1 }}>
                  ApplyFlow AI
                </Typography>
                <Typography sx={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 600 }}>Setup Guide</Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button
                variant="text" size="small" onClick={() => navigate('/')}
                sx={{ color: '#64748b', fontWeight: 600, textTransform: 'none', display: { xs: 'none', sm: 'inline-flex' } }}
              >
                Home
              </Button>
              <Button
                variant="contained" size="small" endIcon={<Login sx={{ fontSize: 14 }} />}
                onClick={() => navigate('/auth')}
                sx={{
                  borderRadius: '6px', fontWeight: 700, textTransform: 'none',
                  background: 'linear-gradient(135deg, #14532d 0%, #16a34a 60%, #22c55e 100%)',
                  boxShadow: '0 4px 14px rgba(22,163,74,0.22)',
                }}
              >
                {isMobile ? 'Sign In' : 'Sign In / Sign Up'}
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* ── Hero ── */}
      <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 4 }, pt: { xs: 5, md: 8 }, pb: 2 }}>
        <Stack spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }} textAlign={{ xs: 'left', md: 'center' }}>
          <Chip
            icon={<AutoAwesome sx={{ fontSize: '0.95rem !important' }} />}
            label="Complete Setup Guide"
            sx={{
              px: 1, height: 34, borderRadius: '6px',
              bgcolor: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.2)',
              color: '#166534', fontWeight: 700,
            }}
          />
          <Typography
            variant="h1"
            sx={{
              color: '#0f172a', fontSize: { xs: '2.2rem', sm: '3rem', md: '3.8rem' },
              fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 1, maxWidth: 720,
            }}
          >
            From sign-up to{' '}
            <Box
              component="span"
              sx={{
                background: 'linear-gradient(135deg, #14532d 0%, #16a34a 45%, #06b6d4 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}
            >
              bot running
            </Box>
            {' '}in minutes.
          </Typography>
          <Typography sx={{ color: '#64748b', fontSize: { xs: '1rem', md: '1.1rem' }, lineHeight: 1.75, maxWidth: 520 }}>
            4 steps to get ApplyFlow AI fully set up and applying to jobs on your behalf.
          </Typography>

          {/* Progress bar */}
          <Box sx={{ width: '100%', maxWidth: 480, mt: 1 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
              <Typography sx={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>
                Step {activeStep + 1} of {steps.length}
              </Typography>
              <Typography sx={{ color: '#16a34a', fontSize: '0.8rem', fontWeight: 700 }}>
                {Math.round(((activeStep + 1) / steps.length) * 100)}%
              </Typography>
            </Stack>
            <Box sx={{ width: '100%', height: 6, bgcolor: 'rgba(22,163,74,0.12)', borderRadius: 3, overflow: 'hidden' }}>
              <Box
                sx={{
                  height: '100%', borderRadius: 3,
                  background: 'linear-gradient(90deg, #16a34a, #22c55e)',
                  width: `${((activeStep + 1) / steps.length) * 100}%`,
                  transition: 'width 0.4s ease',
                }}
              />
            </Box>
          </Box>
        </Stack>
      </Container>

      {/* ── Main layout ── */}
      <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 4 }, pb: { xs: 4, md: 8 }, mt: { xs: 4, md: 6 } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '220px 1fr' },
            gap: { xs: 4, lg: 6 },
            alignItems: 'start',
          }}
        >
          {/* Sidebar — desktop only */}
          {!isMobile && (
            <Box sx={{ position: 'sticky', top: 80 }}>
              <Stack spacing={0.5}>
                {steps.map((step, i) => {
                  const isActive = activeStep === i
                  const isDone = i < activeStep
                  return (
                    <Box
                      key={step.id}
                      onClick={() => stepRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1.5,
                        px: 1.5, py: 1, borderRadius: '8px', cursor: 'pointer',
                        bgcolor: isActive ? `${step.color}12` : 'transparent',
                        border: `1px solid ${isActive ? `${step.color}28` : 'transparent'}`,
                        transition: 'all 0.18s ease',
                        '&:hover': { bgcolor: `${step.color}08` },
                      }}
                    >
                      <Box
                        sx={{
                          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                          display: 'grid', placeItems: 'center',
                          bgcolor: isDone ? '#16a34a' : isActive ? step.color : 'rgba(148,163,184,0.2)',
                          color: isDone || isActive ? '#fff' : '#94a3b8',
                          fontSize: '0.72rem', fontWeight: 800, transition: 'all 0.2s ease',
                        }}
                      >
                        {isDone ? <Check sx={{ fontSize: 13 }} /> : step.id}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          sx={{
                            fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                            color: isDone ? '#16a34a' : isActive ? step.color : '#94a3b8',
                          }}
                        >
                          {step.phase}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: '0.8rem', fontWeight: isActive ? 700 : 500,
                            color: isActive ? '#0f172a' : '#64748b',
                            lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}
                        >
                          {step.title}
                        </Typography>
                      </Box>
                    </Box>
                  )
                })}
              </Stack>
            </Box>
          )}

          {/* Steps */}
          <Stack spacing={{ xs: 3, md: 4 }}>
            {steps.map((step, i) => {
              const isVis = visible[i]
              return (
                <Box
                  key={step.id}
                  ref={(el: HTMLDivElement | null) => { stepRefs.current[i] = el }}
                  sx={{
                    opacity: isVis ? 1 : 0,
                    transform: isVis ? 'none' : 'translateY(32px)',
                    transition: 'opacity 0.5s ease, transform 0.5s ease',
                  }}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      borderRadius: '14px', overflow: 'hidden',
                      border: `1px solid ${activeStep === i ? step.color + '30' : 'rgba(148,163,184,0.18)'}`,
                      boxShadow: activeStep === i
                        ? `0 0 0 3px ${step.color}14, 0 20px 50px rgba(15,23,42,0.07)`
                        : '0 4px 20px rgba(15,23,42,0.04)',
                      transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
                      bgcolor: '#fff',
                    }}
                  >
                    <Box
                      sx={{
                        px: { xs: 2.5, md: 3.5 }, py: { xs: 2.5, md: 3 },
                        background: `linear-gradient(135deg, ${step.colorLight}, transparent 70%)`,
                        borderBottom: '1px solid rgba(148,163,184,0.1)',
                      }}
                    >
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Box
                          sx={{
                            width: 52, height: 52, borderRadius: '12px',
                            display: 'grid', placeItems: 'center',
                            color: step.color, bgcolor: `${step.color}14`,
                            border: `1px solid ${step.color}24`, flexShrink: 0,
                          }}
                        >
                          {step.icon}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.4 }}>
                            <StepBadge label={`Step ${step.id}`} color={step.color} />
                            <StepBadge label={step.phase} color={step.color} />
                          </Stack>
                          <Typography sx={{ color: '#0f172a', fontWeight: 800, fontSize: { xs: '1.05rem', md: '1.2rem' }, lineHeight: 1.3 }}>
                            {step.title}
                          </Typography>
                          <Typography sx={{ color: '#64748b', fontSize: '0.875rem', mt: 0.3 }}>
                            {step.subtitle}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                    <Box sx={{ px: { xs: 2.5, md: 3.5 }, py: { xs: 2.5, md: 3 } }}>
                      {step.content}
                    </Box>
                  </Paper>
                </Box>
              )
            })}

            {/* Completion card */}
            <Box
              sx={{
                opacity: visible[steps.length - 1] ? 1 : 0,
                transform: visible[steps.length - 1] ? 'none' : 'translateY(32px)',
                transition: 'opacity 0.5s ease 0.2s, transform 0.5s ease 0.2s',
              }}
            >
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 3, md: 4 }, borderRadius: '14px', textAlign: 'center',
                  background: 'linear-gradient(135deg, #14532d 0%, #16a34a 55%, #22c55e 100%)',
                  boxShadow: '0 24px 60px rgba(22,163,74,0.28)',
                }}
              >
                <Box
                  sx={{
                    width: 64, height: 64, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.2)',
                    display: 'grid', placeItems: 'center', mx: 'auto', mb: 2,
                  }}
                >
                  <RocketLaunch sx={{ color: '#fff', fontSize: 32 }} />
                </Box>
                <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: { xs: '1.4rem', md: '1.8rem' }, letterSpacing: '-0.03em', mb: 1 }}>
                  You're all set!
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.82)', lineHeight: 1.75, maxWidth: 460, mx: 'auto', mb: 3 }}>
                  The bot is installed, connected, and running. Head to the dashboard to start your
                  first run and watch applications go out automatically.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center">
                  <Button
                    variant="contained" size="large" endIcon={<ArrowForward />}
                    onClick={() => navigate('/dashboard')}
                    sx={{
                      borderRadius: '8px', fontWeight: 800, bgcolor: '#fff', color: '#16a34a',
                      '&:hover': { bgcolor: '#f0fdf4' }, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    }}
                  >
                    Go to Dashboard
                  </Button>
                  <Button
                    variant="outlined" size="large" onClick={() => navigate('/')}
                    sx={{
                      borderRadius: '8px', fontWeight: 700, borderColor: 'rgba(255,255,255,0.4)',
                      color: '#fff', '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.1)' },
                    }}
                  >
                    Back to Home
                  </Button>
                </Stack>
              </Paper>
            </Box>
          </Stack>
        </Box>
      </Container>

      {/* ── Below steps: feature cards ── */}
      <Box
        ref={belowRef}
        sx={{
          py: { xs: 6, md: 10 },
          bgcolor: 'rgba(248,252,251,0.6)',
          borderTop: '1px solid rgba(148,163,184,0.14)',
        }}
      >
        <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
          <Stack spacing={5}>
            <Stack spacing={1.5} alignItems={{ xs: 'flex-start', md: 'center' }} textAlign={{ xs: 'left', md: 'center' }}>
              <Typography
                sx={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}
              >
                Next Steps
              </Typography>
              <Typography
                variant="h2"
                sx={{
                  color: '#0f172a', fontSize: { xs: '1.8rem', md: '2.6rem' },
                  fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.05, maxWidth: 560,
                }}
              >
                Configure and control everything.
              </Typography>
              <Typography sx={{ color: '#64748b', lineHeight: 1.75, maxWidth: 480 }}>
                Once you're running, these two areas let you fine-tune the bot and stay on top of your application pipeline.
              </Typography>
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
                gap: 3,
                opacity: belowVisible ? 1 : 0,
                transform: belowVisible ? 'none' : 'translateY(24px)',
                transition: 'opacity 0.5s ease, transform 0.5s ease',
              }}
            >
              {belowFeatures.map((feat) => (
                <Paper
                  key={feat.title}
                  elevation={0}
                  sx={{
                    borderRadius: '14px', overflow: 'hidden',
                    border: '1px solid rgba(148,163,184,0.18)',
                    boxShadow: '0 4px 24px rgba(15,23,42,0.05)',
                    bgcolor: '#fff',
                  }}
                >
                  {/* Feature header */}
                  <Box
                    sx={{
                      px: { xs: 2.5, md: 3 }, py: { xs: 2.5, md: 3 },
                      background: `linear-gradient(135deg, ${feat.colorLight}, transparent 70%)`,
                      borderBottom: '1px solid rgba(148,163,184,0.1)',
                    }}
                  >
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box
                        sx={{
                          width: 48, height: 48, borderRadius: '12px',
                          display: 'grid', placeItems: 'center',
                          color: feat.color, bgcolor: `${feat.color}14`,
                          border: `1px solid ${feat.color}24`, flexShrink: 0,
                        }}
                      >
                        {feat.icon}
                      </Box>
                      <Box>
                        <Typography sx={{ color: '#0f172a', fontWeight: 800, fontSize: '1.1rem', lineHeight: 1.3 }}>
                          {feat.title}
                        </Typography>
                        <Typography sx={{ color: '#64748b', fontSize: '0.85rem', mt: 0.3 }}>
                          {feat.desc}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>

                  {/* Feature items */}
                  <Box sx={{ px: { xs: 2.5, md: 3 }, py: { xs: 2.5, md: 3 } }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 3 }}>
                      {feat.items.map((item) => (
                        <Box
                          key={item.label}
                          sx={{
                            p: 1.75, borderRadius: '8px',
                            bgcolor: `${feat.color}06`, border: `1px solid ${feat.color}18`,
                          }}
                        >
                          <Typography sx={{ color: '#0f172a', fontWeight: 700, fontSize: '0.82rem' }}>{item.label}</Typography>
                          <Typography sx={{ color: '#64748b', fontSize: '0.76rem', mt: 0.25, lineHeight: 1.4 }}>{item.desc}</Typography>
                        </Box>
                      ))}
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      endIcon={<ArrowForward sx={{ fontSize: 14 }} />}
                      onClick={() => navigate(feat.cta.path)}
                      sx={{
                        borderRadius: '7px', fontWeight: 700, textTransform: 'none',
                        borderColor: `${feat.color}50`, color: feat.color,
                        '&:hover': { borderColor: feat.color, bgcolor: `${feat.color}06` },
                      }}
                    >
                      {feat.cta.label}
                    </Button>
                  </Box>
                </Paper>
              ))}
            </Box>
          </Stack>
        </Container>
      </Box>
    </Box>
  )
}
