import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import App from './App.tsx'
import './index.css'
import './App.css'

const theme = createTheme({
  palette: {
    primary: {
      main: '#16a34a',
      light: '#22c55e',
      dark: '#15803d',
      contrastText: '#fff',
    },
    secondary: {
      main: '#064e3b',
      light: '#065f46',
      dark: '#022c22',
    },
    background: {
      default: '#f8faf9',
      paper: '#ffffff',
    },
    text: {
      primary: '#1e293b',
      secondary: '#64748b',
    },
    success: { main: '#16a34a' },
    error: { main: '#ef4444' },
    warning: { main: '#f59e0b' },
    info: { main: '#0ea5e9' },
  },
  typography: {
    fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
    h1: { fontWeight: 800, letterSpacing: '-0.025em' },
    h2: { fontWeight: 700, letterSpacing: '-0.02em' },
    h3: { fontWeight: 700, letterSpacing: '-0.015em' },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { fontWeight: 600, textTransform: 'none' },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          padding: '10px 24px',
          fontSize: '0.95rem',
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)',
          },
        },
        outlinedPrimary: {
          borderColor: '#bbf7d0',
          color: '#16a34a',
          '&:hover': {
            borderColor: '#16a34a',
            backgroundColor: '#f0fdf4',
          },
        },
        sizeLarge: {
          padding: '12px 32px',
          fontSize: '1.05rem',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
          border: '1px solid #e2e8f0',
        },
        outlined: {
          border: '1px solid #e2e8f0',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#16a34a',
              borderWidth: 2,
            },
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.95rem',
        },
      },
    },
    MuiStepIcon: {
      styleOverrides: {
        root: {
          '&.Mui-active': { color: '#16a34a' },
          '&.Mui-completed': { color: '#16a34a' },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 },
      },
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
