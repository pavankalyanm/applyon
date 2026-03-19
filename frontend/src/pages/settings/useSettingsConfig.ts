import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api'
import type {
  ConfigResponse,
  OutreachConfig,
  PersonalsConfig,
  QuestionsConfig,
  ResumeConfig,
  SearchConfig,
  SecretsConfig,
  SettingsConfig,
} from '../onboarding/types'
import {
  defaultPersonals,
  defaultQuestions,
  defaultOutreach,
  defaultResume,
  defaultSearch,
  defaultSecrets,
  defaultSettings,
} from '../onboarding/types'

export function useSettingsConfig() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [personals, setPersonals] = useState<PersonalsConfig>(defaultPersonals)
  const [questions, setQuestions] = useState<QuestionsConfig>(defaultQuestions)
  const [search, setSearch] = useState<SearchConfig>(defaultSearch)
  const [settings, setSettings] = useState<SettingsConfig>(defaultSettings)
  const [resume, setResume] = useState<ResumeConfig>(defaultResume)
  const [outreach, setOutreach] = useState<OutreachConfig>(defaultOutreach)
  const [secrets, setSecrets] = useState<SecretsConfig>(defaultSecrets)

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

  const canSave = useMemo(() => {
    return personals.first_name.trim().length > 0 && personals.last_name.trim().length > 0
  }, [personals.first_name, personals.last_name])

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

  return {
    loading,
    saving,
    canSave,
    saveAll,
    personals,
    setPersonals,
    questions,
    setQuestions,
    search,
    setSearch,
    settings,
    setSettings,
    resume,
    setResume,
    outreach,
    setOutreach,
    secrets,
    setSecrets,
  }
}
