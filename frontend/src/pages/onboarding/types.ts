export type PersonalsConfig = {
  first_name: string
  middle_name: string
  last_name: string
  phone_number: string
  current_city: string
  street: string
  state: string
  zipcode: string
  country: string
  ethnicity: string
  gender: string
  disability_status: string
  veteran_status: string
}

export type QuestionsConfig = {
  default_resume_path: string
  years_of_experience: string
  require_visa: string
  website: string
  linkedIn: string
  us_citizenship: string
  desired_salary: number | null
  current_ctc: number | null
  notice_period: number | null
  linkedin_headline: string
  linkedin_summary: string
  cover_letter: string
  user_information_all: string
  recent_employer: string
  confidence_level: string
  pause_before_submit: boolean
  pause_at_failed_question: boolean
  overwrite_previous_answers: boolean
}

export type SearchConfig = {
  search_terms: string[]
  search_location: string
  switch_number: number | null
  randomize_search_order: boolean
  sort_by: string
  date_posted: string
  salary: string
  easy_apply_only: boolean
  experience_level: string[]
  job_type: string[]
  on_site: string[]
  companies: string[]
  location: string[]
  industry: string[]
  job_function: string[]
  job_titles: string[]
  benefits: string[]
  commitments: string[]
  under_10_applicants: boolean
  in_your_network: boolean
  fair_chance_employer: boolean
  pause_after_filters: boolean
  about_company_bad_words: string[]
  about_company_good_words: string[]
  bad_words: string[]
  security_clearance: boolean
  did_masters: boolean
  current_experience: number | null
}

export type SettingsConfig = {
  close_tabs: boolean
  follow_companies: boolean
  run_non_stop: boolean
  alternate_sortby: boolean
  cycle_date_posted: boolean
  stop_date_cycle_at_24hr: boolean
  generated_resume_path: string
  file_name: string
  failed_file_name: string
  logs_folder_path: string
  click_gap: number | null
  run_in_background: boolean
  disable_extensions: boolean
  safe_mode: boolean
  smooth_scroll: boolean
  keep_screen_awake: boolean
  stealth_mode: boolean
  showAiErrorAlerts: boolean
}

export type ResumeConfig = {
  default_resume_path?: string
}

export type SecretsConfig = {
  username: string
  password: string
  use_AI: boolean
  ai_provider: string
  llm_api_url: string
  llm_api_key: string
  llm_model: string
  llm_spec: string
  stream_output: boolean
}

export type ConfigResponse = {
  id: number
  personals?: Partial<PersonalsConfig> | null
  questions?: Partial<QuestionsConfig> | null
  search?: Partial<SearchConfig> | null
  settings?: Partial<SettingsConfig & { secrets?: SecretsConfig }> | null
  resume?: Partial<ResumeConfig> | null
}

export const defaultPersonals: PersonalsConfig = {
  first_name: '',
  middle_name: '',
  last_name: '',
  phone_number: '',
  current_city: '',
  street: '',
  state: '',
  zipcode: '',
  country: '',
  ethnicity: '',
  gender: '',
  disability_status: '',
  veteran_status: '',
}

export const defaultQuestions: QuestionsConfig = {
  default_resume_path: 'modules/resumes/default/resume.pdf',
  years_of_experience: '',
  require_visa: '',
  website: '',
  linkedIn: '',
  us_citizenship: '',
  desired_salary: null,
  current_ctc: null,
  notice_period: null,
  linkedin_headline: '',
  linkedin_summary: '',
  cover_letter: '',
  user_information_all: '',
  recent_employer: '',
  confidence_level: '',
  pause_before_submit: true,
  pause_at_failed_question: true,
  overwrite_previous_answers: false,
}

export const defaultSearch: SearchConfig = {
  search_terms: [],
  search_location: '',
  switch_number: null,
  randomize_search_order: false,
  sort_by: '',
  date_posted: '',
  salary: '',
  easy_apply_only: true,
  experience_level: [],
  job_type: [],
  on_site: [],
  companies: [],
  location: [],
  industry: [],
  job_function: [],
  job_titles: [],
  benefits: [],
  commitments: [],
  under_10_applicants: false,
  in_your_network: false,
  fair_chance_employer: false,
  pause_after_filters: true,
  about_company_bad_words: [],
  about_company_good_words: [],
  bad_words: [],
  security_clearance: false,
  did_masters: false,
  current_experience: null,
}

export const defaultSettings: SettingsConfig = {
  close_tabs: false,
  follow_companies: false,
  run_non_stop: false,
  alternate_sortby: true,
  cycle_date_posted: true,
  stop_date_cycle_at_24hr: true,
  generated_resume_path: 'all resumes/',
  file_name: 'all excels/all_applied_applications_history.csv',
  failed_file_name: 'all excels/all_failed_applications_history.csv',
  logs_folder_path: 'logs/',
  click_gap: 1,
  run_in_background: false,
  disable_extensions: false,
  safe_mode: true,
  smooth_scroll: false,
  keep_screen_awake: true,
  stealth_mode: true,
  showAiErrorAlerts: false,
}

export const defaultResume: ResumeConfig = {
  default_resume_path: 'modules/resumes/default/resume.pdf',
}

export const defaultSecrets: SecretsConfig = {
  username: '',
  password: '',
  use_AI: false,
  ai_provider: 'openai',
  llm_api_url: 'https://api.openai.com/v1/',
  llm_api_key: '',
  llm_model: 'gpt-4o-mini',
  llm_spec: 'openai',
  stream_output: false,
}

export function parseNumber(value: string): number | null {
  if (!value.trim()) return null
  const n = Number(value)
  return Number.isNaN(n) ? null : n
}

export function multilineToList(value: string): string[] {
  return value
    .split('\n')
    .map((v) => v.trim())
    .filter(Boolean)
}

export function listToMultiline(list: string[]): string {
  return list.join('\n')
}

