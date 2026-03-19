import { Navigate } from 'react-router-dom'
import { PersonalsStep } from '../onboarding/PersonalsStep'
import { QuestionsStep } from '../onboarding/QuestionsStep'
import { ResumeStep } from '../onboarding/ResumeStep'
import { SearchStep } from '../onboarding/SearchStep'
import { SecretsStep } from '../onboarding/SecretsStep'
import { SettingsStep } from '../onboarding/SettingsStep'
import { OutreachStep } from '../onboarding/OutreachStep'
import { useSettingsOutlet } from './SettingsLayout'

type Section = 'personals' | 'search' | 'questions' | 'settings' | 'resume' | 'outreach' | 'secrets'

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
      return (
        <SettingsStep
          value={ctx.settings}
          onChange={ctx.setSettings}
          aiEnabled={Boolean(ctx.secrets.use_AI)}
        />
      )
    case 'resume':
      return <ResumeStep value={ctx.resume} onChange={ctx.setResume} />
    case 'outreach':
      return <OutreachStep value={ctx.outreach} onChange={ctx.setOutreach} />
    case 'secrets':
      return <SecretsStep value={ctx.secrets} onChange={ctx.setSecrets} />
    default:
      return <Navigate to="/settings/personals" replace />
  }
}
