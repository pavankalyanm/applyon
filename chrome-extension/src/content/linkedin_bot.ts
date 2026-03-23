/**
 * ApplyFlow AI LinkedIn Bot — content script injected into a LinkedIn jobs tab.
 * Context is delivered via chrome.storage.local (primary) or a START_BOT message
 * (backup), so it works on all Chrome versions without session storage limitations.
 */

interface BotContext {
  runId: number
  config: Record<string, unknown>
  token: string
  backendUrl: string
}

interface JobRecord {
  title: string
  company: string
  location: string
  url: string
  status: 'applied' | 'skipped' | 'error'
}

// ─── Context validity guard ─────────────────────────────────────────────────
function isCtxValid(): boolean {
  try { return !!chrome.runtime?.id } catch { return false }
}

// ─── Globals ────────────────────────────────────────────────────────────────
let ctx: BotContext | null = null
let stopFlag = false
let appliedCount = 0
let jobCounter = 0
let maxJobsForRun = 10
let botStarted = false

// Receives START_BOT from service worker (backup path if storage read races)
let resolveStartBot: ((c: BotContext) => void) | null = null

try {
  chrome.runtime.onMessage.addListener((msg: { type: string; context?: BotContext }) => {
    if (msg.type === 'STOP_BOT') {
      stopFlag = true
      log('Stop signal received — finishing current job and halting.')
    } else if (msg.type === 'START_BOT' && msg.context && !botStarted) {
      resolveStartBot?.(msg.context)
    }
  })
} catch { /* context already invalid at inject time */ }

// ─── Wait for context from either storage or direct message ─────────────────
async function waitForBotContext(): Promise<BotContext | null> {
  // Path 1: chrome.storage.local (primary — works in all Chrome versions)
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await sleep(500)
      if (!isCtxValid()) return null
      const stored = await chrome.storage.local.get('applyflowai_bot_context')
      const c = stored.applyflowai_bot_context as BotContext | null
      if (c) {
        // One-use: clear so re-navigations don't re-trigger the bot
        chrome.storage.local.remove('applyflowai_bot_context').catch(() => {})
        return c
      }
    }
  } catch { /* fall through to message path */ }

  // Path 2: wait up to 5 s for a START_BOT message from the service worker
  return new Promise<BotContext | null>((resolve) => {
    resolveStartBot = resolve
    setTimeout(() => resolve(null), 5000)
  })
}

// ─── Entry point ────────────────────────────────────────────────────────────
;(async () => {
  if (!isCtxValid()) return

  const context = await waitForBotContext()
  if (!context || botStarted) return  // not a bot-initiated tab
  botStarted = true

  ctx = context
  const search = (ctx.config.search ?? {}) as Record<string, unknown>
  const settings = (ctx.config.settings ?? {}) as Record<string, unknown>
  const maxApply = Number(settings.max_jobs_per_run ?? 10)
  maxJobsForRun = maxApply

  const rawTerms = search.search_terms
  const termsList: string[] = Array.isArray(rawTerms) ? rawTerms.filter(Boolean) : rawTerms ? [String(rawTerms)] : []
  const searchLocation = String(search.search_location || '')

  log(`Bot started — looking for Easy Apply jobs (max ${maxApply})`)
  log(`Search terms: ${termsList.join(', ') || '(none)'} | Location: ${searchLocation || 'any'}`)

  // Wait for LinkedIn to finish loading
  await waitFor(() => !!document.querySelector('.jobs-search-results-list, .scaffold-layout__list'), 10000)
  await sleep(1500)

  await runApplyLoop(maxApply)

  log(`Bot finished — applied to ${appliedCount} jobs`)
  if (isCtxValid()) {
    try { chrome.runtime.sendMessage({ type: 'BOT_FINISHED', success: true }) } catch { /* context gone */ }
  }
})()

// ─── Main loop ────────────────────────────────────────────────────────────────
async function runApplyLoop(maxApply: number) {
  let page = 0
  while (appliedCount < maxApply && !stopFlag) {
    // Wait for job list items (main bot waits for li[data-occludable-job-id])
    await waitFor(() => !!document.querySelector('li[data-occludable-job-id]'), 8000)
    await sleep(1000)

    const jobs = collectJobCards()
    if (jobs.length === 0) { log('No job cards found on this page'); break }

    log(`Page ${page + 1}: found ${jobs.length} job cards`)
    emitJobEvent({ status: 'scanning', detail: `Page ${page + 1} — found ${jobs.length} jobs` })

    for (const card of jobs) {
      if (stopFlag || appliedCount >= maxApply) break
      await processJobCard(card)
      await sleep(1000 + Math.random() * 800)
    }

    const moved = await goToNextPage()
    if (!moved) break
    page++
    await sleep(3000)
  }
}

// Main bot uses li[data-occludable-job-id] — the most reliable selector
function collectJobCards(): HTMLElement[] {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('li[data-occludable-job-id]'))
  return cards.filter(c => c.offsetParent !== null) // visible only
}

async function processJobCard(card: HTMLElement) {
  // Check if already applied (footer badge says "Applied")
  const footerState = card.querySelector<HTMLElement>('.job-card-container__footer-job-state')
  if (footerState?.innerText?.trim() === 'Applied') return

  // Main bot: click first <a> tag with visible text; title = a.innerText up to first newline
  // (Selenium .text = visible text only, equivalent to JS innerText — textContent includes hidden nodes)
  const links = Array.from(card.querySelectorAll<HTMLElement>('a'))
  const link = links.find(a => a.innerText?.trim().length > 2 && a.offsetParent !== null) ?? links[0]
  if (!link) return

  const title = (link.innerText?.split('\n')[0] ?? '').trim() || 'Unknown Role'

  const companyEl = card.querySelector<HTMLElement>(
    '.job-card-container__primary-description, .artdeco-entity-lockup__subtitle',
  )
  const company = companyEl?.innerText?.trim() ?? 'Unknown Company'

  const locationEl = card.querySelector<HTMLElement>(
    '.job-card-container__metadata-item, .artdeco-entity-lockup__caption, ' +
    '.job-card-container__metadata-wrapper li',
  )
  const location = locationEl?.innerText?.trim() ?? ''

  jobCounter++
  const jobNum = jobCounter
  emitJobEvent({ jobNum, title, company, status: 'clicking' })
  log(`Checking: ${title} @ ${company}`)

  link.click()
  await sleep(1500)

  // Wait for the detail panel to fully load
  await waitFor(() => !!document.querySelector(
    '.job-details-jobs-unified-top-card__primary-description-container, ' +
    '.jobs-details__main-content, .jobs-unified-top-card__primary-description'
  ), 5000)

  // Skip if already applied (redundant check on detail panel)
  if (document.querySelector('.jobs-s-apply__application-link')) {
    emitJobEvent({ jobNum, title, company, status: 'skipped', detail: 'Already applied' })
    log(`Skipped: ${title} @ ${company} (already applied)`)
    return
  }

  const applyBtn = await findEasyApplyButton()
  if (!applyBtn) {
    emitJobEvent({ jobNum, title, company, status: 'skipped', detail: 'No Easy Apply' })
    log(`Skipped: ${title} @ ${company} (no Easy Apply)`)
    return
  }

  emitJobEvent({ jobNum, title, company, status: 'applying' })
  log(`Applying: ${title} @ ${company}`)
  applyBtn.click()
  await sleep(1500)

  const success = await handleApplicationModal(jobNum)
  if (success) {
    appliedCount++
    emitJobEvent({ jobNum, title, company, status: 'applied' })
    log(`Applied (${appliedCount}): ${title} @ ${company}`)
    await reportJob({ title, company, location, url: window.location.href, status: 'applied' })
  } else {
    emitJobEvent({ jobNum, title, company, status: 'error' })
    log(`Error applying to: ${title} @ ${company}`)
    discardApplication()
    await sleep(1000)
  }
}

// Match main bot's 3-way Easy Apply detection exactly
async function findEasyApplyButton(): Promise<HTMLElement | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(600)

    // 1. Old + new UI: button with class jobs-apply-button (artdeco-button--3) + aria-label
    let btn = document.querySelector<HTMLElement>(
      'button.jobs-apply-button[aria-label*="Easy"], ' +
      'button.jobs-apply-button[aria-label*="LinkedIn Apply"]'
    )
    if (btn && btn.offsetParent !== null) return btn

    // 2. New SPA-style: anchor with openSDUIApplyFlow + aria-label
    btn = document.querySelector<HTMLElement>(
      'a[aria-label*="LinkedIn Apply"][href*="openSDUIApplyFlow"]'
    )
    if (btn && btn.offsetParent !== null) return btn

    // 3. Fallback anchor with /apply/ path
    btn = document.querySelector<HTMLElement>(
      'a[href*="/apply/"][href*="openSDUIApplyFlow"]'
    )
    if (btn && btn.offsetParent !== null) return btn

    // 4. Broader fallback: any visible jobs-apply-button
    btn = document.querySelector<HTMLElement>('button.jobs-apply-button:not([disabled])')
    if (btn && btn.offsetParent !== null) {
      // Only return if it's not an external apply button
      const label = (btn.getAttribute('aria-label') ?? '').toLowerCase()
      if (!label.includes('external') && !label.includes('company site')) return btn
    }
  }
  return null
}

// ─── Application modal ────────────────────────────────────────────────────────
async function handleApplicationModal(jobNum: number): Promise<boolean> {
  // Main bot: find_by_class(driver, "jobs-easy-apply-modal") — exact class only
  const modal = await waitFor(
    () => document.querySelector<HTMLElement>('.jobs-easy-apply-modal'),
    6000,
  )
  if (!modal) { log('Modal did not open'); return false }

  await sleep(500)

  // Main bot clicks "Next" once right after modal opens to load first form page
  const initialNext = spanButton(modal, 'Next')
  if (initialNext) { initialNext.click(); await sleep(1200) }

  const maxSteps = 15
  let step = 0

  while (step < maxSteps && !stopFlag) {
    await sleep(900)
    emitJobEvent({ jobNum, status: 'filling', detail: `Step ${step + 1}` })
    await fillFormFields(modal)
    await sleep(600)

    // Check for visible inline errors before advancing
    const err = modal.querySelector<HTMLElement>('.artdeco-inline-feedback--error')
    if (err && err.offsetParent !== null && err.textContent?.trim()) {
      log(`Form validation error: ${err.textContent.trim()}`)
      return false
    }

    // Navigate: Submit application > Review > Next (matches main bot priority)
    const submitBtn = spanButton(modal, 'Submit application')
    if (submitBtn && !submitBtn.disabled) {
      emitJobEvent({ jobNum, status: 'submitting' })
      submitBtn.click()
      await sleep(2500)
      // Click "Done" confirmation
      const doneBtn = spanButton(document.body, 'Done') ??
        document.querySelector<HTMLButtonElement>('[data-test-modal-close-btn]')
      doneBtn?.click()
      return true
    }

    const reviewBtn = spanButton(modal, 'Review')
    if (reviewBtn && !reviewBtn.disabled) {
      reviewBtn.click()
      await sleep(1200)
      // After Review, the Submit button appears — handle it next iteration
      step++
      continue
    }

    const nextBtn = spanButton(modal, 'Next') ??
      modal.querySelector<HTMLButtonElement>('button[data-easy-apply-next-button]')
    if (nextBtn && !nextBtn.disabled) {
      nextBtn.click()
      step++
      continue
    }

    // No navigation found — something unexpected
    log('No navigation button found in modal')
    return false
  }

  return false
}

/** Find a <button> whose direct <span> child has exact trimmed text */
function spanButton(container: HTMLElement | Document, text: string): HTMLButtonElement | null {
  for (const btn of Array.from(container.querySelectorAll<HTMLButtonElement>('button'))) {
    for (const span of Array.from(btn.querySelectorAll('span'))) {
      if (span.textContent?.trim() === text) return btn
    }
  }
  return null
}

/** Discard a failed/partial application to keep LinkedIn in a clean state */
function discardApplication() {
  // Click the modal dismiss/close button
  const dismissBtn = document.querySelector<HTMLElement>(
    '[aria-label="Dismiss"], .artdeco-modal__dismiss, [data-test-modal-close-btn]'
  )
  dismissBtn?.click()
  // After ~600ms LinkedIn usually shows a "Discard application?" dialog
  setTimeout(() => {
    const discardBtn = spanButton(document.body, 'Discard') ??
      spanButton(document.body, 'Discard application')
    discardBtn?.click()
  }, 600)
}

// ─── Form filling — mirrors main bot's answer_questions() ────────────────────
async function fillFormFields(modal: HTMLElement) {
  if (!ctx) return
  const personals = (ctx.config.personals ?? {}) as Record<string, unknown>
  const questionsConfig = (ctx.config.questions ?? {}) as Record<string, string>

  // Main bot iterates div[data-test-form-element] containers
  const formElements = Array.from(
    modal.querySelectorAll<HTMLElement>('div[data-test-form-element]')
  )

  for (const el of formElements) {
    // ── Select ──────────────────────────────────────────────────────────────
    const sel = el.querySelector<HTMLSelectElement>('select')
    if (sel) {
      if (sel.selectedIndex > 0 && sel.value !== '') continue
      const labelText = getFormLabel(el)
      const answer = resolveAnswer(labelText, personals, questionsConfig, 'select')
      if (answer) {
        selectByText(sel, answer)
      } else if (sel.options.length > 1) {
        sel.selectedIndex = 1
        sel.dispatchEvent(new Event('change', { bubbles: true }))
      }
      continue
    }

    // ── Radio (fieldset[data-test-form-builder-radio-button-form-component]) ─
    const fieldset = el.querySelector<HTMLElement>(
      'fieldset[data-test-form-builder-radio-button-form-component]'
    )
    if (fieldset) {
      const radios = Array.from(fieldset.querySelectorAll<HTMLInputElement>('input[type="radio"]'))
      if (radios.some(r => r.checked)) continue
      const titleSpan = fieldset.querySelector<HTMLElement>(
        'span[data-test-form-builder-radio-button-form-component__title] .visually-hidden, ' +
        'span[data-test-form-builder-radio-button-form-component__title]'
      )
      const labelText = titleSpan?.textContent?.trim() ?? ''
      const answer = resolveAnswer(labelText, personals, questionsConfig, 'radio')
      const target = pickRadio(fieldset, radios, answer)
      if (target) {
        const lbl = fieldset.querySelector<HTMLElement>(`label[for="${target.id}"]`)
        ;(lbl ?? target).click()
      }
      continue
    }

    // ── Text / Number input ──────────────────────────────────────────────────
    const textInput = el.querySelector<HTMLInputElement>('input[type="text"], input[type="number"]')
    if (textInput && !textInput.disabled) {
      if (textInput.value.trim()) continue
      const labelText = getFormLabel(el)
      const answer = resolveAnswer(labelText, personals, questionsConfig, 'text')
      if (answer) setReactValue(textInput, answer)
      continue
    }

    // ── Textarea (cover letter / summary) ────────────────────────────────────
    const ta = el.querySelector<HTMLTextAreaElement>('textarea')
    if (ta && !ta.disabled) {
      if (ta.value.trim()) continue
      const labelText = getFormLabel(el)
      const answer = resolveAnswer(labelText, personals, questionsConfig, 'textarea')
      if (answer) setReactValue(ta, answer)
    }
  }
}

/** Get visible label text for a form element container */
function getFormLabel(container: HTMLElement): string {
  // Try .visually-hidden first (main bot's preferred approach)
  const hidden = container.querySelector<HTMLElement>('label .visually-hidden, legend .visually-hidden')
  if (hidden?.textContent?.trim()) return hidden.textContent.trim()
  // Fallback: label or legend text
  const label = container.querySelector<HTMLElement>('label, legend')
  return label?.textContent?.trim() ?? ''
}

/** Pick a radio button matching the desired answer text */
function pickRadio(fieldset: HTMLElement, radios: HTMLInputElement[], answer: string): HTMLInputElement | null {
  if (!answer) return radios[0] ?? null
  const aLow = answer.toLowerCase()
  // Try matching label text
  for (const r of radios) {
    const lbl = fieldset.querySelector<HTMLElement>(`label[for="${r.id}"]`)
    if (lbl?.textContent?.toLowerCase().includes(aLow)) return r
  }
  // Try matching value
  return radios.find(r => r.value.toLowerCase().includes(aLow)) ?? radios[0] ?? null
}

function resolveAnswer(
  label: string,
  personals: Record<string, unknown>,
  questionsConfig: Record<string, string>,
  fieldType: string,
): string {
  const lbl = label.toLowerCase()

  // Pre-configured Q&A from user settings (main bot's questions_list)
  for (const [q, a] of Object.entries(questionsConfig)) {
    if (q && lbl.includes(q.toLowerCase().slice(0, 30))) return a
  }

  // Defaults matching main bot's answer_common_questions()
  if (lbl.includes('experience') || lbl.includes('years')) return String(personals.years_of_experience ?? '3')
  if (lbl.includes('phone') || lbl.includes('mobile')) return String(personals.phone_number ?? personals.phone ?? '')
  if (lbl.includes('linkedin')) return String(personals.linkedin_url ?? '')
  if (lbl.includes('website') || lbl.includes('portfolio') || lbl.includes('github')) return String(personals.website ?? '')
  if (lbl.includes('street')) return String(personals.street ?? '')
  if (lbl.includes('city') || lbl.includes('location') || lbl.includes('address')) return String(personals.current_city ?? personals.city ?? '')
  if (lbl.includes('state')) return String(personals.state ?? '')
  if (lbl.includes('country')) return String(personals.country ?? 'United States')
  if (lbl.includes('zip') || lbl.includes('postal')) return String(personals.zip ?? '')
  if (lbl.includes('first name')) return String(personals.first_name ?? '')
  if (lbl.includes('last name') || lbl.includes('surname')) return String(personals.last_name ?? '')
  if (lbl.includes('full name') || lbl.includes('your name') || lbl.includes('signature')) {
    return `${personals.first_name ?? ''} ${personals.last_name ?? ''}`.trim()
  }
  if (lbl.includes('name') && !lbl.includes('company')) return String(personals.first_name ?? '')
  if (lbl.includes('email')) return String(personals.email ?? '')
  if (lbl.includes('salary') || lbl.includes('compensation') || lbl.includes('expected')) return String(personals.salary_expectations ?? personals.expected_salary ?? '100000')
  if (lbl.includes('notice') || lbl.includes('availability') || lbl.includes('start')) return String(personals.notice_period ?? '2 weeks')
  if (lbl.includes('gender') || lbl.includes('sex')) return String(personals.gender ?? 'Decline')
  if (lbl.includes('disability')) return String(personals.disability_status ?? 'Decline')
  if (lbl.includes('veteran') || lbl.includes('protected')) return String(personals.veteran_status ?? 'I am not a protected veteran')

  if (fieldType === 'radio') {
    if (lbl.includes('authorized') || lbl.includes('eligible') || lbl.includes('citizen')) return 'Yes'
    if (lbl.includes('require sponsor') || lbl.includes('visa')) return 'No'
    if (lbl.includes('us resident') || lbl.includes('permanent resident')) return 'Yes'
    return 'Yes'
  }

  if (fieldType === 'select') {
    if (lbl.includes('proficiency') || lbl.includes('language')) return 'Professional'
    return ''
  }

  if (fieldType === 'textarea') {
    if (lbl.includes('cover') || lbl.includes('why') || lbl.includes('summary')) {
      return 'I am excited about this opportunity and confident that my skills and experience make me a strong fit for this role. I look forward to contributing to your team.'
    }
    return ''
  }

  return ''
}

/** Set value in a React-controlled input without losing React's state */
function setReactValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

/** Select <option> by matching visible text (partial, case-insensitive) */
function selectByText(sel: HTMLSelectElement, value: string) {
  const lv = value.toLowerCase()
  const phrases = [lv, 'yes', 'agree', 'i do', 'prefer not', 'decline']
  // Try exact then partial
  for (const phrase of (lv === value.toLowerCase() ? [lv] : phrases)) {
    const opt = Array.from(sel.options).find(
      o => o.text.toLowerCase().includes(phrase) || o.value.toLowerCase().includes(phrase)
    )
    if (opt) {
      sel.value = opt.value
      sel.dispatchEvent(new Event('change', { bubbles: true }))
      return
    }
  }
  // Last resort: pick first non-empty option
  if (sel.options.length > 1) {
    sel.selectedIndex = 1
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  }
}

// ─── Pagination — matches main bot's artdeco-pagination ──────────────────────
async function goToNextPage(): Promise<boolean> {
  const pagination = document.querySelector<HTMLElement>(
    '.jobs-search-pagination__pages, .artdeco-pagination, .artdeco-pagination__pages'
  )
  if (!pagination) return false

  const activeBtn = pagination.querySelector<HTMLButtonElement>('button.active, button[aria-current="true"]')
  if (!activeBtn) return false

  // Find the button that comes after the active one
  const buttons = Array.from(pagination.querySelectorAll<HTMLButtonElement>('button[aria-label]'))
  const activeIdx = buttons.indexOf(activeBtn)
  const nextBtn = buttons[activeIdx + 1]
  if (!nextBtn || nextBtn.disabled) return false

  nextBtn.click()
  await sleep(3000)
  return true
}

// ─── Report job to backend ────────────────────────────────────────────────────
// Jobs are persisted via the agent WebSocket: the service worker sends a
// `log` message whose line starts with "EVENT:" — the backend's agent_ws
// handler parses it through bot_runner._persist_job_event().
async function reportJob(job: JobRecord) {
  if (!ctx || !isCtxValid()) return
  try {
    const eventKind = job.status === 'applied' ? 'job_applied' : 'job_failed'
    const eventPayload = {
      event: eventKind,
      title: job.title,
      company: job.company,
      location: job.location || undefined,
      application_provider: 'linkedin_easy_apply',
      application_link: job.status === 'applied' ? 'Easy Applied' : undefined,
      job_link: job.url,
    }
    chrome.runtime.sendMessage({
      type: 'BOT_LOG',
      line: `EVENT:${JSON.stringify(eventPayload)}`,
    })
  } catch {
    // Non-fatal
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function log(line: string) {
  const ts = new Date().toISOString().slice(11, 19)
  const msg = `[${ts}] ${line}`
  console.log('[ApplyFlow AI Bot]', msg)
  if (!isCtxValid()) return
  try { chrome.runtime.sendMessage({ type: 'BOT_LOG', line: msg }) } catch { /* context gone */ }
}

function emitJobEvent(ev: Record<string, unknown>) {
  if (!isCtxValid()) return
  try {
    chrome.runtime.sendMessage({
      type: 'JOB_EVENT',
      appliedCount,
      maxJobs: maxJobsForRun,
      ...ev,
    })
  } catch { /* context gone */ }
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms))
}

function waitFor<T>(
  check: () => T | null | undefined | false,
  timeout = 5000,
  interval = 250,
): Promise<T | null> {
  return new Promise((resolve) => {
    const start = Date.now()
    const id = setInterval(() => {
      const result = check()
      if (result) { clearInterval(id); resolve(result as T) }
      else if (Date.now() - start > timeout) { clearInterval(id); resolve(null) }
    }, interval)
  })
}
