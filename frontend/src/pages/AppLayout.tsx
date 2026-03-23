import { Box, Drawer, IconButton, Stack, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material'
import {
  Dashboard as DashboardIcon,
  Logout,
  Menu as MenuIcon,
  RocketLaunch,
  Settings,
  Send,
  Work,
} from '@mui/icons-material'
import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

const SIDEBAR_W = 220

const navItems = [
  { key: 'dashboard', label: 'Dashboard', Icon: DashboardIcon, path: '/dashboard' },
  { key: 'jobs', label: 'Jobs', Icon: Work, path: '/jobs' },
  { key: 'outreaches', label: 'Outreaches', Icon: Send, path: '/outreaches' },
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
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [drawerOpen, setDrawerOpen] = useState(false)

  function logout() {
    localStorage.removeItem('access_token')
    navigate('/auth')
  }

  function handleNavigate(path: string) {
    navigate(path)
    setDrawerOpen(false)
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh' }}>
      {isMobile ? (
        <>
          {/* Mobile top bar */}
          <Box
            sx={{
              position: 'fixed', top: 0, left: 0, right: 0, height: 56,
              bgcolor: '#0c1410', borderBottom: '1px solid rgba(34,197,94,0.12)',
              display: 'flex', alignItems: 'center', px: 2, zIndex: 300,
              gap: 1.5,
            }}
          >
            <IconButton onClick={() => setDrawerOpen(true)} sx={{ color: '#22c55e', p: 1 }}>
              <MenuIcon />
            </IconButton>
            <RocketLaunch sx={{ color: '#22c55e', fontSize: 18 }} />
            <Typography sx={{ fontWeight: 800, color: '#f0fdf4', fontSize: '0.9rem' }}>
              ApplyFlow AI
            </Typography>
          </Box>

          {/* Mobile drawer */}
          <Drawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            PaperProps={{ sx: { width: SIDEBAR_W, bgcolor: '#0c1410', borderRight: '1px solid rgba(34,197,94,0.12)' } }}
          >
            <SidebarContent onNavigate={handleNavigate} onLogout={logout} />
          </Drawer>

          {/* Main content shifted below top bar */}
          <Box
            sx={{
              mt: '56px', flex: 1, minHeight: 'calc(100vh - 56px)',
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
