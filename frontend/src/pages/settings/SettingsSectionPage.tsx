import { Navigate } from 'react-router-dom'
import { PersonalsStep } from '../onboarding/PersonalsStep'
import { QuestionsStep } from '../onboarding/QuestionsStep'
import { ResumeStep } from '../onboarding/ResumeStep'
import { SearchStep } from '../onboarding/SearchStep'
import { SecretsStep } from '../onboarding/SecretsStep'
import { SettingsStep } from '../onboarding/SettingsStep'
import { useSettingsOutlet } from './SettingsLayout'

type Section = 'personals' | 'search' | 'questions' | 'settings' | 'resume' | 'secrets'

type Props = {
  section: Section
}

export function SettingsSectionPage({ section }: Props) {
  const ctx = useSettingsOutlet()

  switch (section) {
    case 'personals':
      return <PersonalsStep value={ctx.personals} onChange={ctx.setPersonals} />
    case 'search':
      return <SearchStep value={ctx.search} onChange={ctx.setSearch} />
    case 'questions':
      return <QuestionsStep value={ctx.questions} onChange={ctx.setQuestions} />
    case 'settings':
      return <SettingsStep value={ctx.settings} onChange={ctx.setSettings} />
    case 'resume':
      return <ResumeStep value={ctx.resume} onChange={ctx.setResume} />
    case 'secrets':
      return <SecretsStep value={ctx.secrets} onChange={ctx.setSecrets} />
    default:
      return <Navigate to="/settings/personals" replace />
  }
}

