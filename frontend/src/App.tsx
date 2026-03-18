import { Navigate, Route, Routes } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage'
import { AuthPage } from './pages/AuthPage'
import { Dashboard } from './pages/Dashboard'
import { JobsDashboard } from './pages/JobsDashboard'
import { OutreachesDashboard } from './pages/OutreachesDashboard'
import { OnboardingWizard } from './pages/OnboardingWizard'
import { SettingsLayout } from './pages/settings/SettingsLayout'
import { SettingsSectionPage } from './pages/settings/SettingsSectionPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('access_token')
  if (!token) return <Navigate to="/auth" replace />
  return <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <OnboardingWizard />
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <SettingsLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="personals" replace />} />
        <Route path="personals" element={<SettingsSectionPage section="personals" />} />
        <Route path="search" element={<SettingsSectionPage section="search" />} />
        <Route path="questions" element={<SettingsSectionPage section="questions" />} />
        <Route path="settings" element={<SettingsSectionPage section="settings" />} />
        <Route path="resume" element={<SettingsSectionPage section="resume" />} />
        <Route path="outreach" element={<SettingsSectionPage section="outreach" />} />
        <Route path="secrets" element={<SettingsSectionPage section="secrets" />} />
      </Route>
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/jobs"
        element={
          <RequireAuth>
            <JobsDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/outreaches"
        element={
          <RequireAuth>
            <OutreachesDashboard />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
