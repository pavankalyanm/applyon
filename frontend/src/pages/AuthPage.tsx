import {
  Alert,
  Box,
  Button,
  Container,
  IconButton,
  InputAdornment,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import {
  Visibility,
  VisibilityOff,
  RocketLaunch,
  ArrowBack,
} from '@mui/icons-material'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

type Mode = 'signup' | 'login'

export function AuthPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isSignup = mode === 'signup'
  const canSubmit = useMemo(
    () => email.trim() && password.trim() && (!isSignup || name.trim()),
    [email, password, isSignup, name],
  )

  async function submit() {
    setError(null)
    setLoading(true)
    try {
      if (isSignup) {
        const resp = await api.post('/auth/signup', { email, password, name })
        localStorage.setItem('access_token', resp.data.access_token)
        navigate('/onboarding')
      } else {
        const resp = await api.post('/auth/login', { email, password })
        localStorage.setItem('access_token', resp.data.access_token)
        navigate('/dashboard')
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #f0fdf4 0%, #ffffff 50%, #ecfdf5 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative blobs */}
      <Box
        sx={{
          position: 'absolute',
          top: -100,
          left: -100,
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(22,163,74,0.07) 0%, transparent 70%)',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: -60,
          right: -60,
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(34,197,94,0.05) 0%, transparent 70%)',
        }}
      />

      <Container maxWidth="xs" sx={{ position: 'relative', zIndex: 1 }}>
        <Stack spacing={4} className="fade-in">
          {/* Logo / Back */}
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton onClick={() => navigate('/')} size="small" sx={{ color: '#64748b' }}>
              <ArrowBack fontSize="small" />
            </IconButton>
            <RocketLaunch sx={{ color: '#16a34a', fontSize: 26 }} />
            <Typography sx={{ fontWeight: 800, color: '#14532d', fontSize: '1.1rem' }}>
              AutoApply
            </Typography>
          </Stack>

          {/* Card */}
          <Box
            sx={{
              bgcolor: '#fff',
              borderRadius: '5px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
              p: { xs: 3, sm: 4 },
            }}
          >
            <Stack spacing={3}>
              <Box>
                <Typography variant="h4" sx={{ mb: 0.5 }}>
                  {isSignup ? 'Create your account' : 'Welcome back'}
                </Typography>
                <Typography color="text.secondary" fontSize="0.95rem">
                  {isSignup
                    ? 'Start automating your job applications today.'
                    : 'Sign in to access your dashboard.'}
                </Typography>
              </Box>

              <Tabs
                value={mode}
                onChange={(_, v) => {
                  setMode(v)
                  setError(null)
                }}
                variant="fullWidth"
                sx={{
                  bgcolor: '#f1f5f9',
                  borderRadius: '5px',
                  p: 0.5,
                  minHeight: 44,
                  '& .MuiTab-root': {
                    minHeight: 38,
                    borderRadius: '5px',
                    zIndex: 1,
                  },
                  '& .Mui-selected': {
                    bgcolor: '#fff',
                    color: '#16a34a !important',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  },
                  '& .MuiTabs-indicator': { display: 'none' },
                }}
              >
                <Tab value="signup" label="Sign up" />
                <Tab value="login" label="Login" />
              </Tabs>

              {error && <Alert severity="error">{error}</Alert>}

              <Stack spacing={2}>
                {isSignup && (
                  <TextField
                    label="Full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    fullWidth
                    autoFocus
                  />
                )}
                <TextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  fullWidth
                  autoFocus={!isSignup}
                />
                <TextField
                  label="Password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  fullWidth
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setShowPw(!showPw)} edge="end">
                            {showPw ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <Button
                  disabled={!canSubmit || loading}
                  variant="contained"
                  size="large"
                  onClick={submit}
                  fullWidth
                  sx={{ mt: 1 }}
                >
                  {loading ? 'Please wait...' : isSignup ? 'Create account' : 'Sign in'}
                </Button>
              </Stack>
            </Stack>
          </Box>

          <Typography sx={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
            By continuing, you agree to our Terms of Service.
          </Typography>
        </Stack>
      </Container>
    </Box>
  )
}
