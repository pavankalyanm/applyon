import {
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import {
  Dashboard as DashboardIcon,
  Logout,
  RocketLaunch,
  Settings,
  Send,
  Work,
} from '@mui/icons-material'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

const SIDEBAR_W = 220
const BOTTOM_NAV_H = 60

const navItems = [
  { key: 'dashboard', label: 'Dashboard', Icon: DashboardIcon, path: '/dashboard' },
  { key: 'jobs', label: 'Jobs', Icon: Work, path: '/jobs' },
  { key: 'outreaches', label: 'Outreach', Icon: Send, path: '/outreaches' },
  { key: 'settings', label: 'Settings', Icon: Settings, path: '/settings' },
]

function SidebarContent({ onNavigate, onLogout }: { onNavigate: (path: string) => void; onLogout: () => void }) {
  const location = useLocation()
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#0c1410' }}>
      {/* Logo */}
      <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid rgba(34,197,94,0.1)' }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <RocketLaunch sx={{ color: '#22c55e', fontSize: 20 }} />
          <Typography sx={{ fontWeight: 800, color: '#f0fdf4', fontSize: '0.92rem', letterSpacing: '-0.01em' }}>
            ApplyFlow AI
          </Typography>
        </Stack>
      </Box>

      {/* Section label */}
      <Box sx={{ px: 3, pt: 3, pb: 0.5 }}>
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#3a6a4a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Navigation
        </Typography>
      </Box>

      {/* Nav items */}
      <Box sx={{ flex: 1, px: 1.5, py: 1 }}>
        {navItems.map(({ key, label, Icon, path }) => {
          const active = location.pathname.startsWith(path)
          return (
            <Tooltip key={key} title="" placement="right">
              <Box
                onClick={() => onNavigate(path)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  px: 2, py: 1.25, mb: 0.5, cursor: 'pointer',
                  bgcolor: active ? 'rgba(34,197,94,0.1)' : 'transparent',
                  borderLeft: `2px solid ${active ? '#22c55e' : 'transparent'}`,
                  color: active ? '#22c55e' : '#5a8a6a',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', color: '#d1fae5' },
                  transition: 'all 0.12s ease',
                }}
              >
                <Icon sx={{ fontSize: 17 }} />
                <Typography sx={{ fontSize: '0.86rem', fontWeight: active ? 600 : 400, color: 'inherit' }}>
                  {label}
                </Typography>
              </Box>
            </Tooltip>
          )
        })}
      </Box>

      {/* Logout */}
      <Box sx={{ px: 1.5, py: 2, borderTop: '1px solid rgba(34,197,94,0.08)' }}>
        <Box
          onClick={onLogout}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            px: 2, py: 1.25, cursor: 'pointer', color: '#3a6a4a',
            '&:hover': { color: '#ef4444', bgcolor: 'rgba(239,68,68,0.05)' },
            transition: 'all 0.12s ease',
          }}
        >
          <Logout sx={{ fontSize: 17 }} />
          <Typography sx={{ fontSize: '0.86rem', fontWeight: 400, color: 'inherit' }}>Logout</Typography>
        </Box>
      </Box>
    </Box>
  )
}

export function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  function logout() {
    localStorage.removeItem('access_token')
    navigate('/auth')
  }

  // Derive active tab value from current path
  const activeTab = navItems.find((item) => location.pathname.startsWith(item.path))?.path ?? false

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh' }}>
      {isMobile ? (
        <>
          {/* ── Mobile: minimal top bar (branding only) ── */}
          <Box
            sx={{
              position: 'fixed', top: 0, left: 0, right: 0, height: 48,
              bgcolor: '#0c1410', borderBottom: '1px solid rgba(34,197,94,0.12)',
              display: 'flex', alignItems: 'center', px: 2, zIndex: 300, gap: 1.25,
            }}
          >
            <RocketLaunch sx={{ color: '#22c55e', fontSize: 17 }} />
            <Typography sx={{ fontWeight: 800, color: '#f0fdf4', fontSize: '0.88rem', letterSpacing: '-0.01em' }}>
              ApplyFlow AI
            </Typography>
          </Box>

          {/* ── Mobile: main content between top bar and bottom nav ── */}
          <Box
            sx={{
              mt: '48px',
              pb: `${BOTTOM_NAV_H}px`,
              flex: 1,
              minHeight: `calc(100dvh - 48px - ${BOTTOM_NAV_H}px)`,
              bgcolor: '#f7faf8',
              backgroundImage: `
                linear-gradient(rgba(22,163,74,0.045) 1px, transparent 1px),
                linear-gradient(90deg, rgba(22,163,74,0.045) 1px, transparent 1px)
              `,
              backgroundSize: '48px 48px',
              width: '100%',
            }}
          >
            <Outlet />
          </Box>

          {/* ── Mobile: bottom navigation ── */}
          <Paper
            elevation={0}
            sx={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              zIndex: 300,
              borderTop: '1px solid rgba(34,197,94,0.15)',
              bgcolor: '#0c1410',
            }}
          >
            <BottomNavigation
              value={activeTab}
              onChange={(_, path) => {
                if (path === 'logout') { logout(); return }
                navigate(path)
              }}
              sx={{
                height: BOTTOM_NAV_H,
                bgcolor: 'transparent',
                '& .MuiBottomNavigationAction-root': {
                  color: '#4a7a5a',
                  minWidth: 0,
                  px: 0.5,
                  gap: 0.4,
                  '&.Mui-selected': { color: '#22c55e' },
                },
                '& .MuiBottomNavigationAction-label': {
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  '&.Mui-selected': { fontSize: '0.65rem' },
                },
              }}
            >
              {navItems.map(({ label, Icon, path }) => (
                <BottomNavigationAction
                  key={path}
                  label={label}
                  value={path}
                  icon={<Icon sx={{ fontSize: 22 }} />}
                  showLabel
                />
              ))}
              <BottomNavigationAction
                label="Logout"
                value="logout"
                icon={<Logout sx={{ fontSize: 22 }} />}
                showLabel
                sx={{ '&.Mui-selected': { color: '#ef4444 !important' }, color: '#4a7a5a' }}
              />
            </BottomNavigation>
          </Paper>
        </>
      ) : (
        <>
          {/* ── Desktop Sidebar ── */}
          <Box
            sx={{
              width: SIDEBAR_W, flexShrink: 0,
              borderRight: '1px solid rgba(34,197,94,0.12)',
              position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 200,
            }}
          >
            <SidebarContent onNavigate={navigate} onLogout={logout} />
          </Box>

          {/* ── Desktop Main content ── */}
          <Box
            sx={{
              ml: `${SIDEBAR_W}px`, flex: 1, minHeight: '100vh',
              bgcolor: '#f7faf8',
              backgroundImage: `
                linear-gradient(rgba(22,163,74,0.045) 1px, transparent 1px),
                linear-gradient(90deg, rgba(22,163,74,0.045) 1px, transparent 1px)
              `,
              backgroundSize: '48px 48px',
            }}
          >
            <Outlet />
          </Box>
        </>
      )}
    </Box>
  )
}
